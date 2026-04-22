-- MPC Modülü - Manufacturing Planning and Control
-- Üretim Planlama ve Kontrolü

-- 1. Üretim Planları
CREATE TABLE IF NOT EXISTS production_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_number VARCHAR(100) UNIQUE NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    
    -- Plan Bilgileri
    plan_date DATE NOT NULL,
    plan_period VARCHAR(50), -- 'Daily', 'Weekly', 'Monthly'
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    
    -- Planlanan Miktarlar
    planned_quantity INTEGER NOT NULL DEFAULT 0,
    actual_quantity INTEGER DEFAULT 0,
    efficiency_percentage DECIMAL(5, 2), -- Verimlilik yüzdesi
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Planned', -- 'Planned', 'In Progress', 'Completed', 'Cancelled'
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Kritik Karakteristikler (CC/SC)
CREATE TABLE IF NOT EXISTS critical_characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    characteristic_code VARCHAR(100) UNIQUE NOT NULL,
    characteristic_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    
    -- Karakteristik Tipi
    characteristic_type VARCHAR(50) NOT NULL, -- 'CC' (Critical), 'SC' (Significant), 'Key'
    classification_source VARCHAR(100), -- 'Customer', 'Internal', 'Regulatory'
    
    -- Spesifikasyonlar
    usl DECIMAL(15, 6),
    lsl DECIMAL(15, 6),
    target_value DECIMAL(15, 6),
    measurement_unit VARCHAR(50),
    
    -- Kontrol Bilgileri
    control_method TEXT,
    inspection_frequency VARCHAR(100),
    responsible_department_id UUID REFERENCES cost_settings(id),
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Proses Parametreleri
CREATE TABLE IF NOT EXISTS process_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_name VARCHAR(255) NOT NULL,
    machine_equipment_id UUID REFERENCES equipments(id),
    process_name VARCHAR(255),
    
    -- Parametre Değerleri
    target_value DECIMAL(15, 6),
    usl DECIMAL(15, 6),
    lsl DECIMAL(15, 6),
    unit VARCHAR(50),
    
    -- Durum
    is_critical BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Proses Parametre Kayıtları
CREATE TABLE IF NOT EXISTS process_parameter_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id UUID NOT NULL REFERENCES process_parameters(id) ON DELETE CASCADE,
    
    -- Kayıt Bilgileri
    record_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_value DECIMAL(15, 6) NOT NULL,
    shift VARCHAR(50),
    operator_id UUID REFERENCES personnel(id),
    
    -- Durum
    is_out_of_spec BOOLEAN DEFAULT false,
    deviation_amount DECIMAL(15, 6),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Lot/Seri Takibi
CREATE TABLE IF NOT EXISTS lot_traceability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    
    -- Üretim Bilgileri
    part_number VARCHAR(100),
    part_name VARCHAR(255),
    production_date DATE NOT NULL,
    production_shift VARCHAR(50),
    production_line VARCHAR(255),
    
    -- Miktar
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- İlişkili Kayıtlar
    related_complaint_id UUID REFERENCES customer_complaints(id),
    related_nc_id UUID REFERENCES non_conformities(id),
    
    -- Durum
    status VARCHAR(50) DEFAULT 'In Stock', -- 'In Stock', 'Shipped', 'Recalled', 'Quarantined'
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_production_plans_date ON production_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_critical_characteristics_part ON critical_characteristics(part_number);
CREATE INDEX IF NOT EXISTS idx_process_parameters_machine ON process_parameters(machine_equipment_id);
CREATE INDEX IF NOT EXISTS idx_process_parameter_records_param ON process_parameter_records(parameter_id);
CREATE INDEX IF NOT EXISTS idx_process_parameter_records_date ON process_parameter_records(record_date);
CREATE INDEX IF NOT EXISTS idx_lot_traceability_lot ON lot_traceability(lot_number);
CREATE INDEX IF NOT EXISTS idx_lot_traceability_serial ON lot_traceability(serial_number);
CREATE INDEX IF NOT EXISTS idx_lot_traceability_production_date ON lot_traceability(production_date);

-- RLS Politikaları
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_characteristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_parameter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_traceability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_plans_select" ON production_plans FOR SELECT USING (true);
CREATE POLICY "production_plans_insert" ON production_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "production_plans_update" ON production_plans FOR UPDATE USING (true);
CREATE POLICY "production_plans_delete" ON production_plans FOR DELETE USING (true);

CREATE POLICY "critical_characteristics_select" ON critical_characteristics FOR SELECT USING (true);
CREATE POLICY "critical_characteristics_insert" ON critical_characteristics FOR INSERT WITH CHECK (true);
CREATE POLICY "critical_characteristics_update" ON critical_characteristics FOR UPDATE USING (true);
CREATE POLICY "critical_characteristics_delete" ON critical_characteristics FOR DELETE USING (true);

CREATE POLICY "process_parameters_select" ON process_parameters FOR SELECT USING (true);
CREATE POLICY "process_parameters_insert" ON process_parameters FOR INSERT WITH CHECK (true);
CREATE POLICY "process_parameters_update" ON process_parameters FOR UPDATE USING (true);
CREATE POLICY "process_parameters_delete" ON process_parameters FOR DELETE USING (true);

CREATE POLICY "process_parameter_records_select" ON process_parameter_records FOR SELECT USING (true);
CREATE POLICY "process_parameter_records_insert" ON process_parameter_records FOR INSERT WITH CHECK (true);
CREATE POLICY "process_parameter_records_update" ON process_parameter_records FOR UPDATE USING (true);
CREATE POLICY "process_parameter_records_delete" ON process_parameter_records FOR DELETE USING (true);

CREATE POLICY "lot_traceability_select" ON lot_traceability FOR SELECT USING (true);
CREATE POLICY "lot_traceability_insert" ON lot_traceability FOR INSERT WITH CHECK (true);
CREATE POLICY "lot_traceability_update" ON lot_traceability FOR UPDATE USING (true);
CREATE POLICY "lot_traceability_delete" ON lot_traceability FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_production_plans_updated_at
    BEFORE UPDATE ON production_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_critical_characteristics_updated_at
    BEFORE UPDATE ON critical_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_process_parameters_updated_at
    BEFORE UPDATE ON process_parameters
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_lot_traceability_updated_at
    BEFORE UPDATE ON lot_traceability
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

-- Fonksiyon: Verimlilik hesaplama
CREATE OR REPLACE FUNCTION calculate_production_efficiency(p_plan_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_planned INTEGER;
    v_actual INTEGER;
    v_efficiency DECIMAL;
BEGIN
    SELECT planned_quantity, actual_quantity INTO v_planned, v_actual
    FROM production_plans
    WHERE id = p_plan_id;
    
    IF v_planned > 0 THEN
        v_efficiency := (v_actual::DECIMAL / v_planned * 100);
    ELSE
        v_efficiency := 0;
    END IF;
    
    UPDATE production_plans
    SET efficiency_percentage = v_efficiency
    WHERE id = p_plan_id;
    
    RETURN v_efficiency;
END;
$$ LANGUAGE plpgsql;

