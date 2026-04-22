-- ============================================================================
-- MÜŞTERİ ŞİKAYETLERİ SLA OTOMASYONLARI
-- SLA takibi, otomatik bildirimler, görev oluşturma
-- ============================================================================

-- 1. SLA Durumunu Otomatik Hesaplama ve Güncelleme
CREATE OR REPLACE FUNCTION update_complaint_sla_status()
RETURNS TRIGGER AS $$
DECLARE
    v_severity TEXT := COALESCE(NEW.severity, 'Orta');
    v_first_response_hours INTEGER;
    v_resolution_hours INTEGER;
    v_sla_first_response_hours INTEGER;
    v_sla_resolution_hours INTEGER;
    v_sla_status TEXT := 'Pending';
    v_hours_since_created NUMERIC;
    v_hours_since_first_response NUMERIC;
BEGIN
    -- SLA sürelerini belirle (önem seviyesine göre)
    CASE v_severity
        WHEN 'Kritik' THEN
            v_sla_first_response_hours := 24;
            v_sla_resolution_hours := 72;
        WHEN 'Yüksek' THEN
            v_sla_first_response_hours := 48;
            v_sla_resolution_hours := 120;
        WHEN 'Orta' THEN
            v_sla_first_response_hours := 72;
            v_sla_resolution_hours := 168;
        WHEN 'Düşük' THEN
            v_sla_first_response_hours := 120;
            v_sla_resolution_hours := 240;
        ELSE
            v_sla_first_response_hours := 72;
            v_sla_resolution_hours := 168;
    END CASE;
    
    -- İlk yanıt süresini hesapla
    IF NEW.first_response_date IS NOT NULL AND NEW.complaint_date IS NOT NULL THEN
        v_first_response_hours := EXTRACT(EPOCH FROM (NEW.first_response_date - NEW.complaint_date)) / 3600;
        NEW.first_response_hours := v_first_response_hours;
    END IF;
    
    -- Çözüm süresini hesapla
    IF NEW.resolution_date IS NOT NULL AND NEW.complaint_date IS NOT NULL THEN
        v_resolution_hours := EXTRACT(EPOCH FROM (NEW.resolution_date - NEW.complaint_date)) / 3600;
        NEW.resolution_hours := v_resolution_hours;
    END IF;
    
    -- SLA durumunu belirle
    IF NEW.status IN ('Kapalı', 'İptal') THEN
        -- Kapatılmış şikayetler için
        IF NEW.first_response_hours IS NOT NULL AND NEW.resolution_hours IS NOT NULL THEN
            IF NEW.first_response_hours <= v_sla_first_response_hours AND 
               NEW.resolution_hours <= v_sla_resolution_hours THEN
                v_sla_status := 'On Time';
            ELSIF NEW.resolution_hours <= v_sla_resolution_hours * 1.2 THEN
                v_sla_status := 'At Risk';
            ELSE
                v_sla_status := 'Overdue';
            END IF;
        END IF;
    ELSE
        -- Açık şikayetler için
        v_hours_since_created := EXTRACT(EPOCH FROM (NOW() - NEW.complaint_date)) / 3600;
        
        IF NEW.first_response_date IS NULL THEN
            -- İlk yanıt bekleniyor
            IF v_hours_since_created > v_sla_first_response_hours THEN
                v_sla_status := 'Overdue';
            ELSIF v_hours_since_created > v_sla_first_response_hours * 0.8 THEN
                v_sla_status := 'At Risk';
            ELSE
                v_sla_status := 'Pending';
            END IF;
        ELSE
            -- Çözüm bekleniyor
            v_hours_since_first_response := EXTRACT(EPOCH FROM (NOW() - NEW.first_response_date)) / 3600;
            v_hours_since_created := EXTRACT(EPOCH FROM (NOW() - NEW.complaint_date)) / 3600;
            
            IF v_hours_since_created > v_sla_resolution_hours THEN
                v_sla_status := 'Overdue';
            ELSIF v_hours_since_created > v_sla_resolution_hours * 0.8 THEN
                v_sla_status := 'At Risk';
            ELSE
                v_sla_status := 'On Time';
            END IF;
        END IF;
    END IF;
    
    NEW.sla_status := v_sla_status;
    NEW.sla_first_response_hours := v_sla_first_response_hours;
    NEW.sla_resolution_hours := v_sla_resolution_hours;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLA durumu güncellenemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_update_complaint_sla_status ON customer_complaints;
CREATE TRIGGER trigger_update_complaint_sla_status
    BEFORE INSERT OR UPDATE OF complaint_date, first_response_date, resolution_date, status, severity ON customer_complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_complaint_sla_status();

-- 2. SLA Yaklaştığında veya Geçtiğinde Bildirim
CREATE OR REPLACE FUNCTION notify_complaint_sla_warning()
RETURNS TRIGGER AS $$
DECLARE
    v_responsible_user_id UUID;
    v_hours_remaining NUMERIC;
    v_hours_overdue NUMERIC;
BEGIN
    -- Sadece açık şikayetler için
    IF NEW.status IN ('Kapalı', 'İptal') THEN
        RETURN NEW;
    END IF;
    
    -- SLA durumu değiştiyse bildirim gönder
    IF OLD.sla_status IS DISTINCT FROM NEW.sla_status THEN
        -- Sorumlu personelin user_id'sini bul
        IF NEW.assigned_to_id IS NOT NULL THEN
            SELECT u.id INTO v_responsible_user_id
            FROM auth.users u
            JOIN personnel p ON p.email = u.email
            WHERE p.id = NEW.assigned_to_id
            LIMIT 1;
        END IF;
        
        -- Sorumlu yoksa, responsible_personnel_id'yi dene
        IF v_responsible_user_id IS NULL AND NEW.responsible_personnel_id IS NOT NULL THEN
            SELECT u.id INTO v_responsible_user_id
            FROM auth.users u
            JOIN personnel p ON p.email = u.email
            WHERE p.id = NEW.responsible_personnel_id
            LIMIT 1;
        END IF;
        
        IF v_responsible_user_id IS NOT NULL THEN
            -- Kalan/geçen süreyi hesapla
            IF NEW.first_response_date IS NULL THEN
                v_hours_remaining := NEW.sla_first_response_hours - 
                    (EXTRACT(EPOCH FROM (NOW() - NEW.complaint_date)) / 3600);
            ELSE
                v_hours_remaining := NEW.sla_resolution_hours - 
                    (EXTRACT(EPOCH FROM (NOW() - NEW.complaint_date)) / 3600);
            END IF;
            
            -- Bildirim oluştur
            PERFORM create_notification(
                v_responsible_user_id,
                'COMPLAINT_SLA_WARNING',
                format('Şikayet SLA %s: %s', 
                    CASE NEW.sla_status
                        WHEN 'Overdue' THEN 'Gecikmiş'
                        WHEN 'At Risk' THEN 'Risk Altında'
                        ELSE 'Güncellendi'
                    END,
                    COALESCE(NEW.complaint_number, 'N/A')
                ),
                format('%s numaralı şikayet için SLA durumu: %s%s', 
                    COALESCE(NEW.complaint_number, 'N/A'),
                    CASE NEW.sla_status
                        WHEN 'Overdue' THEN 'Gecikmiş'
                        WHEN 'At Risk' THEN 'Risk Altında'
                        ELSE 'Güncel'
                    END,
                    CASE 
                        WHEN v_hours_remaining < 0 THEN format(' (%s saat gecikme)', ABS(v_hours_remaining)::INTEGER)
                        WHEN v_hours_remaining <= 24 THEN format(' (%s saat kaldı)', v_hours_remaining::INTEGER)
                        ELSE ''
                    END
                ),
                'customer-complaints',
                NEW.id,
                CASE NEW.sla_status
                    WHEN 'Overdue' THEN 'HIGH'
                    WHEN 'At Risk' THEN 'NORMAL'
                    ELSE 'LOW'
                END,
                format('/customer-complaints?complaint_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Şikayet SLA bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_complaint_sla_warning ON customer_complaints;
CREATE TRIGGER trigger_notify_complaint_sla_warning
    AFTER INSERT OR UPDATE OF sla_status, status ON customer_complaints
    FOR EACH ROW
    EXECUTE FUNCTION notify_complaint_sla_warning();

-- 3. Şikayet Açıldığında Otomatik Görev Oluşturma
CREATE OR REPLACE FUNCTION create_task_for_complaint()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_responsible_personnel_id UUID;
    v_task_title TEXT;
    v_task_description TEXT;
BEGIN
    -- Sadece yeni şikayetler için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Sorumlu personel yoksa devam et
    v_responsible_personnel_id := COALESCE(NEW.assigned_to_id, NEW.responsible_personnel_id);
    
    IF v_responsible_personnel_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Zaten görev var mı kontrol et
    SELECT t.id INTO v_task_id
    FROM tasks t
    JOIN task_assignees ta ON ta.task_id = t.id
    WHERE t.title LIKE '%' || COALESCE(NEW.complaint_number, '') || '%'
      AND ta.personnel_id = v_responsible_personnel_id
      AND t.status NOT IN ('Tamamlandı', 'İptal')
    LIMIT 1;
    
    -- Görev yoksa oluştur
    IF v_task_id IS NULL THEN
        v_task_title := format('Müşteri Şikayeti: %s', COALESCE(NEW.complaint_number, 'Yeni Şikayet'));
        
        v_task_description := format('Müşteri şikayeti için aksiyon almanız gerekiyor.%s%s%s', 
            CASE WHEN NEW.title IS NOT NULL THEN E'\n\nBaşlık: ' || NEW.title ELSE '' END,
            CASE WHEN NEW.description IS NOT NULL THEN E'\n\nAçıklama: ' || LEFT(NEW.description, 300) ELSE '' END,
            CASE WHEN NEW.severity IS NOT NULL THEN E'\n\nÖnem Seviyesi: ' || NEW.severity ELSE '' END
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
                WHEN NEW.severity = 'Kritik' THEN 'Kritik'
                WHEN NEW.severity = 'Yüksek' THEN 'Yüksek'
                ELSE 'Orta'
            END,
            -- SLA'ya göre vade tarihi
            CASE NEW.severity
                WHEN 'Kritik' THEN NEW.complaint_date + INTERVAL '24 hours'
                WHEN 'Yüksek' THEN NEW.complaint_date + INTERVAL '48 hours'
                WHEN 'Orta' THEN NEW.complaint_date + INTERVAL '72 hours'
                ELSE NEW.complaint_date + INTERVAL '120 hours'
            END,
            NOW()
        ) RETURNING id INTO v_task_id;
        
        -- Görevi sorumluya ata
        IF v_task_id IS NOT NULL THEN
            INSERT INTO task_assignees (task_id, personnel_id, assigned_at)
            VALUES (v_task_id, v_responsible_personnel_id, NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Şikayet görevi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_create_task_for_complaint ON customer_complaints;
CREATE TRIGGER trigger_create_task_for_complaint
    AFTER INSERT ON customer_complaints
    FOR EACH ROW
    WHEN (NEW.status NOT IN ('Kapalı', 'İptal'))
    EXECUTE FUNCTION create_task_for_complaint();

-- 4. Şikayet Çözüldüğünde Otomatik Kapatma Önerisi (Manuel onay gerekli)
CREATE OR REPLACE FUNCTION suggest_complaint_closure()
RETURNS TRIGGER AS $$
DECLARE
    v_resolution_complete BOOLEAN := false;
BEGIN
    -- Sadece açık şikayetler için
    IF NEW.status IN ('Kapalı', 'İptal') THEN
        RETURN NEW;
    END IF;
    
    -- Çözüm kriterleri:
    -- 1. Root cause belirlenmiş
    -- 2. Çözüm uygulanmış
    -- 3. Müşteri onayı alınmış (opsiyonel)
    v_resolution_complete := (
        NEW.root_cause IS NOT NULL AND NEW.root_cause != ''
        AND NEW.solution IS NOT NULL AND NEW.solution != ''
        AND NEW.resolution_date IS NOT NULL
    );
    
    -- Çözüm tamamlandıysa ve 7 günden fazla geçtiyse kapatma önerisi
    IF v_resolution_complete AND NEW.resolution_date < NOW() - INTERVAL '7 days' THEN
        -- Notes'a ekle (manuel kapatma için)
        NEW.notes := COALESCE(NEW.notes, '') || E'\n\n[OTOMATIK ÖNERİ] Çözüm tamamlandı ve 7 günden fazla geçti. Şikayet kapatılabilir.';
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Şikayet kapatma önerisi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_suggest_complaint_closure ON customer_complaints;
CREATE TRIGGER trigger_suggest_complaint_closure
    BEFORE UPDATE OF root_cause, solution, resolution_date ON customer_complaints
    FOR EACH ROW
    WHEN (NEW.status NOT IN ('Kapalı', 'İptal'))
    EXECUTE FUNCTION suggest_complaint_closure();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION update_complaint_sla_status IS 'Müşteri şikayeti SLA durumunu otomatik hesaplar ve günceller';
COMMENT ON FUNCTION notify_complaint_sla_warning IS 'SLA yaklaştığında veya geçtiğinde bildirim gönderir';
COMMENT ON FUNCTION create_task_for_complaint IS 'Şikayet açıldığında otomatik görev oluşturur';
COMMENT ON FUNCTION suggest_complaint_closure IS 'Şikayet çözüldüğünde otomatik kapatma önerisi yapar';

