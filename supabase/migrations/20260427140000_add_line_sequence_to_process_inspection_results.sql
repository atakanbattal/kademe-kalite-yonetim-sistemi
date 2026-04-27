-- Muayene sonuç satırlarının, formdaki (bundle) diziliş sırası — UUID id sırası güvenilmez
ALTER TABLE public.process_inspection_results
  ADD COLUMN IF NOT EXISTS line_sequence integer;

COMMENT ON COLUMN public.process_inspection_results.line_sequence IS
  'Proses muayene formu düz sonuç listesinde 0 tabanlı sıra; INKR/raporlarda bire bir eşleme için.';

CREATE INDEX IF NOT EXISTS idx_process_inspection_results_line_sequence
  ON public.process_inspection_results (inspection_id, line_sequence)
  WHERE line_sequence IS NOT NULL;
