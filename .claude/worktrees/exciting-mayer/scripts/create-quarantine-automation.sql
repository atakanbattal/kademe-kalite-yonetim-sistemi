-- ============================================================================
-- KARANTİNA OTOMASYONLARI
-- Otomatik NC oluşturma, bildirimler, entegrasyonlar
-- ============================================================================

-- 1. Kritik Karantina Kayıtlarından Otomatik NC Oluşturma
CREATE OR REPLACE FUNCTION auto_create_nc_from_quarantine()
RETURNS TRIGGER AS $$
DECLARE
    v_nc_id UUID;
    v_nc_number TEXT;
    v_days_in_quarantine INTEGER;
    v_is_critical BOOLEAN := false;
BEGIN
    -- Sadece yeni kayıtlar veya kritik duruma geçenler için
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Karantinada bekleyen kayıtlar için kontrol
    IF NEW.status NOT IN ('Karantinada', 'Onay Bekliyor') THEN
        RETURN NEW;
    END IF;
    
    -- Zaten NC oluşturulmuş mu kontrol et
    IF NEW.non_conformity_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Karantinada kalma süresi
    v_days_in_quarantine := EXTRACT(DAY FROM (NOW() - NEW.quarantine_date))::INTEGER;
    
    -- Kritik kriterler:
    -- 1. 14+ gün karantinada bekliyor
    -- 2. Miktar yüksek (100+ adet)
    -- 3. Kritik parça (is_critical flag'i varsa)
    v_is_critical := (
        v_days_in_quarantine >= 14
        OR (NEW.quantity IS NOT NULL AND NEW.quantity >= 100)
        OR (NEW.is_critical = true)
    );
    
    -- Kritik değilse devam et
    IF NOT v_is_critical THEN
        RETURN NEW;
    END IF;
    
    -- NC numarası oluştur
    SELECT generate_nc_number('DF') INTO v_nc_number;
    
    -- NC kaydı oluştur
    INSERT INTO non_conformities (
        nc_number,
        title,
        description,
        type,
        status,
        priority,
        department,
        requesting_unit,
        requesting_person,
        opening_date,
        source_quarantine_id,
        part_code,
        part_name,
        quantity,
        notes
    ) VALUES (
        v_nc_number,
        format('Karantina Kaydı: %s', COALESCE(NEW.part_name, NEW.part_code, 'Parça')),
        format('Karantina kaydından otomatik oluşturuldu.%s%s%s', 
            CASE WHEN NEW.reason IS NOT NULL THEN E'\n\nSebep: ' || NEW.reason ELSE '' END,
            CASE WHEN NEW.description IS NOT NULL THEN E'\n\nAçıklama: ' || NEW.description ELSE '' END,
            CASE WHEN v_days_in_quarantine > 0 THEN E'\n\nKarantinada ' || v_days_in_quarantine || ' gündür bekliyor.' ELSE '' END
        ),
        'DF',
        'Açık',
        CASE 
            WHEN v_days_in_quarantine >= 21 THEN 'Kritik'
            WHEN v_days_in_quarantine >= 14 THEN 'Yüksek'
            ELSE 'Orta'
        END,
        NEW.requesting_department,
        NEW.requesting_department,
        NEW.requesting_person_name,
        NEW.quarantine_date,
        NEW.id,
        NEW.part_code,
        NEW.part_name,
        NEW.quantity,
        format('Otomatik oluşturuldu - Karantina Kayıt No: %s', NEW.id)
    ) RETURNING id INTO v_nc_id;
    
    -- Karantina kaydını NC ile ilişkilendir
    IF v_nc_id IS NOT NULL THEN
        UPDATE quarantine_records
        SET non_conformity_id = v_nc_id,
            nc_number = v_nc_number
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Karantina NC oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_create_nc_from_quarantine ON quarantine_records;
CREATE TRIGGER trigger_auto_create_nc_from_quarantine
    AFTER INSERT OR UPDATE OF status, quarantine_date ON quarantine_records
    FOR EACH ROW
    WHEN (NEW.status IN ('Karantinada', 'Onay Bekliyor') AND NEW.non_conformity_id IS NULL)
    EXECUTE FUNCTION auto_create_nc_from_quarantine();

-- ============================================================================
-- 2. Karantina Kaydı Oluşturulduğunda Bildirim
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_quarantine_opened()
RETURNS TRIGGER AS $$
DECLARE
    v_responsible_user_ids UUID[];
BEGIN
    -- Sadece yeni kayıtlar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- İlgili birimlerin personellerine bildirim gönder
    SELECT array_agg(DISTINCT u.id) INTO v_responsible_user_ids
    FROM auth.users u
    JOIN personnel p ON p.email = u.email
    WHERE p.department = NEW.requesting_department 
       OR p.department = NEW.source_department
    LIMIT 10;
    
    IF v_responsible_user_ids IS NOT NULL AND array_length(v_responsible_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_responsible_user_ids,
            'QUARANTINE_OPENED',
            format('Yeni Karantina Kaydı: %s', COALESCE(NEW.part_name, NEW.part_code, 'Parça')),
            format('%s parçası karantinaya alındı.%s', 
                COALESCE(NEW.part_name, NEW.part_code, 'Parça'),
                CASE WHEN NEW.reason IS NOT NULL THEN E'\n\nSebep: ' || NEW.reason ELSE '' END
            ),
            'quarantine',
            NEW.id,
            CASE 
                WHEN NEW.quantity IS NOT NULL AND NEW.quantity >= 100 THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            format('/quarantine?record_id=%s', NEW.id)
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Karantina bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_quarantine_opened ON quarantine_records;
CREATE TRIGGER trigger_notify_quarantine_opened
    AFTER INSERT ON quarantine_records
    FOR EACH ROW
    EXECUTE FUNCTION notify_quarantine_opened();

-- ============================================================================
-- 3. Girdi Kalite Red Kayıtlarından Otomatik Karantina Oluşturma
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_quarantine_from_rejection()
RETURNS TRIGGER AS $$
DECLARE
    v_quarantine_id UUID;
BEGIN
    -- Sadece red edilen kayıtlar için
    IF NEW.decision != 'Red' THEN
        RETURN NEW;
    END IF;
    
    -- Zaten karantina kaydı var mı kontrol et
    SELECT id INTO v_quarantine_id
    FROM quarantine_records
    WHERE source_inspection_id = NEW.id
    LIMIT 1;
    
    -- Zaten varsa devam et
    IF v_quarantine_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Karantina kaydı oluştur
    INSERT INTO quarantine_records (
        quarantine_date,
        part_code,
        part_name,
        lot_no,
        quantity,
        unit,
        reason,
        source_department,
        requesting_department,
        requesting_person_name,
        status,
        source_inspection_id,
        description
    ) VALUES (
        NEW.inspection_date,
        NEW.part_code,
        NEW.part_name,
        NEW.lot_no,
        NEW.quantity_rejected,
        'Adet',
        format('Girdi kalite kontrolünden red edildi - Kayıt No: %s', NEW.record_no),
        'Girdi Kalite Kontrol',
        'Girdi Kalite Kontrol',
        COALESCE((SELECT full_name FROM personnel WHERE id = NEW.inspector_id LIMIT 1), 'Sistem'),
        'Karantinada',
        NEW.id,
        format('Girdi kalite kontrol kaydından otomatik oluşturuldu.%s%s', 
            CASE WHEN NEW.rejection_reason IS NOT NULL THEN E'\n\nRed Sebebi: ' || NEW.rejection_reason ELSE '' END,
            CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nNotlar: ' || NEW.notes ELSE '' END
        )
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Girdi kalite karantina kaydı oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_create_quarantine_from_rejection ON incoming_inspections;
CREATE TRIGGER trigger_auto_create_quarantine_from_rejection
    AFTER INSERT OR UPDATE OF decision ON incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision = 'Red')
    EXECUTE FUNCTION auto_create_quarantine_from_rejection();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION auto_create_nc_from_quarantine IS 'Kritik karantina kayıtlarından otomatik NC oluşturur';
COMMENT ON FUNCTION notify_quarantine_opened IS 'Karantina kaydı oluşturulduğunda bildirim gönderir';
COMMENT ON FUNCTION auto_create_quarantine_from_rejection IS 'Girdi kalite red kayıtlarından otomatik karantina oluşturur';

