-- Ayarlar > Birim: personelde yeni üst departman metni yazılıp cost_settings'te yoksa ekle (idempotent).

INSERT INTO public.cost_settings (unit_name, cost_per_minute)
SELECT DISTINCT ON (public.dept_norm_key(trim(p.management_department)))
  trim(p.management_department),
  0::numeric
FROM public.personnel p
WHERE trim(p.management_department) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.cost_settings cs
    WHERE public.dept_norm_key(cs.unit_name) = public.dept_norm_key(trim(p.management_department))
  )
ORDER BY public.dept_norm_key(trim(p.management_department)), length(trim(p.management_department)) DESC;
