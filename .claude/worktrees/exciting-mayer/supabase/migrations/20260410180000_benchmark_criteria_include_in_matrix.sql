-- Matrikste kullanılmayan metrikler listede kalır; karşılaştırmada gizlenir.
ALTER TABLE public.benchmark_criteria
ADD COLUMN IF NOT EXISTS include_in_matrix boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.benchmark_criteria.include_in_matrix IS
    'true: bu benchmark karşılaştırma matrisinde kullanılır; false: tanım kalır, matris ve skor toplamlarında dışarıda';

CREATE INDEX IF NOT EXISTS idx_benchmark_criteria_benchmark_include
    ON public.benchmark_criteria (benchmark_id, include_in_matrix);
