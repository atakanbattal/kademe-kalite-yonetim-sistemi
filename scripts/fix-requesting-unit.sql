  -- =====================================================
  -- Talep Eden Birim (requesting_unit) Düzeltmesi
  -- Bu script non_conformities tablosundaki yanlış 
  -- requesting_unit değerlerini personelin gerçek 
  -- departmanıyla düzeltir
  -- Supabase SQL Editor'dan çalıştırın
  -- =====================================================

  -- 1. Önce yanlış kayıtları kontrol edin
  SELECT 
      nc.id,
      nc.nc_number,
      nc.requesting_person,
      nc.requesting_unit as mevcut_birim,
      p.department as dogru_birim
  FROM public.non_conformities nc
  LEFT JOIN public.personnel p ON p.full_name = nc.requesting_person
  WHERE nc.requesting_person IS NOT NULL
    AND p.department IS NOT NULL
    AND nc.requesting_unit != p.department
  ORDER BY nc.created_at DESC
  LIMIT 50;

  -- 2. Yanlış requesting_unit değerlerini personelin gerçek departmanıyla güncelle
  UPDATE public.non_conformities nc
  SET 
      requesting_unit = p.department,
      updated_at = NOW()
  FROM public.personnel p
  WHERE p.full_name = nc.requesting_person
    AND p.department IS NOT NULL
    AND nc.requesting_unit != p.department;

  -- 3. Özellikle "Tedarikçi Kalite" gibi yanlış değerleri kontrol et ve düzelt
  -- (Yukarıdaki sorgu zaten bunu yapıyor ama ekstra kontrol için)
  UPDATE public.non_conformities nc
  SET 
      requesting_unit = p.department,
      updated_at = NOW()
  FROM public.personnel p
  WHERE p.full_name = nc.requesting_person
    AND p.department IS NOT NULL
    AND (nc.requesting_unit LIKE '%Tedarikçi%' OR nc.requesting_unit = 'Tedarikçi Kalite');

  -- 4. Sonucu kontrol edin
  SELECT 'Düzeltme tamamlandı!' as mesaj;
