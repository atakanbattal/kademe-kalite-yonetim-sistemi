-- Karantina işlem geçmişi ile sapma kaydı arasında izlenebilir bağlantı
ALTER TABLE public.quarantine_history
ADD COLUMN IF NOT EXISTS deviation_id UUID REFERENCES public.deviations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quarantine_history.deviation_id IS 'Bu karantina kararı için oluşturulan sapma kaydı (imzalı PDF sapma eklerinde)';

CREATE INDEX IF NOT EXISTS idx_quarantine_history_deviation_id ON public.quarantine_history(deviation_id);
