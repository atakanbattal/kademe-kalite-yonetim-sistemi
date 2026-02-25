-- audit_log_entries RLS düzeltmesi (42501 hatasını önler)
-- Supabase Dashboard SQL Editor'da çalıştırın

ALTER TABLE IF EXISTS audit_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON audit_log_entries;

-- Authenticated kullanıcılar kendi user_id ile audit log ekleyebilir
CREATE POLICY "Authenticated users can insert audit log"
ON audit_log_entries
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
