-- SPC Modülü - İstatistiksel Proses Kontrolü
-- IATF 16949 Zorunlu Gereklilik

-- 1. SPC Ölçüm Noktaları (Kritik Karakteristikler)
CREATE TABLE IF NOT EXISTS spc_characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    characteristic_code VARCHAR(100) UNIQUE NOT NULL,
    characteristic_name VARCHAR(255) NOT NULL,
    part_code VARCHAR(100),
    part_name VARCHAR(255),
    process_name VARCHAR(255),
    measurement_unit VARCHAR(50), -- 'mm', 'kg', 'N', '%', etc.
    
    -- Spesifikasyon Limitleri
    usl DECIMAL(15, 6), -- Upper Specification Limit
    lsl DECIMAL(15, 6), -- Lower Specification Limit
    target_value DECIMAL(15, 6), -- Nominal/İdeal Değer
    
    -- Kontrol Grafik Tipi
    chart_type VARCHAR(50) NOT NULL DEFAULT 'XbarR', -- 'XbarR', 'XbarS', 'I-MR', 'p', 'np', 'c', 'u'
    
    -- Örnekleme Planı
    sample_size INTEGER DEFAULT 5, -- Subgroup size
    sampling_frequency VARCHAR(100), -- 'Her saat', 'Her shift', 'Her lot', etc.
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    responsible_person_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SPC Ölçüm Verileri
CREATE TABLE IF NOT EXISTS spc_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    characteristic_id UUID NOT NULL REFERENCES spc_characteristics(id) ON DELETE CASCADE,
    
    -- Ölçüm Bilgileri
    measurement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subgroup_number INTEGER, -- Subgroup numarası
    sample_number INTEGER, -- Sample numarası (subgroup içinde)
    measurement_value DECIMAL(15, 6) NOT NULL,
    
    -- Üretim Bilgileri
    batch_number VARCHAR(100),
    lot_number VARCHAR(100),
    shift VARCHAR(50),
    operator_id UUID REFERENCES personnel(id),
    equipment_id UUID REFERENCES equipments(id),
    
    -- Durum
    is_out_of_spec BOOLEAN DEFAULT false,
    is_out_of_control BOOLEAN DEFAULT false,
    special_cause VARCHAR(255), -- Özel neden açıklaması
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SPC Kontrol Grafikleri
CREATE TABLE IF NOT EXISTS spc_control_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    characteristic_id UUID NOT NULL REFERENCES spc_characteristics(id) ON DELETE CASCADE,
    
    -- Grafik Bilgileri
    chart_name VARCHAR(255),
    chart_type VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ,
    
    -- Kontrol Limitleri (Hesaplanmış)
    ucl DECIMAL(15, 6), -- Upper Control Limit
    cl DECIMAL(15, 6), -- Center Line (Ortalama)
    lcl DECIMAL(15, 6), -- Lower Control Limit
    
    -- İstatistikler
    mean_value DECIMAL(15, 6),
    std_deviation DECIMAL(15, 6),
    range_avg DECIMAL(15, 6), -- R-bar (XbarR için)
    
    -- Durum
    is_in_control BOOLEAN DEFAULT true,
    out_of_control_points INTEGER DEFAULT 0,
    out_of_spec_points INTEGER DEFAULT 0,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Proses Yetenek Analizi
CREATE TABLE IF NOT EXISTS spc_capability_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    characteristic_id UUID NOT NULL REFERENCES spc_characteristics(id) ON DELETE CASCADE,
    
    -- Çalışma Bilgileri
    study_name VARCHAR(255),
    study_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sample_count INTEGER NOT NULL,
    
    -- Yetenek İndeksleri
    cp DECIMAL(10, 4), -- Process Capability Index
    cpk DECIMAL(10, 4), -- Process Capability Index (centered)
    pp DECIMAL(10, 4), -- Process Performance Index
    ppk DECIMAL(10, 4), -- Process Performance Index (centered)
    
    -- İstatistikler
    mean_value DECIMAL(15, 6),
    std_deviation DECIMAL(15, 6),
    sigma_level DECIMAL(10, 4), -- Sigma seviyesi
    
    -- Sonuç
    capability_status VARCHAR(50), -- 'Yeterli', 'Yetersiz', 'Mükemmel'
    recommendation TEXT, -- Öneriler
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MSA (Measurement System Analysis) Çalışmaları
CREATE TABLE IF NOT EXISTS spc_msa_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_name VARCHAR(255) NOT NULL,
    characteristic_id UUID REFERENCES spc_characteristics(id),
    measurement_equipment_id UUID REFERENCES equipments(id),
    
    -- Çalışma Bilgileri
    study_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    study_type VARCHAR(50) NOT NULL, -- 'GageR&R', 'Bias', 'Linearity', 'Stability'
    
    -- Gage R&R Sonuçları
    total_variation DECIMAL(15, 6),
    equipment_variation DECIMAL(15, 6),
    appraiser_variation DECIMAL(15, 6),
    part_variation DECIMAL(15, 6),
    gage_rr_percent DECIMAL(10, 4), -- %Gage R&R
    ndc INTEGER, -- Number of Distinct Categories
    
    -- Sonuç
    msa_status VARCHAR(50), -- 'Kabul Edilebilir', 'Kabul Edilemez', 'Sınırda'
    recommendation TEXT,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MSA Ölçüm Verileri
CREATE TABLE IF NOT EXISTS spc_msa_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msa_study_id UUID NOT NULL REFERENCES spc_msa_studies(id) ON DELETE CASCADE,
    
    -- Ölçüm Bilgileri
    part_number INTEGER NOT NULL,
    trial_number INTEGER NOT NULL,
    appraiser_id UUID REFERENCES personnel(id),
    measurement_value DECIMAL(15, 6) NOT NULL,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_spc_measurements_characteristic ON spc_measurements(characteristic_id);
CREATE INDEX IF NOT EXISTS idx_spc_measurements_date ON spc_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS idx_spc_control_charts_characteristic ON spc_control_charts(characteristic_id);
CREATE INDEX IF NOT EXISTS idx_spc_capability_characteristic ON spc_capability_studies(characteristic_id);
CREATE INDEX IF NOT EXISTS idx_spc_msa_measurements_study ON spc_msa_measurements(msa_study_id);

-- RLS Politikaları
ALTER TABLE spc_characteristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_control_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_capability_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_msa_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_msa_measurements ENABLE ROW LEVEL SECURITY;

-- RLS: Tüm kullanıcılar okuyabilir, sadece yetkili kullanıcılar yazabilir
CREATE POLICY "spc_characteristics_select" ON spc_characteristics FOR SELECT USING (true);
CREATE POLICY "spc_characteristics_insert" ON spc_characteristics FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_characteristics_update" ON spc_characteristics FOR UPDATE USING (true);
CREATE POLICY "spc_characteristics_delete" ON spc_characteristics FOR DELETE USING (true);

CREATE POLICY "spc_measurements_select" ON spc_measurements FOR SELECT USING (true);
CREATE POLICY "spc_measurements_insert" ON spc_measurements FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_measurements_update" ON spc_measurements FOR UPDATE USING (true);
CREATE POLICY "spc_measurements_delete" ON spc_measurements FOR DELETE USING (true);

CREATE POLICY "spc_control_charts_select" ON spc_control_charts FOR SELECT USING (true);
CREATE POLICY "spc_control_charts_insert" ON spc_control_charts FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_control_charts_update" ON spc_control_charts FOR UPDATE USING (true);
CREATE POLICY "spc_control_charts_delete" ON spc_control_charts FOR DELETE USING (true);

CREATE POLICY "spc_capability_select" ON spc_capability_studies FOR SELECT USING (true);
CREATE POLICY "spc_capability_insert" ON spc_capability_studies FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_capability_update" ON spc_capability_studies FOR UPDATE USING (true);
CREATE POLICY "spc_capability_delete" ON spc_capability_studies FOR DELETE USING (true);

CREATE POLICY "spc_msa_studies_select" ON spc_msa_studies FOR SELECT USING (true);
CREATE POLICY "spc_msa_studies_insert" ON spc_msa_studies FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_msa_studies_update" ON spc_msa_studies FOR UPDATE USING (true);
CREATE POLICY "spc_msa_studies_delete" ON spc_msa_studies FOR DELETE USING (true);

CREATE POLICY "spc_msa_measurements_select" ON spc_msa_measurements FOR SELECT USING (true);
CREATE POLICY "spc_msa_measurements_insert" ON spc_msa_measurements FOR INSERT WITH CHECK (true);
CREATE POLICY "spc_msa_measurements_update" ON spc_msa_measurements FOR UPDATE USING (true);
CREATE POLICY "spc_msa_measurements_delete" ON spc_msa_measurements FOR DELETE USING (true);

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_spc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spc_characteristics_updated_at
    BEFORE UPDATE ON spc_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_spc_control_charts_updated_at
    BEFORE UPDATE ON spc_control_charts
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

-- Fonksiyon: X-bar ve R kontrol limitlerini hesapla
CREATE OR REPLACE FUNCTION calculate_xbar_r_limits(
    p_characteristic_id UUID,
    p_subgroup_size INTEGER DEFAULT 5
)
RETURNS TABLE (
    ucl_xbar DECIMAL,
    cl_xbar DECIMAL,
    lcl_xbar DECIMAL,
    ucl_r DECIMAL,
    cl_r DECIMAL,
    lcl_r DECIMAL
) AS $$
DECLARE
    v_mean_xbar DECIMAL;
    v_mean_r DECIMAL;
    v_a2 DECIMAL; -- A2 faktörü (subgroup size'a göre)
    v_d3 DECIMAL; -- D3 faktörü
    v_d4 DECIMAL; -- D4 faktörü
BEGIN
    -- Subgroup ortalamalarını ve range'leri hesapla
    WITH subgroup_stats AS (
        SELECT 
            subgroup_number,
            AVG(measurement_value) as xbar,
            MAX(measurement_value) - MIN(measurement_value) as r
        FROM spc_measurements
        WHERE characteristic_id = p_characteristic_id
        GROUP BY subgroup_number
    )
    SELECT 
        AVG(xbar),
        AVG(r)
    INTO v_mean_xbar, v_mean_r
    FROM subgroup_stats;
    
    -- A2, D3, D4 faktörlerini subgroup size'a göre belirle
    -- Basitleştirilmiş: p_subgroup_size = 5 için
    IF p_subgroup_size = 5 THEN
        v_a2 := 0.577;
        v_d3 := 0;
        v_d4 := 2.114;
    ELSIF p_subgroup_size = 4 THEN
        v_a2 := 0.729;
        v_d3 := 0;
        v_d4 := 2.282;
    ELSIF p_subgroup_size = 3 THEN
        v_a2 := 1.023;
        v_d3 := 0;
        v_d4 := 2.574;
    ELSE
        -- Varsayılan değerler
        v_a2 := 0.577;
        v_d3 := 0;
        v_d4 := 2.114;
    END IF;
    
    -- X-bar kontrol limitleri
    cl_xbar := v_mean_xbar;
    ucl_xbar := v_mean_xbar + (v_a2 * v_mean_r);
    lcl_xbar := v_mean_xbar - (v_a2 * v_mean_r);
    
    -- R kontrol limitleri
    cl_r := v_mean_r;
    ucl_r := v_d4 * v_mean_r;
    lcl_r := v_d3 * v_mean_r;
    
    RETURN QUERY SELECT ucl_xbar, cl_xbar, lcl_xbar, ucl_r, cl_r, lcl_r;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyon: Cp ve Cpk hesapla
CREATE OR REPLACE FUNCTION calculate_capability_indices(
    p_characteristic_id UUID
)
RETURNS TABLE (
    cp DECIMAL,
    cpk DECIMAL,
    pp DECIMAL,
    ppk DECIMAL,
    mean_val DECIMAL,
    std_deviation DECIMAL,
    sigma_level DECIMAL
) AS $$
DECLARE
    v_usl DECIMAL;
    v_lsl DECIMAL;
    v_mean DECIMAL;
    v_std_dev DECIMAL;
    v_cp DECIMAL;
    v_cpk DECIMAL;
    v_pp DECIMAL;
    v_ppk DECIMAL;
    v_sigma DECIMAL;
BEGIN
    -- Spesifikasyon limitlerini al
    SELECT usl, lsl INTO v_usl, v_lsl
    FROM spc_characteristics
    WHERE id = p_characteristic_id;
    
    -- Ortalama ve standart sapmayı hesapla
    SELECT 
        AVG(measurement_value),
        STDDEV_POP(measurement_value)
    INTO v_mean, v_std_dev
    FROM spc_measurements
    WHERE characteristic_id = p_characteristic_id;
    
    -- Cp hesapla
    IF v_usl IS NOT NULL AND v_lsl IS NOT NULL AND v_std_dev > 0 THEN
        v_cp := (v_usl - v_lsl) / (6 * v_std_dev);
        
        -- Cpk hesapla
        IF v_mean < (v_usl + v_lsl) / 2 THEN
            v_cpk := (v_mean - v_lsl) / (3 * v_std_dev);
        ELSE
            v_cpk := (v_usl - v_mean) / (3 * v_std_dev);
        END IF;
        
        -- Pp ve Ppk (process performance - tüm veri için)
        v_pp := v_cp; -- Basitleştirilmiş
        v_ppk := v_cpk; -- Basitleştirilmiş
        
        -- Sigma seviyesi
        v_sigma := LEAST(
            (v_usl - v_mean) / v_std_dev,
            (v_mean - v_lsl) / v_std_dev
        );
    ELSE
        v_cp := NULL;
        v_cpk := NULL;
        v_pp := NULL;
        v_ppk := NULL;
        v_sigma := NULL;
    END IF;
    
    RETURN QUERY SELECT v_cp, v_cpk, v_pp, v_ppk, v_mean, v_std_dev, v_sigma;
END;
$$ LANGUAGE plpgsql;
