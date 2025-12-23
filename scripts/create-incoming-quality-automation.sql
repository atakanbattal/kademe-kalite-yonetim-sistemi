-- ============================================================================
-- GİRDİ KALİTE KONTROL OTOMASYONLARI
-- Otomatik karar önerileri, bildirimler, entegrasyonlar
-- ============================================================================

-- 1. Red Edilen Parçalar için Tedarikçiye Otomatik Bildirim
CREATE OR REPLACE FUNCTION notify_supplier_on_rejection()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_email TEXT;
    v_supplier_name TEXT;
    v_admin_user_ids UUID[];
BEGIN
    -- Sadece red edilen kayıtlar için
    IF NEW.decision != 'Red' THEN
        RETURN NEW;
    END IF;
    
    -- Tedarikçi bilgilerini al
    SELECT s.email, s.name INTO v_supplier_email, v_supplier_name
    FROM suppliers s
    WHERE s.id = NEW.supplier_id
    LIMIT 1;
    
    -- Admin kullanıcılarına bildirim gönder (tedarikçi portalına yansıtılacak)
    SELECT array_agg(u.id) INTO v_admin_user_ids
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE p.role = 'admin'
    LIMIT 10;
    
    IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_admin_user_ids,
            'SUPPLIER_REJECTION',
            format('Tedarikçi Red Bildirimi: %s', COALESCE(v_supplier_name, 'Tedarikçi')),
            format('%s tedarikçisinden gelen %s parçası red edildi.%s%s', 
                COALESCE(v_supplier_name, 'Tedarikçi'),
                COALESCE(NEW.part_name, NEW.part_code, 'Parça'),
                CASE WHEN NEW.rejection_reason IS NOT NULL THEN E'\n\nRed Sebebi: ' || NEW.rejection_reason ELSE '' END,
                CASE WHEN NEW.quantity_rejected IS NOT NULL THEN E'\n\nRed Edilen Miktar: ' || NEW.quantity_rejected || ' ' || COALESCE(NEW.unit, 'Adet') ELSE '' END
            ),
            'incoming-quality',
            NEW.id,
            'HIGH',
            format('/incoming-quality?inspection_id=%s', NEW.id)
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tedarikçi red bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_supplier_on_rejection ON incoming_inspections;
CREATE TRIGGER trigger_notify_supplier_on_rejection
    AFTER INSERT OR UPDATE OF decision ON incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision = 'Red' AND NEW.supplier_id IS NOT NULL)
    EXECUTE FUNCTION notify_supplier_on_rejection();

-- 2. Şartlı Kabul Edilen Parçalar için Uyarı
CREATE OR REPLACE FUNCTION notify_conditional_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    v_responsible_user_ids UUID[];
BEGIN
    -- Sadece şartlı kabul edilen kayıtlar için
    IF NEW.decision != 'Şartlı Kabul' THEN
        RETURN NEW;
    END IF;
    
    -- İlgili birimlerin personellerine bildirim gönder
    SELECT array_agg(DISTINCT u.id) INTO v_responsible_user_ids
    FROM auth.users u
    JOIN personnel p ON p.email = u.email
    WHERE p.department = 'Kalite Kontrol' OR p.department = 'Girdi Kalite Kontrol'
    LIMIT 10;
    
    IF v_responsible_user_ids IS NOT NULL AND array_length(v_responsible_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_responsible_user_ids,
            'SUPPLIER_REJECTION',
            format('Şartlı Kabul: %s', COALESCE(NEW.part_name, NEW.part_code, 'Parça')),
            format('%s parçası şartlı kabul edildi. Dikkatli kullanılmalıdır.%s', 
                COALESCE(NEW.part_name, NEW.part_code, 'Parça'),
                CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nNotlar: ' || NEW.notes ELSE '' END
            ),
            'incoming-quality',
            NEW.id,
            'NORMAL',
            format('/incoming-quality?inspection_id=%s', NEW.id)
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Şartlı kabul bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_conditional_acceptance ON incoming_inspections;
CREATE TRIGGER trigger_notify_conditional_acceptance
    AFTER INSERT OR UPDATE OF decision ON incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision = 'Şartlı Kabul')
    EXECUTE FUNCTION notify_conditional_acceptance();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION notify_supplier_on_rejection IS 'Red edilen parçalar için tedarikçiye otomatik bildirim gönderir';
COMMENT ON FUNCTION notify_conditional_acceptance IS 'Şartlı kabul edilen parçalar için uyarı bildirimi gönderir';

