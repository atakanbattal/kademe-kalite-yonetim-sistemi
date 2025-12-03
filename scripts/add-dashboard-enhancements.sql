-- Dashboard Geliştirmeleri için Veritabanı Tabloları

-- 1. Kalite Hedefleri Tablosu (ISO 9001:2015 Madde 6.2)
CREATE TABLE IF NOT EXISTS public.quality_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_name TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('DF_COUNT', '8D_COUNT', 'QUALITY_COST', 'NC_CLOSURE_RATE', 'QUARANTINE_COUNT', 'CUSTOM')),
    target_value NUMERIC NOT NULL,
    target_direction TEXT DEFAULT 'decrease' CHECK (target_direction IN ('increase', 'decrease')),
    unit TEXT,
    year INTEGER NOT NULL,
    description TEXT,
    responsible_unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Benchmark Değerleri Tablosu
CREATE TABLE IF NOT EXISTS public.benchmark_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('DF_COUNT', 'QUALITY_COST', 'SUPPLIER_PPM', 'NC_CLOSURE_RATE')),
    industry_average NUMERIC,
    best_in_class NUMERIC,
    our_value NUMERIC,
    period TEXT, -- '2024-Q1', '2024-01', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(metric_type, period)
);

-- 3. Risk Değerlendirmeleri Tablosu (ISO 9001:2015 Madde 6.1, IATF)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_type TEXT NOT NULL CHECK (risk_type IN ('PROCESS', 'SUPPLIER', 'VEHICLE_TYPE', 'PART_CODE', 'EQUIPMENT')),
    risk_name TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    probability INTEGER CHECK (probability >= 1 AND probability <= 5),
    impact INTEGER CHECK (impact >= 1 AND impact <= 5),
    risk_score INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
    mitigation_actions TEXT,
    responsible_unit TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MITIGATED', 'CLOSED')),
    last_assessment_date DATE DEFAULT CURRENT_DATE,
    next_assessment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 5S Skorları Tablosu
CREATE TABLE IF NOT EXISTS public.five_s_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.cost_settings(id),
    department_name TEXT NOT NULL,
    score_sort NUMERIC CHECK (score_sort >= 0 AND score_sort <= 100),
    score_set_in_order NUMERIC CHECK (score_set_in_order >= 0 AND score_set_in_order <= 100),
    score_shine NUMERIC CHECK (score_shine >= 0 AND score_shine <= 100),
    score_standardize NUMERIC CHECK (score_standardize >= 0 AND score_standardize <= 100),
    score_sustain NUMERIC CHECK (score_sustain >= 0 AND score_sustain <= 100),
    total_score NUMERIC GENERATED ALWAYS AS (
        (score_sort + score_set_in_order + score_shine + score_standardize + score_sustain) / 5
    ) STORED,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. İş Güvenliği Skorları Tablosu
CREATE TABLE IF NOT EXISTS public.safety_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.cost_settings(id),
    department_name TEXT NOT NULL,
    accident_count INTEGER DEFAULT 0,
    near_miss_count INTEGER DEFAULT 0,
    safety_training_hours NUMERIC DEFAULT 0,
    safety_score NUMERIC CHECK (safety_score >= 0 AND safety_score <= 100),
    period TEXT NOT NULL, -- '2024-01', '2024-Q1', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(department_id, period)
);

-- 6. OEE (Overall Equipment Effectiveness) Tablosu
CREATE TABLE IF NOT EXISTS public.oee_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES public.equipments(id),
    equipment_name TEXT NOT NULL,
    availability NUMERIC CHECK (availability >= 0 AND availability <= 100),
    performance NUMERIC CHECK (performance >= 0 AND performance <= 100),
    quality NUMERIC CHECK (quality >= 0 AND quality <= 100),
    oee_score NUMERIC GENERATED ALWAYS AS (
        (availability * performance * quality) / 10000
    ) STORED,
    period TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(equipment_id, period)
);

-- 7. Bildirimler (Notifications) Tablosu
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'SUPPLIER_REJECTION', 'DEVIATION_CREATED', 'QUARANTINE_OPENED', 
        '8D_OVERDUE', 'CALIBRATION_DUE', 'DOCUMENT_EXPIRING', 
        'COST_ANOMALY', 'NC_CREATED', 'AUDIT_DUE'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_module TEXT,
    related_id UUID,
    is_read BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_quality_goals_year ON public.quality_goals(year);
CREATE INDEX IF NOT EXISTS idx_benchmark_values_metric_period ON public.benchmark_values(metric_type, period);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_type_level ON public.risk_assessments(risk_type, risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON public.risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_five_s_scores_department_date ON public.five_s_scores(department_id, assessment_date);
CREATE INDEX IF NOT EXISTS idx_safety_scores_department_period ON public.safety_scores(department_id, period);
CREATE INDEX IF NOT EXISTS idx_oee_scores_equipment_period ON public.oee_scores(equipment_id, period);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_dashboard_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quality_goals_updated_at
    BEFORE UPDATE ON public.quality_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

CREATE TRIGGER update_benchmark_values_updated_at
    BEFORE UPDATE ON public.benchmark_values
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

CREATE TRIGGER update_risk_assessments_updated_at
    BEFORE UPDATE ON public.risk_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

CREATE TRIGGER update_five_s_scores_updated_at
    BEFORE UPDATE ON public.five_s_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

CREATE TRIGGER update_safety_scores_updated_at
    BEFORE UPDATE ON public.safety_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

CREATE TRIGGER update_oee_scores_updated_at
    BEFORE UPDATE ON public.oee_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_tables_updated_at();

-- RLS Policies
ALTER TABLE public.quality_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.five_s_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oee_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Quality Goals Policies
CREATE POLICY "Quality goals görüntüleme" ON public.quality_goals FOR SELECT USING (true);
CREATE POLICY "Quality goals ekleme" ON public.quality_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Quality goals güncelleme" ON public.quality_goals FOR UPDATE USING (true);

-- Benchmark Policies
CREATE POLICY "Benchmark görüntüleme" ON public.benchmark_values FOR SELECT USING (true);
CREATE POLICY "Benchmark ekleme" ON public.benchmark_values FOR INSERT WITH CHECK (true);
CREATE POLICY "Benchmark güncelleme" ON public.benchmark_values FOR UPDATE USING (true);

-- Risk Assessment Policies
CREATE POLICY "Risk assessment görüntüleme" ON public.risk_assessments FOR SELECT USING (true);
CREATE POLICY "Risk assessment ekleme" ON public.risk_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Risk assessment güncelleme" ON public.risk_assessments FOR UPDATE USING (true);

-- 5S Scores Policies
CREATE POLICY "5S scores görüntüleme" ON public.five_s_scores FOR SELECT USING (true);
CREATE POLICY "5S scores ekleme" ON public.five_s_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "5S scores güncelleme" ON public.five_s_scores FOR UPDATE USING (true);

-- Safety Scores Policies
CREATE POLICY "Safety scores görüntüleme" ON public.safety_scores FOR SELECT USING (true);
CREATE POLICY "Safety scores ekleme" ON public.safety_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Safety scores güncelleme" ON public.safety_scores FOR UPDATE USING (true);

-- OEE Scores Policies
CREATE POLICY "OEE scores görüntüleme" ON public.oee_scores FOR SELECT USING (true);
CREATE POLICY "OEE scores ekleme" ON public.oee_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "OEE scores güncelleme" ON public.oee_scores FOR UPDATE USING (true);

-- Notifications Policies
CREATE POLICY "Notifications görüntüleme" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR true);
CREATE POLICY "Notifications ekleme" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications güncelleme" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR true);

-- Fonksiyon: Otomatik bildirim oluşturma
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_module TEXT DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'NORMAL'
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id, notification_type, title, message, 
        related_module, related_id, priority
    ) VALUES (
        p_user_id, p_notification_type, p_title, p_message,
        p_related_module, p_related_id, p_priority
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyon: AI Destekli kök neden tahmin (basit versiyon)
CREATE OR REPLACE FUNCTION predict_root_cause(
    p_part_code TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_vehicle_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_part_nc_count INTEGER;
    v_dept_nc_count INTEGER;
    v_vehicle_nc_count INTEGER;
BEGIN
    -- Parça kodu bazında analiz
    IF p_part_code IS NOT NULL THEN
        SELECT COUNT(*) INTO v_part_nc_count
        FROM public.non_conformities
        WHERE part_code = p_part_code
        AND status != 'Kapatıldı';
    END IF;
    
    -- Birim bazında analiz
    IF p_department IS NOT NULL THEN
        SELECT COUNT(*) INTO v_dept_nc_count
        FROM public.non_conformities
        WHERE (requesting_unit = p_department OR department = p_department)
        AND status != 'Kapatıldı';
    END IF;
    
    -- Araç tipi bazında analiz
    IF p_vehicle_type IS NOT NULL THEN
        SELECT COUNT(*) INTO v_vehicle_nc_count
        FROM public.non_conformities
        WHERE vehicle_type = p_vehicle_type
        AND status != 'Kapatıldı';
    END IF;
    
    v_result := jsonb_build_object(
        'part_code_analysis', jsonb_build_object(
            'part_code', p_part_code,
            'open_nc_count', COALESCE(v_part_nc_count, 0),
            'risk_level', CASE 
                WHEN COALESCE(v_part_nc_count, 0) > 5 THEN 'HIGH'
                WHEN COALESCE(v_part_nc_count, 0) > 2 THEN 'MEDIUM'
                ELSE 'LOW'
            END
        ),
        'department_analysis', jsonb_build_object(
            'department', p_department,
            'open_nc_count', COALESCE(v_dept_nc_count, 0),
            'risk_level', CASE 
                WHEN COALESCE(v_dept_nc_count, 0) > 10 THEN 'HIGH'
                WHEN COALESCE(v_dept_nc_count, 0) > 5 THEN 'MEDIUM'
                ELSE 'LOW'
            END
        ),
        'vehicle_type_analysis', jsonb_build_object(
            'vehicle_type', p_vehicle_type,
            'open_nc_count', COALESCE(v_vehicle_nc_count, 0),
            'risk_level', CASE 
                WHEN COALESCE(v_vehicle_nc_count, 0) > 8 THEN 'HIGH'
                WHEN COALESCE(v_vehicle_nc_count, 0) > 4 THEN 'MEDIUM'
                ELSE 'LOW'
            END
        ),
        'recommendation', CASE
            WHEN COALESCE(v_part_nc_count, 0) > 5 THEN 'Parça kodu için kök neden analizi yapılmalı'
            WHEN COALESCE(v_dept_nc_count, 0) > 10 THEN 'Birim bazında süreç iyileştirme gerekli'
            WHEN COALESCE(v_vehicle_nc_count, 0) > 8 THEN 'Araç tipi için özel kontrol planı oluşturulmalı'
            ELSE 'Mevcut durum normal görünüyor'
        END
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

