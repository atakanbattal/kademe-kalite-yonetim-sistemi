-- dept_norm_key: trim sonrası NFC ile Di̇ / İ gibi birleşik vs parçalı Unicode farkını kaldırır.
-- Böylece Ar-Ge ile Ar-Ge Direktörlüğü tek anahtarda toplanır.

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
  s := normalize(s, NFC);
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

CREATE OR REPLACE FUNCTION public.dept_canonical_from_org_pool(src text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rk text;
  v_pick text;
BEGIN
  IF src IS NULL THEN
    RETURN src;
  END IF;
  IF trim(src) = '' THEN
    RETURN src;
  END IF;
  IF trim(src) IN ('Tedarikçi', 'Girdi Kalite') THEN
    RETURN trim(src);
  END IF;

  rk := public.dept_norm_key(src);
  IF rk IS NULL OR length(rk) < 1 THEN
    RETURN trim(src);
  END IF;

  SELECT normalize(e.name, NFC) INTO v_pick
  FROM (
    WITH pool AS (
      SELECT DISTINCT trim(cs.unit_name) AS name
      FROM public.cost_settings cs
      WHERE cs.unit_name IS NOT NULL AND trim(cs.unit_name) <> ''
      UNION
      SELECT DISTINCT trim(p.department) AS name
      FROM public.personnel p
      WHERE p.department IS NOT NULL AND trim(p.department) <> ''
      UNION
      SELECT DISTINCT trim(p.management_department) AS name
      FROM public.personnel p
      WHERE p.management_department IS NOT NULL AND trim(p.management_department) <> ''
    ),
    enriched AS (
      SELECT
        p.name,
        public.dept_norm_key(p.name) AS nk,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.personnel pe
            WHERE trim(pe.department) = p.name OR trim(pe.management_department) = p.name
          ) THEN 0
          ELSE 1
        END AS pers_pri,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.cost_settings cs WHERE trim(cs.unit_name) = p.name
          ) THEN 0
          ELSE 1
        END AS cost_pri
      FROM pool p
    )
    SELECT * FROM enriched
  ) e
  WHERE
    e.nk = rk
    OR (length(rk) >= 4 AND e.nk LIKE rk || '%' AND length(e.nk) > length(rk))
    OR (
      length(rk) >= 6
      AND length(e.nk) >= 4
      AND rk LIKE e.nk || '%'
      AND length(e.nk) < length(rk)
    )
  ORDER BY length(e.nk) DESC, e.pers_pri ASC, e.cost_pri ASC, length(e.name) DESC
  LIMIT 1;

  RETURN COALESCE(v_pick, normalize(trim(src), NFC));
END;
$$;

UPDATE public.non_conformities nc
SET
  department = public.dept_canonical_from_org_pool(nc.department),
  updated_at = now()
WHERE nc.department IS NOT NULL
  AND trim(nc.department) <> ''
  AND nc.department IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.department);

UPDATE public.non_conformities nc
SET
  requesting_unit = public.dept_canonical_from_org_pool(nc.requesting_unit),
  updated_at = now()
WHERE nc.requesting_unit IS NOT NULL
  AND trim(nc.requesting_unit) <> ''
  AND nc.requesting_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.requesting_unit);

UPDATE public.non_conformities nc
SET
  forwarded_unit = public.dept_canonical_from_org_pool(nc.forwarded_unit),
  updated_at = now()
WHERE nc.forwarded_unit IS NOT NULL
  AND trim(nc.forwarded_unit) <> ''
  AND nc.forwarded_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.forwarded_unit);
