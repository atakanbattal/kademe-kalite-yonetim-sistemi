-- Eğitim kodu sırası: RLS açıkken SECURITY DEFINER fonksiyonunun içindeki SELECT
-- bazı kurulumlarda yine de satırları filtreleyebiliyor; MAX hep 0 → hep EGT-YYYY-001.
-- row_security = off ile tüm trainings satırları sayılır.
-- Ardından mevcut mükerrer kodlar created_at sırasıyla yeniden numaralanır.

CREATE OR REPLACE FUNCTION public.generate_training_code(p_reference_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_year int;
  v_next int;
  v_ref date := COALESCE(p_reference_date, CURRENT_DATE);
BEGIN
  v_year := EXTRACT(YEAR FROM v_ref)::integer;

  PERFORM pg_advisory_xact_lock(842001, v_year);

  SELECT COALESCE(MAX(sub.n), 0)
  INTO v_next
  FROM (
    SELECT (regexp_match(t.training_code, '^EGT-' || v_year::text || '-([0-9]+)$'))[1]::integer AS n
    FROM public.trainings t
    WHERE t.training_code IS NOT NULL
      AND t.training_code ~ ('^EGT-' || v_year::text || '-[0-9]+$')
  ) sub
  WHERE sub.n IS NOT NULL;

  v_next := v_next + 1;

  RETURN 'EGT-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_training_code(date) IS
  'Yıl bazlı benzersiz eğitim kodu (EGT-YYYY-NNNN). RLS dışında tüm kayıtları sayar; eşzamanlı çağrı için advisory lock.';

-- Mevcut kayıtlar: kod içindeki yıl (veya yoksa start_date/created_at yılı) + oluşturulma sırası
WITH parsed AS (
  SELECT
    t.id,
    CASE
      WHEN t.training_code IS NOT NULL
        AND t.training_code ~ '^EGT-[0-9]{4}-[0-9]+$'
        THEN (regexp_match(t.training_code, '^EGT-([0-9]{4})-[0-9]+$'))[1]::integer
      ELSE EXTRACT(YEAR FROM COALESCE(t.start_date, (t.created_at AT TIME ZONE 'UTC')::date))::integer
    END AS y,
    t.created_at
  FROM public.trainings t
),
ranked AS (
  SELECT
    id,
    y,
    ROW_NUMBER() OVER (
      PARTITION BY y
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM parsed
  WHERE y IS NOT NULL AND y BETWEEN 2000 AND 2100
)
UPDATE public.trainings t
SET training_code = 'EGT-' || r.y::text || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r
WHERE t.id = r.id;
