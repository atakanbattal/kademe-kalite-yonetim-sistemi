-- Eğitim yönetimi ve polivalans modülü entegrasyonu için
-- trainings tablosuna polyvalence_skill_id kolonu ekleme

-- 1. polyvalence_skill_id kolonunu ekle
ALTER TABLE trainings 
ADD COLUMN IF NOT EXISTS polyvalence_skill_id UUID;

-- 2. Foreign key constraint ekle
ALTER TABLE trainings
ADD CONSTRAINT fk_trainings_polyvalence_skill
FOREIGN KEY (polyvalence_skill_id)
REFERENCES skills(id)
ON DELETE SET NULL;

-- 3. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_trainings_polyvalence_skill_id 
ON trainings(polyvalence_skill_id);

-- 4. Açıklama ekle
COMMENT ON COLUMN trainings.polyvalence_skill_id IS 
'Polivalans modülünden oluşturulan eğitimler için ilgili yetkinlik ID''si. NULL ise genel eğitim.';

-- Migration başarılı oldu mu kontrol et
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trainings' 
        AND column_name = 'polyvalence_skill_id'
    ) THEN
        RAISE NOTICE '✅ Migration başarılı: polyvalence_skill_id kolonu eklendi';
    ELSE
        RAISE EXCEPTION '❌ Migration başarısız: polyvalence_skill_id kolonu eklenemedi';
    END IF;
END $$;

