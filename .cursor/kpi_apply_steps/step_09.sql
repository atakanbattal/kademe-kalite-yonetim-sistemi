
DO $outer$
BEGIN
  EXECUTE convert_from(decode((SELECT string_agg(chunk, '' ORDER BY seq) FROM public._sql_apply_chunks WHERE batch = 'kpi_monthly_20260414'), 'base64'), 'UTF8');
END;
$outer$;
