-- Personnel ve diğer tablolardaki birim adlarını cost_settings tablosundaki güncel unit_name değerleriyle güncelleme
-- Migration: update-personnel-department-names
-- Tarih: 2025-01-XX
-- Açıklama: Birim adları cost_settings tablosunda güncellendiğinde, tüm tablolardaki eski kayıtları da günceller

-- 1. Personnel tablosundaki tüm kayıtlarda department kolonunu unit_id'ye göre güncelle
UPDATE personnel p
SET department = cs.unit_name
FROM cost_settings cs
WHERE p.unit_id = cs.id
  AND p.department IS DISTINCT FROM cs.unit_name;

-- 2. non_conformities tablosundaki "BİLGİ İŞLEM" kayıtlarını "Bilgi İşlem" olarak güncelle
UPDATE non_conformities
SET department = 'Bilgi İşlem'
WHERE department = 'BİLGİ İŞLEM';

-- 3. quality_costs tablosundaki "BİLGİ İŞLEM" kayıtlarını "Bilgi İşlem" olarak güncelle
UPDATE quality_costs
SET unit = 'Bilgi İşlem'
WHERE unit = 'BİLGİ İŞLEM';

-- 4. equipments tablosundaki "BİLGİ İŞLEM" kayıtlarını "Bilgi İşlem" olarak güncelle
UPDATE equipments
SET responsible_unit = 'Bilgi İşlem'
WHERE responsible_unit = 'BİLGİ İŞLEM';

-- 2. unit_id NULL olan ama department değeri olan kayıtları kontrol et
-- (Bu kayıtlar için manuel müdahale gerekebilir)
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM personnel
    WHERE unit_id IS NULL 
      AND department IS NOT NULL 
      AND department != '';
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Uyarı: % adet personel kaydında unit_id NULL ama department değeri var. Bu kayıtlar güncellenmedi.', orphaned_count;
    END IF;
END $$;

-- 3. Güncelleme sonuçlarını göster
DO $$
DECLARE
    updated_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM personnel p
    INNER JOIN cost_settings cs ON p.unit_id = cs.id
    WHERE p.department = cs.unit_name;
    
    SELECT COUNT(*) INTO total_count
    FROM personnel
    WHERE unit_id IS NOT NULL;
    
    RAISE NOTICE 'Migration tamamlandı!';
    RAISE NOTICE 'Toplam % personel kaydı kontrol edildi.', total_count;
    RAISE NOTICE '% kayıt güncel birim adıyla eşleşiyor.', updated_count;
    RAISE NOTICE 'Personnel tablosundaki department kolonları cost_settings tablosundaki güncel unit_name değerleriyle senkronize edildi.';
END $$;

-- 4. Örnek kontrol sorgusu (isteğe bağlı - çalıştırmak için yorumu kaldırın)
-- SELECT 
--     p.id,
--     p.full_name,
--     p.department as eski_department,
--     cs.unit_name as yeni_department,
--     p.unit_id
-- FROM personnel p
-- LEFT JOIN cost_settings cs ON p.unit_id = cs.id
-- WHERE p.department IS DISTINCT FROM cs.unit_name
-- ORDER BY p.full_name;

