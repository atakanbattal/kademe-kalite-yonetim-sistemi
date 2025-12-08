-- ====================================================
-- eight_d_progress Kolonu Migration (TAM ÇÖZÜM)
-- ====================================================
-- Bu migration non_conformities tablosuna eight_d_progress kolonunu ekler
-- Supabase Dashboard'da SQL Editor'de çalıştırın
-- ====================================================

-- 1. exec_sql fonksiyonunu oluştur (eğer yoksa)
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS TEXT AS $$
BEGIN
    EXECUTE query;
    RETURN 'Success';
EXCEPTION WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS politikası
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

-- 2. eight_d_progress JSONB kolonu ekle
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

-- 3. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_non_conformities_eight_d_progress 
ON public.non_conformities USING GIN (eight_d_progress);

-- 4. Kolon açıklaması ekle
COMMENT ON COLUMN public.non_conformities.eight_d_progress IS '8D adımlarının tamamlanma durumu ve detayları (JSONB)';

-- 5. Mevcut kayıtlar için varsayılan değer güncelle (eğer NULL ise)
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

-- ====================================================
-- Migration Tamamlandı!
-- ====================================================

