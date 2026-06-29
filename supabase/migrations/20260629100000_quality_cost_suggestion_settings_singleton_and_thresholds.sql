-- Singleton: yalnızca bir eşik satırı
ALTER TABLE public.quality_cost_suggestion_settings
  ADD COLUMN IF NOT EXISTS singleton_key smallint NOT NULL DEFAULT 1
    CHECK (singleton_key = 1);

CREATE UNIQUE INDEX IF NOT EXISTS quality_cost_suggestion_settings_singleton_key_idx
  ON public.quality_cost_suggestion_settings (singleton_key);

-- Güncel eşikler (500 USD / 1000 USD, 5 / 10 tekrar)
UPDATE public.quality_cost_suggestion_settings SET
  df_cost_threshold_try = 23321.22,
  eight_d_cost_threshold_try = 46642.44,
  mdi_cost_threshold_try = 10000,
  df_recurrence_threshold = 5,
  eight_d_recurrence_threshold = 10,
  updated_at = now();
