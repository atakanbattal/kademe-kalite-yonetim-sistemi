-- Araç kaynaklı uygunsuzluklarda araç bilgisini (seri no, şasi no) parça kodu yerine ayrı tutmak için
ALTER TABLE public.nonconformity_records
ADD COLUMN IF NOT EXISTS vehicle_identifier TEXT;

COMMENT ON COLUMN public.nonconformity_records.vehicle_identifier IS 'Üretilen araçlardan gelen uygunsuzluklarda seri no veya şasi no';

-- Mevcut kayıtları taşı: Üretilen Araçlar modülünden gelenlerde part_code -> vehicle_identifier
UPDATE public.nonconformity_records
SET vehicle_identifier = part_code,
    part_code = NULL
WHERE detection_area = 'Üretilen Araçlar'
  AND part_code IS NOT NULL
  AND vehicle_identifier IS NULL;
