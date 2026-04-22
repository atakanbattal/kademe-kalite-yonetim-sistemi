-- eight_d_progress kolonu ekleme migration
-- Bu migration non_conformities tablosuna eight_d_progress JSONB kolonunu ekler

-- 1. eight_d_progress JSONB kolonu ekle
ALTER TABLE public.non_conformities 
ADD COLUMN IF NOT EXISTS eight_d_progress JSONB DEFAULT '{
    "D1": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D2": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D3": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D4": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D5": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D6": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D7": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D8": {"completed": false, "responsible": null, "completionDate": null, "description": null}
}'::jsonb;

-- 2. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_non_conformities_eight_d_progress 
ON public.non_conformities USING GIN (eight_d_progress);

-- 3. Kolon açıklaması ekle
COMMENT ON COLUMN public.non_conformities.eight_d_progress IS '8D adımlarının tamamlanma durumu ve detayları (JSONB)';

-- 4. Mevcut kayıtlar için varsayılan değer güncelle (eğer NULL ise)
UPDATE public.non_conformities 
SET eight_d_progress = '{
    "D1": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D2": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D3": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D4": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D5": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D6": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D7": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D8": {"completed": false, "responsible": null, "completionDate": null, "description": null}
}'::jsonb
WHERE eight_d_progress IS NULL;

