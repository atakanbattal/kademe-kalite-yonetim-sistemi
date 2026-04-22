-- DF + MDİ: düzenleme modalında "kaydet" ile aynı kaynak — personel üst birim / birimden
-- talep eden birim + sorumlu birim doldurulur, sonra dept_canonical_from_org_pool ile tekilleştirilir.

UPDATE public.non_conformities nc
SET
  requesting_unit = NULLIF(trim(sub.org_u), ''),
  updated_at = now()
FROM (
  SELECT
    nc2.id,
    COALESCE(
      NULLIF(trim(p.management_department), ''),
      NULLIF(trim(p.department), '')
    ) AS org_u
  FROM public.non_conformities nc2
  INNER JOIN public.personnel p ON trim(p.full_name) = trim(nc2.requesting_person)
  WHERE nc2.type IN ('DF', 'MDI')
    AND nc2.requesting_person IS NOT NULL
    AND trim(nc2.requesting_person) <> ''
) sub
WHERE nc.id = sub.id
  AND sub.org_u IS NOT NULL
  AND trim(sub.org_u) <> '';

UPDATE public.non_conformities nc
SET
  department = NULLIF(trim(x.org_u), ''),
  updated_at = now()
FROM (
  SELECT
    nc2.id,
    COALESCE(
      NULLIF(trim(p.management_department), ''),
      NULLIF(trim(p.department), '')
    ) AS org_u
  FROM public.non_conformities nc2
  INNER JOIN public.personnel p
    ON (nc2.responsible_personnel_id IS NOT NULL AND p.id = nc2.responsible_personnel_id)
    OR (
      nc2.responsible_personnel_id IS NULL
      AND nc2.responsible_person IS NOT NULL
      AND trim(nc2.responsible_person) <> ''
      AND trim(p.full_name) = trim(nc2.responsible_person)
    )
  WHERE nc2.type IN ('DF', 'MDI')
    AND nc2.supplier_id IS NULL
    AND COALESCE(nc2.department, '') NOT IN ('Tedarikçi', 'Girdi Kalite')
) x
WHERE nc.id = x.id
  AND x.org_u IS NOT NULL
  AND trim(x.org_u) <> '';

UPDATE public.non_conformities nc
SET
  department = public.dept_canonical_from_org_pool(nc.department),
  updated_at = now()
WHERE nc.type IN ('DF', 'MDI')
  AND nc.department IS NOT NULL
  AND trim(nc.department) <> ''
  AND nc.department IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.department);

UPDATE public.non_conformities nc
SET
  requesting_unit = public.dept_canonical_from_org_pool(nc.requesting_unit),
  updated_at = now()
WHERE nc.type IN ('DF', 'MDI')
  AND nc.requesting_unit IS NOT NULL
  AND trim(nc.requesting_unit) <> ''
  AND nc.requesting_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.requesting_unit);

UPDATE public.non_conformities nc
SET
  forwarded_unit = public.dept_canonical_from_org_pool(nc.forwarded_unit),
  updated_at = now()
WHERE nc.type IN ('DF', 'MDI')
  AND nc.forwarded_unit IS NOT NULL
  AND trim(nc.forwarded_unit) <> ''
  AND nc.forwarded_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.forwarded_unit);
