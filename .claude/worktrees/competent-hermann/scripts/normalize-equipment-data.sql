-- Equipment tablosundaki responsible_unit ve brand_model alanlarını camelCase'e uygun hale getir
-- Bu script verileri normalize eder

-- 1. responsible_unit için normalizasyon
-- Büyük harfli birimleri camelCase'e çevir
UPDATE equipments 
SET responsible_unit = INITCAP(LOWER(responsible_unit))
WHERE responsible_unit IS NOT NULL 
  AND responsible_unit != INITCAP(LOWER(responsible_unit));

-- Özel durumlar için manuel düzeltmeler
UPDATE equipments 
SET responsible_unit = 'Ar-Ge'
WHERE responsible_unit = 'Ar-ge';

UPDATE equipments 
SET responsible_unit = 'Ar-Ge Direktörlüğü'
WHERE responsible_unit IN ('AR-GE DİREKTÖRLÜĞÜ', 'Ar-Ge Direktörlüğü');

UPDATE equipments 
SET responsible_unit = 'Elektrikhane'
WHERE responsible_unit = 'ELEKTRİKHANE';

UPDATE equipments 
SET responsible_unit = 'Kalite Kontrol Müdürlüğü'
WHERE responsible_unit = 'KALİTE KONTROL MÜDÜRLÜĞÜ';

UPDATE equipments 
SET responsible_unit = 'Lojistik Operasyon Yöneticiliği'
WHERE responsible_unit = 'LOJİSTİK OPERASYON YÖNETİCİLİĞİ';

UPDATE equipments 
SET responsible_unit = 'Satış Sonrası Hizmetler Şefliği'
WHERE responsible_unit = 'SATIŞ SONRASI HİZMETLER ŞEFLİĞİ';

UPDATE equipments 
SET responsible_unit = 'Üretim Müdürlüğü'
WHERE responsible_unit = 'ÜRETİM MÜDÜRLÜĞÜ';

-- 2. brand_model için normalizasyon
-- Başlangıç ve son boşlukları temizle
UPDATE equipments 
SET brand_model = TRIM(brand_model)
WHERE brand_model IS NOT NULL;

-- Tab karakterlerini temizle
UPDATE equipments 
SET brand_model = REPLACE(brand_model, E'\t', '')
WHERE brand_model IS NOT NULL;

-- Büyük/küçük harf tutarsızlıklarını düzelt
UPDATE equipments 
SET brand_model = 'Asimeto'
WHERE brand_model IN ('ASIMETO', 'Asımeto');

UPDATE equipments 
SET brand_model = 'Bosch'
WHERE brand_model = 'BOSCH';

UPDATE equipments 
SET brand_model = 'Cas'
WHERE brand_model = 'cas';

UPDATE equipments 
SET brand_model = 'Ceta Form'
WHERE brand_model = 'CETA-FORM';

UPDATE equipments 
SET brand_model = 'İnsize'
WHERE brand_model LIKE 'INSIZE%';

UPDATE equipments 
SET brand_model = 'İzeltaş'
WHERE brand_model IN ('izeltaş', 'İzeltaş');

UPDATE equipments 
SET brand_model = 'Mitutoyo'
WHERE brand_model = 'Mitutuyo';

UPDATE equipments 
SET brand_model = 'Starline'
WHERE brand_model LIKE '%STARLINE%' OR brand_model LIKE '%Starline%';

UPDATE equipments 
SET brand_model = 'Uni-T'
WHERE brand_model LIKE '%UNI-T%' OR brand_model LIKE '%Uni-T%';

UPDATE equipments 
SET brand_model = 'Yamer'
WHERE brand_model = 'YAMER';

-- Model alanı için de aynı işlemleri yap (eğer varsa)
UPDATE equipments 
SET brand_model = TRIM(brand_model)
WHERE brand_model IS NOT NULL;

UPDATE equipments 
SET brand_model = REPLACE(brand_model, E'\t', '')
WHERE brand_model IS NOT NULL;

