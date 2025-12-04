-- Metroloji Yönetimi Geliştirmeleri
-- Ölçüm Belirsizliği ve Etalon Yönetimi

-- 1. Ölçüm Belirsizliği Kayıtları
CREATE TABLE IF NOT EXISTS measurement_uncertainty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    
    -- Belirsizlik Bilgileri
    measurement_parameter VARCHAR(255) NOT NULL, -- Ölçülen parametre
    nominal_value DECIMAL(15, 6), -- Nominal değer
    measured_value DECIMAL(15, 6), -- Ölçülen değer
    
    -- Belirsizlik Bileşenleri
    type_a_uncertainty DECIMAL(15, 6), -- Tip A belirsizlik
    type_b_uncertainty DECIMAL(15, 6), -- Tip B belirsizlik
    combined_uncertainty DECIMAL(15, 6), -- Birleşik belirsizlik
    expanded_uncertainty DECIMAL(15, 6), -- Genişletilmiş belirsizlik
    coverage_factor DECIMAL(5, 2) DEFAULT 2.0, -- Kapsama faktörü (k=2 için %95 güven)
    
    -- Ölçüm Koşulları
    measurement_conditions JSONB, -- Sıcaklık, nem, vb.
    measurement_date DATE NOT NULL,
    
    -- Meta
    conducted_by UUID REFERENCES personnel(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Etalon Yönetimi
CREATE TABLE IF NOT EXISTS calibration_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_number VARCHAR(100) UNIQUE NOT NULL,
    standard_name VARCHAR(255) NOT NULL,
    
    -- Etalon Bilgileri
    standard_type VARCHAR(50) NOT NULL, -- 'Primary', 'Secondary', 'Working'
    measurement_range VARCHAR(255), -- Ölçüm aralığı
    accuracy_class VARCHAR(100), -- Doğruluk sınıfı
    
    -- Kalibrasyon Bilgileri
    last_calibration_date DATE,
    next_calibration_date DATE,
    calibration_certificate_number VARCHAR(255),
    calibration_lab VARCHAR(255),
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Out of Calibration', 'Retired'
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ölçüm İzlenebilirliği
CREATE TABLE IF NOT EXISTS measurement_traceability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    standard_id UUID REFERENCES calibration_standards(id),
    
    -- İzlenebilirlik Bilgileri
    traceability_chain JSONB, -- İzlenebilirlik zinciri
    traceability_level VARCHAR(50), -- 'Primary', 'Secondary', 'Working'
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_uncertainty_equipment ON measurement_uncertainty(equipment_id);
CREATE INDEX IF NOT EXISTS idx_standards_status ON calibration_standards(status);
CREATE INDEX IF NOT EXISTS idx_traceability_equipment ON measurement_traceability(equipment_id);

-- RLS Politikaları
ALTER TABLE measurement_uncertainty ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_traceability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uncertainty_select" ON measurement_uncertainty FOR SELECT USING (true);
CREATE POLICY "uncertainty_insert" ON measurement_uncertainty FOR INSERT WITH CHECK (true);
CREATE POLICY "uncertainty_update" ON measurement_uncertainty FOR UPDATE USING (true);
CREATE POLICY "uncertainty_delete" ON measurement_uncertainty FOR DELETE USING (true);

CREATE POLICY "standards_select" ON calibration_standards FOR SELECT USING (true);
CREATE POLICY "standards_insert" ON calibration_standards FOR INSERT WITH CHECK (true);
CREATE POLICY "standards_update" ON calibration_standards FOR UPDATE USING (true);
CREATE POLICY "standards_delete" ON calibration_standards FOR DELETE USING (true);

CREATE POLICY "traceability_select" ON measurement_traceability FOR SELECT USING (true);
CREATE POLICY "traceability_insert" ON measurement_traceability FOR INSERT WITH CHECK (true);
CREATE POLICY "traceability_update" ON measurement_traceability FOR UPDATE USING (true);
CREATE POLICY "traceability_delete" ON measurement_traceability FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_standards_updated_at
    BEFORE UPDATE ON calibration_standards
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

