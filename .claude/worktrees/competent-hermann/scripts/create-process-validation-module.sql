-- Proses Validasyonu Modülü
-- IQ/OQ/PQ Protokolleri

-- 1. Validasyon Planları
CREATE TABLE IF NOT EXISTS validation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_number VARCHAR(100) UNIQUE NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    
    -- Validasyon Bilgileri
    process_name VARCHAR(255),
    equipment_id UUID REFERENCES equipments(id),
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    
    -- Validasyon Tipi
    validation_type VARCHAR(50) NOT NULL, -- 'Initial', 'Periodic', 'After Change'
    change_reason TEXT, -- Değişiklik nedeni (After Change için)
    
    -- Tarihler
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Planned', -- 'Planned', 'In Progress', 'Completed', 'Failed', 'Cancelled'
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    validation_team UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Validasyon Protokolleri (IQ/OQ/PQ)
CREATE TABLE IF NOT EXISTS validation_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_plan_id UUID NOT NULL REFERENCES validation_plans(id) ON DELETE CASCADE,
    
    -- Protokol Bilgileri
    protocol_type VARCHAR(50) NOT NULL, -- 'IQ', 'OQ', 'PQ'
    protocol_number INTEGER NOT NULL, -- Sıra numarası
    
    -- Protokol Durumu
    status VARCHAR(50) DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'Completed', 'Failed'
    
    -- Sonuçlar
    test_results JSONB, -- Test sonuçları (esnek yapı)
    acceptance_criteria TEXT,
    actual_results TEXT,
    
    -- Onay
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Validasyon Testleri
CREATE TABLE IF NOT EXISTS validation_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID NOT NULL REFERENCES validation_protocols(id) ON DELETE CASCADE,
    
    -- Test Bilgileri
    test_number INTEGER NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    
    -- Kriterler
    acceptance_criteria TEXT,
    test_method TEXT,
    
    -- Sonuçlar
    result VARCHAR(50), -- 'Pass', 'Fail', 'N/A'
    actual_value DECIMAL(15, 6),
    expected_value DECIMAL(15, 6),
    test_notes TEXT,
    
    -- Tarihler
    test_date TIMESTAMPTZ,
    conducted_by UUID REFERENCES personnel(id),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_validation_plans_status ON validation_plans(status);
CREATE INDEX IF NOT EXISTS idx_validation_protocols_plan ON validation_protocols(validation_plan_id);
CREATE INDEX IF NOT EXISTS idx_validation_tests_protocol ON validation_tests(protocol_id);

-- RLS Politikaları
ALTER TABLE validation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validation_plans_select" ON validation_plans FOR SELECT USING (true);
CREATE POLICY "validation_plans_insert" ON validation_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "validation_plans_update" ON validation_plans FOR UPDATE USING (true);
CREATE POLICY "validation_plans_delete" ON validation_plans FOR DELETE USING (true);

CREATE POLICY "validation_protocols_select" ON validation_protocols FOR SELECT USING (true);
CREATE POLICY "validation_protocols_insert" ON validation_protocols FOR INSERT WITH CHECK (true);
CREATE POLICY "validation_protocols_update" ON validation_protocols FOR UPDATE USING (true);
CREATE POLICY "validation_protocols_delete" ON validation_protocols FOR DELETE USING (true);

CREATE POLICY "validation_tests_select" ON validation_tests FOR SELECT USING (true);
CREATE POLICY "validation_tests_insert" ON validation_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "validation_tests_update" ON validation_tests FOR UPDATE USING (true);
CREATE POLICY "validation_tests_delete" ON validation_tests FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_validation_plans_updated_at
    BEFORE UPDATE ON validation_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_validation_protocols_updated_at
    BEFORE UPDATE ON validation_protocols
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

