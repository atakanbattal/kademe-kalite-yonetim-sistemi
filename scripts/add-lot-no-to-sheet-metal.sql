-- Sac malzemeler tablosuna lot_no alanı ekleme
-- Migration: add-lot-no-to-sheet-metal
-- Tarih: 2025-11-05

-- sheet_metal_items tablosuna lot_no sütunu ekle
ALTER TABLE sheet_metal_items 
ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- Index oluştur (arama performansı için)
CREATE INDEX IF NOT EXISTS idx_sheet_metal_items_lot_no 
ON sheet_metal_items(lot_no);

-- Mevcut kayıtlar için comment ekle
COMMENT ON COLUMN sheet_metal_items.lot_no IS 'Malzeme lot numarası - üretim partisi takibi için kullanılır';

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE 'Migration tamamlandı: sheet_metal_items.lot_no sütunu başarıyla eklendi.';
END $$;

