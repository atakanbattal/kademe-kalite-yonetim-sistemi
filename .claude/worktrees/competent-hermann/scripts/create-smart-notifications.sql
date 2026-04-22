-- ============================================================================
-- AKILLI BİLDİRİM SİSTEMİ
-- Sistem geneli analizler ve uyarılar
-- ============================================================================

-- 1. Uzun Süredir İç Tetkik Yapılmamış Uyarısı
CREATE OR REPLACE FUNCTION notify_missing_audits()
RETURNS void AS $$
DECLARE
    v_days_since_last_audit INTEGER;
    v_last_audit_date DATE;
    v_admin_user_ids UUID[];
    v_message TEXT;
BEGIN
    -- Son iç tetkik tarihini bul
    SELECT MAX(audit_date) INTO v_last_audit_date
    FROM audits
    WHERE status = 'Tamamlandı'
      AND audit_type != 'Yıllık Plan';
    
    -- Eğer hiç tetkik yoksa veya 90 günden fazla geçmişse uyarı gönder
    IF v_last_audit_date IS NULL THEN
        v_message := 'Sistemde henüz hiç iç tetkik tamamlanmamış. İç tetkik planı oluşturmanız önerilir.';
        v_days_since_last_audit := 999;
    ELSE
        v_days_since_last_audit := EXTRACT(DAY FROM (CURRENT_DATE - v_last_audit_date))::INTEGER;
        
        IF v_days_since_last_audit < 90 THEN
            RETURN; -- Henüz uyarı zamanı değil
        END IF;
        
        v_message := format('Son iç tetkik %s gün önce (%s) tamamlanmış. Yeni bir iç tetkik planı oluşturmanız önerilir.', 
            v_days_since_last_audit,
            TO_CHAR(v_last_audit_date, 'DD.MM.YYYY'));
    END IF;
    
    -- Admin ve kalite yöneticilerine bildirim gönder
    SELECT array_agg(DISTINCT u.id) INTO v_admin_user_ids
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN personnel pe ON pe.email = u.email
    WHERE p.role = 'admin' 
       OR pe.department IN ('Kalite', 'Kalite Kontrol', 'Kalite Yönetimi')
    LIMIT 20;
    
    IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_admin_user_ids,
            'AUDIT_DUE',
            'Uyarı: İç Tetkik Gecikmesi',
            v_message,
            'internal-audit',
            NULL,
            CASE 
                WHEN v_days_since_last_audit >= 180 THEN 'CRITICAL'
                WHEN v_days_since_last_audit >= 120 THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            '/internal-audit'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Yaklaşan Terminler için Genel Uyarı
CREATE OR REPLACE FUNCTION notify_upcoming_deadlines()
RETURNS void AS $$
DECLARE
    v_record RECORD;
    v_user_ids UUID[];
    v_days_until_due INTEGER;
BEGIN
    -- 8D/DF kayıtları için yaklaşan terminler
    FOR v_record IN
        SELECT 
            nc.id,
            nc.nc_number,
            nc.mdi_no,
            nc.due_at,
            nc.responsible_personnel_id,
            nc.title,
            EXTRACT(DAY FROM (nc.due_at - CURRENT_DATE))::INTEGER as days_until_due
        FROM non_conformities nc
        WHERE nc.status NOT IN ('Kapatıldı', 'Reddedildi')
          AND nc.due_at IS NOT NULL
          AND nc.due_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND (nc.type = '8D' OR nc.type = 'DF')
    LOOP
        v_days_until_due := v_record.days_until_due;
        
        -- Sorumlu personel ve yöneticilere bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_user_ids
        FROM auth.users u
        LEFT JOIN personnel p ON p.email = u.email
        WHERE p.id = v_record.responsible_personnel_id
           OR p.department IN ('Kalite', 'Kalite Kontrol')
           OR EXISTS (
               SELECT 1 FROM profiles pr 
               WHERE pr.id = u.id AND pr.role = 'admin'
           )
        LIMIT 10;
        
        IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_user_ids,
                '8D_OVERDUE',
                format('Yaklaşan Termin: %s', COALESCE(v_record.nc_number, v_record.mdi_no, 'NC')),
                format('%s numaralı kayıt için termin %s gün sonra (%s).', 
                    COALESCE(v_record.nc_number, v_record.mdi_no, 'NC'),
                    v_days_until_due,
                    TO_CHAR(v_record.due_at, 'DD.MM.YYYY')),
                'df-8d',
                v_record.id,
                CASE 
                    WHEN v_days_until_due <= 1 THEN 'CRITICAL'
                    WHEN v_days_until_due <= 3 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/df-8d?nc_id=%s', v_record.id)
            );
        END IF;
    END LOOP;
    
    -- Müşteri şikayetleri için yaklaşan SLA'lar
    FOR v_record IN
        SELECT 
            cc.id,
            cc.complaint_no,
            cc.complaint_date,
            cc.severity,
            cc.assigned_to_id,
            cc.responsible_personnel_id,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - cc.complaint_date)) / 3600 as hours_since_created
        FROM customer_complaints cc
        WHERE cc.status NOT IN ('Kapalı', 'İptal')
          AND cc.complaint_date IS NOT NULL
    LOOP
        DECLARE
            v_sla_hours INTEGER;
            v_hours_remaining NUMERIC;
        BEGIN
            -- Severity'ye göre SLA saatleri
            CASE v_record.severity
                WHEN 'Kritik' THEN v_sla_hours := 24;
                WHEN 'Yüksek' THEN v_sla_hours := 48;
                WHEN 'Orta' THEN v_sla_hours := 72;
                WHEN 'Düşük' THEN v_sla_hours := 120;
                ELSE v_sla_hours := 72;
            END CASE;
            
            v_hours_remaining := v_sla_hours - v_record.hours_since_created;
            
            -- SLA'nın %80'ine ulaşıldıysa veya geçildiyse uyarı gönder
            IF v_hours_remaining <= (v_sla_hours * 0.2) THEN
                SELECT array_agg(DISTINCT u.id) INTO v_user_ids
                FROM auth.users u
                LEFT JOIN personnel p ON p.email = u.email
                WHERE p.id = COALESCE(v_record.assigned_to_id, v_record.responsible_personnel_id)
                   OR p.department IN ('Kalite', 'Müşteri Hizmetleri')
                   OR EXISTS (
                       SELECT 1 FROM profiles pr 
                       WHERE pr.id = u.id AND pr.role = 'admin'
                   )
                LIMIT 10;
                
                IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
                    PERFORM create_notifications_for_users(
                        v_user_ids,
                        'COMPLAINT_SLA_WARNING',
                        format('Şikayet SLA Uyarısı: %s', COALESCE(v_record.complaint_no, 'N/A')),
                        format('%s numaralı şikayet için SLA %s. %s saat kaldı.', 
                            COALESCE(v_record.complaint_no, 'N/A'),
                            CASE 
                                WHEN v_hours_remaining < 0 THEN format('%s saat gecikmiş', ABS(v_hours_remaining)::INTEGER)
                                WHEN v_hours_remaining <= 24 THEN format('%s saat kaldı', v_hours_remaining::INTEGER)
                                ELSE format('%s saat kaldı', v_hours_remaining::INTEGER)
                            END,
                            CASE 
                                WHEN v_hours_remaining < 0 THEN 'GECİKMİŞ'
                                WHEN v_hours_remaining <= 24 THEN 'KRİTİK'
                                ELSE 'UYARI'
                            END),
                        'customer-complaints',
                        v_record.id,
                        CASE 
                            WHEN v_hours_remaining < 0 THEN 'CRITICAL'
                            WHEN v_hours_remaining <= 24 THEN 'HIGH'
                            ELSE 'NORMAL'
                        END,
                        format('/customer-complaints?complaint_id=%s', v_record.id)
                    );
                END IF;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Uzun Süredir NC Oluşturulmamış Uyarısı (Anormal Durum)
CREATE OR REPLACE FUNCTION notify_low_nc_activity()
RETURNS void AS $$
DECLARE
    v_days_since_last_nc INTEGER;
    v_last_nc_date DATE;
    v_nc_count_last_month INTEGER;
    v_admin_user_ids UUID[];
    v_message TEXT;
BEGIN
    -- Son NC tarihini bul
    SELECT MAX(created_at::DATE) INTO v_last_nc_date
    FROM non_conformities
    WHERE status != 'Reddedildi';
    
    -- Son 30 günde oluşturulan NC sayısı
    SELECT COUNT(*) INTO v_nc_count_last_month
    FROM non_conformities
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND status != 'Reddedildi';
    
    -- Eğer hiç NC yoksa veya 60 günden fazla geçmişse uyarı gönder
    IF v_last_nc_date IS NULL THEN
        v_message := 'Sistemde henüz hiç uygunsuzluk kaydı oluşturulmamış. Bu normal bir durum olabilir, ancak kontrol edilmesi önerilir.';
        v_days_since_last_nc := 999;
    ELSE
        v_days_since_last_nc := EXTRACT(DAY FROM (CURRENT_DATE - v_last_nc_date))::INTEGER;
        
        -- 60 günden fazla geçmişse ve son ayda hiç NC yoksa uyarı gönder
        IF v_days_since_last_nc >= 60 AND v_nc_count_last_month = 0 THEN
            v_message := format('Son uygunsuzluk kaydı %s gün önce (%s) oluşturulmuş. Son 30 günde hiç NC oluşturulmamış. Bu durumun kontrol edilmesi önerilir.', 
                v_days_since_last_nc,
                TO_CHAR(v_last_nc_date, 'DD.MM.YYYY'));
        ELSE
            RETURN; -- Normal durum
        END IF;
    END IF;
    
    -- Admin ve kalite yöneticilerine bildirim gönder
    SELECT array_agg(DISTINCT u.id) INTO v_admin_user_ids
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN personnel pe ON pe.email = u.email
    WHERE p.role = 'admin' 
       OR pe.department IN ('Kalite', 'Kalite Kontrol', 'Kalite Yönetimi')
    LIMIT 20;
    
    IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_admin_user_ids,
            'NC_CREATED',
            'Uyarı: Düşük NC Aktivitesi',
            v_message,
            'df-8d',
            NULL,
            'NORMAL',
            '/df-8d'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Kalibrasyon Gecikmeleri için Genel Uyarı
CREATE OR REPLACE FUNCTION notify_overdue_calibrations_summary()
RETURNS void AS $$
DECLARE
    v_overdue_count INTEGER;
    v_critical_count INTEGER;
    v_admin_user_ids UUID[];
    v_message TEXT;
BEGIN
    -- Gecikmiş kalibrasyon sayısı
    SELECT COUNT(*) INTO v_overdue_count
    FROM equipment_calibrations ec
    WHERE ec.is_active = true
      AND ec.next_calibration_date IS NOT NULL
      AND ec.next_calibration_date < CURRENT_DATE;
    
    -- Kritik gecikmeler (30+ gün)
    SELECT COUNT(*) INTO v_critical_count
    FROM equipment_calibrations ec
    WHERE ec.is_active = true
      AND ec.next_calibration_date IS NOT NULL
      AND ec.next_calibration_date < CURRENT_DATE - INTERVAL '30 days';
    
    -- Eğer gecikmiş kalibrasyon varsa uyarı gönder
    IF v_overdue_count > 0 THEN
        v_message := format('Sistemde %s adet gecikmiş kalibrasyon bulunmaktadır.%s', 
            v_overdue_count,
            CASE 
                WHEN v_critical_count > 0 THEN format(' Bunlardan %s tanesi kritik seviyede (30+ gün gecikmiş).', v_critical_count)
                ELSE ''
            END);
        
        -- Admin ve ekipman sorumlularına bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_admin_user_ids
        FROM auth.users u
        LEFT JOIN profiles p ON p.id = u.id
        LEFT JOIN personnel pe ON pe.email = u.email
        WHERE p.role = 'admin' 
           OR pe.department IN ('Kalite', 'Kalite Kontrol', 'Ekipman', 'Bakım')
        LIMIT 20;
        
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                'CALIBRATION_DUE',
                format('Uyarı: %s Gecikmiş Kalibrasyon', v_overdue_count),
                v_message,
                'equipment',
                NULL,
                CASE 
                    WHEN v_critical_count > 0 THEN 'CRITICAL'
                    WHEN v_overdue_count >= 10 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                '/equipment'
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Doküman Geçerlilik Süresi Yaklaşanlar için Özet
CREATE OR REPLACE FUNCTION notify_expiring_documents_summary()
RETURNS void AS $$
DECLARE
    v_expiring_count INTEGER;
    v_expired_count INTEGER;
    v_admin_user_ids UUID[];
    v_message TEXT;
BEGIN
    -- 30 gün içinde geçerliliği dolacak dokümanlar
    SELECT COUNT(*) INTO v_expiring_count
    FROM documents
    WHERE valid_until IS NOT NULL
      AND valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND status NOT IN ('Arşivlendi');
    
    -- Geçerliliği dolmuş dokümanlar
    SELECT COUNT(*) INTO v_expired_count
    FROM documents
    WHERE valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE
      AND status NOT IN ('Arşivlendi');
    
    -- Eğer yaklaşan veya geçmiş doküman varsa uyarı gönder
    IF v_expiring_count > 0 OR v_expired_count > 0 THEN
        v_message := format('Sistemde %s adet dokümanın geçerlilik süresi yaklaşıyor (30 gün içinde).', v_expiring_count);
        
        IF v_expired_count > 0 THEN
            v_message := v_message || format(' %s adet dokümanın geçerlilik süresi dolmuş.', v_expired_count);
        END IF;
        
        -- Admin ve doküman sorumlularına bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_admin_user_ids
        FROM auth.users u
        LEFT JOIN profiles p ON p.id = u.id
        LEFT JOIN personnel pe ON pe.email = u.email
        WHERE p.role = 'admin' 
           OR pe.department IN ('Kalite', 'Kalite Kontrol', 'Dokümantasyon')
        LIMIT 20;
        
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                'DOCUMENT_EXPIRING',
                format('Uyarı: %s Doküman Geçerlilik Süresi Yaklaşıyor', v_expiring_count + v_expired_count),
                v_message,
                'document',
                NULL,
                CASE 
                    WHEN v_expired_count > 0 THEN 'HIGH'
                    WHEN v_expiring_count >= 10 THEN 'NORMAL'
                    ELSE 'LOW'
                END,
                '/document'
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Açık NC'lerin Yaş Analizi
CREATE OR REPLACE FUNCTION notify_old_open_ncs()
RETURNS void AS $$
DECLARE
    v_old_nc_count INTEGER;
    v_very_old_nc_count INTEGER;
    v_admin_user_ids UUID[];
    v_message TEXT;
BEGIN
    -- 60+ gündür açık NC'ler
    SELECT COUNT(*) INTO v_old_nc_count
    FROM non_conformities
    WHERE status NOT IN ('Kapatıldı', 'Reddedildi')
      AND created_at < CURRENT_DATE - INTERVAL '60 days';
    
    -- 120+ gündür açık NC'ler
    SELECT COUNT(*) INTO v_very_old_nc_count
    FROM non_conformities
    WHERE status NOT IN ('Kapatıldı', 'Reddedildi')
      AND created_at < CURRENT_DATE - INTERVAL '120 days';
    
    -- Eğer eski açık NC'ler varsa uyarı gönder
    IF v_old_nc_count > 0 THEN
        v_message := format('Sistemde %s adet 60+ gündür açık uygunsuzluk kaydı bulunmaktadır.', v_old_nc_count);
        
        IF v_very_old_nc_count > 0 THEN
            v_message := v_message || format(' Bunlardan %s tanesi 120+ gündür açık.', v_very_old_nc_count);
        END IF;
        
        -- Admin ve kalite yöneticilerine bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_admin_user_ids
        FROM auth.users u
        LEFT JOIN profiles p ON p.id = u.id
        LEFT JOIN personnel pe ON pe.email = u.email
        WHERE p.role = 'admin' 
           OR pe.department IN ('Kalite', 'Kalite Kontrol', 'Kalite Yönetimi')
        LIMIT 20;
        
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                '8D_OVERDUE',
                format('Uyarı: %s Eski Açık NC Kaydı', v_old_nc_count),
                v_message,
                'df-8d',
                NULL,
                CASE 
                    WHEN v_very_old_nc_count > 0 THEN 'CRITICAL'
                    WHEN v_old_nc_count >= 10 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                '/df-8d'
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Tüm Akıllı Bildirimleri Çalıştıran Ana Fonksiyon
CREATE OR REPLACE FUNCTION run_all_smart_notifications()
RETURNS void AS $$
BEGIN
    -- Tüm akıllı bildirimleri sırayla çalıştır
    PERFORM notify_missing_audits();
    PERFORM notify_upcoming_deadlines();
    PERFORM notify_low_nc_activity();
    PERFORM notify_overdue_calibrations_summary();
    PERFORM notify_expiring_documents_summary();
    PERFORM notify_old_open_ncs();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_missing_audits IS 'Uzun süredir iç tetkik yapılmamışsa uyarı gönderir';
COMMENT ON FUNCTION notify_upcoming_deadlines IS 'Yaklaşan terminler için genel uyarılar gönderir';
COMMENT ON FUNCTION notify_low_nc_activity IS 'Uzun süredir NC oluşturulmamışsa uyarı gönderir';
COMMENT ON FUNCTION notify_overdue_calibrations_summary IS 'Gecikmiş kalibrasyonlar için özet uyarı gönderir';
COMMENT ON FUNCTION notify_expiring_documents_summary IS 'Geçerlilik süresi yaklaşan dokümanlar için özet uyarı gönderir';
COMMENT ON FUNCTION notify_old_open_ncs IS 'Eski açık NC kayıtları için uyarı gönderir';
COMMENT ON FUNCTION run_all_smart_notifications IS 'Tüm akıllı bildirimleri çalıştırır. Günlük cron job olarak çağrılmalıdır.';

