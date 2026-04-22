-- Sürekli İyileştirme Projeleri (DMAIC) Modülü
-- Six Sigma Methodology

-- 1. DMAIC Projeleri
CREATE TABLE IF NOT EXISTS dmaic_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number VARCHAR(100) UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    
    -- Proje Bilgileri
    project_type VARCHAR(50) NOT NULL, -- 'DMAIC', 'DMADV', 'Quick Win'
    priority VARCHAR(50) DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    
    -- DMAIC Aşamaları
    define_status VARCHAR(50) DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'Completed'
    measure_status VARCHAR(50) DEFAULT 'Not Started',
    analyze_status VARCHAR(50) DEFAULT 'Not Started',
    improve_status VARCHAR(50) DEFAULT 'Not Started',
    control_status VARCHAR(50) DEFAULT 'Not Started',
    
    -- Proje Durumu
    overall_status VARCHAR(50) DEFAULT 'Define', -- 'Define', 'Measure', 'Analyze', 'Improve', 'Control', 'Completed'
    
    -- Problem Tanımı
    problem_statement TEXT,
    business_case TEXT,
    project_scope TEXT,
    
    -- Hedefler
    target_metrics JSONB, -- Hedef metrikler
    financial_impact DECIMAL(15, 2), -- Beklenen finansal etki
    
    -- Tarihler
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Ekip
    project_leader_id UUID REFERENCES personnel(id),
    team_members UUID[] DEFAULT ARRAY[]::UUID[],
    champion_id UUID REFERENCES personnel(id), -- Sponsor
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DMAIC Aşama Detayları
CREATE TABLE IF NOT EXISTS dmaic_phase_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES dmaic_projects(id) ON DELETE CASCADE,
    
    -- Aşama Bilgileri
    phase VARCHAR(20) NOT NULL, -- 'Define', 'Measure', 'Analyze', 'Improve', 'Control'
    phase_number INTEGER NOT NULL, -- 1-5
    
    -- Aşama İçeriği
    deliverables JSONB, -- Teslim edilecekler
    tools_used TEXT[], -- Kullanılan araçlar
    findings TEXT, -- Bulgular
    conclusions TEXT, -- Sonuçlar
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Not Started',
    completion_date DATE,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DMAIC Aksiyon Planları
CREATE TABLE IF NOT EXISTS dmaic_action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES dmaic_projects(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES dmaic_phase_details(id),
    
    -- Aksiyon Bilgileri
    action_number INTEGER NOT NULL,
    action_description TEXT NOT NULL,
    action_type VARCHAR(50), -- 'Data Collection', 'Analysis', 'Implementation', 'Monitoring'
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Open',
    due_date DATE,
    completed_date DATE,
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_dmaic_projects_status ON dmaic_projects(overall_status);
CREATE INDEX IF NOT EXISTS idx_dmaic_phases_project ON dmaic_phase_details(project_id);
CREATE INDEX IF NOT EXISTS idx_dmaic_actions_project ON dmaic_action_plans(project_id);

-- RLS Politikaları
ALTER TABLE dmaic_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmaic_phase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmaic_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dmaic_projects_select" ON dmaic_projects FOR SELECT USING (true);
CREATE POLICY "dmaic_projects_insert" ON dmaic_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "dmaic_projects_update" ON dmaic_projects FOR UPDATE USING (true);
CREATE POLICY "dmaic_projects_delete" ON dmaic_projects FOR DELETE USING (true);

CREATE POLICY "dmaic_phases_select" ON dmaic_phase_details FOR SELECT USING (true);
CREATE POLICY "dmaic_phases_insert" ON dmaic_phase_details FOR INSERT WITH CHECK (true);
CREATE POLICY "dmaic_phases_update" ON dmaic_phase_details FOR UPDATE USING (true);
CREATE POLICY "dmaic_phases_delete" ON dmaic_phase_details FOR DELETE USING (true);

CREATE POLICY "dmaic_actions_select" ON dmaic_action_plans FOR SELECT USING (true);
CREATE POLICY "dmaic_actions_insert" ON dmaic_action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "dmaic_actions_update" ON dmaic_action_plans FOR UPDATE USING (true);
CREATE POLICY "dmaic_actions_delete" ON dmaic_action_plans FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_dmaic_projects_updated_at
    BEFORE UPDATE ON dmaic_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_dmaic_phases_updated_at
    BEFORE UPDATE ON dmaic_phase_details
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_dmaic_actions_updated_at
    BEFORE UPDATE ON dmaic_action_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

