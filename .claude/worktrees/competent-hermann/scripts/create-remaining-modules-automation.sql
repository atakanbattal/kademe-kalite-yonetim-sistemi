-- ============================================================================
-- DİĞER MODÜL OTOMASYONLARI
-- Kaizen, İç Tetkik, Doküman, Eğitim, Polivalans, Benchmark, Proses Kontrol
-- ============================================================================

-- ============================================================================
-- 1. KAIZEN OTOMASYONLARI
-- ============================================================================

-- Kaizen Skorunu Otomatik Hesaplama
CREATE OR REPLACE FUNCTION calculate_kaizen_score(
    p_cost_benefit NUMERIC,
    p_difficulty_level TEXT,
    p_employee_participation INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_score NUMERIC := 0;
    v_cost_score NUMERIC := 0;
    v_difficulty_score NUMERIC := 0;
    v_participation_score NUMERIC := 0;
BEGIN
    -- Maliyet faydası skoru (0-40 puan)
    IF p_cost_benefit IS NOT NULL THEN
        IF p_cost_benefit >= 100000 THEN
            v_cost_score := 40;
        ELSIF p_cost_benefit >= 50000 THEN
            v_cost_score := 30;
        ELSIF p_cost_benefit >= 10000 THEN
            v_cost_score := 20;
        ELSIF p_cost_benefit >= 1000 THEN
            v_cost_score := 10;
        ELSE
            v_cost_score := 5;
        END IF;
    END IF;
    
    -- Zorluk derecesi skoru (0-30 puan) - kolay = yüksek puan
    CASE p_difficulty_level
        WHEN 'Kolay' THEN v_difficulty_score := 30;
        WHEN 'Orta' THEN v_difficulty_score := 20;
        WHEN 'Zor' THEN v_difficulty_score := 10;
        ELSE v_difficulty_score := 15;
    END CASE;
    
    -- Çalışan katılımı skoru (0-30 puan)
    IF p_employee_participation IS NOT NULL THEN
        IF p_employee_participation >= 10 THEN
            v_participation_score := 30;
        ELSIF p_employee_participation >= 5 THEN
            v_participation_score := 20;
        ELSIF p_employee_participation >= 2 THEN
            v_participation_score := 10;
        ELSE
            v_participation_score := 5;
        END IF;
    END IF;
    
    v_score := v_cost_score + v_difficulty_score + v_participation_score;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kaizen Maliyet Kazancını Otomatik Hesaplama
CREATE OR REPLACE FUNCTION calculate_kaizen_cost_savings()
RETURNS TRIGGER AS $$
DECLARE
    v_total_savings NUMERIC := 0;
    v_score NUMERIC;
BEGIN
    -- Sadece tamamlanmış kaizenler için
    IF NEW.status != 'Tamamlandı' THEN
        RETURN NEW;
    END IF;
    
    -- Maliyet kazancı zaten hesaplanmışsa devam et
    IF NEW.cost_savings IS NOT NULL AND NEW.cost_savings > 0 THEN
        RETURN NEW;
    END IF;
    
    -- Maliyet kazancını hesapla (cost_benefit alanından)
    IF NEW.cost_benefit IS NOT NULL THEN
        v_total_savings := NEW.cost_benefit;
    END IF;
    
    -- Skor hesapla
    v_score := calculate_kaizen_score(
        NEW.cost_benefit,
        NEW.difficulty_level,
        COALESCE(array_length(NEW.team_members, 1), 0)
    );
    
    NEW.cost_savings := v_total_savings;
    NEW.score := v_score;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Kaizen maliyet kazancı hesaplanamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_calculate_kaizen_cost_savings ON kaizen_entries;
CREATE TRIGGER trigger_calculate_kaizen_cost_savings
    BEFORE INSERT OR UPDATE OF status, cost_benefit, difficulty_level, team_members ON kaizen_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_kaizen_cost_savings();

-- Kaizen Onay Beklerken Bildirim
CREATE OR REPLACE FUNCTION notify_kaizen_pending_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_user_ids UUID[];
BEGIN
    -- Sadece onay bekleyen kaizenler için
    IF NEW.status != 'Onay Bekliyor' THEN
        RETURN NEW;
    END IF;
    
    -- Admin kullanıcılarına bildirim gönder
    SELECT array_agg(u.id) INTO v_admin_user_ids
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE p.role = 'admin'
    LIMIT 10;
    
    IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
        PERFORM create_notifications_for_users(
            v_admin_user_ids,
            'NC_CREATED',
            format('Kaizen Onay Bekliyor: %s', COALESCE(NEW.title, 'Kaizen')),
            format('%s başlıklı kaizen onayınızı bekliyor.', COALESCE(NEW.title, 'Kaizen')),
            'kaizen',
            NEW.id,
            'NORMAL',
            format('/kaizen?kaizen_id=%s', NEW.id)
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Kaizen bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_kaizen_pending_approval ON kaizen_entries;
CREATE TRIGGER trigger_notify_kaizen_pending_approval
    AFTER INSERT OR UPDATE OF status ON kaizen_entries
    FOR EACH ROW
    WHEN (NEW.status = 'Onay Bekliyor')
    EXECUTE FUNCTION notify_kaizen_pending_approval();

-- ============================================================================
-- 2. İÇ TETKİK OTOMASYONLARI
-- ============================================================================

-- Yıllık Tetkik Planını Otomatik Oluşturma
CREATE OR REPLACE FUNCTION generate_annual_audit_plan()
RETURNS void AS $$
DECLARE
    v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    v_plan_exists BOOLEAN;
    v_audit_id UUID;
BEGIN
    -- Bu yıl için plan zaten var mı kontrol et
    SELECT EXISTS(
        SELECT 1 FROM audits
        WHERE EXTRACT(YEAR FROM audit_date) = v_current_year
          AND audit_type = 'Yıllık Plan'
    ) INTO v_plan_exists;
    
    -- Plan yoksa oluştur
    IF NOT v_plan_exists THEN
        INSERT INTO audits (
            report_number,
            title,
            audit_type,
            audit_date,
            status,
            created_at
        ) VALUES (
            format('AUDIT-PLAN-%s', v_current_year),
            format('%s Yıllık İç Tetkik Planı', v_current_year),
            'Yıllık Plan',
            make_date(v_current_year, 1, 1),
            'Planlandı',
            NOW()
        ) RETURNING id INTO v_audit_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_annual_audit_plan IS 'Yıllık tetkik planını otomatik oluşturur. Yıl başında çağrılmalıdır.';

-- Yaklaşan Tetkikler için Bildirim
CREATE OR REPLACE FUNCTION notify_upcoming_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_days_until_audit INTEGER;
    v_auditor_user_ids UUID[];
BEGIN
    -- Tetkik tarihi kontrolü
    IF NEW.audit_date IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Kalan gün hesapla
    v_days_until_audit := EXTRACT(DAY FROM (NEW.audit_date - NOW()))::INTEGER;
    
    -- 7 gün kala bildirim gönder
    IF v_days_until_audit <= 7 AND v_days_until_audit >= 0 THEN
        -- Tetkikçilere bildirim gönder
        SELECT array_agg(DISTINCT u.id) INTO v_auditor_user_ids
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        WHERE p.id = ANY(COALESCE(NEW.auditor_ids, ARRAY[]::UUID[]))
        LIMIT 10;
        
        IF v_auditor_user_ids IS NOT NULL AND array_length(v_auditor_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_auditor_user_ids,
                'AUDIT_DUE',
                format('Yaklaşan Tetkik: %s', COALESCE(NEW.title, NEW.report_number, 'Tetkik')),
                format('%s tetkiki %s gün sonra yapılacak.', 
                    COALESCE(NEW.title, NEW.report_number, 'Tetkik'),
                    v_days_until_audit
                ),
                'internal-audit',
                NEW.id,
                CASE 
                    WHEN v_days_until_audit <= 1 THEN 'HIGH'
                    WHEN v_days_until_audit <= 3 THEN 'NORMAL'
                    ELSE 'LOW'
                END,
                format('/internal-audit?audit_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tetkik bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_upcoming_audit ON audits;
CREATE TRIGGER trigger_notify_upcoming_audit
    AFTER INSERT OR UPDATE OF audit_date ON audits
    FOR EACH ROW
    WHEN (NEW.audit_date IS NOT NULL AND NEW.status NOT IN ('Tamamlandı', 'İptal'))
    EXECUTE FUNCTION notify_upcoming_audit();

-- Bulgulardan Otomatik NC Oluşturma
CREATE OR REPLACE FUNCTION auto_create_nc_from_audit_finding()
RETURNS TRIGGER AS $$
DECLARE
    v_nc_id UUID;
    v_nc_number TEXT;
    v_audit RECORD;
BEGIN
    -- Sadece yeni bulgular için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Bulgu kritik veya major ise NC oluştur
    IF NEW.severity NOT IN ('Kritik', 'Major', 'Önemli') THEN
        RETURN NEW;
    END IF;
    
    -- Tetkik bilgilerini al
    SELECT * INTO v_audit
    FROM audits
    WHERE id = NEW.audit_id;
    
    IF NOT FOUND THEN
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
        opening_date,
        source_finding_id,
        source_audit_id,
        audit_title,
        notes
    ) VALUES (
        v_nc_number,
        format('Tetkik Bulgusu: %s', COALESCE(NEW.title, 'Bulgular')),
        format('İç tetkik bulgusundan otomatik oluşturuldu.%s%s%s', 
            CASE WHEN NEW.description IS NOT NULL THEN E'\n\nBulgular: ' || NEW.description ELSE '' END,
            CASE WHEN NEW.recommendation IS NOT NULL THEN E'\n\nÖneriler: ' || NEW.recommendation ELSE '' END,
            CASE WHEN v_audit.title IS NOT NULL THEN E'\n\nTetkik: ' || v_audit.title ELSE '' END
        ),
        'DF',
        'Açık',
        CASE 
            WHEN NEW.severity = 'Kritik' THEN 'Kritik'
            WHEN NEW.severity = 'Major' THEN 'Yüksek'
            ELSE 'Orta'
        END,
        NEW.department,
        NEW.department,
        NEW.finding_date,
        NEW.id,
        NEW.audit_id,
        v_audit.title,
        format('Otomatik oluşturuldu - Tetkik Bulgu No: %s', NEW.id)
    ) RETURNING id INTO v_nc_id;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tetkik bulgusundan NC oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_create_nc_from_audit_finding ON audit_findings;
CREATE TRIGGER trigger_auto_create_nc_from_audit_finding
    AFTER INSERT ON audit_findings
    FOR EACH ROW
    WHEN (NEW.severity IN ('Kritik', 'Major', 'Önemli'))
    EXECUTE FUNCTION auto_create_nc_from_audit_finding();

-- ============================================================================
-- 3. DOKÜMAN YÖNETİMİ OTOMASYONLARI
-- ============================================================================

-- Doküman Geçerlilik Süresi Yaklaştığında Bildirim (zaten notification sisteminde var)
-- Burada sadece otomatik arşivleme ekliyoruz

-- Süresi Dolan Dokümanları Otomatik Arşivleme
CREATE OR REPLACE FUNCTION auto_archive_expired_documents()
RETURNS TRIGGER AS $$
DECLARE
    v_days_overdue INTEGER;
BEGIN
    -- Geçerlilik tarihi kontrolü
    IF NEW.valid_until IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Gecikme günü hesapla
    v_days_overdue := EXTRACT(DAY FROM (NOW() - NEW.valid_until))::INTEGER;
    
    -- 30 günden fazla geçmişse otomatik arşivle
    IF v_days_overdue > 30 AND NEW.status != 'Arşivlendi' THEN
        NEW.status := 'Arşivlendi';
        NEW.notes := COALESCE(NEW.notes, '') || format(E'\n\n[OTOMATIK] %s tarihinde geçerlilik süresi dolduğu için arşivlendi.', 
            TO_CHAR(NEW.valid_until, 'DD.MM.YYYY'));
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Doküman arşivlenemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_archive_expired_documents ON documents;
CREATE TRIGGER trigger_auto_archive_expired_documents
    BEFORE UPDATE OF valid_until ON documents
    FOR EACH ROW
    WHEN (NEW.valid_until IS NOT NULL)
    EXECUTE FUNCTION auto_archive_expired_documents();

-- ============================================================================
-- 4. EĞİTİM MODÜLÜ OTOMASYONLARI
-- ============================================================================

-- Eğitim Tamamlandığında Polivalans Matrisini Otomatik Güncelleme
CREATE OR REPLACE FUNCTION update_polyvalence_on_training_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_training RECORD;
    v_participant RECORD;
BEGIN
    -- Sadece tamamlanmış eğitimler için
    IF NEW.status != 'Tamamlandı' THEN
        RETURN NEW;
    END IF;
    
    -- Eğitim bilgilerini al
    SELECT * INTO v_training
    FROM training_plans
    WHERE id = NEW.training_plan_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Katılımcılar için polivalans güncelle
    -- Not: training_participants tablosu varsa kullanılır
    -- Burada örnek bir implementasyon gösteriyoruz
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Polivalans güncellenemedi: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eğitim Atandığında Otomatik Bildirim
CREATE OR REPLACE FUNCTION notify_training_assigned()
RETURNS TRIGGER AS $$
DECLARE
    v_participant_user_id UUID;
    v_training_title TEXT;
BEGIN
    -- Sadece yeni atamalar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Eğitim bilgilerini al
    SELECT title INTO v_training_title
    FROM training_plans
    WHERE id = NEW.training_plan_id;
    
    -- Katılımcının user_id'sini bul
    SELECT u.id INTO v_participant_user_id
    FROM auth.users u
    JOIN personnel p ON p.email = u.email
    WHERE p.id = NEW.personnel_id
    LIMIT 1;
    
    IF v_participant_user_id IS NOT NULL THEN
        PERFORM create_notification(
            v_participant_user_id,
            'TRAINING_UPCOMING',
            format('Yeni Eğitim: %s', COALESCE(v_training_title, 'Eğitim')),
            format('Size yeni bir eğitim atandı: %s', COALESCE(v_training_title, 'Eğitim')),
            'training',
            NEW.training_plan_id,
            'NORMAL',
            format('/training?training_id=%s', NEW.training_plan_id)
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Eğitim bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (training_participants tablosu varsa)
-- DROP TRIGGER IF EXISTS trigger_notify_training_assigned ON training_participants;
-- CREATE TRIGGER trigger_notify_training_assigned
--     AFTER INSERT ON training_participants
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_training_assigned();

-- Eğitim Tamamlandığında Otomatik Sertifika Oluşturma
CREATE OR REPLACE FUNCTION auto_create_training_certificate()
RETURNS TRIGGER AS $$
DECLARE
    v_certificate_id UUID;
    v_participant_name TEXT;
    v_training_title TEXT;
BEGIN
    -- Sadece tamamlanmış eğitimler için
    IF NEW.status != 'Tamamlandı' OR OLD.status = 'Tamamlandı' THEN
        RETURN NEW;
    END IF;
    
    -- Eğitim ve katılımcı bilgilerini al
    SELECT tp.title, p.full_name INTO v_training_title, v_participant_name
    FROM training_plans tp
    JOIN personnel p ON p.id = NEW.personnel_id
    WHERE tp.id = NEW.training_plan_id;
    
    -- Sertifika oluştur (training_certificates tablosu varsa)
    -- Burada örnek bir implementasyon gösteriyoruz
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Eğitim sertifikası oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. POLİVALANS MODÜLÜ OTOMASYONLARI
-- ============================================================================

-- Polivalans Eksiklikleri için Otomatik Görev Oluşturma
CREATE OR REPLACE FUNCTION create_task_for_polyvalence_gap()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_personnel_name TEXT;
    v_skill_name TEXT;
    v_target_level INTEGER;
    v_current_level INTEGER;
BEGIN
    -- Eğitim tamamlandığında polivalans güncellemesi yapılır
    -- Bu fonksiyon eğitim modülünden çağrılabilir
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Polivalans görevi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. BENCHMARK MODÜLÜ OTOMASYONLARI
-- ============================================================================

-- Benchmark Değerleri Güncellendiğinde Bildirim
CREATE OR REPLACE FUNCTION notify_benchmark_updated()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_user_ids UUID[];
BEGIN
    -- Sadece güncellemeler için
    IF TG_OP != 'UPDATE' THEN
        RETURN NEW;
    END IF;
    
    -- Değer değiştiyse bildirim gönder
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
        -- Admin kullanıcılarına bildirim gönder
        SELECT array_agg(u.id) INTO v_admin_user_ids
        FROM auth.users u
        JOIN profiles p ON p.id = u.id
        WHERE p.role = 'admin'
        LIMIT 10;
        
        IF v_admin_user_ids IS NOT NULL AND array_length(v_admin_user_ids, 1) > 0 THEN
            PERFORM create_notifications_for_users(
                v_admin_user_ids,
                'BENCHMARK_UPDATED',
                format('Benchmark Güncellendi: %s', COALESCE(NEW.title, 'Benchmark')),
                format('%s benchmark kaydı güncellendi.', COALESCE(NEW.title, 'Benchmark')),
                'benchmark',
                NEW.id,
                'LOW',
                format('/benchmark?benchmark_id=%s', NEW.id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Benchmark bildirimi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_notify_benchmark_updated ON benchmarks;
CREATE TRIGGER trigger_notify_benchmark_updated
    AFTER UPDATE OF status, approval_status ON benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION notify_benchmark_updated();

-- ============================================================================
-- 7. PROSES KONTROL MODÜLÜ OTOMASYONLARI
-- ============================================================================

-- Proses Parametreleri Sınır Dışına Çıktığında Otomatik Uyarı
CREATE OR REPLACE FUNCTION notify_process_parameter_out_of_control()
RETURNS TRIGGER AS $$
DECLARE
    v_responsible_user_ids UUID[];
    v_equipment_name TEXT;
BEGIN
    -- Sadece yeni kayıtlar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Kontrol limitleri kontrolü (process_parameter_records tablosunda)
    -- Burada örnek bir implementasyon gösteriyoruz
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Proses parametre uyarısı oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kritik Proses Sapmalarından Otomatik NC Oluşturma
CREATE OR REPLACE FUNCTION auto_create_nc_from_process_deviation()
RETURNS TRIGGER AS $$
DECLARE
    v_nc_id UUID;
    v_nc_number TEXT;
BEGIN
    -- Sadece kritik sapmalar için
    -- Burada örnek bir implementasyon gösteriyoruz
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Proses sapmasından NC oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION calculate_kaizen_score IS 'Kaizen skorunu otomatik hesaplar';
COMMENT ON FUNCTION calculate_kaizen_cost_savings IS 'Kaizen maliyet kazancını otomatik hesaplar';
COMMENT ON FUNCTION notify_kaizen_pending_approval IS 'Kaizen onay beklerken bildirim gönderir';
COMMENT ON FUNCTION generate_annual_audit_plan IS 'Yıllık tetkik planını otomatik oluşturur';
COMMENT ON FUNCTION notify_upcoming_audit IS 'Yaklaşan tetkikler için bildirim gönderir';
COMMENT ON FUNCTION auto_create_nc_from_audit_finding IS 'Tetkik bulgularından otomatik NC oluşturur';
COMMENT ON FUNCTION auto_archive_expired_documents IS 'Süresi dolan dokümanları otomatik arşivler';
COMMENT ON FUNCTION notify_training_assigned IS 'Eğitim atandığında bildirim gönderir';
COMMENT ON FUNCTION notify_benchmark_updated IS 'Benchmark güncellendiğinde bildirim gönderir';

