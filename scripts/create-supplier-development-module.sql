-- Tedarikçi Geliştirme Modülü
-- IATF 16949 - Supplier Development

-- 1. Tedarikçi Geliştirme Planları
CREATE TABLE IF NOT EXISTS supplier_development_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Plan Bilgileri
    plan_name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(50) NOT NULL, -- 'Quality Improvement', 'Capacity', 'Cost Reduction', 'Technology'
    priority VARCHAR(50) DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    
    -- Hedefler
    objectives TEXT NOT NULL,
    target_metrics JSONB, -- Hedef metrikler (PPM, OTD, etc.)
    current_status VARCHAR(50) DEFAULT 'Planned', -- 'Planned', 'In Progress', 'Completed', 'On Hold'
    
    -- Tarihler
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Geliştirme Aksiyonları
CREATE TABLE IF NOT EXISTS supplier_development_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES supplier_development_plans(id) ON DELETE CASCADE,
    
    -- Aksiyon Bilgileri
    action_number INTEGER NOT NULL,
    action_description TEXT NOT NULL,
    action_type VARCHAR(50), -- 'Training', 'Process Improvement', 'Equipment', 'Documentation'
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'In Progress', 'Completed', 'Cancelled'
    due_date DATE,
    completed_date DATE,
    
    -- Sonuçlar
    results TEXT,
    evidence_files TEXT[], -- Dosya yolları
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Geliştirme Değerlendirmeleri
CREATE TABLE IF NOT EXISTS supplier_development_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES supplier_development_plans(id) ON DELETE CASCADE,
    
    -- Değerlendirme Bilgileri
    assessment_date DATE NOT NULL,
    assessment_type VARCHAR(50) NOT NULL, -- 'Initial', 'Progress', 'Final'
    
    -- Sonuçlar
    metrics_before JSONB, -- Önceki metrikler
    metrics_after JSONB, -- Sonraki metrikler
    improvement_percentage DECIMAL(5, 2),
    
    -- Değerlendirme
    assessment_notes TEXT,
    assessor_id UUID REFERENCES personnel(id),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_dev_plans_supplier ON supplier_development_plans(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dev_actions_plan ON supplier_development_actions(plan_id);
CREATE INDEX IF NOT EXISTS idx_dev_assessments_plan ON supplier_development_assessments(plan_id);

-- RLS Politikaları
ALTER TABLE supplier_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_development_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_development_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_plans_select" ON supplier_development_plans FOR SELECT USING (true);
CREATE POLICY "dev_plans_insert" ON supplier_development_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_plans_update" ON supplier_development_plans FOR UPDATE USING (true);
CREATE POLICY "dev_plans_delete" ON supplier_development_plans FOR DELETE USING (true);

CREATE POLICY "dev_actions_select" ON supplier_development_actions FOR SELECT USING (true);
CREATE POLICY "dev_actions_insert" ON supplier_development_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_actions_update" ON supplier_development_actions FOR UPDATE USING (true);
CREATE POLICY "dev_actions_delete" ON supplier_development_actions FOR DELETE USING (true);

CREATE POLICY "dev_assessments_select" ON supplier_development_assessments FOR SELECT USING (true);
CREATE POLICY "dev_assessments_insert" ON supplier_development_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_assessments_update" ON supplier_development_assessments FOR UPDATE USING (true);
CREATE POLICY "dev_assessments_delete" ON supplier_development_assessments FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme (eğer fonksiyon yoksa oluştur)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dev_plans_updated_at
    BEFORE UPDATE ON supplier_development_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dev_actions_updated_at
    BEFORE UPDATE ON supplier_development_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

