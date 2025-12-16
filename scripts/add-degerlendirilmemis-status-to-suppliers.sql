-- ====================================================
-- Tedarikçi Statüsüne 'Değerlendirilmemiş' Ekleme
-- ====================================================
-- Bu migration suppliers tablosundaki status kolonuna 
-- 'Değerlendirilmemiş' seçeneğini ekler
-- ====================================================

-- Mevcut constraint'i kaldır
ALTER TABLE public.suppliers 
DROP CONSTRAINT IF EXISTS suppliers_status_check;

-- Yeni constraint'i ekle (Değerlendirilmemiş dahil)
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_status_check 
CHECK (status IN ('Değerlendirilmemiş', 'Onaylı', 'Askıya Alınmış', 'Red', 'Alternatif'));

-- Varsayılan değeri güncelle (opsiyonel - mevcut kayıtları etkilemez)
ALTER TABLE public.suppliers 
ALTER COLUMN status SET DEFAULT 'Değerlendirilmemiş';

-- Yorum ekle
COMMENT ON COLUMN public.suppliers.status IS 'Tedarikçi durumu: Değerlendirilmemiş, Onaylı, Askıya Alınmış, Red, Alternatif';

