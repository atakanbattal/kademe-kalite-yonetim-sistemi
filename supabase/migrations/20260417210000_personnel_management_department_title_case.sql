-- cost_settings ile aynı birim adları personnel.management_department alanında
-- büyük harfle kalmışsa Title Case'e (projede "camelCase" olarak kullanılan biçim) çeker.
-- Idempotent: birden fazla çalıştırılabilir.

BEGIN;

UPDATE public.personnel SET management_department = 'Ar-Ge Direktörlüğü'
  WHERE management_department = 'AR-GE DİREKTÖRLÜĞÜ';
UPDATE public.personnel SET management_department = 'İdari İşler Müdürlüğü'
  WHERE management_department = 'İDARİ İŞLER MÜDÜRLÜĞÜ';
UPDATE public.personnel SET management_department = 'Kurumsal İletişim ve Dijital Pazarlama'
  WHERE management_department = 'KURUMSAL İLETİŞİM VE DİJİTAL PAZARLAMA';
UPDATE public.personnel SET management_department = 'Lojistik Yöneticiliği'
  WHERE management_department = 'LOJİSTİK YÖNETİCİLİĞİ';
UPDATE public.personnel SET management_department = 'Satınalma Müdürlüğü'
  WHERE management_department = 'SATINALMA MÜDÜRLÜĞÜ';
UPDATE public.personnel SET management_department = 'Satış Sonrası Hizmetler Müdürlüğü'
  WHERE management_department = 'SATIŞ SONRASI HİZMETLER MÜDÜRLÜĞÜ';
UPDATE public.personnel SET management_department = 'Üretim Müdürlüğü (Kabin Hattı)'
  WHERE management_department = 'ÜRETİM MÜDÜRLÜĞÜ (KABİN HATTI)';
UPDATE public.personnel SET management_department = 'Üretim Müdürlüğü (Üst Yapı)'
  WHERE management_department = 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)';
UPDATE public.personnel SET management_department = 'Üretim Planlama Müdürlüğü'
  WHERE management_department = 'ÜRETİM PLANLAMA MÜDÜRLÜĞÜ';
UPDATE public.personnel SET management_department = 'Yurt Dışı Satış Müdürlüğü'
  WHERE management_department = 'YURT DIŞI SATIŞ MÜDÜRLÜĞÜ';
UPDATE public.personnel SET management_department = 'Yurt İçi Satış Müdürlüğü'
  WHERE management_department = 'YURT İÇİ SATIŞ MÜDÜRLÜĞÜ';

COMMIT;
