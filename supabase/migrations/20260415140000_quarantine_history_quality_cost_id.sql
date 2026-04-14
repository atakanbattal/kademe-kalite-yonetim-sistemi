ALTER TABLE public.quarantine_history
ADD COLUMN IF NOT EXISTS quality_cost_id UUID REFERENCES public.quality_costs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quarantine_history.quality_cost_id IS 'Karantina hurda kararı için oluşturulan kalite maliyeti kaydı (hurda tutanağı ekleri)';

CREATE INDEX IF NOT EXISTS idx_quarantine_history_quality_cost_id ON public.quarantine_history(quality_cost_id);
