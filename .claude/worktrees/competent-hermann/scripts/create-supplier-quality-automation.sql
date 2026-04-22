-- ============================================================================
-- TEDARİKÇİ KALİTE OTOMASYONLARI
-- PPM, OTD hesaplama, otomatik değerlendirme, bildirimler
-- ============================================================================

-- 1. PPM (Parts Per Million) Otomatik Hesaplama
CREATE OR REPLACE FUNCTION calculate_supplier_ppm(
    p_supplier_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_received INTEGER := 0;
    v_total_rejected INTEGER := 0;
    v_ppm NUMERIC := 0;
    v_start_date DATE := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE));
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    -- Toplam alınan miktar
    SELECT COALESCE(SUM(quantity_received), 0) INTO v_total_received
    FROM incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND inspection_date >= v_start_date
      AND inspection_date <= v_end_date;
    
    -- Toplam red edilen miktar
    SELECT COALESCE(SUM(quantity_rejected), 0) INTO v_total_rejected
    FROM incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND decision = 'Red'
      AND inspection_date >= v_start_date
      AND inspection_date <= v_end_date;
    
    -- PPM hesapla: (Red / Alınan) * 1,000,000
    IF v_total_received > 0 THEN
        v_ppm := (v_total_rejected::NUMERIC / v_total_received::NUMERIC) * 1000000;
    END IF;
    
    RETURN v_ppm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. OTD (On-Time Delivery) Otomatik Hesaplama
CREATE OR REPLACE FUNCTION calculate_supplier_otd(
    p_supplier_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_deliveries INTEGER := 0;
    v_on_time_deliveries INTEGER := 0;
    v_otd_percentage NUMERIC := 0;
    v_start_date DATE := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE));
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    -- Toplam teslimat sayısı (incoming_inspections tablosundan)
    SELECT COUNT(*) INTO v_total_deliveries
    FROM incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND inspection_date >= v_start_date
      AND inspection_date <= v_end_date;
    
    -- Zamanında teslimat sayısı (expected_date ve inspection_date karşılaştırması)
    -- Not: expected_date kolonu yoksa, inspection_date kullanılır
    SELECT COUNT(*) INTO v_on_time_deliveries
    FROM incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND inspection_date >= v_start_date
      AND inspection_date <= v_end_date
      AND (
          expected_date IS NULL 
          OR inspection_date <= expected_date
          OR inspection_date <= expected_date + INTERVAL '3 days' -- 3 gün tolerans
      );
    
    -- OTD yüzdesi hesapla
    IF v_total_deliveries > 0 THEN
        v_otd_percentage := (v_on_time_deliveries::NUMERIC / v_total_deliveries::NUMERIC) * 100;
    END IF;
    
    RETURN v_otd_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tedarikçi Performansını Otomatik Güncelleme
CREATE OR REPLACE FUNCTION update_supplier_performance()
RETURNS TRIGGER AS $$
DECLARE
    v_ppm NUMERIC;
    v_otd NUMERIC;
    v_current_month_ppm NUMERIC;
    v_current_month_otd NUMERIC;
    v_supplier_id UUID;
BEGIN
    -- Girdi kalite kontrol kaydı eklendiğinde/güncellendiğinde
    IF TG_TABLE_NAME = 'incoming_inspections' THEN
        v_supplier_id := COALESCE(NEW.supplier_id, OLD.supplier_id);
    ELSE
        RETURN NULL;
    END IF;
    
    IF v_supplier_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Son 12 ayın PPM ve OTD'sini hesapla
    v_ppm := calculate_supplier_ppm(v_supplier_id, CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE);
    v_otd := calculate_supplier_otd(v_supplier_id, CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE);
    
    -- Bu ayın PPM ve OTD'sini hesapla
    v_current_month_ppm := calculate_supplier_ppm(v_supplier_id, DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE);
    v_current_month_otd := calculate_supplier_otd(v_supplier_id, DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE);
    
    -- Tedarikçi performansını güncelle
    UPDATE suppliers
    SET 
        ppm = v_ppm,
        otd_percentage = v_otd,
        current_month_ppm = v_current_month_ppm,
        current_month_otd = v_current_month_otd,
        last_performance_update = NOW()
    WHERE id = v_supplier_id;
    
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tedarikçi performansı güncellenemedi: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_update_supplier_performance ON incoming_inspections;
CREATE TRIGGER trigger_update_supplier_performance
    AFTER INSERT OR UPDATE OF decision, quantity_received, quantity_rejected ON incoming_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_performance();

-- 4. Yıllık Değerlendirme Otomatik Hesaplama (A-B-C Sınıfı)
CREATE OR REPLACE FUNCTION calculate_supplier_rating(
    p_supplier_id UUID,
    p_year INTEGER DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_year INTEGER := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
    v_year_start DATE := make_date(v_year, 1, 1);
    v_year_end DATE := make_date(v_year, 12, 31);
    v_ppm NUMERIC;
    v_otd NUMERIC;
    v_rating TEXT;
    v_nc_count INTEGER;
BEGIN
    -- Yılın PPM ve OTD'sini hesapla
    v_ppm := calculate_supplier_ppm(p_supplier_id, v_year_start, v_year_end);
    v_otd := calculate_supplier_otd(p_supplier_id, v_year_start, v_year_end);
    
    -- Yılın NC sayısını hesapla
    SELECT COUNT(*) INTO v_nc_count
    FROM supplier_non_conformities
    WHERE supplier_id = p_supplier_id
      AND created_at >= v_year_start
      AND created_at <= v_year_end;
    
    -- Değerlendirme kriterleri:
    -- A Sınıfı: PPM < 100, OTD > 95%, NC < 3
    -- B Sınıfı: PPM < 500, OTD > 90%, NC < 10
    -- C Sınıfı: Diğerleri
    
    IF v_ppm < 100 AND v_otd > 95 AND v_nc_count < 3 THEN
        v_rating := 'A';
    ELSIF v_ppm < 500 AND v_otd > 90 AND v_nc_count < 10 THEN
        v_rating := 'B';
    ELSE
        v_rating := 'C';
    END IF;
    
    RETURN v_rating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Tedarikçi Performansı Düştüğünde Bildirim
CREATE OR REPLACE FUNCTION notify_supplier_performance_decline()
RETURNS TRIGGER AS $$
DECLARE
    v_old_ppm NUMERIC;
    v_new_ppm NUMERIC;
    v_old_otd NUMERIC;
    v_new_otd NUMERIC;
    v_admin_user_ids UUID[];
BEGIN
    -- Sadece performans güncellemelerinde
    IF OLD.ppm IS NULL AND OLD.otd_percentage IS NULL THEN
        RETURN NEW;
    END IF;
    
    v_old_ppm := COALESCE(OLD.ppm, 0);
    v_new_ppm := COALESCE(NEW.ppm, 0);
    v_old_otd := COALESCE(OLD.otd_percentage, 100);
    v_new_otd := COALESCE(NEW.otd_percentage, 100);
    
    -- Performans düşüşü kontrolü (%20+ kötüleşme)
    IF (v_new_ppm > v_old_ppm * 1.2 OR v_new_otd < v_old_otd * 0.8) AND v_old_ppm > 0 THEN
        -- Admin kullanıcılarını bul
        SELECT array_agg(u.id) INTO v_admin_user_ids
        FROM auth.users u
        JOIN profiles p ON p.id = u.id
        WHERE p.role = 'admin'
        LIMIT 10;
        
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                'SUPPLIER_REJECTION',
                format('Tedarikçi Performans Düşüşü: %s', NEW.name),
                format('%s tedarikçisinin performansı düştü:%s%s', 
                    NEW.name,
                    CASE WHEN v_new_ppm > v_old_ppm * 1.2 THEN 
                        format(E'\n\nPPM: %.0f → %.0f (%%%.0f artış)', v_old_ppm, v_new_ppm, ((v_new_ppm / v_old_ppm - 1) * 100))
                    ELSE '' END,
                    CASE WHEN v_new_otd < v_old_otd * 0.8 THEN 
                        format(E'\n\nOTD: %.1f%% → %.1f%% (%%%.0f azalış)', v_old_otd, v_new_otd, ((1 - v_new_otd / v_old_otd) * 100))
                    ELSE '' END
                ),
                'supplier-quality',
                NEW.id,
                'HIGH',
                format('/supplier-quality?supplier_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tedarikçi performans bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_supplier_performance_decline ON suppliers;
CREATE TRIGGER trigger_notify_supplier_performance_decline
    AFTER UPDATE OF ppm, otd_percentage ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION notify_supplier_performance_decline();

-- 6. Girdi Kalite Red Kayıtlarından Otomatik Tedarikçi NC Oluşturma
CREATE OR REPLACE FUNCTION auto_create_supplier_nc_from_rejection()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_nc_id UUID;
BEGIN
    -- Sadece red edilen kayıtlar için
    IF NEW.decision != 'Red' THEN
        RETURN NEW;
    END IF;
    
    -- Tedarikçi yoksa devam et
    IF NEW.supplier_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Zaten NC oluşturulmuş mu kontrol et
    SELECT id INTO v_supplier_nc_id
    FROM supplier_non_conformities
    WHERE source_inspection_id = NEW.id
    LIMIT 1;
    
    -- Zaten varsa devam et
    IF v_supplier_nc_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Tedarikçi NC oluştur
    INSERT INTO supplier_non_conformities (
        supplier_id,
        title,
        description,
        status,
        source_inspection_id,
        created_at
    ) VALUES (
        NEW.supplier_id,
        format('Girdi Kalite Red: %s', COALESCE(NEW.part_name, NEW.part_code, 'Parça')),
        format('Girdi kalite kontrolünden red edildi.%s%s%s', 
            CASE WHEN NEW.rejection_reason IS NOT NULL THEN E'\n\nRed Sebebi: ' || NEW.rejection_reason ELSE '' END,
            CASE WHEN NEW.quantity_rejected IS NOT NULL THEN E'\n\nRed Edilen Miktar: ' || NEW.quantity_rejected || ' ' || COALESCE(NEW.unit, 'Adet') ELSE '' END,
            CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nNotlar: ' || NEW.notes ELSE '' END
        ),
        'Açık',
        NEW.id,
        NOW()
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tedarikçi NC oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_create_supplier_nc_from_rejection ON incoming_inspections;
CREATE TRIGGER trigger_auto_create_supplier_nc_from_rejection
    AFTER INSERT OR UPDATE OF decision ON incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision = 'Red' AND NEW.supplier_id IS NOT NULL)
    EXECUTE FUNCTION auto_create_supplier_nc_from_rejection();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION calculate_supplier_ppm IS 'Tedarikçi PPM (Parts Per Million) değerini hesaplar';
COMMENT ON FUNCTION calculate_supplier_otd IS 'Tedarikçi OTD (On-Time Delivery) yüzdesini hesaplar';
COMMENT ON FUNCTION update_supplier_performance IS 'Tedarikçi performansını otomatik günceller';
COMMENT ON FUNCTION calculate_supplier_rating IS 'Tedarikçi yıllık değerlendirmesini hesaplar (A-B-C sınıfı)';
COMMENT ON FUNCTION notify_supplier_performance_decline IS 'Tedarikçi performansı düştüğünde bildirim gönderir';
COMMENT ON FUNCTION auto_create_supplier_nc_from_rejection IS 'Girdi kalite red kayıtlarından otomatik tedarikçi NC oluşturur';

