-- Polivalans modülüne departman bazlı yetkinlik yönetimi ekleme
-- Migration: add-department-to-polyvalence
-- Tarih: 2025-11-05

-- skill_categories tablosuna department alanı ekle
ALTER TABLE skill_categories 
ADD COLUMN IF NOT EXISTS department TEXT;

-- skills tablosuna department alanı ekle
ALTER TABLE skills 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Index oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_skill_categories_department 
ON skill_categories(department);

CREATE INDEX IF NOT EXISTS idx_skills_department 
ON skills(department);

-- Comment ekle
COMMENT ON COLUMN skill_categories.department IS 'Bu kategori hangi departmana ait (NULL ise tüm departmanlarda görünür)';
COMMENT ON COLUMN skills.department IS 'Bu yetkinlik hangi departmana ait (NULL ise tüm departmanlarda görünür)';

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE 'Migration tamamlandı: Polivalans modülüne department alanları eklendi.';
    RAISE NOTICE 'Artık yetkinlik ve kategoriler departman bazlı yönetilebilir.';
    RAISE NOTICE 'NULL department değeri = Tüm departmanlarda görünür';
END $$;

