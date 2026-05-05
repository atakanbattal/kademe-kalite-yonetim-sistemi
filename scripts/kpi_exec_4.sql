DO $exec$
DECLARE
  b64 text;
  ddl text;
BEGIN
  SELECT string_agg(part, '' ORDER BY id) INTO b64 FROM _kpi_b64_acc;
  ddl := convert_from(decode(b64, 'base64'), 'UTF8');
  EXECUTE ddl;
END
$exec$;