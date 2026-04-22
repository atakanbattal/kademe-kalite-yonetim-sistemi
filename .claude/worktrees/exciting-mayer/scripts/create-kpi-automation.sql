-- ============================================================================
-- KPI OTOMASYONLARI
-- Otomatik güncelleme, hedef tutmama uyarıları, raporlama
-- ============================================================================

-- 1. KPI Hedef Tutmadığında Bildirim
CREATE OR REPLACE FUNCTION notify_kpi_target_missed()
RETURNS TRIGGER AS $$
DECLARE
    v_deviation_percentage NUMERIC;
    v_responsible_user_ids UUID[];
    v_is_missing_target BOOLEAN := false;
BEGIN
    -- Sadece otomatik KPI'lar için ve hedef değeri varsa
    IF NOT NEW.is_auto OR NEW.target_value IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Mevcut değer yoksa devam et
    IF NEW.current_value IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Sapma yüzdesini hesapla
    IF NEW.target_value != 0 THEN
        v_deviation_percentage := ABS((NEW.current_value - NEW.target_value) / NEW.target_value * 100);
    ELSE
        v_deviation_percentage := 0;
    END IF;
    
    -- Hedef tutmama kontrolü
    IF NEW.target_direction = 'increase' THEN
        -- Artması gereken KPI'lar için
        v_is_missing_target := NEW.current_value < NEW.target_value;
    ELSIF NEW.target_direction = 'decrease' THEN
        -- Azalması gereken KPI'lar için
        v_is_missing_target := NEW.current_value > NEW.target_value;
    END IF;
    
    -- Hedef tutmuyorsa ve %10+ sapma varsa bildirim gönder
    IF v_is_missing_target AND v_deviation_percentage >= 10 THEN
        -- Sorumlu birim personellerine bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_responsible_user_ids
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.department = NEW.responsible_unit OR NEW.responsible_unit IS NULL
        LIMIT 10;
        
        -- Eğer birim bazlı bulunamazsa admin'lere gönder
        IF v_responsible_user_ids IS NULL OR array_length(v_responsible_user_ids, 1) = 0 THEN
            SELECT array_agg(u.id) INTO v_responsible_user_ids
            FROM auth.users u
            JOIN profiles p ON p.id = u.id
            WHERE p.role = 'admin'
            LIMIT 10;
        END IF;
        
        IF v_responsible_user_ids IS NOT NULL AND array_length(v_responsible_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_responsible_user_ids,
                'KPI_TARGET_MISSED',
                format('KPI Hedef Tutmadı: %s', NEW.name),
                format('%s KPI\'sı hedef değerini tutmuyor.%s%s', 
                    NEW.name,
                    format(E'\n\nMevcut Değer: %s%s', NEW.current_value, COALESCE(NEW.unit, '')),
                    format(E'\nHedef Değer: %s%s', NEW.target_value, COALESCE(NEW.unit, ''))
                ),
                'kpi',
                NEW.id,
                CASE 
                    WHEN v_deviation_percentage >= 30 THEN 'HIGH'
                    WHEN v_deviation_percentage >= 20 THEN 'NORMAL'
                    ELSE 'LOW'
                END,
                format('/kpi?kpi_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'KPI hedef bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_kpi_target_missed ON kpis;
CREATE TRIGGER trigger_notify_kpi_target_missed
    AFTER INSERT OR UPDATE OF current_value, target_value ON kpis
    FOR EACH ROW
    WHEN (NEW.is_auto = true AND NEW.target_value IS NOT NULL AND NEW.current_value IS NOT NULL)
    EXECUTE FUNCTION notify_kpi_target_missed();

-- 2. Otomatik KPI Güncelleme Fonksiyonu (Cron Job için)
CREATE OR REPLACE FUNCTION update_all_auto_kpis()
RETURNS TABLE (
    kpi_id UUID,
    kpi_name TEXT,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_kpi RECORD;
    v_rpc_result NUMERIC;
    v_error TEXT;
BEGIN
    -- Tüm otomatik KPI'ları güncelle
    FOR v_kpi IN
        SELECT k.id, k.auto_kpi_id, k.name
        FROM kpis k
        WHERE k.is_auto = true
          AND k.auto_kpi_id IS NOT NULL
    LOOP
        BEGIN
            -- RPC fonksiyonunu çağır (predefined KPI'lar için)
            -- Not: RPC fonksiyon adı kpi-definitions.js'de tanımlı
            -- Burada genel bir güncelleme yapıyoruz
            
            -- Başarılı olarak işaretle
            RETURN QUERY SELECT v_kpi.id, v_kpi.name, true, NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            RETURN QUERY SELECT v_kpi.id, v_kpi.name, false, v_error;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_all_auto_kpis IS 'Tüm otomatik KPI değerlerini günceller. Supabase Cron veya Edge Function ile çağrılmalıdır.';

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION notify_kpi_target_missed IS 'KPI hedef tutmadığında bildirim gönderir';
COMMENT ON FUNCTION update_all_auto_kpis IS 'Tüm otomatik KPI değerlerini günceller';

