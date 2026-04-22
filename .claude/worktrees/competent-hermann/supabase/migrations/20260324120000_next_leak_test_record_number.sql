-- Atomik sızdırmazlık kayıt numarası (eşzamanlı insert çakışmalarını önler)
CREATE OR REPLACE FUNCTION public.next_leak_test_record_number(p_test_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_prefix text;
  v_year_start date;
  v_day_after date;
  v_count int;
BEGIN
  v_year := EXTRACT(YEAR FROM p_test_date)::int;
  v_prefix := 'SZK-' || RIGHT(v_year::text, 2) || '-';
  v_year_start := make_date(v_year, 1, 1);
  v_day_after := p_test_date + 1;

  PERFORM pg_advisory_xact_lock(hashtext('leak_test_record_number_' || v_year::text));

  SELECT COUNT(*)::int INTO v_count
  FROM public.leak_test_records
  WHERE record_number LIKE v_prefix || '%'
    AND test_date >= v_year_start
    AND test_date < v_day_after;

  RETURN v_prefix || LPAD((v_count + 1)::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_leak_test_record_number(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_leak_test_record_number(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_leak_test_record_number(date) TO service_role;

COMMENT ON FUNCTION public.next_leak_test_record_number(date) IS
  'Seçilen test tarihine göre SZK-YY-#### benzersiz kayıt numarası üretir; yıllık kilit ile yarış güvenli.';
