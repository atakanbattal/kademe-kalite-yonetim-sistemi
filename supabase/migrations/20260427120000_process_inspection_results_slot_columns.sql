-- Proses muayene sonuç satırlarını kontrol planı kalemine ve ölçüm numarasına bağlamak
-- (INKR/raporlarda nominal–ölçü eşlemesi; kova hatası önlenir)
ALTER TABLE public.process_inspection_results
  ADD COLUMN IF NOT EXISTS control_plan_item_id uuid,
  ADD COLUMN IF NOT EXISTS measurement_number integer;

COMMENT ON COLUMN public.process_inspection_results.control_plan_item_id IS
  'process_control_plans.items[].id değeri; muayene satırı hangi kalemle eşleşir';
COMMENT ON COLUMN public.process_inspection_results.measurement_number IS
  'Aynı kalemde kaçıncı ölçüm (1 tabanlı)';

CREATE INDEX IF NOT EXISTS idx_process_inspection_results_control_plan_item
  ON public.process_inspection_results (control_plan_item_id)
  WHERE control_plan_item_id IS NOT NULL;
