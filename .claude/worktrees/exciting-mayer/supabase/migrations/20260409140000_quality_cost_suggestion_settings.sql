-- Kalite maliyeti Performans & DF sekmesi: DF/8D/MDI öneri eşikleri (uygunsuzluk ayarlarına paralel)
CREATE TABLE IF NOT EXISTS public.quality_cost_suggestion_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Tek kayıt tutarı (TRY) — tekrar kontrolünden önce değerlendirilir
    df_cost_threshold_try numeric(18, 2) NOT NULL DEFAULT 50000,
    eight_d_cost_threshold_try numeric(18, 2) NOT NULL DEFAULT 150000,
    mdi_cost_threshold_try numeric(18, 2) NOT NULL DEFAULT 25000,
    -- Aynı parça kodunda (seçili dönemdeki kayıtlar içinde) kaç tekrar → öneri
    df_recurrence_threshold integer NOT NULL DEFAULT 3 CHECK (df_recurrence_threshold >= 1),
    eight_d_recurrence_threshold integer NOT NULL DEFAULT 5 CHECK (eight_d_recurrence_threshold >= 1),
    -- Açıklama için tutulur (ileride kayıt tarihine göre pencere için)
    threshold_period_days integer NOT NULL DEFAULT 30 CHECK (threshold_period_days >= 1 AND threshold_period_days <= 365),
    auto_suggest boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.quality_cost_suggestion_settings IS 'Kalite maliyeti analizinde DF/8D/MDI öneri eşikleri (tek satır, singleton).';

-- Varsayılan tek satır (tablo boşsa)
INSERT INTO public.quality_cost_suggestion_settings (
    df_cost_threshold_try,
    eight_d_cost_threshold_try,
    mdi_cost_threshold_try,
    df_recurrence_threshold,
    eight_d_recurrence_threshold,
    threshold_period_days,
    auto_suggest
)
SELECT 50000, 150000, 25000, 3, 5, 30, true
WHERE NOT EXISTS (SELECT 1 FROM public.quality_cost_suggestion_settings LIMIT 1);

-- RLS
ALTER TABLE public.quality_cost_suggestion_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quality_cost_suggestion_settings_all_authenticated" ON public.quality_cost_suggestion_settings;

CREATE POLICY "quality_cost_suggestion_settings_all_authenticated"
    ON public.quality_cost_suggestion_settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_cost_suggestion_settings TO authenticated;
