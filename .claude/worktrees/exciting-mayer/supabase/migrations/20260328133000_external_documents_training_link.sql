-- Dış kaynaklı doküman ↔ eğitim planı ilişkisi

ALTER TABLE public.external_documents
  ADD COLUMN IF NOT EXISTS training_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_external_documents_training_id
  ON public.external_documents(training_id)
  WHERE training_id IS NOT NULL;

COMMENT ON COLUMN public.external_documents.training_required IS 'Bu doküman için eğitim verilmesi gerektiği işaretlendi mi';
COMMENT ON COLUMN public.external_documents.training_id IS 'Otomatik oluşturulan ilişkili eğitim planı';
