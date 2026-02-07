-- Tedarikçi tablosuna manuel sınıf belirleme kolonları ekle
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS supplier_grade TEXT CHECK (supplier_grade IN ('A', 'B', 'C', 'D'));
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS grade_reason TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS grade_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.suppliers.supplier_grade IS 'Manuel olarak belirlenen tedarikçi sınıfı (A/B/C/D)';
COMMENT ON COLUMN public.suppliers.grade_reason IS 'Manuel sınıf belirleme gerekçesi';
COMMENT ON COLUMN public.suppliers.grade_updated_at IS 'Manuel sınıf belirleme tarihi';

-- supplier_ppm_data tablosu (eğer yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_ppm_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
    ppm_value NUMERIC(12, 2) DEFAULT 0,
    inspected_quantity NUMERIC(12, 0) DEFAULT 0,
    defective_quantity NUMERIC(12, 0) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, year, month)
);

-- supplier_deliveries tablosu (eğer yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
    delivery_note_number TEXT,
    planned_delivery_date DATE,
    actual_delivery_date DATE,
    on_time BOOLEAN DEFAULT TRUE,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- supplier_evaluations tablosu (eğer yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    evaluation_year INTEGER NOT NULL,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    ppm_value NUMERIC(12, 2) DEFAULT 0,
    otd_percentage NUMERIC(5, 2) DEFAULT 0,
    audit_score NUMERIC(5, 2) DEFAULT 0,
    overall_score NUMERIC(5, 2) DEFAULT 0,
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, evaluation_year)
);

-- PPM hesaplama fonksiyonu (aylık)
CREATE OR REPLACE FUNCTION calculate_supplier_ppm_monthly(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    v_inspected NUMERIC := 0;
    v_defective NUMERIC := 0;
    v_ppm NUMERIC := 0;
BEGIN
    -- Gelen malzeme kontrolünden verileri al
    SELECT 
        COALESCE(SUM(quantity_received), 0),
        COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
    INTO v_inspected, v_defective
    FROM public.incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND EXTRACT(YEAR FROM inspection_date) = p_year
      AND EXTRACT(MONTH FROM inspection_date) = p_month;
    
    IF v_inspected > 0 THEN
        v_ppm := (v_defective / v_inspected) * 1000000;
    END IF;
    
    RETURN ROUND(v_ppm, 2);
END;
$$ LANGUAGE plpgsql;

-- PPM hesaplama fonksiyonu (yıllık)
CREATE OR REPLACE FUNCTION calculate_supplier_ppm_yearly(
    p_supplier_id UUID,
    p_year INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    v_inspected NUMERIC := 0;
    v_defective NUMERIC := 0;
    v_ppm NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(SUM(quantity_received), 0),
        COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
    INTO v_inspected, v_defective
    FROM public.incoming_inspections
    WHERE supplier_id = p_supplier_id
      AND EXTRACT(YEAR FROM inspection_date) = p_year;
    
    IF v_inspected > 0 THEN
        v_ppm := (v_defective / v_inspected) * 1000000;
    END IF;
    
    RETURN ROUND(v_ppm, 2);
END;
$$ LANGUAGE plpgsql;

-- OTD hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_supplier_otd(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER := 0;
    v_on_time INTEGER := 0;
    v_otd NUMERIC := 0;
BEGIN
    IF p_month IS NOT NULL THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE on_time = TRUE)
        INTO v_total, v_on_time
        FROM public.supplier_deliveries
        WHERE supplier_id = p_supplier_id
          AND year = p_year
          AND month = p_month;
    ELSE
        SELECT COUNT(*), COUNT(*) FILTER (WHERE on_time = TRUE)
        INTO v_total, v_on_time
        FROM public.supplier_deliveries
        WHERE supplier_id = p_supplier_id
          AND year = p_year;
    END IF;
    
    IF v_total > 0 THEN
        v_otd := (v_on_time::NUMERIC / v_total::NUMERIC) * 100;
    END IF;
    
    RETURN ROUND(v_otd, 2);
END;
$$ LANGUAGE plpgsql;

-- PPM güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_supplier_ppm(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_ppm NUMERIC;
    v_inspected NUMERIC := 0;
    v_defective NUMERIC := 0;
BEGIN
    IF p_month IS NULL THEN
        -- Yıllık hesaplama
        v_ppm := calculate_supplier_ppm_yearly(p_supplier_id, p_year);
        
        SELECT 
            COALESCE(SUM(quantity_received), 0),
            COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
        INTO v_inspected, v_defective
        FROM public.incoming_inspections
        WHERE supplier_id = p_supplier_id
          AND EXTRACT(YEAR FROM inspection_date) = p_year;
    ELSE
        -- Aylık hesaplama
        v_ppm := calculate_supplier_ppm_monthly(p_supplier_id, p_year, p_month);
        
        SELECT 
            COALESCE(SUM(quantity_received), 0),
            COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
        INTO v_inspected, v_defective
        FROM public.incoming_inspections
        WHERE supplier_id = p_supplier_id
          AND EXTRACT(YEAR FROM inspection_date) = p_year
          AND EXTRACT(MONTH FROM inspection_date) = p_month;
    END IF;
    
    -- Upsert
    INSERT INTO public.supplier_ppm_data (
        supplier_id, year, month, ppm_value, inspected_quantity, defective_quantity, updated_at
    ) VALUES (
        p_supplier_id, p_year, p_month, v_ppm, v_inspected, v_defective, NOW()
    )
    ON CONFLICT (supplier_id, year, month) 
    DO UPDATE SET 
        ppm_value = EXCLUDED.ppm_value,
        inspected_quantity = EXCLUDED.inspected_quantity,
        defective_quantity = EXCLUDED.defective_quantity,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Tedarikçi değerlendirme fonksiyonu
CREATE OR REPLACE FUNCTION evaluate_supplier(
    p_supplier_id UUID,
    p_year INTEGER
) RETURNS UUID AS $$
DECLARE
    v_ppm NUMERIC;
    v_otd NUMERIC;
    v_audit_score NUMERIC;
    v_ppm_score NUMERIC;
    v_overall_score NUMERIC;
    v_grade TEXT;
    v_evaluation_id UUID;
BEGIN
    -- PPM değeri
    v_ppm := calculate_supplier_ppm_yearly(p_supplier_id, p_year);
    
    -- OTD değeri
    v_otd := calculate_supplier_otd(p_supplier_id, p_year, NULL);
    
    -- Son denetim skoru
    SELECT score INTO v_audit_score
    FROM public.supplier_audit_plans
    WHERE supplier_id = p_supplier_id
      AND status = 'Tamamlandı'
      AND score IS NOT NULL
      AND EXTRACT(YEAR FROM COALESCE(actual_date, planned_date)) = p_year
    ORDER BY COALESCE(actual_date, planned_date) DESC
    LIMIT 1;
    
    v_audit_score := COALESCE(v_audit_score, 50); -- Default skor
    
    -- PPM'den skor hesapla (düşük PPM = yüksek skor)
    IF v_ppm < 100 THEN
        v_ppm_score := 100;
    ELSIF v_ppm < 500 THEN
        v_ppm_score := 80;
    ELSIF v_ppm < 1000 THEN
        v_ppm_score := 60;
    ELSE
        v_ppm_score := 40;
    END IF;
    
    -- Genel skor: PPM %40, OTD %30, Audit %30
    v_overall_score := (v_ppm_score * 0.4) + (v_otd * 0.3) + (v_audit_score * 0.3);
    
    -- Sınıf belirleme
    IF v_overall_score >= 90 THEN
        v_grade := 'A';
    ELSIF v_overall_score >= 75 THEN
        v_grade := 'B';
    ELSIF v_overall_score >= 60 THEN
        v_grade := 'C';
    ELSE
        v_grade := 'D';
    END IF;
    
    -- Kaydet
    INSERT INTO public.supplier_evaluations (
        supplier_id, evaluation_year, evaluation_date, ppm_value, otd_percentage, 
        audit_score, overall_score, grade
    ) VALUES (
        p_supplier_id, p_year, CURRENT_DATE, v_ppm, v_otd,
        v_audit_score, v_overall_score, v_grade
    )
    ON CONFLICT (supplier_id, evaluation_year)
    DO UPDATE SET
        evaluation_date = CURRENT_DATE,
        ppm_value = EXCLUDED.ppm_value,
        otd_percentage = EXCLUDED.otd_percentage,
        audit_score = EXCLUDED.audit_score,
        overall_score = EXCLUDED.overall_score,
        grade = EXCLUDED.grade,
        updated_at = NOW()
    RETURNING id INTO v_evaluation_id;
    
    RETURN v_evaluation_id;
END;
$$ LANGUAGE plpgsql;

-- RLS politikaları
ALTER TABLE public.supplier_ppm_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;

-- Tüm authenticated kullanıcılar için okuma/yazma izni
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'supplier_ppm_data_all_access') THEN
        CREATE POLICY supplier_ppm_data_all_access ON public.supplier_ppm_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'supplier_deliveries_all_access') THEN
        CREATE POLICY supplier_deliveries_all_access ON public.supplier_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'supplier_evaluations_all_access') THEN
        CREATE POLICY supplier_evaluations_all_access ON public.supplier_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_supplier_ppm_data_supplier_year ON public.supplier_ppm_data(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_supplier_year ON public.supplier_deliveries(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier_year ON public.supplier_evaluations(supplier_id, evaluation_year);
