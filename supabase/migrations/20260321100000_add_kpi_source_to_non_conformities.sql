-- KPI'dan açılan uygunsuzlukları aylık bazda ilişkilendirmek için
ALTER TABLE public.non_conformities
ADD COLUMN IF NOT EXISTS source_kpi_id UUID REFERENCES public.kpis(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_kpi_year INTEGER,
ADD COLUMN IF NOT EXISTS source_kpi_month INTEGER;

COMMENT ON COLUMN public.non_conformities.source_kpi_id IS 'Kaynak KPI (KPI modülünden hedef tutmayan KPI için açılan uygunsuzluk)';
COMMENT ON COLUMN public.non_conformities.source_kpi_year IS 'KPI kaynak ay - yıl';
COMMENT ON COLUMN public.non_conformities.source_kpi_month IS 'KPI kaynak ay - ay (1-12)';

CREATE INDEX IF NOT EXISTS idx_non_conformities_source_kpi
ON public.non_conformities(source_kpi_id, source_kpi_year, source_kpi_month)
WHERE source_kpi_id IS NOT NULL;
