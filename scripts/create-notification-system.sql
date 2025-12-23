-- ============================================================================
-- KAPSAMLI BİLDİRİM SİSTEMİ
-- Tüm modüllerden otomatik bildirim oluşturma sistemi
-- ============================================================================

-- 1. Bildirimler Tablosu (Genel)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'SUPPLIER_REJECTION', 'DEVIATION_CREATED', 'QUARANTINE_OPENED', 
        '8D_OVERDUE', 'CALIBRATION_DUE', 'DOCUMENT_EXPIRING', 
        'COST_ANOMALY', 'NC_CREATED', 'AUDIT_DUE', 'TASK_ASSIGNED',
        'TASK_DUE', 'COMPLAINT_SLA_WARNING', 'KPI_TARGET_MISSED',
        'QUARANTINE_LONG_STAY', 'EQUIPMENT_CALIBRATION_OVERDUE',
        'TRAINING_UPCOMING', 'POLIVALANCE_DEFICIENT', 'BENCHMARK_UPDATED'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_module TEXT,
    related_id UUID,
    is_read BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT -- Bildirime tıklandığında gidilecek URL
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);

-- RLS Politikaları
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Bildirim Oluşturma Fonksiyonu
-- ============================================================================
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_module TEXT DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'NORMAL',
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        notification_type,
        title,
        message,
        related_module,
        related_id,
        priority,
        action_url
    ) VALUES (
        p_user_id,
        p_notification_type,
        p_title,
        p_message,
        p_related_module,
        p_related_id,
        p_priority,
        p_action_url
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
    -- Hata durumunda sessizce devam et (bildirim sistemi kritik değil)
    RAISE WARNING 'Bildirim oluşturulamadı: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Toplu Bildirim Oluşturma Fonksiyonu
-- ============================================================================
CREATE OR REPLACE FUNCTION create_notifications_for_users(
    p_user_ids UUID[],
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_module TEXT DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'NORMAL',
    p_action_url TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER := 0;
BEGIN
    FOREACH v_user_id IN ARRAY p_user_ids
    LOOP
        PERFORM create_notification(
            v_user_id,
            p_notification_type,
            p_title,
            p_message,
            p_related_module,
            p_related_id,
            p_priority,
            p_action_url
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Toplu bildirim oluşturulamadı: %', SQLERRM;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. DF/8D Gecikme Bildirimleri Trigger'ı
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_8d_overdue()
RETURNS TRIGGER AS $$
DECLARE
    v_days_overdue INTEGER;
    v_responsible_user_id UUID;
BEGIN
    -- Sadece açık kayıtlar için kontrol et
    IF NEW.status IN ('Kapatıldı', 'Reddedildi') THEN
        RETURN NEW;
    END IF;
    
    -- Vade tarihi kontrolü
    IF NEW.due_at IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Gecikme günü hesapla
    v_days_overdue := EXTRACT(DAY FROM (NOW() - NEW.due_at))::INTEGER;
    
    -- 30 günden fazla gecikme varsa bildirim oluştur
    IF v_days_overdue >= 30 THEN
        -- Sorumlu personelin user_id'sini bul
        SELECT u.id INTO v_responsible_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.id = NEW.responsible_personnel_id
        LIMIT 1;
        
        IF v_responsible_user_id IS NOT NULL THEN
            PERFORM create_notification(
                v_responsible_user_id,
                '8D_OVERDUE',
                format('Geciken 8D Kaydı: %s', COALESCE(NEW.nc_number, NEW.mdi_no, 'N/A')),
                format('%s numaralı 8D kaydı %s gündür gecikmiş durumda.', 
                    COALESCE(NEW.nc_number, NEW.mdi_no, 'N/A'), 
                    v_days_overdue),
                'df-8d',
                NEW.id,
                CASE 
                    WHEN v_days_overdue >= 60 THEN 'CRITICAL'
                    WHEN v_days_overdue >= 45 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/df-8d?nc_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (her güncellemede kontrol et)
DROP TRIGGER IF EXISTS trigger_notify_8d_overdue ON non_conformities;
CREATE TRIGGER trigger_notify_8d_overdue
    AFTER INSERT OR UPDATE OF status, due_at ON non_conformities
    FOR EACH ROW
    WHEN (NEW.type = '8D' OR NEW.type = 'DF')
    EXECUTE FUNCTION notify_8d_overdue();

-- ============================================================================
-- 5. Kalibrasyon Gecikme Bildirimleri Trigger'ı
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_calibration_due()
RETURNS TRIGGER AS $$
DECLARE
    v_days_until_due INTEGER;
    v_responsible_user_id UUID;
    v_equipment_name TEXT;
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
    
    -- 30 gün kala veya geçmişse bildirim oluştur
    IF v_days_until_due <= 30 THEN
        -- Ekipman adını al
        SELECT name INTO v_equipment_name
        FROM equipments
        WHERE id = NEW.equipment_id;
        
        -- Sorumlu birimin personellerine bildirim gönder
        SELECT array_agg(u.id) INTO v_responsible_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        JOIN equipments e ON e.responsible_unit = p.department
        WHERE e.id = NEW.equipment_id
        LIMIT 1;
        
        -- Eğer birim bazlı bulunamazsa, ekipmanı kullanan personellere gönder
        IF v_responsible_user_id IS NULL THEN
            SELECT array_agg(DISTINCT u.id) INTO v_responsible_user_id
            FROM auth.users u
            JOIN personnel p ON p.email = u.email
            JOIN equipment_assignments ea ON ea.personnel_id = p.id
            WHERE ea.equipment_id = NEW.equipment_id AND ea.is_active = true;
        END IF;
        
        IF v_responsible_user_id IS NOT NULL THEN
            PERFORM create_notification(
                v_responsible_user_id,
                CASE 
                    WHEN v_days_until_due < 0 THEN 'CALIBRATION_DUE'
                    ELSE 'CALIBRATION_DUE'
                END,
                format('Kalibrasyon %s: %s', 
                    CASE WHEN v_days_until_due < 0 THEN 'Gecikmiş' ELSE 'Yaklaşıyor' END,
                    COALESCE(v_equipment_name, 'Ekipman')),
                format('%s ekipmanının kalibrasyonu %s gün %s.', 
                    COALESCE(v_equipment_name, 'Ekipman'),
                    ABS(v_days_until_due),
                    CASE WHEN v_days_until_due < 0 THEN 'geçmiş' ELSE 'kaldı' END),
                'equipment',
                NEW.equipment_id,
                CASE 
                    WHEN v_days_until_due < 0 THEN 'HIGH'
                    WHEN v_days_until_due <= 7 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/equipment?equipment_id=%s', NEW.equipment_id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_calibration_due ON equipment_calibrations;
CREATE TRIGGER trigger_notify_calibration_due
    AFTER INSERT OR UPDATE OF next_calibration_date, is_active ON equipment_calibrations
    FOR EACH ROW
    EXECUTE FUNCTION notify_calibration_due();

-- ============================================================================
-- 6. Doküman Geçerlilik Bildirimleri Trigger'ı
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_document_expiring()
RETURNS TRIGGER AS $$
DECLARE
    v_days_until_expiry INTEGER;
    v_owner_user_id UUID;
BEGIN
    -- Geçerlilik tarihi kontrolü
    IF NEW.valid_until IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Kalan gün hesapla
    v_days_until_expiry := EXTRACT(DAY FROM (NEW.valid_until - NOW()))::INTEGER;
    
    -- 30 gün kala veya geçmişse bildirim oluştur
    IF v_days_until_expiry <= 30 THEN
        -- Doküman sahibinin user_id'sini bul
        SELECT u.id INTO v_owner_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.id = NEW.owner_id
        LIMIT 1;
        
        IF v_owner_user_id IS NOT NULL THEN
            PERFORM create_notification(
                v_owner_user_id,
                'DOCUMENT_EXPIRING',
                format('Doküman Geçerliliği: %s', COALESCE(NEW.name, 'Doküman')),
                format('%s dokümanının geçerliliği %s gün %s.', 
                    COALESCE(NEW.name, 'Doküman'),
                    ABS(v_days_until_expiry),
                    CASE WHEN v_days_until_expiry < 0 THEN 'geçmiş' ELSE 'kaldı' END),
                'document',
                NEW.id,
                CASE 
                    WHEN v_days_until_expiry < 0 THEN 'HIGH'
                    WHEN v_days_until_expiry <= 7 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/document?document_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_document_expiring ON documents;
CREATE TRIGGER trigger_notify_document_expiring
    AFTER INSERT OR UPDATE OF valid_until ON documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_document_expiring();

-- ============================================================================
-- 7. Karantina Uzun Bekleme Bildirimleri Trigger'ı
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_quarantine_long_stay()
RETURNS TRIGGER AS $$
DECLARE
    v_days_in_quarantine INTEGER;
    v_responsible_user_id UUID;
BEGIN
    -- Sadece karantinada bekleyen kayıtlar için
    IF NEW.status NOT IN ('Karantinada', 'Onay Bekliyor') THEN
        RETURN NEW;
    END IF;
    
    -- Karantinada kalma süresi hesapla
    v_days_in_quarantine := EXTRACT(DAY FROM (NOW() - NEW.quarantine_date))::INTEGER;
    
    -- 7 günden fazla bekliyorsa bildirim oluştur
    IF v_days_in_quarantine >= 7 THEN
        -- İlgili birimin personellerine bildirim gönder
        SELECT array_agg(u.id) INTO v_responsible_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.department = NEW.requesting_department OR p.department = NEW.source_department
        LIMIT 5;
        
        IF v_responsible_user_id IS NOT NULL THEN
            PERFORM create_notifications_for_users(
                v_responsible_user_id,
                'QUARANTINE_LONG_STAY',
                format('Uzun Bekleyen Karantina: %s', COALESCE(NEW.part_name, 'Parça')),
                format('%s parçası karantinada %s gündür bekliyor.', 
                    COALESCE(NEW.part_name, 'Parça'),
                    v_days_in_quarantine),
                'quarantine',
                NEW.id,
                CASE 
                    WHEN v_days_in_quarantine >= 14 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/quarantine?record_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_quarantine_long_stay ON quarantine_records;
CREATE TRIGGER trigger_notify_quarantine_long_stay
    AFTER INSERT OR UPDATE OF status, quarantine_date ON quarantine_records
    FOR EACH ROW
    EXECUTE FUNCTION notify_quarantine_long_stay();

-- ============================================================================
-- 8. NC Oluşturulduğunda Bildirim
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_nc_created()
RETURNS TRIGGER AS $$
DECLARE
    v_responsible_user_id UUID;
BEGIN
    -- Sadece yeni kayıtlar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Sorumlu personelin user_id'sini bul
    IF NEW.responsible_personnel_id IS NOT NULL THEN
        SELECT u.id INTO v_responsible_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.id = NEW.responsible_personnel_id
        LIMIT 1;
        
        IF v_responsible_user_id IS NOT NULL THEN
            PERFORM create_notification(
                v_responsible_user_id,
                'NC_CREATED',
                format('Yeni Uygunsuzluk: %s', COALESCE(NEW.nc_number, NEW.mdi_no, 'N/A')),
                format('%s numaralı uygunsuzluk kaydı size atandı.', 
                    COALESCE(NEW.nc_number, NEW.mdi_no, 'N/A')),
                'df-8d',
                NEW.id,
                CASE 
                    WHEN NEW.priority = 'Yüksek' THEN 'HIGH'
                    WHEN NEW.priority = 'Kritik' THEN 'CRITICAL'
                    ELSE 'NORMAL'
                END,
                format('/df-8d?nc_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_nc_created ON non_conformities;
CREATE TRIGGER trigger_notify_nc_created
    AFTER INSERT ON non_conformities
    FOR EACH ROW
    EXECUTE FUNCTION notify_nc_created();

-- ============================================================================
-- 9. Görev Atandığında Bildirim
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Sadece yeni atamalar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Atanan personelin user_id'sini bul
    SELECT u.id INTO v_user_id
    FROM auth.users u
    JOIN personnel p ON p.email = u.email
    WHERE p.id = NEW.personnel_id
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Görev bilgisini al
        PERFORM create_notification(
            v_user_id,
            'TASK_ASSIGNED',
            format('Yeni Görev: %s', (SELECT title FROM tasks WHERE id = NEW.task_id)),
            format('Size yeni bir görev atandı: %s', (SELECT title FROM tasks WHERE id = NEW.task_id)),
            'tasks',
            NEW.task_id,
            CASE 
                WHEN (SELECT priority FROM tasks WHERE id = NEW.task_id) = 'Yüksek' THEN 'HIGH'
                WHEN (SELECT priority FROM tasks WHERE id = NEW.task_id) = 'Kritik' THEN 'CRITICAL'
                ELSE 'NORMAL'
            END,
            format('/tasks?task_id=%s', NEW.task_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON task_assignees;
CREATE TRIGGER trigger_notify_task_assigned
    AFTER INSERT ON task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assigned();

-- ============================================================================
-- 10. Günlük Kontrol Fonksiyonu (Cron Job için)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_daily_notifications()
RETURNS void AS $$
DECLARE
    v_nc RECORD;
    v_calibration RECORD;
    v_document RECORD;
    v_quarantine RECORD;
BEGIN
    -- 30+ gün gecikmiş 8D kayıtları için günlük kontrol
    FOR v_nc IN 
        SELECT nc.*, 
               EXTRACT(DAY FROM (NOW() - nc.due_at))::INTEGER as days_overdue
        FROM non_conformities nc
        WHERE nc.status NOT IN ('Kapatıldı', 'Reddedildi')
          AND nc.due_at IS NOT NULL
          AND nc.due_at < NOW()
          AND (nc.type = '8D' OR nc.type = 'DF')
          AND EXTRACT(DAY FROM (NOW() - nc.due_at)) >= 30
    LOOP
        PERFORM notify_8d_overdue();
    END LOOP;
    
    -- Kalibrasyon tarihi yaklaşan ekipmanlar için kontrol
    FOR v_calibration IN
        SELECT ec.*, e.name as equipment_name
        FROM equipment_calibrations ec
        JOIN equipments e ON e.id = ec.equipment_id
        WHERE ec.is_active = true
          AND ec.next_calibration_date IS NOT NULL
          AND ec.next_calibration_date <= NOW() + INTERVAL '30 days'
    LOOP
        PERFORM notify_calibration_due();
    END LOOP;
    
    -- Geçerlilik süresi yaklaşan dokümanlar için kontrol
    FOR v_document IN
        SELECT d.*
        FROM documents d
        WHERE d.valid_until IS NOT NULL
          AND d.valid_until <= NOW() + INTERVAL '30 days'
    LOOP
        PERFORM notify_document_expiring();
    END LOOP;
    
    -- 7+ gün karantinada bekleyen kayıtlar için kontrol
    FOR v_quarantine IN
        SELECT qr.*
        FROM quarantine_records qr
        WHERE qr.status IN ('Karantinada', 'Onay Bekliyor')
          AND qr.quarantine_date <= NOW() - INTERVAL '7 days'
    LOOP
        PERFORM notify_quarantine_long_stay();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_daily_notifications() IS 'Günlük bildirim kontrollerini yapar. Supabase Cron veya Edge Function ile çağrılmalıdır.';

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON TABLE public.notifications IS 'Sistem geneli bildirimler tablosu';
COMMENT ON FUNCTION create_notification IS 'Tek kullanıcı için bildirim oluşturur';
COMMENT ON FUNCTION create_notifications_for_users IS 'Birden fazla kullanıcı için toplu bildirim oluşturur';
COMMENT ON FUNCTION notify_8d_overdue IS '8D kayıtları geciktiğinde bildirim oluşturur';
COMMENT ON FUNCTION notify_calibration_due IS 'Kalibrasyon tarihi yaklaştığında bildirim oluşturur';
COMMENT ON FUNCTION notify_document_expiring IS 'Doküman geçerliliği yaklaştığında bildirim oluşturur';
COMMENT ON FUNCTION notify_quarantine_long_stay IS 'Karantinada uzun bekleyen kayıtlar için bildirim oluşturur';
COMMENT ON FUNCTION notify_nc_created IS 'Yeni NC oluşturulduğunda bildirim oluşturur';
COMMENT ON FUNCTION notify_task_assigned IS 'Görev atandığında bildirim oluşturur';

