-- =====================================================
-- Tedarikçi Sınıfına Göre Durum Düzeltmesi
-- Bu script mevcut sınıflara göre durumları günceller
-- Supabase SQL Editor'dan çalıştırın
-- =====================================================

-- 1. Önce mevcut durumu kontrol edin
SELECT 
    name as tedarikci_adi,
    supplier_grade as sinif,
    status as mevcut_durum,
    CASE 
        WHEN supplier_grade = 'A' THEN 'Onaylı'
        WHEN supplier_grade = 'B' THEN 'Onaylı'
        WHEN supplier_grade = 'C' THEN 'Askıya Alınmış'
        WHEN supplier_grade = 'D' THEN 'Red'
        ELSE status
    END as olmasi_gereken_durum
FROM public.suppliers
WHERE supplier_grade IS NOT NULL
ORDER BY supplier_grade;

-- 2. D sınıfı tedarikçilerin durumunu "Red" yap
UPDATE public.suppliers
SET status = 'Red', updated_at = NOW()
WHERE supplier_grade = 'D' AND status != 'Red';

-- 3. C sınıfı tedarikçilerin durumunu "Askıya Alınmış" yap
UPDATE public.suppliers
SET status = 'Askıya Alınmış', updated_at = NOW()
WHERE supplier_grade = 'C' AND status != 'Askıya Alınmış';

-- 4. A ve B sınıfı tedarikçilerin durumunu "Onaylı" yap
UPDATE public.suppliers
SET status = 'Onaylı', updated_at = NOW()
WHERE supplier_grade IN ('A', 'B') AND status != 'Onaylı';

-- 5. Sonucu kontrol edin
SELECT 
    name as tedarikci_adi,
    supplier_grade as sinif,
    status as guncellenmis_durum,
    grade_reason as gerekcesi
FROM public.suppliers
WHERE supplier_grade IS NOT NULL
ORDER BY supplier_grade;

SELECT 'Güncelleme tamamlandı!' as mesaj;
