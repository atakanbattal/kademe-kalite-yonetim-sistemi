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
