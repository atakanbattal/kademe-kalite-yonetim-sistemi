-- ====================================================
-- Eksik Audit Trigger'ları Ekleme
-- ====================================================
-- Bu migration tüm eksik tablolara audit trigger ekler
-- ====================================================

-- Helper Function: Trigger Oluştur
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
-- EKSİK TABLOLARA TRIGGER EKLE
-- ============================================================================

-- APQP Modülü
SELECT create_audit_trigger('apqp_projects');
SELECT create_audit_trigger('apqp_phases');
SELECT create_audit_trigger('ppap_documents');
SELECT create_audit_trigger('ppap_submissions');
SELECT create_audit_trigger('run_at_rate_studies');

-- FMEA Modülü
SELECT create_audit_trigger('fmea_projects');
SELECT create_audit_trigger('fmea_functions');
SELECT create_audit_trigger('fmea_failure_modes');
SELECT create_audit_trigger('fmea_causes_controls');
SELECT create_audit_trigger('fmea_action_plans');

-- DMAIC Modülü
SELECT create_audit_trigger('dmaic_projects');
SELECT create_audit_trigger('dmaic_phase_details');
SELECT create_audit_trigger('dmaic_action_plans');

-- Doküman Yönetimi (eksikler)
SELECT create_audit_trigger('document_folders');
SELECT create_audit_trigger('document_approvals');
SELECT create_audit_trigger('document_comments');
SELECT create_audit_trigger('document_access_logs');
SELECT create_audit_trigger('document_notifications');

-- Tedarikçi Dokümanları
SELECT create_audit_trigger('supplier_documents');

-- Ekipman Yönetimi (eksikler)
SELECT create_audit_trigger('equipment_spare_parts');
SELECT create_audit_trigger('maintenance_plans');
SELECT create_audit_trigger('maintenance_breakdowns');
SELECT create_audit_trigger('maintenance_work_orders');
SELECT create_audit_trigger('maintenance_checklists');

-- Kaizen (eksikler)
SELECT create_audit_trigger('kaizen_tags');
SELECT create_audit_trigger('kaizen_entry_tags');

-- Müşteri Yönetimi (eksikler)
SELECT create_audit_trigger('customer_satisfaction_surveys');
SELECT create_audit_trigger('customer_survey_questions');
SELECT create_audit_trigger('customer_feedback');
SELECT create_audit_trigger('customer_satisfaction_trends');
SELECT create_audit_trigger('customer_scores');

-- Benchmark (eksikler)
SELECT create_audit_trigger('benchmark_categories');
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

-- Polivalans (eksikler)
SELECT create_audit_trigger('skill_categories');
SELECT create_audit_trigger('skills');
SELECT create_audit_trigger('personnel_skills');
SELECT create_audit_trigger('skill_training_records');
SELECT create_audit_trigger('skill_certification_records');
SELECT create_audit_trigger('skill_assessments');
SELECT create_audit_trigger('polyvalence_targets');

-- Eğitim Yönetimi (eksikler)
SELECT create_audit_trigger('training_documents');
SELECT create_audit_trigger('training_exams');
SELECT create_audit_trigger('training_exam_questions');
SELECT create_audit_trigger('training_exam_answers');

-- SPC & Ölçüm (eksikler)
SELECT create_audit_trigger('spc_characteristics');
SELECT create_audit_trigger('spc_measurements');
SELECT create_audit_trigger('spc_control_charts');
SELECT create_audit_trigger('spc_capability_studies');
SELECT create_audit_trigger('spc_msa_studies');
SELECT create_audit_trigger('spc_msa_measurements');
SELECT create_audit_trigger('measurement_methods');
SELECT create_audit_trigger('tolerance_values');

-- Validation Plans
SELECT create_audit_trigger('validation_plans');
SELECT create_audit_trigger('validation_protocols');
SELECT create_audit_trigger('validation_tests');

-- Process Control
SELECT create_audit_trigger('process_control_equipment');
SELECT create_audit_trigger('process_control_plans');
SELECT create_audit_trigger('process_control_documents');
SELECT create_audit_trigger('process_control_notes');
SELECT create_audit_trigger('process_parameters');
SELECT create_audit_trigger('process_parameter_records');

-- Critical Characteristics
SELECT create_audit_trigger('critical_characteristics');

-- Lot Traceability
SELECT create_audit_trigger('lot_traceability');

-- Production Plans
SELECT create_audit_trigger('production_plans');

-- Products
SELECT create_audit_trigger('products');
SELECT create_audit_trigger('product_categories');

-- Audit Standards & Types
SELECT create_audit_trigger('audit_standards');
SELECT create_audit_trigger('audit_types');
SELECT create_audit_trigger('audit_question_bank');
SELECT create_audit_trigger('audit_results');

-- Supplier Development
SELECT create_audit_trigger('supplier_development_plans');
SELECT create_audit_trigger('supplier_development_actions');
SELECT create_audit_trigger('supplier_development_assessments');

-- Analytics & Reports
SELECT create_audit_trigger('quality_analytics_reports');
SELECT create_audit_trigger('quality_trends');
SELECT create_audit_trigger('quality_forecasts');
SELECT create_audit_trigger('quality_comparisons');

-- Helper Function'u Temizle
DROP FUNCTION IF EXISTS create_audit_trigger(TEXT);

-- ============================================================================
-- Başarı Raporu
-- ============================================================================
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND trigger_name = 'audit_log_trigger';
    
    RAISE NOTICE '✅ Toplam % audit trigger aktif', trigger_count;
END $$;

