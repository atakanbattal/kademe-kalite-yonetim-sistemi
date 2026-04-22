-- ============================================================================
-- KALİTESİZLİK MALİYETİ OTOMASYONLARI
-- Anomali tespiti, otomatik hesaplama, bildirimler
-- ============================================================================

-- 1. Maliyet Anomalisi Tespiti ve Bildirim
CREATE OR REPLACE FUNCTION detect_cost_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    v_monthly_avg NUMERIC;
    v_current_month_total NUMERIC;
    v_anomaly_threshold NUMERIC := 1.5; -- %50 artış = 1.5x
    v_admin_user_ids UUID[];
    v_unit TEXT;
BEGIN
    -- Sadece yeni kayıtlar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Maliyet tarihi ve birim kontrolü
    IF NEW.cost_date IS NULL OR NEW.unit IS NULL THEN
        RETURN NEW;
    END IF;
    
    v_unit := NEW.unit;
    
    -- Son 3 ayın ortalamasını hesapla
    SELECT AVG(amount) INTO v_monthly_avg
    FROM quality_costs
    WHERE unit = v_unit
      AND cost_date >= DATE_TRUNC('month', NEW.cost_date) - INTERVAL '3 months'
      AND cost_date < DATE_TRUNC('month', NEW.cost_date)
      AND id != NEW.id;
    
    -- Ortalama yoksa (ilk kayıt) devam et
    IF v_monthly_avg IS NULL OR v_monthly_avg = 0 THEN
        RETURN NEW;
    END IF;
    
    -- Bu ayın toplamını hesapla
    SELECT COALESCE(SUM(amount), 0) INTO v_current_month_total
    FROM quality_costs
    WHERE unit = v_unit
      AND DATE_TRUNC('month', cost_date) = DATE_TRUNC('month', NEW.cost_date);
    
    -- Anomali kontrolü (%50+ artış)
    IF v_current_month_total > (v_monthly_avg * v_anomaly_threshold) THEN
        -- Admin kullanıcılarını bul
        SELECT array_agg(u.id) INTO v_admin_user_ids
        FROM auth.users u
        JOIN profiles p ON p.id = u.id
        WHERE p.role = 'admin'
        LIMIT 10;
        
        -- Bildirim oluştur
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                'COST_ANOMALY',
                format('Maliyet Anomalisi: %s Birimi', v_unit),
                format('%s biriminde bu ayki toplam maliyet (%.2f ₺) son 3 ayın ortalamasından (%.2f ₺) %%%.0f daha yüksek.', 
                    v_unit,
                    v_current_month_total,
                    v_monthly_avg,
                    ((v_current_month_total / v_monthly_avg - 1) * 100)
                ),
                'quality-cost',
                NEW.id,
                'HIGH',
                format('/quality-cost?unit=%s', v_unit)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Maliyet anomalisi tespit edilemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_detect_cost_anomaly ON quality_costs;
CREATE TRIGGER trigger_detect_cost_anomaly
    AFTER INSERT ON quality_costs
    FOR EACH ROW
    EXECUTE FUNCTION detect_cost_anomaly();

-- ============================================================================
-- 2. Produced Vehicles'tan Otomatik Maliyet Kaydı Oluşturma
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_cost_from_produced_vehicle()
RETURNS TRIGGER AS $$
DECLARE
    v_cost_amount NUMERIC;
    v_unit_cost_setting RECORD;
    v_cost_id UUID;
BEGIN
    -- Sadece final hataları için ve maliyet kaydı yoksa
    IF NEW.final_faults IS NULL OR NEW.final_faults = '[]'::jsonb THEN
        RETURN NEW;
    END IF;
    
    -- Bu araç için zaten maliyet kaydı var mı kontrol et
    SELECT id INTO v_cost_id
    FROM quality_costs
    WHERE source_type = 'produced_vehicle_final_faults'
      AND source_id = NEW.id
    LIMIT 1;
    
    -- Zaten varsa devam et
    IF v_cost_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Birim maliyet ayarını bul
    SELECT * INTO v_unit_cost_setting
    FROM cost_settings
    WHERE unit_name = NEW.production_department
    LIMIT 1;
    
    -- Birim maliyet yoksa devam et
    IF v_unit_cost_setting IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Final hatalarını parse et ve maliyet hesapla
    -- Bu kısım frontend'de yapılıyor, burada sadece trigger olarak ekliyoruz
    -- Gerçek hesaplama vehicleCostCalculator.js'de yapılıyor
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Produced vehicle maliyet kaydı oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (şimdilik pasif - frontend'de yapılıyor)
-- DROP TRIGGER IF EXISTS trigger_auto_create_cost_from_produced_vehicle ON produced_vehicles;
-- CREATE TRIGGER trigger_auto_create_cost_from_produced_vehicle
--     AFTER INSERT OR UPDATE OF final_faults ON produced_vehicles
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_create_cost_from_produced_vehicle();

-- ============================================================================
-- 3. COPQ Otomatik Hesaplama Fonksiyonu
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_copq(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
    internal_failure NUMERIC,
    external_failure NUMERIC,
    appraisal NUMERIC,
    prevention NUMERIC,
    total_copq NUMERIC,
    unit TEXT
) AS $$
DECLARE
    v_start_date DATE := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE));
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
    v_unit_filter TEXT := p_unit;
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE 
            WHEN qc.cost_type IN ('İç Hata Maliyetleri', 'Hurda', 'Yeniden İşlem', 'İç Hata') 
            THEN qc.amount ELSE 0 
        END), 0) as internal_failure,
        COALESCE(SUM(CASE 
            WHEN qc.cost_type IN ('Dış Hata Maliyetleri', 'Dış Hata', 'Müşteri Şikayeti') 
            THEN qc.amount ELSE 0 
        END), 0) as external_failure,
        COALESCE(SUM(CASE 
            WHEN qc.cost_type IN ('Değerlendirme Maliyetleri', 'Kontrol', 'Test', 'Muayene') 
            THEN qc.amount ELSE 0 
        END), 0) as appraisal,
        COALESCE(SUM(CASE 
            WHEN qc.cost_type IN ('Önleme Maliyetleri', 'Önleme', 'Eğitim', 'Kalite Planlama') 
            THEN qc.amount ELSE 0 
        END), 0) as prevention,
        COALESCE(SUM(qc.amount), 0) as total_copq,
        COALESCE(v_unit_filter, 'Tüm Birimler') as unit
    FROM quality_costs qc
    WHERE qc.cost_date >= v_start_date
      AND qc.cost_date <= v_end_date
      AND (v_unit_filter IS NULL OR qc.unit = v_unit_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_copq IS 'COPQ (Cost of Poor Quality) hesaplar: İç Hata + Dış Hata + Değerlendirme + Önleme';

-- ============================================================================
-- 4. Aylık COPQ Raporu Otomatik Oluşturma (Cron Job için)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_monthly_copq_report()
RETURNS void AS $$
DECLARE
    v_last_month_start DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    v_last_month_end DATE := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day';
    v_copq_data RECORD;
    v_admin_user_ids UUID[];
    v_report_text TEXT;
BEGIN
    -- Admin kullanıcılarını bul
    SELECT array_agg(u.id) INTO v_admin_user_ids
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE p.role = 'admin'
    LIMIT 10;
    
    IF v_admin_user_ids IS NULL OR array_length(v_admin_user_ids, 1) = 0 THEN
        RETURN;
    END IF;
    
    -- Tüm birimler için COPQ hesapla
    FOR v_copq_data IN
        SELECT 
            unit,
            calculate_copq(v_last_month_start, v_last_month_end, unit).*
        FROM (
            SELECT DISTINCT unit FROM quality_costs
            WHERE cost_date >= v_last_month_start AND cost_date <= v_last_month_end
        ) units
    LOOP
        v_report_text := format(
            E'%s Birimi - Geçen Ay COPQ Raporu:\n\n' ||
            E'İç Hata Maliyetleri: %.2f ₺\n' ||
            E'Dış Hata Maliyetleri: %.2f ₺\n' ||
            E'Değerlendirme Maliyetleri: %.2f ₺\n' ||
            E'Önleme Maliyetleri: %.2f ₺\n' ||
            E'TOPLAM COPQ: %.2f ₺',
            v_copq_data.unit,
            v_copq_data.internal_failure,
            v_copq_data.external_failure,
            v_copq_data.appraisal,
            v_copq_data.prevention,
            v_copq_data.total_copq
        );
        
        -- Bildirim oluştur
        PERFORM create_notifications_for_users(
            v_admin_user_ids,
            'COST_ANOMALY',
            format('Aylık COPQ Raporu: %s', v_copq_data.unit),
            v_report_text,
            'quality-cost',
            NULL,
            'NORMAL',
            format('/quality-cost?dateRange=lastMonth&unit=%s', v_copq_data.unit)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_monthly_copq_report IS 'Aylık COPQ raporlarını otomatik oluşturur. Supabase Cron veya Edge Function ile çağrılmalıdır.';

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION detect_cost_anomaly IS 'Maliyet anomalilerini tespit eder ve bildirim gönderir';
COMMENT ON FUNCTION auto_create_cost_from_produced_vehicle IS 'Produced vehicles final hatalarından otomatik maliyet kaydı oluşturur';
COMMENT ON FUNCTION generate_monthly_copq_report IS 'Aylık COPQ raporlarını otomatik oluşturur';

