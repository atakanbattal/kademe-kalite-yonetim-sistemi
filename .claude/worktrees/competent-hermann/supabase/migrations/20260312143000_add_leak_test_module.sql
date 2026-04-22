CREATE TABLE IF NOT EXISTS public.leak_test_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    vehicle_type_label TEXT NOT NULL,
    tank_type VARCHAR(30) NOT NULL,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    test_start_time TIME NOT NULL,
    test_duration_minutes INTEGER NOT NULL CHECK (test_duration_minutes > 0),
    test_result VARCHAR(20) NOT NULL,
    leak_count INTEGER NOT NULL DEFAULT 0 CHECK (leak_count >= 0),
    tested_by_personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    tested_by_name TEXT NOT NULL,
    welded_by_personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    welded_by_name TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT leak_test_records_tank_type_check
        CHECK (tank_type IN ('Yağ Tankı', 'Su Tankı', 'Mazot Tankı', 'Fıskiye')),
    CONSTRAINT leak_test_records_result_check
        CHECK (test_result IN ('Kabul', 'Kaçak Var')),
    CONSTRAINT leak_test_records_result_leak_count_check
        CHECK (
            (test_result = 'Kabul' AND leak_count = 0)
            OR
            (test_result = 'Kaçak Var' AND leak_count > 0)
        )
);

COMMENT ON TABLE public.leak_test_records IS 'Sızdırmazlık kontrol test kayıtları';
COMMENT ON COLUMN public.leak_test_records.vehicle_type_label IS 'Kayıt anındaki araç tipi görünür adı';
COMMENT ON COLUMN public.leak_test_records.tested_by_name IS 'Kayıt anındaki test personeli görünür adı';
COMMENT ON COLUMN public.leak_test_records.welded_by_name IS 'Kayıt anındaki kaynak personeli görünür adı';

CREATE INDEX IF NOT EXISTS idx_leak_test_records_test_date
    ON public.leak_test_records(test_date DESC, test_start_time DESC);
CREATE INDEX IF NOT EXISTS idx_leak_test_records_vehicle_type
    ON public.leak_test_records(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_leak_test_records_test_result
    ON public.leak_test_records(test_result);
CREATE INDEX IF NOT EXISTS idx_leak_test_records_tested_by
    ON public.leak_test_records(tested_by_personnel_id);
CREATE INDEX IF NOT EXISTS idx_leak_test_records_welded_by
    ON public.leak_test_records(welded_by_personnel_id);

ALTER TABLE public.leak_test_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'leak_test_records'
          AND policyname = 'Authenticated users can view leak test records'
    ) THEN
        CREATE POLICY "Authenticated users can view leak test records"
            ON public.leak_test_records
            FOR SELECT
            USING (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'leak_test_records'
          AND policyname = 'Authenticated users can insert leak test records'
    ) THEN
        CREATE POLICY "Authenticated users can insert leak test records"
            ON public.leak_test_records
            FOR INSERT
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'leak_test_records'
          AND policyname = 'Authenticated users can update leak test records'
    ) THEN
        CREATE POLICY "Authenticated users can update leak test records"
            ON public.leak_test_records
            FOR UPDATE
            USING (auth.role() = 'authenticated')
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'leak_test_records'
          AND policyname = 'Authenticated users can delete leak test records'
    ) THEN
        CREATE POLICY "Authenticated users can delete leak test records"
            ON public.leak_test_records
            FOR DELETE
            USING (auth.role() = 'authenticated');
    END IF;
END $$;
