-- Tedarikçi Denetim Planlarına "supplier_attendees" (Denetlenen firmadan katılanlar) alanı ekleme
-- Bu script, mevcut "participants" (denetçiler) alanına ek olarak, 
-- denetlenen firmadan katılan kişilerin de kaydedilebilmesini sağlar.

-- supplier_audit_plans tablosuna supplier_attendees kolonu ekle
ALTER TABLE supplier_audit_plans
ADD COLUMN IF NOT EXISTS supplier_attendees TEXT[] DEFAULT '{}';

-- Kolon açıklaması ekle
COMMENT ON COLUMN supplier_audit_plans.supplier_attendees IS 'Denetlenen firmadan denetime katılan kişilerin isimleri (Array olarak saklanır)';

-- Mevcut participants kolonunun açıklamasını güncelle (varsa)
COMMENT ON COLUMN supplier_audit_plans.participants IS 'Denetimi yapan denetçilerin isimleri (Array olarak saklanır)';

-- İşlem başarılı mesajı
DO $$
BEGIN
    RAISE NOTICE 'supplier_attendees kolonu başarıyla eklendi. Artık denetlenen firmadan katılan kişileri kaydedebilirsiniz.';
END $$;

