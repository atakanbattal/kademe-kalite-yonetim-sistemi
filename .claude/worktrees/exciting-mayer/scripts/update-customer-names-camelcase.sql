-- =====================================================
-- Mevcut müşteri isimlerini CamelCase formatına çevir
-- Bu script'i Supabase SQL Editor'dan çalıştırın
-- Tablo: quality_inspections (üretilen araçlar tablosu)
-- =====================================================

-- 1. Önce güncellenecek kayıtları kontrol edin (opsiyonel)
SELECT id, customer_name as eski_isim, INITCAP(LOWER(TRIM(customer_name))) as yeni_isim
FROM public.quality_inspections 
WHERE customer_name IS NOT NULL 
  AND customer_name != ''
  AND customer_name != INITCAP(LOWER(TRIM(customer_name)))
LIMIT 50;

-- 2. Tüm müşteri isimlerini CamelCase formatına güncelle
UPDATE public.quality_inspections 
SET customer_name = INITCAP(LOWER(TRIM(customer_name))),
    updated_at = NOW()
WHERE customer_name IS NOT NULL 
  AND customer_name != ''
  AND customer_name != INITCAP(LOWER(TRIM(customer_name)));

-- 3. Sonucu kontrol edin
SELECT 'Güncelleme tamamlandı! Etkilenen satır sayısı yukarıda görünmektedir.' as mesaj;
