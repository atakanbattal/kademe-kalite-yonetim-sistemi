-- Sapma talep numarası: eşzamanlı kayıtlarda aynı numarayı önlemek için atomik üretim
CREATE OR REPLACE FUNCTION public.next_deviation_request_no(p_year integer, p_deviation_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_prod boolean := (trim(COALESCE(p_deviation_type, '')) = 'Üretim');
  v_max int := 0;
  v_row record;
  v_seq int;
BEGIN
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'Geçersiz yıl: %', p_year;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('deviation_request_no_' || p_year::text || '_' || CASE WHEN v_is_prod THEN 'U' ELSE 'G' END)
  );

  FOR v_row IN
    SELECT request_no
    FROM public.deviations
    WHERE request_no IS NOT NULL
      AND request_no LIKE (p_year::text || '-%')
  LOOP
    IF v_is_prod THEN
      IF v_row.request_no ~ ('^' || p_year::text || '-U\d+$') THEN
        v_seq := (regexp_match(v_row.request_no, '^' || p_year::text || '-U(\d+)$'))[1]::int;
        IF v_seq > v_max THEN v_max := v_seq; END IF;
      END IF;
    ELSE
      IF v_row.request_no ~ ('^' || p_year::text || '-\d+$')
         AND v_row.request_no !~ ('^' || p_year::text || '-U\d+$') THEN
        v_seq := (regexp_match(v_row.request_no, '^' || p_year::text || '-(\d+)$'))[1]::int;
        IF v_seq > v_max THEN v_max := v_seq; END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_is_prod THEN
    RETURN p_year::text || '-U' || LPAD((v_max + 1)::text, 3, '0');
  END IF;

  RETURN p_year::text || '-' || LPAD((v_max + 1)::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_deviation_request_no(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_deviation_request_no(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_deviation_request_no(integer, text) TO service_role;

COMMENT ON FUNCTION public.next_deviation_request_no(integer, text) IS
  'Sapma talep numarası üretir: Girdi YYYY-NNN, Üretim YYYY-UNNN; yıl+tür bazında kilitli.';
