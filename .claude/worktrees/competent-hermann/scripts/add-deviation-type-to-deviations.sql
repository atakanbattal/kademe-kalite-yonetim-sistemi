-- Sapma Modülü: Sapma Tipi (Üretim/Girdi Kontrolü) ve Numara Sistemi
-- Bu script Supabase SQL editöründe çalıştırılmalıdır

-- 1. Sapma tipi kolonu ekle
ALTER TABLE deviations
ADD COLUMN IF NOT EXISTS deviation_type VARCHAR(50) DEFAULT 'Girdi Kontrolü';

-- 2. Yorum ekle
COMMENT ON COLUMN deviations.deviation_type IS 'Sapma tipi: Girdi Kontrolü veya Üretim';

-- 3. Check constraint ekle (sadece geçerli değerlere izin ver)
ALTER TABLE deviations
DROP CONSTRAINT IF EXISTS check_valid_deviation_type;

ALTER TABLE deviations
ADD CONSTRAINT check_valid_deviation_type
CHECK (deviation_type IN ('Girdi Kontrolü', 'Üretim') OR deviation_type IS NULL);

-- 4. İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_deviations_deviation_type ON deviations(deviation_type);

-- 5. Mevcut kayıtları varsayılan değerle güncelle
UPDATE deviations
SET deviation_type = 'Girdi Kontrolü'
WHERE deviation_type IS NULL;

