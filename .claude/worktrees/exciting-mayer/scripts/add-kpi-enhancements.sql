-- KPI Modülü Geliştirmeleri
-- Aylık hedef ve gerçekleşen takibi için tablo
CREATE TABLE IF NOT EXISTS public.kpi_monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    target_value NUMERIC,
    actual_value NUMERIC,
    responsible_unit TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kpi_id, year, month)
);

-- KPI aksiyonları tablosu
CREATE TABLE IF NOT EXISTS public.kpi_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('DÖF', '8D', 'Geliştirme Planı')),
    title TEXT NOT NULL,
    description TEXT,
    responsible_unit TEXT,
    responsible_person TEXT,
    due_date DATE,
    status TEXT DEFAULT 'Beklemede' CHECK (status IN ('Beklemede', 'Devam Ediyor', 'Tamamlandı', 'İptal')),
    related_nc_id UUID REFERENCES public.non_conformities(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI tablosuna sorumlu birim ve otomatik öneri alanları ekle
ALTER TABLE public.kpis 
ADD COLUMN IF NOT EXISTS responsible_unit TEXT,
ADD COLUMN IF NOT EXISTS auto_suggest_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS threshold_percentage NUMERIC DEFAULT 10; -- %10 sapma için otomatik öneri

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_kpi_monthly_data_kpi_id ON public.kpi_monthly_data(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_monthly_data_year_month ON public.kpi_monthly_data(year, month);
CREATE INDEX IF NOT EXISTS idx_kpi_actions_kpi_id ON public.kpi_actions(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_actions_status ON public.kpi_actions(status);

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_kpi_monthly_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kpi_monthly_data_updated_at
    BEFORE UPDATE ON public.kpi_monthly_data
    FOR EACH ROW
    EXECUTE FUNCTION update_kpi_monthly_data_updated_at();

CREATE TRIGGER update_kpi_actions_updated_at
    BEFORE UPDATE ON public.kpi_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_kpi_monthly_data_updated_at();

-- RLS Policies
ALTER TABLE public.kpi_monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_actions ENABLE ROW LEVEL SECURITY;

-- KPI monthly data için policy
CREATE POLICY "KPI monthly data görüntüleme" ON public.kpi_monthly_data
    FOR SELECT USING (true);

CREATE POLICY "KPI monthly data ekleme" ON public.kpi_monthly_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "KPI monthly data güncelleme" ON public.kpi_monthly_data
    FOR UPDATE USING (true);

-- KPI actions için policy
CREATE POLICY "KPI actions görüntüleme" ON public.kpi_actions
    FOR SELECT USING (true);

CREATE POLICY "KPI actions ekleme" ON public.kpi_actions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "KPI actions güncelleme" ON public.kpi_actions
    FOR UPDATE USING (true);

-- Fonksiyon: KPI sapma hesaplama
CREATE OR REPLACE FUNCTION calculate_kpi_deviation(
    p_kpi_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_target NUMERIC;
    v_actual NUMERIC;
    v_deviation NUMERIC;
BEGIN
    SELECT target_value, actual_value
    INTO v_target, v_actual
    FROM public.kpi_monthly_data
    WHERE kpi_id = p_kpi_id AND year = p_year AND month = p_month;
    
    IF v_target IS NULL OR v_actual IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF v_target = 0 THEN
        RETURN NULL;
    END IF;
    
    v_deviation := ((v_actual - v_target) / v_target * 100);
    RETURN v_deviation;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyon: KPI hedef tutmama kontrolü ve otomatik öneri
CREATE OR REPLACE FUNCTION check_kpi_target_and_suggest(
    p_kpi_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_kpi RECORD;
    v_monthly_data RECORD;
    v_deviation NUMERIC;
    v_threshold NUMERIC;
    v_target_direction TEXT;
    v_needs_action BOOLEAN := false;
    v_suggestion JSONB;
BEGIN
    -- KPI bilgilerini al
    SELECT target_direction, threshold_percentage, auto_suggest_enabled, responsible_unit
    INTO v_kpi
    FROM public.kpis
    WHERE id = p_kpi_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'KPI bulunamadı');
    END IF;
    
    IF NOT v_kpi.auto_suggest_enabled THEN
        RETURN jsonb_build_object('needs_action', false, 'message', 'Otomatik öneri devre dışı');
    END IF;
    
    -- Aylık veriyi al
    SELECT target_value, actual_value
    INTO v_monthly_data
    FROM public.kpi_monthly_data
    WHERE kpi_id = p_kpi_id AND year = p_year AND month = p_month;
    
    IF v_monthly_data.target_value IS NULL OR v_monthly_data.actual_value IS NULL THEN
        RETURN jsonb_build_object('needs_action', false, 'message', 'Aylık veri eksik');
    END IF;
    
    -- Sapma hesapla
    v_deviation := calculate_kpi_deviation(p_kpi_id, p_year, p_month);
    v_threshold := COALESCE(v_kpi.threshold_percentage, 10);
    v_target_direction := v_kpi.target_direction;
    
    -- Hedef tutmama kontrolü
    IF v_target_direction = 'increase' THEN
        -- Artırılması gereken KPI için, gerçekleşen hedefin altındaysa
        IF v_monthly_data.actual_value < v_monthly_data.target_value THEN
            v_needs_action := true;
        END IF;
    ELSIF v_target_direction = 'decrease' THEN
        -- Azaltılması gereken KPI için, gerçekleşen hedefin üstündeyse
        IF v_monthly_data.actual_value > v_monthly_data.target_value THEN
            v_needs_action := true;
        END IF;
    END IF;
    
    -- Sapma yüzdesi kontrolü
    IF ABS(v_deviation) > v_threshold THEN
        v_needs_action := true;
    END IF;
    
    IF v_needs_action THEN
        v_suggestion := jsonb_build_object(
            'needs_action', true,
            'deviation', v_deviation,
            'threshold', v_threshold,
            'suggestions', jsonb_build_array(
                jsonb_build_object('type', 'DÖF', 'priority', 'Yüksek'),
                jsonb_build_object('type', '8D', 'priority', 'Orta'),
                jsonb_build_object('type', 'Geliştirme Planı', 'priority', 'Düşük')
            ),
            'responsible_unit', v_kpi.responsible_unit
        );
    ELSE
        v_suggestion := jsonb_build_object('needs_action', false, 'message', 'Hedef tutuluyor');
    END IF;
    
    RETURN v_suggestion;
END;
$$ LANGUAGE plpgsql;

