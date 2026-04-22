-- Geçmiş tarihli kayıtta 409 (record_number unique): numara üretimi test_date aralığına
-- göre sayımdı; aynı yıl için zaten alınmış SZK-YY-#### ile çakışıyordu.
-- Artık o yıl prefix'ine sahip tüm kayıtlardaki en yüksek sıra + 1 kullanılır.
CREATE OR REPLACE FUNCTION public.next_leak_test_record_number(p_test_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_prefix text;
  v_max_seq int;
BEGIN
  v_year := EXTRACT(YEAR FROM p_test_date)::int;
  v_prefix := 'SZK-' || RIGHT(v_year::text, 2) || '-';

  PERFORM pg_advisory_xact_lock(hashtext('leak_test_record_number_' || v_year::text));

  SELECT COALESCE(MAX(seq), 0) INTO v_max_seq
  FROM (
    SELECT (regexp_match(record_number, '^SZK-[0-9]{2}-([0-9]+)$'))[1]::int AS seq
    FROM public.leak_test_records
    WHERE record_number LIKE v_prefix || '%'
  ) s
  WHERE seq IS NOT NULL;

  RETURN v_prefix || LPAD((v_max_seq + 1)::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.next_leak_test_record_number(date) IS
  'SZK-YY-####: o yıl için mevcut numaraların maksimum sırası + 1; test_date ile çakışma yaratmaz.';
