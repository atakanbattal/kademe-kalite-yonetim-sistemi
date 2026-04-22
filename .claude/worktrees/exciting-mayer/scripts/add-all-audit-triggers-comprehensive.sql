-- ============================================================================
-- KAPSAMLI AUDIT LOGGING SİSTEMİ - TÜM TABLOLAR İÇİN
-- ============================================================================
-- Bu script veritabanındaki TÜM tablolara audit trigger ekler
-- Böylece her türlü işlem (INSERT, UPDATE, DELETE) otomatik olarak loglanır
-- ============================================================================

-- ============================================================================
-- 1. Audit Logging Function'ı Güncelle (Hata Güvenli)
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_action TEXT;
    v_details JSONB;
    v_table_name TEXT;
BEGIN
    -- Current user bilgilerini al
    v_user_id := auth.uid();
    
    -- User full name'i profiles tablosundan çek
    SELECT full_name INTO v_user_name
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Eğer profiles'da yoksa auth.users'dan çek
    IF v_user_name IS NULL THEN
        SELECT raw_user_meta_data->>'full_name' INTO v_user_name
        FROM auth.users
        WHERE id = v_user_id;
    END IF;
    
    -- Tablo adını al
    v_table_name := TG_TABLE_NAME;
    
    -- İşlem tipine göre action ve details belirle
    IF (TG_OP = 'INSERT') THEN
        v_action := 'EKLEME: ' || v_table_name;
        v_details := to_jsonb(NEW);
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'GÜNCELLEME: ' || v_table_name;
        v_details := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW),
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(to_jsonb(NEW))
                WHERE to_jsonb(NEW)->>key IS DISTINCT FROM to_jsonb(OLD)->>key
            )
        );
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'SİLME: ' || v_table_name;
        v_details := to_jsonb(OLD);
    END IF;
    
    -- Audit kaydını ekle (hata durumunda ana işlemi engellemesin)
    BEGIN
        INSERT INTO public.audit_log_entries (
            user_id,
            user_full_name,
            action,
            table_name,
            details,
            created_at
        ) VALUES (
            v_user_id,
            COALESCE(v_user_name, 'Sistem'),
            v_action,
            v_table_name,
            v_details,
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Hata durumunda sadece uyarı ver, ana işlemi engelleme
        RAISE WARNING 'Audit log kaydedilemedi: % (Table: %)', SQLERRM, v_table_name;
    END;
    
    -- Trigger'ın normal akışını bozmamak için uygun değeri döndür
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_entry() IS 'Tüm tablo işlemlerini otomatik olarak audit_log_entries tablosuna kaydeder (hata güvenli)';

-- ============================================================================
-- 2. Helper Function: Trigger Oluştur
-- ============================================================================
CREATE OR REPLACE FUNCTION create_audit_trigger(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Önce mevcut trigger'ı sil (varsa)
    EXECUTE format('DROP TRIGGER IF EXISTS audit_log_trigger ON %I', table_name);
    
    -- Yeni trigger oluştur
    EXECUTE format('
        CREATE TRIGGER audit_log_trigger
        AFTER INSERT OR UPDATE OR DELETE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION log_audit_entry()
    ', table_name);
    
    RAISE NOTICE '✅ Audit trigger created for table: %', table_name;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Trigger oluşturulamadı: % (Table: %)', SQLERRM, table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TÜM TABLOLARA TRIGGER EKLE
-- ============================================================================

-- Görev Yönetimi
SELECT create_audit_trigger('tasks');
SELECT create_audit_trigger('task_assignees');
SELECT create_audit_trigger('task_checklists');
SELECT create_audit_trigger('task_tags');
SELECT create_audit_trigger('task_tag_relations');
SELECT create_audit_trigger('task_comments');
SELECT create_audit_trigger('task_attachments');

-- Uygunsuzluklar (DF/8D/MDI)
SELECT create_audit_trigger('non_conformities');

-- Sapma Yönetimi
SELECT create_audit_trigger('deviations');
SELECT create_audit_trigger('deviation_approvals');
SELECT create_audit_trigger('deviation_attachments');
SELECT create_audit_trigger('deviation_vehicles');

-- Tetkik Yönetimi
SELECT create_audit_trigger('audits');
SELECT create_audit_trigger('audit_findings');

-- Karantina
SELECT create_audit_trigger('quarantine_records');

-- Girdi Kalite Kontrol
SELECT create_audit_trigger('incoming_inspections');
SELECT create_audit_trigger('incoming_control_plans');
SELECT create_audit_trigger('incoming_inspection_results');
SELECT create_audit_trigger('incoming_inspection_defects');
SELECT create_audit_trigger('incoming_inspection_attachments');

-- Sac Malzemeleri
SELECT create_audit_trigger('sheet_metal_items');

-- Stok Risk Kontrol
SELECT create_audit_trigger('stock_risk_controls');

-- İNKR Raporları
SELECT create_audit_trigger('inkr_reports');

-- Kaizen
SELECT create_audit_trigger('kaizen_entries');

-- Ekipman & Kalibrasyon
SELECT create_audit_trigger('equipments');
SELECT create_audit_trigger('equipment_calibrations');
SELECT create_audit_trigger('equipment_assignments');

-- Tedarikçi Yönetimi
SELECT create_audit_trigger('suppliers');
SELECT create_audit_trigger('supplier_non_conformities');
SELECT create_audit_trigger('supplier_audits');
SELECT create_audit_trigger('supplier_certificates');
SELECT create_audit_trigger('supplier_scores');
SELECT create_audit_trigger('supplier_audit_plans');
SELECT create_audit_trigger('supplier_audit_attendees');
SELECT create_audit_trigger('supplier_audit_questions');

-- Doküman Yönetimi
SELECT create_audit_trigger('documents');
SELECT create_audit_trigger('document_revisions');

-- Personel
SELECT create_audit_trigger('personnel');

-- KPI
SELECT create_audit_trigger('kpis');

-- Müşteri Şikayetleri
SELECT create_audit_trigger('customers');
SELECT create_audit_trigger('customer_complaints');
SELECT create_audit_trigger('complaint_analyses');
SELECT create_audit_trigger('complaint_actions');
SELECT create_audit_trigger('complaint_documents');
SELECT create_audit_trigger('customer_communication_history');
SELECT create_audit_trigger('customer_scores');

-- Benchmark Yönetimi
SELECT create_audit_trigger('benchmark_categories');
SELECT create_audit_trigger('benchmarks');
SELECT create_audit_trigger('benchmark_items');
SELECT create_audit_trigger('benchmark_pros_cons');
SELECT create_audit_trigger('benchmark_criteria');
SELECT create_audit_trigger('benchmark_scores');
SELECT create_audit_trigger('benchmark_cost_analysis');
SELECT create_audit_trigger('benchmark_risk_analysis');
SELECT create_audit_trigger('benchmark_approvals');
SELECT create_audit_trigger('benchmark_reports');
SELECT create_audit_trigger('benchmark_documents');
SELECT create_audit_trigger('benchmark_activity_log');

-- Polivalans Yönetimi
SELECT create_audit_trigger('skill_categories');
SELECT create_audit_trigger('skills');
SELECT create_audit_trigger('personnel_skills');
SELECT create_audit_trigger('skill_training_records');
SELECT create_audit_trigger('skill_certification_records');

-- Eğitim Yönetimi
SELECT create_audit_trigger('trainings');
SELECT create_audit_trigger('training_participants');

-- WPS Yönetimi
SELECT create_audit_trigger('wps_procedures');

-- Üretilen Araçlar & Kalite Kontrol
SELECT create_audit_trigger('produced_vehicles');
SELECT create_audit_trigger('quality_inspections');
SELECT create_audit_trigger('quality_inspection_history');
SELECT create_audit_trigger('quality_inspection_faults');
SELECT create_audit_trigger('fault_categories');
SELECT create_audit_trigger('vehicle_timeline_events');

-- Kalite Maliyetleri
SELECT create_audit_trigger('quality_costs');

-- Maliyet Ayarları
SELECT create_audit_trigger('cost_settings');
SELECT create_audit_trigger('material_costs');

-- Ölçüm ve Karakteristikler
SELECT create_audit_trigger('characteristics');
SELECT create_audit_trigger('measurement_equipment');
SELECT create_audit_trigger('tolerance_standards');

-- Üretim Departmanları
SELECT create_audit_trigger('production_departments');

-- Profiller (kullanıcı profilleri - sadece kritik değişiklikler için)
-- SELECT create_audit_trigger('profiles'); -- Çok fazla log üretebilir, opsiyonel

-- ============================================================================
-- 4. Dinamik Olarak Tüm Tabloları Bul ve Trigger Ekle
-- ============================================================================
-- Eğer yukarıdaki listede olmayan tablolar varsa, bunları da ekle
DO $$
DECLARE
    table_record RECORD;
    excluded_tables TEXT[] := ARRAY[
        'audit_log_entries',  -- Audit log tablosunun kendisi
        'schema_migrations',  -- Migration tablosu
        'spatial_ref_sys',    -- PostGIS sistem tablosu
        'geography_columns',   -- PostGIS sistem tablosu
        'geometry_columns'    -- PostGIS sistem tablosu
    ];
    table_name TEXT;
BEGIN
    -- Public schema'daki tüm tabloları bul
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN (SELECT unnest(excluded_tables))
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_%'
    LOOP
        table_name := table_record.tablename;
        
        -- Bu tabloda trigger var mı kontrol et
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND event_object_table = table_name
            AND trigger_name = 'audit_log_trigger'
        ) THEN
            -- Trigger yoksa ekle
            BEGIN
                PERFORM create_audit_trigger(table_name);
                RAISE NOTICE '✅ Yeni tablo için trigger eklendi: %', table_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '⚠️ Tablo için trigger eklenemedi: % - %', table_name, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- 5. Helper Function'u Temizle
-- ============================================================================
DROP FUNCTION IF EXISTS create_audit_trigger(TEXT);

-- ============================================================================
-- 6. Başarı Raporu
-- ============================================================================
DO $$
DECLARE
    trigger_count INTEGER;
    table_count INTEGER;
BEGIN
    -- Toplam trigger sayısı
    SELECT COUNT(*)
    INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name = 'audit_log_trigger'
    AND trigger_schema = 'public';
    
    -- Toplam tablo sayısı
    SELECT COUNT(*)
    INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ KAPSAMLI AUDIT LOGGING SİSTEMİ BAŞARIYLA KURULDU!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '📊 Toplam Tablo Sayısı: %', table_count;
    RAISE NOTICE '🔍 Audit Trigger Sayısı: %', trigger_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık TÜM tablolardaki işlemler otomatik olarak loglanacak:';
    RAISE NOTICE '   • INSERT (Ekleme)';
    RAISE NOTICE '   • UPDATE (Güncelleme)';
    RAISE NOTICE '   • DELETE (Silme)';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Loglar audit_log_entries tablosunda görüntülenebilir.';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

