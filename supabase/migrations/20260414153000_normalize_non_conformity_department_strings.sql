-- DF/8D/MDİ: sorumlu birim / talep birimi metinlerini cost_settings.unit_name ile hizala
-- (Ar-Ge vs Ar-Ge Direktörlüğü gibi mükerrer satırları azaltır)

CREATE OR REPLACE FUNCTION public.dept_norm_key(t text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  IF t IS NULL THEN
    RETURN '';
  END IF;
  s := trim(t);
  IF s = '' THEN
    RETURN '';
  END IF;
  s := translate(
    s,
    'İIıĞğÜüŞşÖöÇç',
    'iiigguussoocc'
  );
  s := lower(s);
  s := regexp_replace(s, '[-\s_.]+', '', 'g');
  RETURN s;
END;
$$;

-- 1) Tam anahtar eşleşmesi (yazım / tire / boşluk farkı)
UPDATE public.non_conformities nc
SET
  department = cs.unit_name,
  updated_at = now()
FROM public.cost_settings cs
WHERE nc.department IS NOT NULL
  AND dept_norm_key(nc.department) = dept_norm_key(cs.unit_name)
  AND nc.department IS DISTINCT FROM cs.unit_name;

UPDATE public.non_conformities nc
SET
  requesting_unit = cs.unit_name,
  updated_at = now()
FROM public.cost_settings cs
WHERE nc.requesting_unit IS NOT NULL
  AND dept_norm_key(nc.requesting_unit) = dept_norm_key(cs.unit_name)
  AND nc.requesting_unit IS DISTINCT FROM cs.unit_name;

UPDATE public.non_conformities nc
SET
  forwarded_unit = cs.unit_name,
  updated_at = now()
FROM public.cost_settings cs
WHERE nc.forwarded_unit IS NOT NULL
  AND dept_norm_key(nc.forwarded_unit) = dept_norm_key(cs.unit_name)
  AND nc.forwarded_unit IS DISTINCT FROM cs.unit_name;

-- 2) Kısa ad → tam birim adı (ör. Ar-Ge → Ar-Ge Direktörlüğü): tek uzun eşleşme
UPDATE public.non_conformities nc
SET
  department = sub.cname,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (nc2.id)
    nc2.id,
    cs.unit_name AS cname
  FROM public.non_conformities nc2
  INNER JOIN public.cost_settings cs
    ON length(dept_norm_key(nc2.department)) >= 4
   AND length(dept_norm_key(cs.unit_name)) > length(dept_norm_key(nc2.department))
   AND dept_norm_key(cs.unit_name) LIKE dept_norm_key(nc2.department) || '%'
  ORDER BY nc2.id, length(cs.unit_name) DESC
) sub
WHERE nc.id = sub.id
  AND nc.department IS DISTINCT FROM sub.cname;

UPDATE public.non_conformities nc
SET
  requesting_unit = sub.cname,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (nc2.id)
    nc2.id,
    cs.unit_name AS cname
  FROM public.non_conformities nc2
  INNER JOIN public.cost_settings cs
    ON nc2.requesting_unit IS NOT NULL
   AND length(dept_norm_key(nc2.requesting_unit)) >= 4
   AND length(dept_norm_key(cs.unit_name)) > length(dept_norm_key(nc2.requesting_unit))
   AND dept_norm_key(cs.unit_name) LIKE dept_norm_key(nc2.requesting_unit) || '%'
  ORDER BY nc2.id, length(cs.unit_name) DESC
) sub
WHERE nc.id = sub.id
  AND nc.requesting_unit IS DISTINCT FROM sub.cname;

UPDATE public.non_conformities nc
SET
  forwarded_unit = sub.cname,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (nc2.id)
    nc2.id,
    cs.unit_name AS cname
  FROM public.non_conformities nc2
  INNER JOIN public.cost_settings cs
    ON nc2.forwarded_unit IS NOT NULL
   AND length(dept_norm_key(nc2.forwarded_unit)) >= 4
   AND length(dept_norm_key(cs.unit_name)) > length(dept_norm_key(nc2.forwarded_unit))
   AND dept_norm_key(cs.unit_name) LIKE dept_norm_key(nc2.forwarded_unit) || '%'
  ORDER BY nc2.id, length(cs.unit_name) DESC
) sub
WHERE nc.id = sub.id
  AND nc.forwarded_unit IS DISTINCT FROM sub.cname;

COMMENT ON FUNCTION public.dept_norm_key(text) IS 'Birim metinlerini karşılaştırmak için normalize eder (DF/8D departman birleştirme).';
