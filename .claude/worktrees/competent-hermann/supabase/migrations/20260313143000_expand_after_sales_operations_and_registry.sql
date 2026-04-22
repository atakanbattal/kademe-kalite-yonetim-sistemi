ALTER TABLE public.customer_complaints
ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS vehicle_model_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS chassis_brand VARCHAR(100),
ADD COLUMN IF NOT EXISTS chassis_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS fault_part_code VARCHAR(120),
ADD COLUMN IF NOT EXISTS fault_part_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS recommended_workflow VARCHAR(20),
ADD COLUMN IF NOT EXISTS workflow_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_complaints_vehicle_category
    ON public.customer_complaints(vehicle_category);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_vehicle_model_code
    ON public.customer_complaints(vehicle_model_code);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_fault_part_code
    ON public.customer_complaints(fault_part_code);

CREATE TABLE IF NOT EXISTS public.after_sales_service_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.customer_complaints(id) ON DELETE CASCADE,
    operation_type VARCHAR(100) NOT NULL DEFAULT 'Saha Servisi',
    operation_title VARCHAR(255) NOT NULL,
    operation_details TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Türkiye',
    assigned_person_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    current_location VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Planlandı',
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    lodging_days INTEGER DEFAULT 0,
    lodging_cost NUMERIC(12,2) DEFAULT 0,
    travel_km NUMERIC(12,2) DEFAULT 0,
    travel_cost NUMERIC(12,2) DEFAULT 0,
    labor_hours NUMERIC(12,2) DEFAULT 0,
    labor_cost NUMERIC(12,2) DEFAULT 0,
    used_part_cost NUMERIC(12,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    completion_notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_service_operations IS 'Satış sonrası saha görevlendirme, planlama, personel ve maliyet kayıtları.';

CREATE INDEX IF NOT EXISTS idx_after_sales_service_operations_complaint
    ON public.after_sales_service_operations(complaint_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_service_operations_assigned_person
    ON public.after_sales_service_operations(assigned_person_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_service_operations_status
    ON public.after_sales_service_operations(status);

CREATE TABLE IF NOT EXISTS public.after_sales_service_operation_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES public.after_sales_service_operations(id) ON DELETE CASCADE,
    part_code VARCHAR(120),
    part_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    is_fault_source BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_service_operation_parts IS 'Satış sonrası operasyonlarda kullanılan ve/veya arızanın kaynağı olan parçalar.';

CREATE INDEX IF NOT EXISTS idx_after_sales_service_operation_parts_operation
    ON public.after_sales_service_operation_parts(operation_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_service_operation_parts_code
    ON public.after_sales_service_operation_parts(part_code);

CREATE TABLE IF NOT EXISTS public.after_sales_vehicle_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    vehicle_serial_number VARCHAR(120) UNIQUE,
    vehicle_chassis_number VARCHAR(120),
    vehicle_category VARCHAR(100) NOT NULL,
    vehicle_model_code VARCHAR(100) NOT NULL,
    vehicle_model_name VARCHAR(255),
    chassis_brand VARCHAR(100),
    chassis_model VARCHAR(100),
    engine_brand VARCHAR(100),
    engine_model VARCHAR(100),
    engine_serial_number VARCHAR(120),
    delivery_date DATE,
    production_date DATE,
    factory_inspection_notes TEXT,
    factory_findings TEXT,
    factory_fault_summary TEXT,
    quality_gate_notes TEXT,
    warranty_document_no VARCHAR(120),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_vehicle_registry IS 'Fabrikadan sevk edilen tüm araçların satış sonrası kimlik kartı ve fabrika bulgu arşivi.';

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_registry_customer
    ON public.after_sales_vehicle_registry(customer_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_registry_category
    ON public.after_sales_vehicle_registry(vehicle_category);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_registry_model
    ON public.after_sales_vehicle_registry(vehicle_model_code);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_registry_chassis_brand
    ON public.after_sales_vehicle_registry(chassis_brand);

ALTER TABLE public.after_sales_vehicle_files
    ALTER COLUMN vehicle_serial_number DROP NOT NULL;

ALTER TABLE public.after_sales_vehicle_files
ADD COLUMN IF NOT EXISTS scope_type VARCHAR(30) DEFAULT 'vehicle',
ADD COLUMN IF NOT EXISTS vehicle_registry_id UUID REFERENCES public.after_sales_vehicle_registry(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS vehicle_model_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS chassis_brand VARCHAR(100),
ADD COLUMN IF NOT EXISTS chassis_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS document_group VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_scope_type
    ON public.after_sales_vehicle_files(scope_type);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_registry
    ON public.after_sales_vehicle_files(vehicle_registry_id);

ALTER TABLE public.after_sales_service_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_service_operation_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_vehicle_registry ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_table TEXT;
BEGIN
    FOREACH policy_table IN ARRAY ARRAY[
        'after_sales_service_operations',
        'after_sales_service_operation_parts',
        'after_sales_vehicle_registry'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = policy_table
              AND policyname = policy_table || '_select_authenticated'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                policy_table || '_select_authenticated',
                policy_table
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = policy_table
              AND policyname = policy_table || '_insert_authenticated'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
                policy_table || '_insert_authenticated',
                policy_table
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = policy_table
              AND policyname = policy_table || '_update_authenticated'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
                policy_table || '_update_authenticated',
                policy_table
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = policy_table
              AND policyname = policy_table || '_delete_authenticated'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
                policy_table || '_delete_authenticated',
                policy_table
            );
        END IF;
    END LOOP;
END $$;
