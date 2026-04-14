-- cost_settings_align_to_management_department sonrası: personel.unit_id,
-- her kaydın kendi management_department metniyle eşleşen cost_settings satırına bağlansın
-- (aynı eski birimde farklı üst departman olan istisnalar için).

BEGIN;

UPDATE public.personnel p
SET
  unit_id = cs.id,
  updated_at = now()
FROM public.cost_settings cs
WHERE trim(p.management_department) <> ''
  AND public.dept_norm_key(cs.unit_name) = public.dept_norm_key(trim(p.management_department))
  AND p.unit_id IS DISTINCT FROM cs.id;

COMMIT;
