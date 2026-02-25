-- Hesap yönetimi için auth.users + profiles birleşik listesi
-- AccountManager bu RPC ile kullanıcıları listeler
-- Sadece settings:full veya super admin yetkisi olanlar çağırabilir

CREATE OR REPLACE FUNCTION public.get_all_users_with_profiles()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_permissions jsonb;
  caller_email text;
  is_super_admin boolean := false;
  has_settings_full boolean := false;
BEGIN
  -- Çağıran kullanıcı kontrolü
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = auth.uid();
  is_super_admin := (caller_email = 'atakan.battal@kademe.com.tr');
  
  SELECT p.permissions INTO caller_permissions 
  FROM public.profiles p 
  WHERE p.id = auth.uid();
  has_settings_full := (caller_permissions->>'settings' = 'full');
  
  IF NOT is_super_admin AND NOT has_settings_full THEN
    RAISE EXCEPTION 'Yetkisiz: Hesap yönetimi için yetkiniz yok';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'))::text,
    u.raw_user_meta_data,
    u.created_at,
    COALESCE(p.permissions, u.raw_user_meta_data->'permissions', '{}'::jsonb)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_all_users_with_profiles() IS 'Hesap yönetimi için kullanıcı listesi (settings:full veya super admin gerekli)';

-- Yetki güncellemesi için RPC (profiles RLS bypass - sadece settings:full)
CREATE OR REPLACE FUNCTION public.update_profile_permissions(
  target_user_id uuid,
  new_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_permissions jsonb;
  caller_email text;
  is_super_admin boolean := false;
  has_settings_full boolean := false;
BEGIN
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = auth.uid();
  is_super_admin := (caller_email = 'atakan.battal@kademe.com.tr');
  
  SELECT p.permissions INTO caller_permissions FROM public.profiles p WHERE p.id = auth.uid();
  has_settings_full := (caller_permissions->>'settings' = 'full');
  
  IF NOT is_super_admin AND NOT has_settings_full THEN
    RAISE EXCEPTION 'Yetkisiz: Yetki güncelleme için settings:full gerekli';
  END IF;

  UPDATE public.profiles 
  SET permissions = new_permissions, updated_at = now() 
  WHERE id = target_user_id;
END;
$$;

COMMENT ON FUNCTION public.update_profile_permissions(uuid, jsonb) IS 'Hesap yetkilerini günceller (settings:full gerekli)';
