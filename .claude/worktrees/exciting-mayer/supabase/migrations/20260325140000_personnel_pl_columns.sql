-- PL ile eşleştirilecek personel alanları (sync part1/part2 migration'larından önce)
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS management_department text,
  ADD COLUMN IF NOT EXISTS collar_type text;

COMMENT ON COLUMN public.personnel.management_department IS 'Üst departman / müdürlük (PL DEPARTMAN)';
COMMENT ON COLUMN public.personnel.collar_type IS 'Yaka ünvanı: MAVİ / BEYAZ (PL UNVAN)';
