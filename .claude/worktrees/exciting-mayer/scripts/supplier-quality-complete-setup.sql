-- =====================================================
-- Tedarikçi Kalite Modülü - Tam Kurulum SQL
-- Bu script'i Supabase SQL Editor'dan çalıştırın
-- Eksik tabloları oluşturur ve eksik kolonları ekler
-- =====================================================

-- 1. suppliers tablosuna manuel sınıf kolonları ekle (yoksa)
DO $$
BEGIN
    -- supplier_grade kolonu
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'suppliers' 
        AND column_name = 'supplier_grade'
    ) THEN
        ALTER TABLE public.suppliers 
        ADD COLUMN supplier_grade TEXT CHECK (supplier_grade IN ('A', 'B', 'C', 'D'));
        RAISE NOTICE 'supplier_grade kolonu eklendi';
    ELSE
        RAISE NOTICE 'supplier_grade kolonu zaten mevcut';
    END IF;
    
    -- grade_reason kolonu
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'suppliers' 
        AND column_name = 'grade_reason'
    ) THEN
        ALTER TABLE public.suppliers ADD COLUMN grade_reason TEXT;
        RAISE NOTICE 'grade_reason kolonu eklendi';
    ELSE
        RAISE NOTICE 'grade_reason kolonu zaten mevcut';
    END IF;
    
    -- grade_updated_at kolonu
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'suppliers' 
        AND column_name = 'grade_updated_at'
    ) THEN
        ALTER TABLE public.suppliers ADD COLUMN grade_updated_at TIMESTAMPTZ;
        RAISE NOTICE 'grade_updated_at kolonu eklendi';
    ELSE
        RAISE NOTICE 'grade_updated_at kolonu zaten mevcut';
    END IF;
END $$;

-- 2. supplier_ppm_data tablosu (yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_ppm_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER, -- NULL = yıllık, 1-12 = aylık
    ppm_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    inspected_quantity INTEGER NOT NULL DEFAULT 0,
    defective_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, year, month)
);

-- 3. supplier_deliveries tablosu (yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    delivery_note_number TEXT,
    planned_delivery_date DATE,
    actual_delivery_date DATE,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
    on_time BOOLEAN NOT NULL DEFAULT true,
    quantity_ordered INTEGER,
    quantity_delivered INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. supplier_evaluations tablosu (yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    evaluation_year INTEGER NOT NULL,
    evaluation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ppm_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    otd_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    audit_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D')),
    notes TEXT,
    evaluator_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, evaluation_year)
);

-- 5. Index'ler
CREATE INDEX IF NOT EXISTS idx_supplier_ppm_supplier_year ON public.supplier_ppm_data(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_supplier_year ON public.supplier_deliveries(supplier_id, year);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier_year ON public.supplier_evaluations(supplier_id, evaluation_year);

-- 6. RLS Policies (Row Level Security)
ALTER TABLE public.supplier_ppm_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;

-- PPM Data policies
DO $$
BEGIN
    -- Okuma politikası
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_ppm_data' 
        AND policyname = 'Allow read for authenticated users'
    ) THEN
        CREATE POLICY "Allow read for authenticated users" ON public.supplier_ppm_data
            FOR SELECT TO authenticated USING (true);
    END IF;
    
    -- Yazma politikası
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_ppm_data' 
        AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON public.supplier_ppm_data
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Deliveries policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_deliveries' 
        AND policyname = 'Allow read for authenticated users'
    ) THEN
        CREATE POLICY "Allow read for authenticated users" ON public.supplier_deliveries
            FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_deliveries' 
        AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON public.supplier_deliveries
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Evaluations policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_evaluations' 
        AND policyname = 'Allow read for authenticated users'
    ) THEN
        CREATE POLICY "Allow read for authenticated users" ON public.supplier_evaluations
            FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'supplier_evaluations' 
        AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON public.supplier_evaluations
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. Sonuç
SELECT 'Tedarikçi kalite modülü kurulumu tamamlandı!' as mesaj;
SELECT 
    'suppliers' as tablo, 
    COUNT(*) as kayit_sayisi,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'suppliers' AND table_schema = 'public') as kolon_sayisi
FROM public.suppliers
UNION ALL
SELECT 
    'supplier_ppm_data', 
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'supplier_ppm_data' AND table_schema = 'public')
FROM public.supplier_ppm_data
UNION ALL
SELECT 
    'supplier_deliveries', 
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'supplier_deliveries' AND table_schema = 'public')
FROM public.supplier_deliveries
UNION ALL
SELECT 
    'supplier_evaluations', 
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'supplier_evaluations' AND table_schema = 'public')
FROM public.supplier_evaluations;
