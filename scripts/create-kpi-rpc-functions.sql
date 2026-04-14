image.png-- Otomatik KPI RPC Fonksiyonları
-- Tüm modüllerden veri çekebilen KPI fonksiyonları

-- ============================================
-- SPC MODÜLÜ KPI'LARI
-- ============================================

-- Aktif SPC Karakteristik Sayısı
CREATE OR REPLACE FUNCTION get_active_spc_characteristics_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM spc_characteristics WHERE is_active = true);
END;
$$ LANGUAGE plpgsql;

-- Kontrol Dışı Proses Sayısı
CREATE OR REPLACE FUNCTION get_out_of_control_processes_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(DISTINCT characteristic_id)::INTEGER 
            FROM spc_control_charts 
            WHERE is_in_control = false);
END;
$$ LANGUAGE plpgsql;

-- Proses Yetenekli Oranı (Cp/Cpk > 1.33)
CREATE OR REPLACE FUNCTION get_capable_processes_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_capable INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM spc_capability_studies;
    SELECT COUNT(*) INTO v_capable FROM spc_capability_studies 
    WHERE (cp >= 1.33 AND cpk >= 1.33);
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_capable::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- MSA Çalışması Sayısı
CREATE OR REPLACE FUNCTION get_msa_studies_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM spc_msa_studies);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MPC MODÜLÜ KPI'LARI
-- ============================================

-- Aktif Üretim Planı Sayısı
CREATE OR REPLACE FUNCTION get_active_production_plans_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM production_plans 
            WHERE status IN ('Planned', 'In Progress'));
END;
$$ LANGUAGE plpgsql;

-- Kritik Karakteristik Sayısı (CC/SC)
CREATE OR REPLACE FUNCTION get_critical_characteristics_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM critical_characteristics 
            WHERE is_active = true);
END;
$$ LANGUAGE plpgsql;

-- Proses Parametresi Kayıt Sayısı (Son 30 gün)
CREATE OR REPLACE FUNCTION get_process_parameter_records_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM process_parameter_records 
            WHERE record_date >= NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROCESS VALIDATION MODÜLÜ KPI'LARI
-- ============================================

-- Aktif Validasyon Planı Sayısı
CREATE OR REPLACE FUNCTION get_active_validation_plans_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM validation_plans 
            WHERE status IN ('Planned', 'In Progress'));
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış Validasyon Oranı
CREATE OR REPLACE FUNCTION get_completed_validations_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM validation_plans;
    SELECT COUNT(*) INTO v_completed FROM validation_plans 
    WHERE status = 'Completed';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FMEA MODÜLÜ KPI'LARI
-- ============================================

-- Aktif FMEA Proje Sayısı
CREATE OR REPLACE FUNCTION get_active_fmea_projects_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM fmea_projects 
            WHERE status IN ('Active', 'In Review', 'Draft'));
END;
$$ LANGUAGE plpgsql;

-- Yüksek RPN Sayısı (RPN > 100)
CREATE OR REPLACE FUNCTION get_high_rpn_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM fmea_causes_controls 
            WHERE rpn > 100);
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış FMEA Aksiyon Planı Oranı
CREATE OR REPLACE FUNCTION get_completed_fmea_actions_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM fmea_action_plans;
    SELECT COUNT(*) INTO v_completed FROM fmea_action_plans 
    WHERE status = 'Completed';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PPAP/APQP MODÜLÜ KPI'LARI
-- ============================================

-- Aktif APQP Proje Sayısı
CREATE OR REPLACE FUNCTION get_active_apqp_projects_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM apqp_projects 
            WHERE status NOT IN ('Approved', 'Rejected', 'Completed'));
END;
$$ LANGUAGE plpgsql;

-- PPAP Onay Bekleyen Sayısı
CREATE OR REPLACE FUNCTION get_pending_ppap_approvals_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM ppap_submissions 
            WHERE submission_status IN ('Submitted', 'Draft'));
END;
$$ LANGUAGE plpgsql;

-- Run-at-Rate Tamamlanma Oranı
CREATE OR REPLACE FUNCTION get_run_at_rate_completion_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM run_at_rate_studies;
    SELECT COUNT(*) INTO v_completed FROM run_at_rate_studies 
    WHERE status = 'Completed';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DMAIC MODÜLÜ KPI'LARI
-- ============================================

-- Aktif DMAIC Proje Sayısı
CREATE OR REPLACE FUNCTION get_active_dmaic_projects_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM dmaic_projects 
            WHERE overall_status != 'Completed');
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış DMAIC Proje Sayısı
CREATE OR REPLACE FUNCTION get_completed_dmaic_projects_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM dmaic_projects 
            WHERE overall_status = 'Completed');
END;
$$ LANGUAGE plpgsql;

-- DMAIC Başarı Oranı
CREATE OR REPLACE FUNCTION get_dmaic_success_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM dmaic_projects;
    SELECT COUNT(*) INTO v_completed FROM dmaic_projects 
    WHERE overall_status = 'Completed';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MÜŞTERİ ŞİKAYETLERİ KPI'LARI
-- ============================================

-- Açık Müşteri Şikayeti Sayısı
CREATE OR REPLACE FUNCTION get_open_customer_complaints_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM customer_complaints 
            WHERE status NOT IN ('Kapalı', 'Çözüldü'));
END;
$$ LANGUAGE plpgsql;

-- SLA İçinde Çözülen Şikayet Oranı
CREATE OR REPLACE FUNCTION get_sla_compliant_complaints_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_sla_compliant INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM customer_complaints 
    WHERE status IN ('Kapalı', 'Çözüldü');
    
    SELECT COUNT(*) INTO v_sla_compliant FROM customer_complaints 
    WHERE status IN ('Kapalı', 'Çözüldü')
    AND actual_close_date IS NOT NULL
    AND target_close_date IS NOT NULL
    AND actual_close_date <= target_close_date;
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_sla_compliant::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- Ortalama Şikayet Çözüm Süresi (gün)
CREATE OR REPLACE FUNCTION get_avg_complaint_resolution_time()
RETURNS NUMERIC AS $$
DECLARE
    v_avg_days NUMERIC;
BEGIN
    SELECT AVG(EXTRACT(EPOCH FROM (actual_close_date - complaint_date)) / 86400)
    INTO v_avg_days
    FROM customer_complaints
    WHERE status IN ('Kapalı', 'Çözüldü')
    AND actual_close_date IS NOT NULL
    AND complaint_date IS NOT NULL;
    
    RETURN COALESCE(ROUND(v_avg_days, 2), 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TEDARİKÇİ KALİTE KPI'LARI
-- ============================================

-- Aktif Tedarikçi Sayısı
CREATE OR REPLACE FUNCTION get_active_suppliers_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM suppliers WHERE status = 'Onaylı');
END;
$$ LANGUAGE plpgsql;

-- Ortalama Tedarikçi Skoru (onaylı tedarikçi başına son dönem skor kartı)
CREATE OR REPLACE FUNCTION get_avg_supplier_score()
RETURNS NUMERIC AS $$
DECLARE
    v_avg_score NUMERIC;
BEGIN
    WITH latest AS (
        SELECT DISTINCT ON (ss.supplier_id)
            ss.supplier_id,
            ss.final_score
        FROM supplier_scores ss
        ORDER BY ss.supplier_id, ss.period DESC NULLS LAST, ss.created_at DESC
    )
    SELECT AVG(l.final_score) INTO v_avg_score
    FROM latest l
    INNER JOIN suppliers s ON s.id = l.supplier_id AND s.status = 'Onaylı';
    RETURN COALESCE(ROUND(v_avg_score, 2), 0);
END;
$$ LANGUAGE plpgsql;

-- Tedarikçi Uygunsuzluk Oranı (girdi kalite muayeneleri: ret miktarı / gelen miktar)
-- Aynı mantık: get_incoming_rejection_rate — tek kaynak
CREATE OR REPLACE FUNCTION get_supplier_nc_rate()
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT get_incoming_rejection_rate();
$$;

-- ============================================
-- KAIZEN MODÜLÜ KPI'LARI
-- ============================================

-- Aktif Kaizen Sayısı
-- Kapandı ve Reddedildi hariç tümü aktif
CREATE OR REPLACE FUNCTION get_active_kaizen_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM kaizen_entries 
            WHERE status NOT IN ('Kapandı', 'Reddedildi'));
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış Kaizen Sayısı
-- Kapandı durumu tamamlanmış sayılır
CREATE OR REPLACE FUNCTION get_completed_kaizen_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM kaizen_entries 
            WHERE status = 'Kapandı');
END;
$$ LANGUAGE plpgsql;

-- Kaizen Başarı Oranı
-- Kapandı / (Toplam - Reddedildi - Askıda)
CREATE OR REPLACE FUNCTION get_kaizen_success_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    -- Reddedildi ve Askıda hariç toplam
    SELECT COUNT(*) INTO v_total FROM kaizen_entries 
    WHERE status NOT IN ('Reddedildi', 'Askıda');
    
    -- Kapandı olanlar
    SELECT COUNT(*) INTO v_completed FROM kaizen_entries 
    WHERE status = 'Kapandı';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EĞİTİM MODÜLÜ KPI'LARI
-- ============================================

-- Planlanmış Eğitim Sayısı
CREATE OR REPLACE FUNCTION get_planned_trainings_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM trainings 
            WHERE (start_date >= CURRENT_DATE OR scheduled_date >= CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış Eğitim Sayısı (Türkçe + İngilizce durum)
CREATE OR REPLACE FUNCTION get_completed_trainings_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM trainings
            WHERE status IN ('Tamamlandı', 'Tamamlandi', 'Completed'));
END;
$$ LANGUAGE plpgsql;

-- Eğitim Katılım Oranı
CREATE OR REPLACE FUNCTION get_training_participation_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total_participants INTEGER;
    v_attended_participants INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_participants FROM training_participants;
    SELECT COUNT(*) INTO v_attended_participants FROM training_participants 
    WHERE status = 'Tamamlandı';
    
    IF v_total_participants = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_attended_participants::NUMERIC / v_total_participants::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POLİVALANS MODÜLÜ KPI'LARI
-- ============================================

-- Ortalama Polivalans Skoru
CREATE OR REPLACE FUNCTION get_avg_polyvalence_score()
RETURNS NUMERIC AS $$
DECLARE
    v_avg_score NUMERIC;
BEGIN
    SELECT AVG(current_level) INTO v_avg_score FROM personnel_skills;
    RETURN COALESCE(ROUND(v_avg_score, 2), 0);
END;
$$ LANGUAGE plpgsql;

-- Kritik Yetkinlik Eksikliği Sayısı
CREATE OR REPLACE FUNCTION get_critical_skill_gaps_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM personnel_skills ps
            JOIN skills s ON ps.skill_id = s.id
            WHERE s.is_critical = true
            AND ps.current_level < s.target_level);
END;
$$ LANGUAGE plpgsql;

-- Sertifika Geçerlilik Durumu (Geçersiz sertifika sayısı)
CREATE OR REPLACE FUNCTION get_expired_certifications_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM personnel_skills 
            WHERE is_certified = true
            AND certification_expiry_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ÜRETİLEN ARAÇLAR KPI'LARI
-- ============================================

-- Üretilen Araç Sayısı (Son 30 gün)
CREATE OR REPLACE FUNCTION get_produced_vehicles_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM produced_vehicles 
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- Kalite Kontrol Geçiş Oranı
CREATE OR REPLACE FUNCTION get_quality_inspection_pass_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_passed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM quality_inspections;
    SELECT COUNT(*) INTO v_passed FROM quality_inspections 
    WHERE status = 'Onaylandı';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_passed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- Ortalama Kalite Kontrol Süresi (gün) - Sadece control_start→control_end (yeniden işlem hariç)
CREATE OR REPLACE FUNCTION get_avg_quality_inspection_time()
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_avg_days NUMERIC;
BEGIN
    WITH waiting_ts AS (
        SELECT inspection_id, MIN(event_timestamp) AS ts
        FROM vehicle_timeline_events
        WHERE event_type = 'waiting_for_shipping_info'
        GROUP BY inspection_id
    ),
    control_starts AS (
        SELECT vte.inspection_id, vte.event_timestamp,
            ROW_NUMBER() OVER (PARTITION BY vte.inspection_id ORDER BY vte.event_timestamp) AS rn
        FROM vehicle_timeline_events vte
        WHERE vte.event_type = 'control_start'
        AND (NOT EXISTS (SELECT 1 FROM waiting_ts w WHERE w.inspection_id = vte.inspection_id)
             OR vte.event_timestamp < (SELECT ts FROM waiting_ts w2 WHERE w2.inspection_id = vte.inspection_id))
    ),
    control_ends AS (
        SELECT vte.inspection_id, vte.event_timestamp,
            ROW_NUMBER() OVER (PARTITION BY vte.inspection_id ORDER BY vte.event_timestamp) AS rn
        FROM vehicle_timeline_events vte
        WHERE vte.event_type = 'control_end'
        AND (NOT EXISTS (SELECT 1 FROM waiting_ts w WHERE w.inspection_id = vte.inspection_id)
             OR vte.event_timestamp < (SELECT ts FROM waiting_ts w2 WHERE w2.inspection_id = vte.inspection_id))
    ),
    pairs AS (
        SELECT s.inspection_id,
            EXTRACT(EPOCH FROM (e.event_timestamp - s.event_timestamp)) / 86400 AS duration_days
        FROM control_starts s
        JOIN control_ends e ON s.inspection_id = e.inspection_id AND s.rn = e.rn
    ),
    per_inspection AS (
        SELECT inspection_id, SUM(duration_days) AS total_control_days
        FROM pairs
        GROUP BY inspection_id
    )
    SELECT AVG(total_control_days)::NUMERIC INTO v_avg_days FROM per_inspection;

    RETURN COALESCE(ROUND(v_avg_days, 2), 0);
END;
$$;

-- ============================================
-- BENCHMARK MODÜLÜ KPI'LARI
-- ============================================

-- Aktif Benchmark Sayısı
CREATE OR REPLACE FUNCTION get_active_benchmarks_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM benchmarks 
            WHERE status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal'));
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış Benchmark Sayısı
CREATE OR REPLACE FUNCTION get_completed_benchmarks_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM benchmarks 
            WHERE status IN ('Completed', 'Tamamlandı'));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- WPS MODÜLÜ KPI'LARI
-- ============================================

-- Aktif WPS Prosedürü Sayısı
CREATE OR REPLACE FUNCTION get_active_wps_procedures_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM wps_procedures 
            WHERE status = 'Active');
END;
$$ LANGUAGE plpgsql;

-- Onay Bekleyen WPS Sayısı
CREATE OR REPLACE FUNCTION get_pending_wps_approvals_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM wps_procedures 
            WHERE status = 'Pending Approval');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GÖREV YÖNETİMİ KPI'LARI
-- ============================================

-- Açık Görev Sayısı
CREATE OR REPLACE FUNCTION get_open_tasks_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM tasks 
            WHERE status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal'));
END;
$$ LANGUAGE plpgsql;

-- Gecikmiş Görev Sayısı
CREATE OR REPLACE FUNCTION get_overdue_tasks_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM tasks 
            WHERE status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal')
            AND due_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Görev Tamamlanma Oranı
CREATE OR REPLACE FUNCTION get_task_completion_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM tasks;
    SELECT COUNT(*) INTO v_completed FROM tasks 
    WHERE status IN ('Completed', 'Tamamlandı');
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MÜŞTERİ MEMNUNİYETİ KPI'LARI
-- ============================================

-- NPS Skoru (Net Promoter Score)
CREATE OR REPLACE FUNCTION get_nps_score()
RETURNS NUMERIC AS $$
DECLARE
    v_promoters INTEGER;
    v_detractors INTEGER;
    v_total INTEGER;
    v_nps NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total FROM customer_satisfaction_surveys;
    SELECT COUNT(*) INTO v_promoters FROM customer_satisfaction_surveys 
    WHERE nps_score >= 9;
    SELECT COUNT(*) INTO v_detractors FROM customer_satisfaction_surveys 
    WHERE nps_score <= 6;
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    v_nps := ((v_promoters::NUMERIC / v_total::NUMERIC) - (v_detractors::NUMERIC / v_total::NUMERIC)) * 100;
    RETURN ROUND(v_nps, 2);
END;
$$ LANGUAGE plpgsql;

-- Memnuniyet Anketi Sayısı
CREATE OR REPLACE FUNCTION get_satisfaction_surveys_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM customer_satisfaction_surveys);
END;
$$ LANGUAGE plpgsql;

-- Ortalama Müşteri Memnuniyet Skoru
CREATE OR REPLACE FUNCTION get_avg_customer_satisfaction_score()
RETURNS NUMERIC AS $$
DECLARE
    v_avg_score NUMERIC;
BEGIN
    SELECT AVG(overall_score) INTO v_avg_score FROM customer_satisfaction_surveys;
    RETURN COALESCE(ROUND(v_avg_score, 2), 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TEDARİKÇİ GELİŞTİRME KPI'LARI
-- ============================================

-- Aktif Geliştirme Planı Sayısı
CREATE OR REPLACE FUNCTION get_active_supplier_development_plans_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM supplier_development_plans 
            WHERE current_status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal'));
END;
$$ LANGUAGE plpgsql;

-- Tamamlanmış Geliştirme Planı Sayısı
CREATE OR REPLACE FUNCTION get_completed_supplier_development_plans_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM supplier_development_plans 
            WHERE current_status IN ('Completed', 'Tamamlandı'));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EKİPMAN — Kalibrasyon gecikmesi (ekipman başına son kayıt)
-- ============================================
CREATE OR REPLACE FUNCTION get_calibration_due_count()
RETURNS INTEGER AS $$
  WITH latest AS (
    SELECT DISTINCT ON (ec.equipment_id)
      ec.equipment_id,
      ec.next_calibration_date,
      ec.is_active
    FROM equipment_calibrations ec
    ORDER BY ec.equipment_id, ec.calibration_date DESC NULLS LAST, ec.created_at DESC NULLS LAST
  )
  SELECT COUNT(*)::INTEGER
  FROM latest l
  JOIN equipments e ON e.id = l.equipment_id
  WHERE e.status IS DISTINCT FROM 'Hurdaya Ayrıldı'
    AND (l.is_active IS NULL OR l.is_active = true)
    AND l.next_calibration_date IS NOT NULL
    AND l.next_calibration_date < CURRENT_DATE;
$$ LANGUAGE sql STABLE;

-- ============================================
-- İÇ TETKİK — Son 30 günde tamamlanan
-- ============================================
CREATE OR REPLACE FUNCTION get_completed_internal_audits_30d_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM audits
  WHERE status = 'Tamamlandı'
    AND COALESCE(updated_at, created_at) >= (CURRENT_TIMESTAMP - INTERVAL '30 days');
$$ LANGUAGE sql STABLE;

