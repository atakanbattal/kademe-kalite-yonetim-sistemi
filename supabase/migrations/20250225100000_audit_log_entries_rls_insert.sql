-- audit_log_entries tablosuna INSERT yapabilmek için RLS policy
-- DataContext.logAudit() client-side insert için gerekli (42501 hatasını önler)

-- RLS zaten aktifse policy ekle; yoksa önce aktifleştir
ALTER TABLE IF EXISTS audit_log_entries ENABLE ROW LEVEL SECURITY;

-- Mevcut insert policy varsa sil (idempotent)
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON audit_log_entries;

-- Authenticated kullanıcılar kendi user_id'leri ile audit log ekleyebilir
CREATE POLICY "Authenticated users can insert audit log"
ON audit_log_entries
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
