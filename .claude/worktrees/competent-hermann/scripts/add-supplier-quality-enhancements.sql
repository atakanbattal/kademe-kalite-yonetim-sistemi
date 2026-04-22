-- Tedarikçi Kalite Modülü Geliştirmeleri
-- PPM, OTD%, Değerlendirme Sistemi

-- 1. Tedarikçi PPM hesaplama fonksiyonu (aylık)
CREATE OR REPLACE FUNCTION calculate_supplier_ppm_monthly(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_inspected INTEGER;
    v_defective INTEGER;
    v_ppm NUMERIC;
BEGIN
    -- Belirtilen ay için muayene edilen ve hatalı parça sayısını hesapla
    SELECT 
        COALESCE(SUM(quantity_received), 0),
        COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
    INTO v_inspected, v_defective
    FROM public.incoming_inspections
    WHERE supplier_id = p_supplier_id
        AND EXTRACT(YEAR FROM inspection_date) = p_year
        AND EXTRACT(MONTH FROM inspection_date) = p_month
        AND decision IN ('Kabul', 'Şartlı Kabul', 'Ret');
    
    -- PPM hesapla: (Hatalı Parça / Toplam Muayene Edilen) × 1,000,000
    IF v_inspected > 0 THEN
        v_ppm := ROUND((v_defective::NUMERIC / v_inspected::NUMERIC) * 1000000, 2);
    ELSE
        v_ppm := 0;
    END IF;
    
    RETURN v_ppm;
END;
$$ LANGUAGE plpgsql;

-- 2. Tedarikçi PPM hesaplama fonksiyonu (yıllık)
CREATE OR REPLACE FUNCTION calculate_supplier_ppm_yearly(
    p_supplier_id UUID,
    p_year INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_inspected INTEGER;
    v_defective INTEGER;
    v_ppm NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(quantity_received), 0),
        COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
    INTO v_inspected, v_defective
    FROM public.incoming_inspections
    WHERE supplier_id = p_supplier_id
        AND EXTRACT(YEAR FROM inspection_date) = p_year
        AND decision IN ('Kabul', 'Şartlı Kabul', 'Ret');
    
    IF v_inspected > 0 THEN
        v_ppm := ROUND((v_defective::NUMERIC / v_inspected::NUMERIC) * 1000000, 2);
    ELSE
        v_ppm := 0;
    END IF;
    
    RETURN v_ppm;
END;
$$ LANGUAGE plpgsql;

-- 3. Tedarikçi PPM takip tablosu
CREATE TABLE IF NOT EXISTS public.supplier_ppm_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
    ppm_value NUMERIC NOT NULL DEFAULT 0,
    inspected_quantity INTEGER DEFAULT 0,
    defective_quantity INTEGER DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(supplier_id, year, month)
);

-- 4. Otomatik PPM güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_supplier_ppm(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_ppm NUMERIC;
    v_inspected INTEGER;
    v_defective INTEGER;
    v_record_id UUID;
BEGIN
    IF p_month IS NULL THEN
        -- Yıllık PPM
        v_ppm := calculate_supplier_ppm_yearly(p_supplier_id, p_year);
        
        SELECT 
            COALESCE(SUM(quantity_received), 0),
            COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
        INTO v_inspected, v_defective
        FROM public.incoming_inspections
        WHERE supplier_id = p_supplier_id
            AND EXTRACT(YEAR FROM inspection_date) = p_year
            AND decision IN ('Kabul', 'Şartlı Kabul', 'Ret');
    ELSE
        -- Aylık PPM
        v_ppm := calculate_supplier_ppm_monthly(p_supplier_id, p_year, p_month);
        
        SELECT 
            COALESCE(SUM(quantity_received), 0),
            COALESCE(SUM(quantity_rejected + quantity_conditional), 0)
        INTO v_inspected, v_defective
        FROM public.incoming_inspections
        WHERE supplier_id = p_supplier_id
            AND EXTRACT(YEAR FROM inspection_date) = p_year
            AND EXTRACT(MONTH FROM inspection_date) = p_month
            AND decision IN ('Kabul', 'Şartlı Kabul', 'Ret');
    END IF;
    
    -- Kaydı güncelle veya oluştur
    INSERT INTO public.supplier_ppm_data (
        supplier_id,
        year,
        month,
        ppm_value,
        inspected_quantity,
        defective_quantity
    ) VALUES (
        p_supplier_id,
        p_year,
        p_month,
        v_ppm,
        v_inspected,
        v_defective
    )
    ON CONFLICT (supplier_id, year, month) 
    DO UPDATE SET
        ppm_value = EXCLUDED.ppm_value,
        inspected_quantity = EXCLUDED.inspected_quantity,
        defective_quantity = EXCLUDED.defective_quantity,
        calculated_at = NOW()
    RETURNING id INTO v_record_id;
    
    RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;

-- 5. OTD% (On-Time Delivery) hesaplama için tablo
CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    delivery_note_number VARCHAR(100),
    order_date DATE,
    planned_delivery_date DATE,
    actual_delivery_date DATE,
    on_time BOOLEAN,
    otd_percentage NUMERIC,
    year INTEGER,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. OTD% hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_supplier_otd(
    p_supplier_id UUID,
    p_year INTEGER,
    p_month INTEGER DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_deliveries INTEGER;
    v_on_time_deliveries INTEGER;
    v_otd_percentage NUMERIC;
BEGIN
    IF p_month IS NULL THEN
        -- Yıllık OTD%
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE on_time = true)
        INTO v_total_deliveries, v_on_time_deliveries
        FROM public.supplier_deliveries
        WHERE supplier_id = p_supplier_id
            AND year = p_year;
    ELSE
        -- Aylık OTD%
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE on_time = true)
        INTO v_total_deliveries, v_on_time_deliveries
        FROM public.supplier_deliveries
        WHERE supplier_id = p_supplier_id
            AND year = p_year
            AND month = p_month;
    END IF;
    
    IF v_total_deliveries > 0 THEN
        v_otd_percentage := ROUND((v_on_time_deliveries::NUMERIC / v_total_deliveries::NUMERIC) * 100, 2);
    ELSE
        v_otd_percentage := 0;
    END IF;
    
    RETURN v_otd_percentage;
END;
$$ LANGUAGE plpgsql;

-- 7. Tedarikçi değerlendirme sistemi tablosu
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    evaluation_year INTEGER NOT NULL,
    ppm_value NUMERIC DEFAULT 0,
    otd_percentage NUMERIC DEFAULT 0,
    audit_score NUMERIC DEFAULT 0,
    overall_score NUMERIC DEFAULT 0,
    grade VARCHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D')),
    evaluation_date DATE DEFAULT CURRENT_DATE,
    evaluated_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(supplier_id, evaluation_year)
);

-- 8. Otomatik değerlendirme ve sınıflandırma fonksiyonu
CREATE OR REPLACE FUNCTION evaluate_supplier(
    p_supplier_id UUID,
    p_year INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_ppm NUMERIC;
    v_otd NUMERIC;
    v_audit_score NUMERIC;
    v_overall_score NUMERIC;
    v_grade VARCHAR(1);
    v_evaluation_id UUID;
    v_latest_audit RECORD;
BEGIN
    -- PPM değerini al (yıllık)
    v_ppm := calculate_supplier_ppm_yearly(p_supplier_id, p_year);
    
    -- OTD% değerini al (yıllık)
    v_otd := calculate_supplier_otd(p_supplier_id, p_year);
    
    -- Son audit skorunu al
    SELECT score INTO v_audit_score
    FROM public.supplier_audit_plans
    WHERE supplier_id = p_supplier_id
        AND status = 'Tamamlandı'
        AND score IS NOT NULL
        AND EXTRACT(YEAR FROM actual_date) = p_year
    ORDER BY actual_date DESC
    LIMIT 1;
    
    v_audit_score := COALESCE(v_audit_score, 0);
    
    -- Genel skor hesapla (PPM %40, OTD% %30, Audit %30)
    -- PPM için ters skor (düşük PPM = yüksek skor)
    -- PPM < 100 = 100 puan, PPM 100-500 = 80 puan, PPM > 500 = 50 puan
    DECLARE
        v_ppm_score NUMERIC;
    BEGIN
        IF v_ppm < 100 THEN
            v_ppm_score := 100;
        ELSIF v_ppm < 500 THEN
            v_ppm_score := 80;
        ELSE
            v_ppm_score := 50;
        END IF;
    END;
    
    v_overall_score := (v_ppm_score * 0.4) + (v_otd * 0.3) + (v_audit_score * 0.3);
    
    -- Sınıf belirleme
    IF v_overall_score >= 90 AND v_ppm < 100 AND v_otd >= 95 THEN
        v_grade := 'A';
    ELSIF v_overall_score >= 75 AND v_ppm < 500 AND v_otd >= 90 THEN
        v_grade := 'B';
    ELSIF v_overall_score >= 60 THEN
        v_grade := 'C';
    ELSE
        v_grade := 'D';
    END IF;
    
    -- Değerlendirme kaydı oluştur veya güncelle
    INSERT INTO public.supplier_evaluations (
        supplier_id,
        evaluation_year,
        ppm_value,
        otd_percentage,
        audit_score,
        overall_score,
        grade,
        evaluated_by
    ) VALUES (
        p_supplier_id,
        p_year,
        v_ppm,
        v_otd,
        v_audit_score,
        v_overall_score,
        v_grade,
        auth.uid()
    )
    ON CONFLICT (supplier_id, evaluation_year)
    DO UPDATE SET
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

-- 9. Index'ler
CREATE INDEX IF NOT EXISTS idx_supplier_ppm_data_supplier_year ON public.supplier_ppm_data(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_ppm_data_year_month ON public.supplier_ppm_data(year, month);
CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_supplier_year ON public.supplier_deliveries(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier_year ON public.supplier_evaluations(supplier_id, evaluation_year);

-- 10. Trigger: Girdi muayenesi sonrası otomatik PPM güncelleme
CREATE OR REPLACE FUNCTION trigger_update_supplier_ppm()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
BEGIN
    IF NEW.inspection_date IS NOT NULL AND NEW.supplier_id IS NOT NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.inspection_date);
        v_month := EXTRACT(MONTH FROM NEW.inspection_date);
        
        -- Aylık PPM güncelle
        PERFORM update_supplier_ppm(NEW.supplier_id, v_year, v_month);
        
        -- Yıllık PPM güncelle
        PERFORM update_supplier_ppm(NEW.supplier_id, v_year, NULL);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_incoming_inspection_ppm_update
    AFTER INSERT OR UPDATE ON public.incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision IN ('Kabul', 'Şartlı Kabul', 'Ret'))
    EXECUTE FUNCTION trigger_update_supplier_ppm();

-- 11. Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_supplier_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_supplier_evaluations_updated_at
    BEFORE UPDATE ON public.supplier_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_evaluations_updated_at();

-- Yorumlar
COMMENT ON FUNCTION calculate_supplier_ppm_monthly IS 'Tedarikçi için aylık PPM hesaplama';
COMMENT ON FUNCTION calculate_supplier_ppm_yearly IS 'Tedarikçi için yıllık PPM hesaplama';
COMMENT ON FUNCTION calculate_supplier_otd IS 'Tedarikçi için OTD% (On-Time Delivery) hesaplama';
COMMENT ON FUNCTION evaluate_supplier IS 'Tedarikçi için otomatik değerlendirme ve sınıflandırma (A-B-C-D)';
COMMENT ON TABLE public.supplier_ppm_data IS 'Tedarikçi PPM verileri (aylık/yıllık)';
COMMENT ON TABLE public.supplier_deliveries IS 'Tedarikçi teslimat takibi (OTD% hesaplama için)';
COMMENT ON TABLE public.supplier_evaluations IS 'Tedarikçi yıllık değerlendirme kayıtları';

-- 12. Tedarikçi 8D Portal Link Sistemi
CREATE TABLE IF NOT EXISTS public.supplier_8d_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    nc_id UUID NOT NULL REFERENCES public.non_conformities(id) ON DELETE CASCADE,
    unique_token VARCHAR(100) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    link_url TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 13. Tedarikçi 8D Portal Gönderimleri
CREATE TABLE IF NOT EXISTS public.supplier_8d_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES public.supplier_8d_links(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    nc_id UUID NOT NULL REFERENCES public.non_conformities(id) ON DELETE CASCADE,
    eight_d_steps JSONB,
    root_cause_analysis TEXT,
    corrective_actions TEXT,
    preventive_actions TEXT,
    evidence_files TEXT[], -- Supabase Storage paths
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supplier_contact_name TEXT,
    supplier_contact_email TEXT,
    status VARCHAR(50) DEFAULT 'Beklemede' CHECK (status IN ('Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi'))
);

-- 14. Unique token oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION generate_supplier_8d_link(
    p_supplier_id UUID,
    p_nc_id UUID,
    p_expires_days INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
    v_link_id UUID;
    v_token VARCHAR(100);
    v_base_url TEXT;
BEGIN
    -- Unique token oluştur
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Base URL (production'da environment variable'dan alınmalı)
    v_base_url := 'https://kademekalite.online/supplier-portal/8d/';
    
    -- Link kaydı oluştur
    INSERT INTO public.supplier_8d_links (
        supplier_id,
        nc_id,
        unique_token,
        link_url,
        expires_at,
        created_by
    ) VALUES (
        p_supplier_id,
        p_nc_id,
        v_token,
        v_base_url || v_token,
        NOW() + (p_expires_days || ' days')::INTERVAL,
        auth.uid()
    ) RETURNING id INTO v_link_id;
    
    RETURN v_link_id;
END;
$$ LANGUAGE plpgsql;

-- 15. Link erişim takibi
CREATE OR REPLACE FUNCTION track_supplier_link_access(
    p_token VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
    v_link_id UUID;
BEGIN
    UPDATE public.supplier_8d_links
    SET accessed_at = NOW(),
        access_count = access_count + 1
    WHERE unique_token = p_token
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    RETURNING id INTO v_link_id;
    
    RETURN v_link_id;
END;
$$ LANGUAGE plpgsql;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_supplier_8d_links_token ON public.supplier_8d_links(unique_token);
CREATE INDEX IF NOT EXISTS idx_supplier_8d_links_supplier_nc ON public.supplier_8d_links(supplier_id, nc_id);
CREATE INDEX IF NOT EXISTS idx_supplier_8d_submissions_link ON public.supplier_8d_submissions(link_id);
CREATE INDEX IF NOT EXISTS idx_supplier_8d_submissions_status ON public.supplier_8d_submissions(status);

COMMENT ON TABLE public.supplier_8d_links IS 'Tedarikçilere özel 8D portal linkleri';
COMMENT ON TABLE public.supplier_8d_submissions IS 'Tedarikçilerden gelen 8D gönderimleri';
COMMENT ON FUNCTION generate_supplier_8d_link IS 'Tedarikçi için özel 8D portal linki oluşturma';

-- 16. Girdi KK Entegrasyonu: Reddedilen stok otomatik tedarikçi kalite modülüne düşme
CREATE OR REPLACE FUNCTION auto_create_supplier_nc_from_rejection()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_id UUID;
    v_nc_id UUID;
BEGIN
    -- Sadece Ret kararı verildiğinde ve supplier_id varsa çalış
    IF NEW.decision = 'Ret' AND NEW.supplier_id IS NOT NULL AND (OLD.decision IS NULL OR OLD.decision != 'Ret') THEN
        -- Tedarikçi bilgisini al
        v_supplier_id := NEW.supplier_id;
        
        -- Otomatik olarak tedarikçi uygunsuzluğu oluştur
        INSERT INTO public.non_conformities (
            supplier_id,
            title,
            description,
            type,
            status,
            priority,
            department,
            opening_date,
            is_supplier_nc,
            source_inspection_id,
            part_code,
            part_name,
            vehicle_type
        ) VALUES (
            v_supplier_id,
            COALESCE(NEW.part_name || ' (' || NEW.part_code || ')', 'GKK Ret Kararı') || ' - Otomatik Uygunsuzluk',
            'Girdi Kalite Kontrol sonucu Ret kararı verilmiştir. ' ||
            'İrsaliye No: ' || COALESCE(NEW.delivery_note_number, '-') || E'\n' ||
            'Reddedilen Miktar: ' || COALESCE(NEW.quantity_rejected::text, '0') || ' ' || COALESCE(NEW.unit, 'adet') || E'\n' ||
            'Muayene Tarihi: ' || NEW.inspection_date::text || E'\n' ||
            COALESCE('Notlar: ' || NEW.notes, ''),
            'DF',
            'Açık',
            'Yüksek',
            'Tedarikçi',
            NEW.inspection_date,
            true,
            NEW.id,
            NEW.part_code,
            NEW.part_name,
            NEW.vehicle_type
        ) RETURNING id INTO v_nc_id;
        
        -- Tedarikçi 8D linki oluştur (opsiyonel - otomatik)
        -- PERFORM generate_supplier_8d_link(v_supplier_id, v_nc_id, 30);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_supplier_nc_from_rejection ON public.incoming_inspections;
CREATE TRIGGER trigger_auto_supplier_nc_from_rejection
    AFTER INSERT OR UPDATE ON public.incoming_inspections
    FOR EACH ROW
    WHEN (NEW.decision = 'Ret' AND NEW.supplier_id IS NOT NULL)
    EXECUTE FUNCTION auto_create_supplier_nc_from_rejection();

COMMENT ON FUNCTION auto_create_supplier_nc_from_rejection IS 'Girdi KK Ret kararı sonrası otomatik tedarikçi uygunsuzluğu oluşturma';

