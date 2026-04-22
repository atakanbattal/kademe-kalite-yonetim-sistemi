-- Otomatik üretilen benchmark kriterlerini manuel kriterlerden ayırmak için
ALTER TABLE public.benchmark_criteria
ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.benchmark_criteria.source IS 'manual: kullanıcı tanımlı; auto: alternatif verilerinden üretildi';

ALTER TABLE public.benchmark_criteria DROP CONSTRAINT IF EXISTS benchmark_criteria_source_check;
ALTER TABLE public.benchmark_criteria ADD CONSTRAINT benchmark_criteria_source_check CHECK (source IN ('manual', 'auto'));

CREATE INDEX IF NOT EXISTS idx_benchmark_criteria_benchmark_source ON public.benchmark_criteria(benchmark_id, source);
