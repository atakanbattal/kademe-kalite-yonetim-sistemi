-- Eksik Audit Trigger'ları Ekle
-- Tüm modüllerdeki hareketlerin loglanması için eksik trigger'ları ekler

-- ============================================================================
-- Helper function'u geçici olarak oluştur
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
    
    RAISE NOTICE 'Audit trigger created for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EKSİK MODÜLLER İÇİN TRIGGER'LAR
-- ============================================================================

-- Görev Yönetimi (tasks tablosu için trigger ekle)
SELECT create_audit_trigger('tasks');
SELECT create_audit_trigger('task_assignees');
SELECT create_audit_trigger('task_checklists');
SELECT create_audit_trigger('task_tags');

-- Sac Malzeme Girişleri
SELECT create_audit_trigger('sheet_metal_items');

-- Stok Risk Kontrol
SELECT create_audit_trigger('stock_risk_controls');

-- İNKR Raporları
SELECT create_audit_trigger('inkr_reports');

-- Müşteri Şikayet Alt Tabloları
SELECT create_audit_trigger('complaint_analyses');
SELECT create_audit_trigger('complaint_actions');
SELECT create_audit_trigger('complaint_documents');
SELECT create_audit_trigger('customers');

-- Benchmark Modülü (Tüm Tablolar)
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

-- Polivalans Modülü
SELECT create_audit_trigger('skill_categories');
SELECT create_audit_trigger('skills');
SELECT create_audit_trigger('personnel_skills');
SELECT create_audit_trigger('skill_training_records');
SELECT create_audit_trigger('skill_certification_records');

-- Gelen Kalite Kontrol Alt Tabloları
SELECT create_audit_trigger('incoming_control_plans');
SELECT create_audit_trigger('incoming_inspection_results');
SELECT create_audit_trigger('incoming_inspection_defects');
SELECT create_audit_trigger('incoming_inspection_attachments');

-- Sapma Alt Tabloları
SELECT create_audit_trigger('deviation_attachments');
SELECT create_audit_trigger('deviation_vehicles');

-- Tedarikçi Alt Tabloları
SELECT create_audit_trigger('supplier_certificates');
SELECT create_audit_trigger('supplier_scores');
SELECT create_audit_trigger('supplier_audit_plans');
SELECT create_audit_trigger('supplier_audit_attendees');

-- Doküman Alt Tabloları
-- (document_revisions zaten var, diğerleri kontrol edilecek)

-- Üretilen Araçlar Alt Tabloları
SELECT create_audit_trigger('quality_inspection_faults');
SELECT create_audit_trigger('fault_categories');

-- Ekipman Alt Tabloları
SELECT create_audit_trigger('equipment_assignments');

-- Maliyet Ayarları
SELECT create_audit_trigger('cost_settings');
SELECT create_audit_trigger('material_costs');

-- Ölçüm ve Karakteristikler
SELECT create_audit_trigger('characteristics');
SELECT create_audit_trigger('measurement_equipment');
SELECT create_audit_trigger('tolerance_standards');

-- Tedarikçi Audit Soruları
SELECT create_audit_trigger('supplier_audit_questions');

-- ============================================================================
-- Helper function'u temizle
-- ============================================================================
DROP FUNCTION IF EXISTS create_audit_trigger(TEXT);

-- ============================================================================
-- Başarı Mesajı
-- ============================================================================
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name = 'audit_log_trigger'
    AND trigger_schema = 'public';
    
    RAISE NOTICE '✅ Eksik audit trigger''ları başarıyla eklendi!';
    RAISE NOTICE '📋 Toplam % tablo için audit trigger aktif.', trigger_count;
    RAISE NOTICE '🔍 Artık tüm modül hareketleri audit_log_entries tablosunda izlenecek.';
END $$;

