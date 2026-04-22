-- ============================================================================
-- EKİPMAN KALİBRASYON OTOMASYONLARI
-- Otomatik görev oluşturma, durum güncelleme, bildirimler
-- ============================================================================

-- 1. Kalibrasyon Tarihi Yaklaşan Ekipmanlar için Otomatik Görev Oluşturma
CREATE OR REPLACE FUNCTION create_task_for_calibration()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_responsible_personnel_id UUID;
    v_equipment_name TEXT;
    v_days_until_due INTEGER;
    v_task_title TEXT;
    v_task_description TEXT;
BEGIN
    -- Sadece aktif kalibrasyonlar için
    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;
    
    -- Sonraki kalibrasyon tarihi kontrolü
    IF NEW.next_calibration_date IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Kalan gün hesapla
    v_days_until_due := EXTRACT(DAY FROM (NEW.next_calibration_date - NOW()))::INTEGER;
    
    -- 30 gün kala veya geçmişse görev oluştur
    IF v_days_until_due <= 30 THEN
        -- Ekipman adını al
        SELECT name INTO v_equipment_name
        FROM equipments
        WHERE id = NEW.equipment_id;
        
        -- Sorumlu birimin personelini bul
        SELECT p.id INTO v_responsible_personnel_id
        FROM personnel p
        JOIN equipments e ON e.responsible_unit = p.department
        WHERE e.id = NEW.equipment_id
        LIMIT 1;
        
        -- Eğer birim bazlı bulunamazsa, ekipmanı kullanan personellere bak
        IF v_responsible_personnel_id IS NULL THEN
            SELECT ea.personnel_id INTO v_responsible_personnel_id
            FROM equipment_assignments ea
            WHERE ea.equipment_id = NEW.equipment_id 
              AND ea.is_active = true
            LIMIT 1;
        END IF;
        
        -- Personel bulunamazsa devam et
        IF v_responsible_personnel_id IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Zaten görev var mı kontrol et
        SELECT t.id INTO v_task_id
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        WHERE t.title LIKE '%' || COALESCE(v_equipment_name, '') || '%'
          AND t.title LIKE '%Kalibrasyon%'
          AND ta.personnel_id = v_responsible_personnel_id
          AND t.status NOT IN ('Tamamlandı', 'İptal')
        LIMIT 1;
        
        -- Görev yoksa oluştur
        IF v_task_id IS NULL THEN
            v_task_title := format('Kalibrasyon: %s', COALESCE(v_equipment_name, 'Ekipman'));
            
            v_task_description := format('Ekipman kalibrasyonu %s.%s%s', 
                CASE 
                    WHEN v_days_until_due < 0 THEN format('%s gün gecikmiş', ABS(v_days_until_due))
                    WHEN v_days_until_due = 0 THEN 'bugün'
                    ELSE format('%s gün sonra', v_days_until_due)
                END,
                CASE WHEN NEW.next_calibration_date IS NOT NULL THEN 
                    E'\n\nKalibrasyon Tarihi: ' || TO_CHAR(NEW.next_calibration_date, 'DD.MM.YYYY')
                ELSE '' END,
                CASE WHEN v_equipment_name IS NOT NULL THEN 
                    E'\n\nEkipman: ' || v_equipment_name
                ELSE '' END
            );
            
            -- Görev oluştur
            INSERT INTO tasks (
                title,
                description,
                status,
                priority,
                due_date,
                created_at
            ) VALUES (
                v_task_title,
                v_task_description,
                'Açık',
                CASE 
                    WHEN v_days_until_due < 0 THEN 'Kritik'
                    WHEN v_days_until_due <= 7 THEN 'Yüksek'
                    ELSE 'Orta'
                END,
                NEW.next_calibration_date,
                NOW()
            ) RETURNING id INTO v_task_id;
            
            -- Görevi sorumluya ata
            IF v_task_id IS NOT NULL THEN
                INSERT INTO task_assignees (task_id, personnel_id, assigned_at)
                VALUES (v_task_id, v_responsible_personnel_id, NOW())
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Kalibrasyon görevi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_create_task_for_calibration ON equipment_calibrations;
CREATE TRIGGER trigger_create_task_for_calibration
    AFTER INSERT OR UPDATE OF next_calibration_date, is_active ON equipment_calibrations
    FOR EACH ROW
    WHEN (NEW.is_active = true AND NEW.next_calibration_date IS NOT NULL)
    EXECUTE FUNCTION create_task_for_calibration();

-- 2. Kalibrasyon Süresi Geçen Ekipmanları Otomatik "Geçmiş" Olarak İşaretleme
CREATE OR REPLACE FUNCTION mark_overdue_calibrations()
RETURNS TRIGGER AS $$
DECLARE
    v_days_overdue INTEGER;
BEGIN
    -- Sadece aktif kalibrasyonlar için
    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;
    
    -- Sonraki kalibrasyon tarihi kontrolü
    IF NEW.next_calibration_date IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Gecikme günü hesapla
    v_days_overdue := EXTRACT(DAY FROM (NOW() - NEW.next_calibration_date))::INTEGER;
    
    -- Geçmişse ve ekipman durumu aktifse, ekipmanı "Kalibrasyon Gerekli" olarak işaretle
    IF v_days_overdue > 0 THEN
        UPDATE equipments
        SET status = 'Kalibrasyon Gerekli',
            updated_at = NOW()
        WHERE id = NEW.equipment_id
          AND status NOT IN ('Hurdaya Ayrıldı', 'Kalibrasyon Gerekli');
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gecikmiş kalibrasyon işaretlenemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_mark_overdue_calibrations ON equipment_calibrations;
CREATE TRIGGER trigger_mark_overdue_calibrations
    AFTER INSERT OR UPDATE OF next_calibration_date ON equipment_calibrations
    FOR EACH ROW
    WHEN (NEW.is_active = true AND NEW.next_calibration_date IS NOT NULL)
    EXECUTE FUNCTION mark_overdue_calibrations();

-- 3. Kalibrasyon Sertifikalarını Otomatik Doküman Modülüne Ekleme
CREATE OR REPLACE FUNCTION add_calibration_certificate_to_documents()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
    v_equipment_name TEXT;
    v_certificate_path TEXT;
BEGIN
    -- Sadece yeni kalibrasyonlar için ve sertifika yolu varsa
    IF TG_OP != 'INSERT' OR NEW.certificate_path IS NULL OR NEW.certificate_path = '' THEN
        RETURN NEW;
    END IF;
    
    -- Ekipman adını al
    SELECT name INTO v_equipment_name
    FROM equipments
    WHERE id = NEW.equipment_id;
    
    -- Doküman oluştur
    INSERT INTO documents (
        name,
        document_number,
        document_type,
        category,
        publish_date,
        valid_until,
        owner_id,
        file_path,
        description,
        status
    ) VALUES (
        format('Kalibrasyon Sertifikası - %s', COALESCE(v_equipment_name, 'Ekipman')),
        format('CAL-%s-%s', NEW.equipment_id, TO_CHAR(NEW.calibration_date, 'YYYYMMDD')),
        'Kalibrasyon Sertifikası',
        'Kalite Dokümanları',
        NEW.calibration_date,
        NEW.next_calibration_date,
        (SELECT owner_id FROM equipments WHERE id = NEW.equipment_id LIMIT 1),
        NEW.certificate_path,
        format('Ekipman kalibrasyon sertifikası.%s%s', 
            CASE WHEN NEW.calibration_result IS NOT NULL THEN E'\n\nSonuç: ' || NEW.calibration_result ELSE '' END,
            CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nNotlar: ' || NEW.notes ELSE '' END
        ),
        'Yayınlandı'
    ) RETURNING id INTO v_document_id;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Hata durumunda sessizce devam et (doküman ekleme kritik değil)
    RAISE WARNING 'Kalibrasyon sertifikası dokümana eklenemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (opsiyonel - certificate_path kolonu varsa)
-- DROP TRIGGER IF EXISTS trigger_add_calibration_certificate_to_documents ON equipment_calibrations;
-- CREATE TRIGGER trigger_add_calibration_certificate_to_documents
--     AFTER INSERT ON equipment_calibrations
--     FOR EACH ROW
--     WHEN (NEW.certificate_path IS NOT NULL AND NEW.certificate_path != '')
--     EXECUTE FUNCTION add_calibration_certificate_to_documents();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION create_task_for_calibration IS 'Kalibrasyon tarihi yaklaşan ekipmanlar için otomatik görev oluşturur';
COMMENT ON FUNCTION mark_overdue_calibrations IS 'Kalibrasyon süresi geçen ekipmanları otomatik olarak işaretler';
COMMENT ON FUNCTION add_calibration_certificate_to_documents IS 'Kalibrasyon sertifikalarını otomatik doküman modülüne ekler';

