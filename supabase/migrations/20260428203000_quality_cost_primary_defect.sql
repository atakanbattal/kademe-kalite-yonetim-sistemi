-- Hurda / yeniden işlem: hesaplayıcı-only veya tek satırda ana hata tipi (proses muayene listesi ile uyumlu)
ALTER TABLE public.quality_costs
  ADD COLUMN IF NOT EXISTS primary_defect_type text,
  ADD COLUMN IF NOT EXISTS primary_defect_group_key text;

COMMENT ON COLUMN public.quality_costs.primary_defect_type IS 'Hurda/yeniden işlem: kalemsiz veya tek kaynakta seçilen hata tipi (defectCategories)';
COMMENT ON COLUMN public.quality_costs.primary_defect_group_key IS 'Disiplin grubu (kaynak, montaj, boya, ...)';

CREATE INDEX IF NOT EXISTS idx_quality_costs_primary_defect_group
  ON public.quality_costs (primary_defect_group_key)
  WHERE primary_defect_group_key IS NOT NULL;
