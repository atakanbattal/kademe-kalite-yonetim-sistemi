-- Açık sapma KPI ve ortalama muayene süresi (saat): canlı RPC + aylık kpi_monthly_actual ile uyum
-- Sapma: yalnızca status = 'Açık' (Kapandı/Kapatıldı yanlışlıkla sayılmaz)
-- Muayene süresi: gün yerine saat (Ortalama Muayene Süresi KPI birimi)

CREATE OR REPLACE FUNCTION public.get_open_deviation_count()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::numeric FROM public.deviations WHERE status = 'Açık';
$$;

COMMENT ON FUNCTION public.get_open_deviation_count() IS 'Açık statülü sapma talepleri — Sapma modülü ile uyumlu.';

CREATE OR REPLACE FUNCTION public.get_avg_quality_inspection_time()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    RETURN COALESCE(ROUND(v_avg_days * 24, 2), 0);
END;
$$;

COMMENT ON FUNCTION public.get_avg_quality_inspection_time() IS 'Ortalama kalite kontrol (muayene) süresi — control_start→control_end, sonuç saat cinsinden.';

-- KPI aylık gerçekleşen: tüm otomatik KPI id'leri için dönem [m_start, m_end)
-- + backfill + güncel değer senkronu (kpis.current_value)
CREATE OR REPLACE FUNCTION public.kpi_monthly_actual(p_kid text, m_start timestamptz, m_end timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $kpi$
DECLARE
  v numeric;
BEGIN
  v := NULL;

  IF p_kid = 'incoming_rejection_rate' THEN
    SELECT CASE WHEN COALESCE(SUM(quantity_received),0) = 0 THEN 0
      ELSE ROUND(COALESCE(SUM(quantity_rejected),0)::numeric / NULLIF(SUM(quantity_received),0) * 100, 2) END
      INTO v FROM incoming_inspections WHERE inspection_date >= m_start AND inspection_date < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'supplier_nc_rate' THEN
    SELECT CASE WHEN COALESCE(SUM(quantity_received),0) = 0 THEN 0
      ELSE ROUND(COALESCE(SUM(quantity_rejected),0)::numeric / NULLIF(SUM(quantity_received),0) * 100, 2) END
      INTO v FROM incoming_inspections WHERE inspection_date >= m_start AND inspection_date < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_non_conformities_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM non_conformities nc
      WHERE nc.created_at < m_end AND nc.status NOT IN ('Kapatıldı', 'Reddedildi')
        AND (nc.closed_at IS NULL OR nc.closed_at >= m_end);

    RETURN v;
  END IF;

  IF p_kid = 'open_8d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM non_conformities nc
      WHERE nc.type = '8D' AND nc.created_at < m_end AND nc.status <> 'Kapatıldı'
        AND (nc.closed_at IS NULL OR nc.closed_at >= m_end);

    RETURN v;
  END IF;

  IF p_kid = 'df_closure_rate' THEN
    SELECT CASE WHEN COUNT(*) FILTER (WHERE nc.type = 'DF' AND nc.status != 'Reddedildi') = 0 THEN 0
      ELSE ROUND(COUNT(*) FILTER (WHERE nc.type = 'DF' AND nc.status = 'Kapatıldı')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE nc.type = 'DF' AND nc.status != 'Reddedildi'), 0) * 100, 2) END INTO v
      FROM non_conformities nc WHERE nc.created_at >= m_start AND nc.created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_quality_nc_closure_time' THEN
    SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (nc.closed_at - nc.created_at)) / 86400)::numeric, 1), 0) INTO v
      FROM non_conformities nc WHERE nc.department = 'Kalite' AND nc.status = 'Kapatıldı'
        AND nc.closed_at IS NOT NULL AND nc.created_at IS NOT NULL
        AND nc.closed_at >= m_start AND nc.closed_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_nonconformity_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM nonconformity_records nr
      WHERE nr.created_at < m_end
        AND NOT (nr.status = 'Kapatıldı' AND COALESCE(nr.updated_at, nr.created_at) < m_end)
        AND NOT (nr.status IN ('DF Açıldı','8D Açıldı') AND nr.source_nc_id IS NOT NULL);

    RETURN v;
  END IF;

  IF p_kid = 'nonconformity_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM nonconformity_records
      WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'nonconformity_closure_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status = 'Kapatıldı')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM nonconformity_records WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'critical_nonconformity_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM nonconformity_records
      WHERE severity = 'Kritik' AND created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'nonconformity_df_8d_conversion_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status IN ('DF Açıldı','8D Açıldı'))::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM nonconformity_records WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'quarantine_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM quarantine_records qr
      WHERE qr.status = 'Karantinada' AND qr.created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'produced_vehicles_count' THEN
    IF to_regclass('public.produced_vehicles') IS NOT NULL THEN
      SELECT COUNT(*)::numeric INTO v FROM produced_vehicles pv
        WHERE pv.created_at >= m_start AND pv.created_at < m_end;
    END IF;

    RETURN v;
  END IF;

  IF p_kid = 'quality_inspection_pass_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE qi.status = 'Onaylandı')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM quality_inspections qi WHERE qi.quality_entry_at >= m_start AND qi.quality_entry_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_quality_process_time' THEN
    SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(qi.shipped_at, qi.updated_at) - qi.quality_entry_at)) / 86400)::numeric, 2), 0) INTO v
      FROM quality_inspections qi WHERE qi.quality_entry_at >= m_start AND qi.quality_entry_at < m_end AND qi.quality_entry_at IS NOT NULL;

    RETURN v;
  END IF;

  IF p_kid = 'avg_quality_inspection_time' THEN
    SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (e.event_timestamp - s.event_timestamp)) / 3600)::numeric, 2), 0) INTO v
      FROM vehicle_timeline_events s
      JOIN vehicle_timeline_events e ON s.inspection_id = e.inspection_id AND s.event_type = 'control_start' AND e.event_type = 'control_end'
      WHERE s.event_timestamp >= m_start AND s.event_timestamp < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'process_inkr_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM process_inkr_reports WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'process_inkr_total_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM process_inkr_reports WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'leak_test_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM leak_test_records WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'leak_test_rejection_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM leak_test_records WHERE test_result = 'Red' AND created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'leak_test_pass_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE test_result = 'Kabul')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM leak_test_records WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_supplier_nc_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM supplier_non_conformities snc
      WHERE snc.created_at < m_end AND snc.status <> 'Kapatıldı' AND (snc.closed_at IS NULL OR snc.closed_at >= m_end);

    RETURN v;
  END IF;

  IF p_kid = 'active_suppliers_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM suppliers s
      WHERE s.status = 'Onaylı' AND s.created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_supplier_score' THEN
    SELECT COALESCE(ROUND(AVG(l.final_score)::numeric, 2), 0) INTO v FROM (
      SELECT DISTINCT ON (ss.supplier_id) ss.supplier_id, ss.final_score FROM supplier_scores ss
      WHERE ss.created_at < m_end ORDER BY ss.supplier_id, ss.period DESC NULLS LAST, ss.created_at DESC
    ) l JOIN suppliers s ON s.id = l.supplier_id AND s.status = 'Onaylı';

    RETURN v;
  END IF;

  IF p_kid = 'active_spc_characteristics_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM spc_characteristics WHERE is_active = true AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'out_of_control_processes_count' THEN
    SELECT COUNT(DISTINCT characteristic_id)::numeric INTO v FROM spc_control_charts
      WHERE is_in_control = false AND period_end >= m_start AND period_start < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'capable_processes_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE cp >= 1.33 AND cpk >= 1.33)::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM spc_capability_studies WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'msa_studies_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM spc_msa_studies WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_production_plans_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM production_plans WHERE status IN ('Planned', 'In Progress') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'critical_characteristics_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM critical_characteristics WHERE is_active = true AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'process_parameter_records_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM process_parameter_records WHERE record_date >= m_start::date AND record_date < m_end::date;

    RETURN v;
  END IF;

  IF p_kid = 'active_validation_plans_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM validation_plans WHERE status IN ('Planned', 'In Progress') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_validations_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status = 'Completed')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM validation_plans WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_fmea_projects_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM fmea_projects WHERE status IN ('Active', 'In Review', 'Draft') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'high_rpn_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM fmea_causes_controls WHERE rpn > 100 AND created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_fmea_actions_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status = 'Completed')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM fmea_action_plans WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_apqp_projects_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM apqp_projects WHERE status NOT IN ('Approved', 'Rejected', 'Completed') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'pending_ppap_approvals_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM ppap_submissions WHERE submission_status IN ('Submitted', 'Draft') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'run_at_rate_completion_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status = 'Completed')::numeric / COUNT(*)::numeric * 100, 2) END INTO v FROM run_at_rate_studies WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_dmaic_projects_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM dmaic_projects WHERE overall_status != 'Completed' AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_dmaic_projects_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM dmaic_projects WHERE overall_status = 'Completed' AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'dmaic_success_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE overall_status = 'Completed')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM dmaic_projects WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_customer_complaints_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM customer_complaints cc
      WHERE cc.created_at < m_end AND cc.status NOT IN ('Kapatıldı', 'Çözüldü', 'İptal')
        AND (cc.actual_close_date IS NULL OR cc.actual_close_date >= m_end::date);

    RETURN v;
  END IF;

  IF p_kid = 'after_sales_open_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM customer_complaints cc
      WHERE cc.created_at < m_end AND cc.status NOT IN ('Kapatıldı', 'Çözüldü', 'İptal')
        AND (cc.actual_close_date IS NULL OR cc.actual_close_date >= m_end::date);

    RETURN v;
  END IF;

  IF p_kid = 'after_sales_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM customer_complaints WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'sla_compliant_complaints_rate' THEN
    SELECT CASE WHEN COUNT(*) FILTER (WHERE status IN ('Kapalı','Çözüldü')) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status IN ('Kapalı','Çözüldü') AND actual_close_date IS NOT NULL AND target_close_date IS NOT NULL AND actual_close_date <= target_close_date)::numeric
      / NULLIF(COUNT(*) FILTER (WHERE status IN ('Kapalı','Çözüldü')), 0) * 100, 2) END INTO v
      FROM customer_complaints WHERE updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_complaint_resolution_time' THEN
    SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (actual_close_date - complaint_date)) / 86400)::numeric, 2), 0) INTO v
      FROM customer_complaints WHERE status IN ('Kapalı', 'Çözüldü') AND actual_close_date IS NOT NULL AND complaint_date IS NOT NULL
        AND actual_close_date >= m_start AND actual_close_date < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'expired_document_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM documents d
      WHERE d.valid_until IS NOT NULL AND d.valid_until >= m_start::date AND d.valid_until < m_end::date;

    RETURN v;
  END IF;

  IF p_kid = 'completed_internal_audits_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM audits
      WHERE status = 'Tamamlandı' AND COALESCE(updated_at, created_at) >= m_start AND COALESCE(updated_at, created_at) < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_internal_audit_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM audits
      WHERE status = 'Tamamlandı' AND COALESCE(updated_at, created_at) >= m_start AND COALESCE(updated_at, created_at) < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_deviation_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM deviations d
      WHERE d.created_at < m_end AND d.status = 'Açık';

    RETURN v;
  END IF;

  IF p_kid = 'calibration_due_count' THEN
    WITH latest AS (
        SELECT DISTINCT ON (ec.equipment_id) ec.equipment_id, ec.next_calibration_date, ec.is_active
        FROM equipment_calibrations ec ORDER BY ec.equipment_id, ec.calibration_date DESC NULLS LAST, ec.created_at DESC NULLS LAST
      )
      SELECT COUNT(*)::numeric INTO v FROM latest l
      JOIN equipments e ON e.id = l.equipment_id
      WHERE e.status IS DISTINCT FROM 'Hurdaya Ayrıldı' AND (l.is_active IS NULL OR l.is_active = true)
        AND l.next_calibration_date IS NOT NULL AND l.next_calibration_date < m_end::date;

    RETURN v;
  END IF;

  IF p_kid = 'active_fixture_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM fixtures WHERE status = 'Aktif' AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'total_fixture_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM fixtures WHERE created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'fixture_nonconformity_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM fixture_nonconformities fn
      WHERE fn.created_at < m_end AND (fn.correction_status IS NULL OR fn.correction_status != 'Düzeltildi');

    RETURN v;
  END IF;

  IF p_kid = 'active_wps_procedures_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM wps_procedures WHERE status = 'Active' AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'pending_wps_approvals_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM wps_procedures WHERE status = 'Pending Approval' AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'planned_trainings_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM trainings WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_trainings_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM trainings WHERE status IN ('Tamamlandı', 'Tamamlandi', 'Completed') AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'training_participation_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE tp.status = 'Tamamlandı')::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM training_participants tp JOIN trainings tr ON tr.id = tp.training_id
      WHERE tr.created_at >= m_start AND tr.created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_polyvalence_score' THEN
    SELECT COALESCE(ROUND(AVG(ps.current_level)::numeric, 2), 0) INTO v FROM personnel_skills ps WHERE ps.updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'critical_skill_gaps_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM personnel_skills ps JOIN skills s ON ps.skill_id = s.id
      WHERE s.is_critical = true AND ps.current_level < s.target_level AND ps.updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'expired_certifications_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM personnel_skills
      WHERE is_certified = true AND certification_expiry_date IS NOT NULL AND certification_expiry_date < m_end::date;

    RETURN v;
  END IF;

  IF p_kid = 'active_kaizen_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM kaizen_entries WHERE status NOT IN ('Kapandı', 'Reddedildi') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_kaizen_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM kaizen_entries WHERE status = 'Kapandı' AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'kaizen_success_rate' THEN
    SELECT CASE WHEN COUNT(*) FILTER (WHERE status NOT IN ('Reddedildi', 'Askıda')) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status = 'Kapandı')::numeric / NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('Reddedildi', 'Askıda')), 0) * 100, 2) END INTO v
      FROM kaizen_entries WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_benchmarks_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM benchmarks WHERE status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_benchmarks_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM benchmarks WHERE status IN ('Completed', 'Tamamlandı') AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'open_tasks_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM tasks t
      WHERE t.created_at < m_end AND t.status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal');

    RETURN v;
  END IF;

  IF p_kid = 'overdue_tasks_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM tasks t
      WHERE t.status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal') AND t.due_date IS NOT NULL AND t.due_date < LEAST(m_end::date, CURRENT_DATE) AND t.created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'task_completion_rate' THEN
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(
      COUNT(*) FILTER (WHERE status IN ('Completed', 'Tamamlandı'))::numeric / COUNT(*)::numeric * 100, 2) END INTO v
      FROM tasks WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_tasks_30d_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM tasks WHERE status IN ('Tamamlandı', 'Completed') AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'nps_score' THEN
    WITH x AS (SELECT COUNT(*) AS t,
        COUNT(*) FILTER (WHERE nps_score >= 9) AS p, COUNT(*) FILTER (WHERE nps_score <= 6) AS d
      FROM customer_satisfaction_surveys WHERE created_at >= m_start AND created_at < m_end)
      SELECT CASE WHEN t = 0 THEN 0 ELSE ROUND(((p::numeric / t) - (d::numeric / t)) * 100, 2) END INTO v FROM x;

    RETURN v;
  END IF;

  IF p_kid = 'satisfaction_surveys_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM customer_satisfaction_surveys WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'avg_customer_satisfaction_score' THEN
    SELECT COALESCE(ROUND(AVG(overall_score)::numeric, 2), 0) INTO v FROM customer_satisfaction_surveys WHERE created_at >= m_start AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'active_supplier_development_plans_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM supplier_development_plans
      WHERE current_status NOT IN ('Completed', 'Cancelled', 'Tamamlandı', 'İptal') AND created_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'completed_supplier_development_plans_count' THEN
    SELECT COUNT(*)::numeric INTO v FROM supplier_development_plans
      WHERE current_status IN ('Completed', 'Tamamlandı') AND updated_at >= m_start AND updated_at < m_end;

    RETURN v;
  END IF;

  IF p_kid = 'non_quality_cost' THEN
    SELECT COALESCE(SUM(amount), 0)::numeric INTO v FROM quality_costs WHERE cost_date >= m_start::date AND cost_date < m_end::date;

    RETURN v;
  END IF;

  IF p_kid = 'total_quality_cost' THEN
    SELECT COALESCE(SUM(amount), 0)::numeric INTO v FROM quality_costs WHERE cost_date >= m_start::date AND cost_date < m_end::date;

    RETURN v;
  END IF;

  RETURN v;
END;
$kpi$;


CREATE OR REPLACE FUNCTION public.backfill_kpi_monthly_data(p_months_back integer DEFAULT 13)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $bf$
DECLARE
  kpi_row RECORD;
  mo integer;
  t_year integer;
  t_month integer;
  m_start timestamptz;
  m_end timestamptz;
  calc_value numeric;
  updated_count integer := 0;
BEGIN
  FOR kpi_row IN
    SELECT id, auto_kpi_id FROM kpis WHERE is_auto = true AND auto_kpi_id IS NOT NULL
  LOOP
    FOR mo IN 0..p_months_back - 1 LOOP
      m_start := date_trunc('month', now() - (mo || ' months')::interval);
      m_end := m_start + interval '1 month';
      t_year := extract(year from m_start)::integer;
      t_month := extract(month from m_start)::integer;
      calc_value := kpi_monthly_actual(kpi_row.auto_kpi_id, m_start, m_end);
      IF calc_value IS NOT NULL THEN
        INSERT INTO kpi_monthly_data (kpi_id, year, month, actual_value)
        VALUES (kpi_row.id, t_year, t_month, calc_value)
        ON CONFLICT (kpi_id, year, month)
        DO UPDATE SET actual_value = EXCLUDED.actual_value, updated_at = now();
        updated_count := updated_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'records_updated', updated_count);
END;
$bf$;

CREATE OR REPLACE FUNCTION public.sync_kpi_current_from_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync$
DECLARE
  cy int := extract(year from current_date)::int;
  cm int := extract(month from current_date)::int;
BEGIN
  UPDATE public.kpis k
  SET current_value = COALESCE(
    (SELECT d.actual_value FROM kpi_monthly_data d WHERE d.kpi_id = k.id AND d.year = cy AND d.month = cm AND d.actual_value IS NOT NULL),
    (SELECT d2.actual_value FROM kpi_monthly_data d2 WHERE d2.kpi_id = k.id AND d2.actual_value IS NOT NULL ORDER BY d2.year DESC, d2.month DESC LIMIT 1)
  ),
  updated_at = now()
  WHERE k.is_auto = true;
END;
$sync$;

-- KPI satırı birimini şablona hizala (mevcut kurulumda gün kalmış olabilir)
UPDATE public.kpis SET unit = ' saat' WHERE auto_kpi_id = 'avg_quality_inspection_time';

