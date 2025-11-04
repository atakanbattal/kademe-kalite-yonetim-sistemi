-- Kapsamlı Audit Logging Sistemi
-- Bu script tüm kritik modüllerdeki işlemleri otomatik olarak loglar

-- ============================================================================
-- 1. audit_log_entries tablosunu güncelle (table_name'i zorunlu yap)
-- ============================================================================
ALTER TABLE audit_log_entries
ALTER COLUMN table_name SET NOT NULL;

COMMENT ON COLUMN audit_log_entries.table_name IS 'İşlemin yapıldığı tablo adı';
COMMENT ON COLUMN audit_log_entries.action IS 'Yapılan işlem (EKLEME, GÜNCELLEME, SİLME vb.)';
COMMENT ON COLUMN audit_log_entries.details IS 'İşlem detayları (JSON formatında)';

-- ============================================================================
-- 2. Genel Audit Logging Function
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
    
    -- Audit kaydını ekle
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
    
    -- Trigger'ın normal akışını bozmamak için uygun değeri döndür
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_entry() IS 'Tüm kritik tablo işlemlerini otomatik olarak audit_log_entries tablosuna kaydeder';

-- ============================================================================
-- 3. Kritik Tablolara Trigger Ekle
-- ============================================================================

-- Helper function: Trigger varsa sil, yoksa oluştur
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
    
    RAISE NOTICE 'Audit trigger created for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Tüm Kritik Tablolar için Trigger Oluştur
-- ============================================================================

-- Kalite Maliyetleri
SELECT create_audit_trigger('quality_costs');

-- Uygunsuzluklar (DF/8D/MDI)
SELECT create_audit_trigger('non_conformities');

-- Sapma Yönetimi
SELECT create_audit_trigger('deviations');
SELECT create_audit_trigger('deviation_approvals');

-- Tetkik Yönetimi
SELECT create_audit_trigger('audits');
SELECT create_audit_trigger('audit_findings');

-- Karantina
SELECT create_audit_trigger('quarantine_records');

-- Girdi Kalite Kontrol
SELECT create_audit_trigger('incoming_inspections');

-- Kaizen
SELECT create_audit_trigger('kaizen_entries');

-- Ekipman & Kalibrasyon
SELECT create_audit_trigger('equipments');
SELECT create_audit_trigger('equipment_calibrations');

-- Tedarikçi Yönetimi
SELECT create_audit_trigger('suppliers');
SELECT create_audit_trigger('supplier_non_conformities');
SELECT create_audit_trigger('supplier_audits');

-- Doküman Yönetimi
SELECT create_audit_trigger('documents');
SELECT create_audit_trigger('document_revisions');

-- Personel
SELECT create_audit_trigger('personnel');

-- KPI
SELECT create_audit_trigger('kpis');

-- Müşteri Şikayetleri
SELECT create_audit_trigger('customer_complaints');

-- Eğitim Yönetimi
SELECT create_audit_trigger('trainings');
SELECT create_audit_trigger('training_participants');

-- WPS Yönetimi
SELECT create_audit_trigger('wps_procedures');

-- Görevler (mevcut manuel loglaması var ama trigger ile de destekleyelim)
-- SELECT create_audit_trigger('tasks');

-- Üretilen Araçlar
SELECT create_audit_trigger('produced_vehicles');
SELECT create_audit_trigger('quality_inspections');

-- ============================================================================
-- 5. Helper function'u temizle
-- ============================================================================
DROP FUNCTION IF EXISTS create_audit_trigger(TEXT);

-- ============================================================================
-- 6. Başarı Mesajı
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Kapsamlı audit logging sistemi başarıyla kuruldu!';
    RAISE NOTICE '📋 Toplam % tablo için audit trigger oluşturuldu.', (
        SELECT COUNT(*)
        FROM information_schema.triggers
        WHERE trigger_name = 'audit_log_trigger'
        AND trigger_schema = 'public'
    );
END $$;

