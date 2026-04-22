-- PL personel listesindeki BİRİM değerleri (Ayarl > Birim / personel ataması / DF birim alanları)
INSERT INTO public.cost_settings (unit_name, cost_per_minute)
SELECT v.unit_name, 0::numeric
FROM (
  VALUES
    ('AR-GE'),
    ('BOYAHANE'),
    ('DEPO'),
    ('ELEKTRİKHANE'),
    ('GENEL MÜDÜRLÜK'),
    ('İDARİ İŞLER'),
    ('İNSAN KAYNAKLARI'),
    ('KABİN HATTI'),
    ('KALİTE GÜVENCE'),
    ('KALİTE KONTROL'),
    ('KAYNAKHANE'),
    ('KURUMSAL İLETİŞİM'),
    ('LOJİSTİK'),
    ('MALİ İŞLER'),
    ('MONTAJHANE'),
    ('PLANLAMA'),
    ('SATINALMA'),
    ('SATIŞ SONRASI HİZMETLER'),
    ('ÜST YAPI'),
    ('YURT DIŞI SATIŞ'),
    ('YURT İÇİ SATIŞ')
) AS v(unit_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cost_settings cs
  WHERE lower(trim(cs.unit_name)) = lower(trim(v.unit_name))
);
