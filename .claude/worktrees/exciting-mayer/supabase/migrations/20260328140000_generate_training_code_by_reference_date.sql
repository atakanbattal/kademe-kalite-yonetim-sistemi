-- Eğitim kodu: EGT-YYYY-NNNN (YYYY = başlangıç / referans tarihinin yılı, NNNN yıl içi sıra)
-- Geçmiş tarihli kayıtlarda p_reference_date ile o yıla göre kod üretilir.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'generate_training_code'
      AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_training_code(p_reference_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
  v_ref date := COALESCE(p_reference_date, CURRENT_DATE);
BEGIN
  v_year := EXTRACT(YEAR FROM v_ref)::integer;

  SELECT COALESCE(
    MAX(
      (substring(t.training_code FROM ('^EGT-' || v_year::text || '-([0-9]+)$')))::integer
    ),
    0
  )
  INTO v_next
  FROM trainings t
  WHERE t.training_code ~ ('^EGT-' || v_year::text || '-[0-9]+$');

  v_next := v_next + 1;

  RETURN 'EGT-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_training_code(date) IS
  'Yıl bazlı benzersiz eğitim kodu (EGT-YYYY-NNNN). Geçmiş kayıt için p_reference_date = eğitim başlangıç tarihi.';

GRANT EXECUTE ON FUNCTION public.generate_training_code(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_training_code(date) TO service_role;
