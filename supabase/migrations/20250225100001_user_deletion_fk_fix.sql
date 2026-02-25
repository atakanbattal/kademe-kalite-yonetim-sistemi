-- Kullanıcı silme öncesi referansları temizleyen fonksiyon
-- manage-user Edge Function bu RPC'yi deleteUser'dan önce çağırır

CREATE OR REPLACE FUNCTION public.cleanup_user_references(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- audit_log_entries: silinen kullanıcının loglarını sil (FK engelini kaldır)
    DELETE FROM public.audit_log_entries WHERE user_id = target_user_id;
    
    -- document_access_logs: user_id NOT NULL olduğu için kayıtları sil
    BEGIN
        DELETE FROM public.document_access_logs WHERE user_id = target_user_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Diğer tablolar (created_by, uploaded_by vb.) - gerekirse eklenebilir
    -- Şimdilik audit_log_entries yeterli olabilir
END;
$$;

COMMENT ON FUNCTION public.cleanup_user_references(uuid) IS 'Kullanıcı silmeden önce auth.users FK referanslarını temizler';
