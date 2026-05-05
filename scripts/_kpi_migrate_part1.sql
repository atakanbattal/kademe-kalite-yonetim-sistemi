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
