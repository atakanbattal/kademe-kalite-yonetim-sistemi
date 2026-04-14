-- Ortalama tedarikçi skoru: tüm tarihsel satırlar yerine onaylı tedarikçi başına son skor kartı
CREATE OR REPLACE FUNCTION public.get_avg_supplier_score()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Kalibrasyon gecikmesi: ekipman başına son aktif kalibrasyon (hurda hariç)
CREATE OR REPLACE FUNCTION public.get_calibration_due_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (ec.equipment_id)
      ec.equipment_id,
      ec.next_calibration_date,
      ec.is_active
    FROM equipment_calibrations ec
    ORDER BY ec.equipment_id, ec.calibration_date DESC NULLS LAST, ec.created_at DESC NULLS LAST
  )
  SELECT COUNT(*)::int
  FROM latest l
  JOIN public.equipments e ON e.id = l.equipment_id
  WHERE e.status IS DISTINCT FROM 'Hurdaya Ayrıldı'
    AND (l.is_active IS NULL OR l.is_active = true)
    AND l.next_calibration_date IS NOT NULL
    AND l.next_calibration_date < CURRENT_DATE;
$$;

-- Tamamlanan eğitim: uygulamadaki Türkçe + yazım varyantları + Completed
CREATE OR REPLACE FUNCTION public.get_completed_trainings_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::int
    FROM trainings
    WHERE status IN ('Tamamlandı', 'Tamamlandi', 'Completed')
  );
END;
$$;

-- İç tetkik: açık yerine son 30 günde tamamlanan (daha anlamlı KPI)
CREATE OR REPLACE FUNCTION public.get_completed_internal_audits_30d_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM audits
  WHERE status = 'Tamamlandı'
    AND COALESCE(updated_at, created_at) >= (CURRENT_TIMESTAMP - INTERVAL '30 days');
$$;

-- Eski KPI satırlarını yeni metrikle hizala
UPDATE public.kpis
SET
  auto_kpi_id = 'completed_internal_audits_30d_count',
  name = 'Tamamlanan İç Tetkik (30 Gün)',
  description = 'Son 30 gün içinde tamamlanan iç tetkik sayısı (operasyonel performans).',
  data_source = 'İç Tetkik Yönetimi',
  category = 'document',
  target_direction = 'increase'
WHERE is_auto = true
  AND auto_kpi_id = 'open_internal_audit_count';
