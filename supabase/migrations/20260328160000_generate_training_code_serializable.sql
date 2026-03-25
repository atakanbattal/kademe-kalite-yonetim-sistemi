-- Eşzamanlı eğitim oluşturmalarında aynı EGT-YYYY-NNNN kodunun üretilmesini önlemek için
-- yıl bazlı transaction advisory lock kullanılır.

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

  -- Aynı yıl için kod üretimini sıraya koy (842001 = sabit uygulama anahtarı)
  PERFORM pg_advisory_xact_lock(842001, v_year);

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
  'Yıl bazlı benzersiz eğitim kodu (EGT-YYYY-NNNN). Eşzamanlı çağrılarda mükerrer kodu önlemek için advisory lock kullanır.';
