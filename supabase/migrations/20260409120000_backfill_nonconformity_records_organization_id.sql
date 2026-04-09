-- RLS: organization_id = get_user_org_id() — NULL satırlar görünmez; eski kayıtlar için org doldurulur.
UPDATE public.nonconformity_records nr
SET organization_id = p.organization_id
FROM public.profiles p
WHERE nr.organization_id IS NULL
  AND nr.created_by IS NOT NULL
  AND p.id = nr.created_by
  AND p.organization_id IS NOT NULL;
