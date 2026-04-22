-- Hesap yönetimi düzeltmeleri - Supabase Dashboard SQL Editor'da çalıştırın
-- Bu script: audit_log RLS, get_all_users_with_profiles, profiles permissions kolonu

-- 1. audit_log_entries RLS (42501 hatasını önler)
ALTER TABLE IF EXISTS audit_log_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON audit_log_entries;
CREATE POLICY "Authenticated users can insert audit log"
ON audit_log_entries FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2. profiles tablosunda permissions kolonu yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles.permissions zaten mevcut veya hata: %', SQLERRM;
END $$;

-- 3. get_all_users_with_profiles fonksiyonu (önce mevcut fonksiyonu sil)
DROP FUNCTION IF EXISTS public.get_all_users_with_profiles();

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
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = auth.uid();
  is_super_admin := (caller_email = 'atakan.battal@kademe.com.tr');
  SELECT p.permissions INTO caller_permissions FROM public.profiles p WHERE p.id = auth.uid();
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
