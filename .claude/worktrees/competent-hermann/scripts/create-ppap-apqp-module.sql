-- PPAP/APQP Modülü - Production Part Approval Process / Advanced Product Quality Planning
-- IATF 16949 Zorunlu Gereklilik

-- 1. APQP Projeleri
CREATE TABLE IF NOT EXISTS apqp_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number VARCHAR(100) UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    
    -- Proje Bilgileri
    project_type VARCHAR(50) NOT NULL DEFAULT 'APQP', -- 'APQP', 'PPAP', 'Run-at-Rate'
    status VARCHAR(50) NOT NULL DEFAULT 'Planning', -- 'Planning', 'Design', 'Process Development', 'Product Validation', 'Feedback & Corrective Action', 'Approved', 'Rejected'
    priority VARCHAR(50) DEFAULT 'Normal', -- 'Critical', 'High', 'Normal', 'Low'
    
    -- Tarihler
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Sorumluluk
    project_manager_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    team_members UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. APQP Aşamaları ve Görevleri
CREATE TABLE IF NOT EXISTS apqp_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES apqp_projects(id) ON DELETE CASCADE,
    
    -- Aşama Bilgileri
    phase_number INTEGER NOT NULL, -- 1-5
    phase_name VARCHAR(100) NOT NULL, -- 'Planning', 'Design', 'Process Development', 'Product Validation', 'Feedback'
    status VARCHAR(50) NOT NULL DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'Completed', 'On Hold'
    
    -- Tarihler
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- İlerleme
    completion_percentage INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PPAP Dokümanları
CREATE TABLE IF NOT EXISTS ppap_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES apqp_projects(id) ON DELETE CASCADE,
    
    -- Doküman Bilgileri
    document_type VARCHAR(100) NOT NULL, -- 'Design Records', 'Engineering Change Documents', 'Customer Engineering Approval', 'DFMEA', 'PFMEA', 'Control Plan', 'MSA', 'SPC', 'Process Flow', 'Dimensional Results', 'Material Test Results', 'Performance Test Results', 'Initial Sample Inspection Report', 'PSW', etc.
    document_name VARCHAR(255) NOT NULL,
    document_version VARCHAR(50),
    document_status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Submitted', 'Approved', 'Rejected', 'Under Review'
    
    -- Dosya Bilgileri
    file_path TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Onay Bilgileri
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PPAP Submission (PSW - Part Submission Warrant)
CREATE TABLE IF NOT EXISTS ppap_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES apqp_projects(id) ON DELETE CASCADE,
    
    -- Submission Bilgileri
    submission_level INTEGER DEFAULT 3, -- 1-5 (IATF standard)
    submission_type VARCHAR(50) DEFAULT 'Full', -- 'Full', 'Partial', 'Waiver'
    submission_status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Submitted', 'Approved', 'Rejected', 'Conditionally Approved'
    
    -- PSW Bilgileri
    psw_number VARCHAR(100),
    customer_part_number VARCHAR(100),
    engineering_change_level VARCHAR(50),
    date_submitted DATE,
    date_approved DATE,
    
    -- Sonuç
    customer_decision VARCHAR(50), -- 'Approved', 'Rejected', 'Conditionally Approved'
    customer_comments TEXT,
    reason_for_submission VARCHAR(255), -- 'New Part', 'Engineering Change', 'Process Change', 'Tooling Change', 'Supplier Change', 'Material Change', 'Location Change', 'Other'
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Run-at-Rate Çalışmaları
CREATE TABLE IF NOT EXISTS run_at_rate_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES apqp_projects(id) ON DELETE CASCADE,
    
    -- Çalışma Bilgileri
    study_date DATE NOT NULL,
    production_line VARCHAR(255),
    target_production_rate INTEGER, -- Hedef üretim hızı (adet/saat)
    actual_production_rate INTEGER, -- Gerçekleşen üretim hızı
    production_quantity INTEGER, -- Üretilen miktar
    duration_hours DECIMAL(10, 2), -- Süre (saat)
    
    -- Sonuç
    success_rate DECIMAL(5, 2), -- Başarı oranı (%)
    issues_encountered TEXT,
    corrective_actions TEXT,
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Completed', -- 'Planned', 'In Progress', 'Completed', 'Failed'
    
    -- Meta
    conducted_by UUID REFERENCES personnel(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_apqp_projects_customer ON apqp_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_apqp_projects_status ON apqp_projects(status);
CREATE INDEX IF NOT EXISTS idx_apqp_phases_project ON apqp_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_ppap_documents_project ON ppap_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_ppap_submissions_project ON ppap_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_run_at_rate_project ON run_at_rate_studies(project_id);

-- RLS Politikaları
ALTER TABLE apqp_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE apqp_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppap_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppap_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_at_rate_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apqp_projects_select" ON apqp_projects FOR SELECT USING (true);
CREATE POLICY "apqp_projects_insert" ON apqp_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "apqp_projects_update" ON apqp_projects FOR UPDATE USING (true);
CREATE POLICY "apqp_projects_delete" ON apqp_projects FOR DELETE USING (true);

CREATE POLICY "apqp_phases_select" ON apqp_phases FOR SELECT USING (true);
CREATE POLICY "apqp_phases_insert" ON apqp_phases FOR INSERT WITH CHECK (true);
CREATE POLICY "apqp_phases_update" ON apqp_phases FOR UPDATE USING (true);
CREATE POLICY "apqp_phases_delete" ON apqp_phases FOR DELETE USING (true);

CREATE POLICY "ppap_documents_select" ON ppap_documents FOR SELECT USING (true);
CREATE POLICY "ppap_documents_insert" ON ppap_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "ppap_documents_update" ON ppap_documents FOR UPDATE USING (true);
CREATE POLICY "ppap_documents_delete" ON ppap_documents FOR DELETE USING (true);

CREATE POLICY "ppap_submissions_select" ON ppap_submissions FOR SELECT USING (true);
CREATE POLICY "ppap_submissions_insert" ON ppap_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "ppap_submissions_update" ON ppap_submissions FOR UPDATE USING (true);
CREATE POLICY "ppap_submissions_delete" ON ppap_submissions FOR DELETE USING (true);

CREATE POLICY "run_at_rate_select" ON run_at_rate_studies FOR SELECT USING (true);
CREATE POLICY "run_at_rate_insert" ON run_at_rate_studies FOR INSERT WITH CHECK (true);
CREATE POLICY "run_at_rate_update" ON run_at_rate_studies FOR UPDATE USING (true);
CREATE POLICY "run_at_rate_delete" ON run_at_rate_studies FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_apqp_projects_updated_at
    BEFORE UPDATE ON apqp_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_apqp_phases_updated_at
    BEFORE UPDATE ON apqp_phases
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_ppap_documents_updated_at
    BEFORE UPDATE ON ppap_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_ppap_submissions_updated_at
    BEFORE UPDATE ON ppap_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

-- Fonksiyon: PPAP doküman tamamlanma kontrolü
CREATE OR REPLACE FUNCTION check_ppap_completeness(p_project_id UUID)
RETURNS TABLE (
    total_documents INTEGER,
    completed_documents INTEGER,
    completion_percentage DECIMAL,
    missing_documents TEXT[]
) AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_missing TEXT[];
BEGIN
    -- Toplam doküman sayısı
    SELECT COUNT(*) INTO v_total
    FROM ppap_documents
    WHERE project_id = p_project_id;
    
    -- Tamamlanan doküman sayısı
    SELECT COUNT(*) INTO v_completed
    FROM ppap_documents
    WHERE project_id = p_project_id
    AND document_status = 'Approved';
    
    -- Eksik dokümanlar (opsiyonel - standart PPAP doküman listesi ile karşılaştırılabilir)
    -- Bu basitleştirilmiş bir versiyon
    
    RETURN QUERY SELECT 
        v_total,
        v_completed,
        CASE WHEN v_total > 0 THEN (v_completed::DECIMAL / v_total * 100) ELSE 0 END,
        ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql;

