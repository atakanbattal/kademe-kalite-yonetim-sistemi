-- Kullanıcı silinmeden önce storage.objects'taki sahiplik kayıtlarını temizler.
-- auth.admin.deleteUser, storage.objects.owner foreign key nedeniyle başarısız olabiliyor.
CREATE OR REPLACE FUNCTION public.delete_user_storage_objects(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  DELETE FROM storage.objects WHERE owner = target_user_id;
END;
$$;
