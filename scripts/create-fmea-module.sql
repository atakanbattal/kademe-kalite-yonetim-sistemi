-- FMEA Modülü - Failure Mode and Effects Analysis
-- DFMEA (Design FMEA) ve PFMEA (Process FMEA)
-- IATF 16949 Zorunlu Gereklilik

-- 1. FMEA Projeleri
CREATE TABLE IF NOT EXISTS fmea_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fmea_number VARCHAR(100) UNIQUE NOT NULL,
    fmea_name VARCHAR(255) NOT NULL,
    fmea_type VARCHAR(50) NOT NULL, -- 'DFMEA', 'PFMEA'
    
    -- Proje Bilgileri
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    process_name VARCHAR(255),
    customer_id UUID REFERENCES customers(id),
    
    -- Durum
    status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'In Review', 'Approved', 'Active', 'Obsolete'
    revision_number VARCHAR(50) DEFAULT 'Rev. 01',
    revision_date DATE DEFAULT CURRENT_DATE,
    
    -- Sorumluluk
    team_leader_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    team_members UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FMEA Fonksiyonları/İşlemler
CREATE TABLE IF NOT EXISTS fmea_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fmea_project_id UUID NOT NULL REFERENCES fmea_projects(id) ON DELETE CASCADE,
    
    -- Fonksiyon Bilgileri
    function_number INTEGER NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    function_description TEXT,
    
    -- Sıralama
    display_order INTEGER DEFAULT 0,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FMEA Hata Modları (Failure Modes)
CREATE TABLE IF NOT EXISTS fmea_failure_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id UUID NOT NULL REFERENCES fmea_functions(id) ON DELETE CASCADE,
    
    -- Hata Modu Bilgileri
    failure_mode_number INTEGER NOT NULL,
    failure_mode_description TEXT NOT NULL,
    potential_effect TEXT, -- Etki
    
    -- Severity (S) - Şiddet (1-10)
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    severity_rationale TEXT, -- Şiddet gerekçesi
    
    -- Classification
    is_special_characteristic BOOLEAN DEFAULT false, -- Özel karakteristik mi?
    classification VARCHAR(50), -- 'CC', 'SC', 'Key', etc.
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FMEA Kök Nedenler ve Kontroller
CREATE TABLE IF NOT EXISTS fmea_causes_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    failure_mode_id UUID NOT NULL REFERENCES fmea_failure_modes(id) ON DELETE CASCADE,
    
    -- Kök Neden Bilgileri
    cause_number INTEGER NOT NULL,
    potential_cause TEXT NOT NULL,
    
    -- Occurrence (O) - Oluşma (1-10)
    occurrence INTEGER NOT NULL CHECK (occurrence >= 1 AND occurrence <= 10),
    occurrence_rationale TEXT,
    
    -- Mevcut Kontroller
    current_controls_prevention TEXT, -- Önleyici kontroller
    current_controls_detection TEXT, -- Tespit kontrolleri
    
    -- Detection (D) - Tespit (1-10)
    detection INTEGER NOT NULL CHECK (detection >= 1 AND detection <= 10),
    detection_rationale TEXT,
    
    -- RPN (Risk Priority Number) = S × O × D
    rpn INTEGER GENERATED ALWAYS AS (severity * occurrence * detection) STORED,
    
    -- Severity referansı (failure_mode'dan)
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FMEA Aksiyon Planları
CREATE TABLE IF NOT EXISTS fmea_action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cause_control_id UUID NOT NULL REFERENCES fmea_causes_controls(id) ON DELETE CASCADE,
    
    -- Aksiyon Bilgileri
    action_number INTEGER NOT NULL,
    recommended_action TEXT NOT NULL,
    action_type VARCHAR(50), -- 'Prevention', 'Detection', 'Both'
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    
    -- Tarihler
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'In Progress', 'Completed', 'Verified', 'Cancelled'
    
    -- Sonuçlar (Aksiyon sonrası)
    new_severity INTEGER CHECK (new_severity >= 1 AND new_severity <= 10),
    new_occurrence INTEGER CHECK (new_occurrence >= 1 AND new_occurrence <= 10),
    new_detection INTEGER CHECK (new_detection >= 1 AND new_detection <= 10),
    new_rpn INTEGER, -- Yeni RPN
    
    -- Doğrulama
    verification_method TEXT,
    verification_date DATE,
    verification_result TEXT,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_fmea_projects_type ON fmea_projects(fmea_type);
CREATE INDEX IF NOT EXISTS idx_fmea_projects_status ON fmea_projects(status);
CREATE INDEX IF NOT EXISTS idx_fmea_functions_project ON fmea_functions(fmea_project_id);
CREATE INDEX IF NOT EXISTS idx_fmea_failure_modes_function ON fmea_failure_modes(function_id);
CREATE INDEX IF NOT EXISTS idx_fmea_causes_controls_failure_mode ON fmea_causes_controls(failure_mode_id);
CREATE INDEX IF NOT EXISTS idx_fmea_action_plans_cause_control ON fmea_action_plans(cause_control_id);
CREATE INDEX IF NOT EXISTS idx_fmea_action_plans_status ON fmea_action_plans(status);

-- RLS Politikaları
ALTER TABLE fmea_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmea_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmea_failure_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmea_causes_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmea_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fmea_projects_select" ON fmea_projects FOR SELECT USING (true);
CREATE POLICY "fmea_projects_insert" ON fmea_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "fmea_projects_update" ON fmea_projects FOR UPDATE USING (true);
CREATE POLICY "fmea_projects_delete" ON fmea_projects FOR DELETE USING (true);

CREATE POLICY "fmea_functions_select" ON fmea_functions FOR SELECT USING (true);
CREATE POLICY "fmea_functions_insert" ON fmea_functions FOR INSERT WITH CHECK (true);
CREATE POLICY "fmea_functions_update" ON fmea_functions FOR UPDATE USING (true);
CREATE POLICY "fmea_functions_delete" ON fmea_functions FOR DELETE USING (true);

CREATE POLICY "fmea_failure_modes_select" ON fmea_failure_modes FOR SELECT USING (true);
CREATE POLICY "fmea_failure_modes_insert" ON fmea_failure_modes FOR INSERT WITH CHECK (true);
CREATE POLICY "fmea_failure_modes_update" ON fmea_failure_modes FOR UPDATE USING (true);
CREATE POLICY "fmea_failure_modes_delete" ON fmea_failure_modes FOR DELETE USING (true);

CREATE POLICY "fmea_causes_controls_select" ON fmea_causes_controls FOR SELECT USING (true);
CREATE POLICY "fmea_causes_controls_insert" ON fmea_causes_controls FOR INSERT WITH CHECK (true);
CREATE POLICY "fmea_causes_controls_update" ON fmea_causes_controls FOR UPDATE USING (true);
CREATE POLICY "fmea_causes_controls_delete" ON fmea_causes_controls FOR DELETE USING (true);

CREATE POLICY "fmea_action_plans_select" ON fmea_action_plans FOR SELECT USING (true);
CREATE POLICY "fmea_action_plans_insert" ON fmea_action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "fmea_action_plans_update" ON fmea_action_plans FOR UPDATE USING (true);
CREATE POLICY "fmea_action_plans_delete" ON fmea_action_plans FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_fmea_projects_updated_at
    BEFORE UPDATE ON fmea_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_fmea_failure_modes_updated_at
    BEFORE UPDATE ON fmea_failure_modes
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_fmea_causes_controls_updated_at
    BEFORE UPDATE ON fmea_causes_controls
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_fmea_action_plans_updated_at
    BEFORE UPDATE ON fmea_action_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

-- Fonksiyon: RPN hesaplama ve güncelleme
CREATE OR REPLACE FUNCTION calculate_fmea_rpn()
RETURNS TRIGGER AS $$
BEGIN
    -- RPN otomatik olarak computed column olarak hesaplanıyor
    -- Ancak trigger ile ek kontroller yapılabilir
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyon: Yüksek RPN'li öğeleri bul
CREATE OR REPLACE FUNCTION get_high_risk_fmea_items(
    p_fmea_project_id UUID,
    p_rpn_threshold INTEGER DEFAULT 100
)
RETURNS TABLE (
    failure_mode_id UUID,
    failure_mode_description TEXT,
    cause_description TEXT,
    severity INTEGER,
    occurrence INTEGER,
    detection INTEGER,
    rpn INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fm.id,
        fm.failure_mode_description,
        cc.potential_cause,
        cc.severity,
        cc.occurrence,
        cc.detection,
        cc.rpn
    FROM fmea_failure_modes fm
    JOIN fmea_functions f ON fm.function_id = f.id
    JOIN fmea_causes_controls cc ON cc.failure_mode_id = fm.id
    WHERE f.fmea_project_id = p_fmea_project_id
    AND cc.rpn >= p_rpn_threshold
    ORDER BY cc.rpn DESC;
END;
$$ LANGUAGE plpgsql;

