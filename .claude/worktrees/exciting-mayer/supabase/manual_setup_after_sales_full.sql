-- Satış Sonrası Hizmetler tam kurulum SQL'i
-- Bu dosyanın tamamını Supabase SQL Editor'a tek seferde yapıştırabilirsiniz.

ALTER TABLE public.customer_complaints
ADD COLUMN IF NOT EXISTS case_type VARCHAR(100) DEFAULT 'Müşteri Şikayeti',
ADD COLUMN IF NOT EXISTS complaint_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS vehicle_serial_number VARCHAR(120),
ADD COLUMN IF NOT EXISTS vehicle_chassis_number VARCHAR(120),
ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(255),
ADD COLUMN IF NOT EXISTS vehicle_plate_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS service_channel VARCHAR(100),
ADD COLUMN IF NOT EXISTS service_location_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS service_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS service_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS service_partner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS helpdesk_supported BOOLEAN,
ADD COLUMN IF NOT EXISTS conversation_recorded BOOLEAN,
ADD COLUMN IF NOT EXISTS service_record_created BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS warranty_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS warranty_end_date DATE,
ADD COLUMN IF NOT EXISTS warranty_document_no VARCHAR(120),
ADD COLUMN IF NOT EXISTS warranty_terms_explained BOOLEAN,
ADD COLUMN IF NOT EXISTS out_of_warranty_explained BOOLEAN,
ADD COLUMN IF NOT EXISTS user_manual_available BOOLEAN,
ADD COLUMN IF NOT EXISTS maintenance_catalog_available BOOLEAN,
ADD COLUMN IF NOT EXISTS spare_parts_catalog_available BOOLEAN,
ADD COLUMN IF NOT EXISTS multilingual_docs_available BOOLEAN,
ADD COLUMN IF NOT EXISTS documents_archived_by_work_order BOOLEAN,
ADD COLUMN IF NOT EXISTS spare_part_required BOOLEAN,
ADD COLUMN IF NOT EXISTS spare_part_status VARCHAR(100),
ADD COLUMN IF NOT EXISTS spare_part_eta_days INTEGER,
ADD COLUMN IF NOT EXISTS spare_part_shipped_by_company BOOLEAN,
ADD COLUMN IF NOT EXISTS root_cause_methodology VARCHAR(100),
ADD COLUMN IF NOT EXISTS repeat_failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recurrence_risk_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS design_revision_applied BOOLEAN,
ADD COLUMN IF NOT EXISTS design_revision_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS survey_sent BOOLEAN,
ADD COLUMN IF NOT EXISTS survey_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS survey_notes TEXT,
ADD COLUMN IF NOT EXISTS service_start_date DATE,
ADD COLUMN IF NOT EXISTS service_completion_date DATE;

COMMENT ON COLUMN public.customer_complaints.case_type IS 'Satış sonrası vaka tipi: şikayet, garanti, servis, teknik destek, yedek parça vb.';
COMMENT ON COLUMN public.customer_complaints.vehicle_serial_number IS 'Araç seri numarası ile hızlı izleme ve arama için tutulur.';
COMMENT ON COLUMN public.customer_complaints.service_location_type IS 'Yurt içi, yurt dışı, uzak destek, müşteri tesisi veya fabrika servis kaydı.';
COMMENT ON COLUMN public.customer_complaints.warranty_status IS 'Garanti içinde/dışı/iyi niyet gibi garanti kararı.';
COMMENT ON COLUMN public.customer_complaints.repeat_failure_count IS 'Aynı problem veya hata tekrar sayısı.';

CREATE INDEX IF NOT EXISTS idx_customer_complaints_case_type
    ON public.customer_complaints(case_type);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_vehicle_serial
    ON public.customer_complaints(vehicle_serial_number);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_vehicle_chassis
    ON public.customer_complaints(vehicle_chassis_number);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_warranty_status
    ON public.customer_complaints(warranty_status);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_service_location
    ON public.customer_complaints(service_location_type);

CREATE TABLE IF NOT EXISTS public.after_sales_vehicle_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    related_complaint_id UUID REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
    vehicle_serial_number VARCHAR(120) NOT NULL,
    vehicle_chassis_number VARCHAR(120),
    vehicle_plate_number VARCHAR(50),
    vehicle_model VARCHAR(255),
    delivery_date DATE,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_description TEXT,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    revision_no VARCHAR(50),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_vehicle_files IS 'Satış sonrası araç kimlik dosyaları, logbook taramaları ve teslim sonrası müşteri doküman arşivi.';
COMMENT ON COLUMN public.after_sales_vehicle_files.document_type IS 'Araç kimlik dosyası, logbook, garanti belgesi, kullanıcı kitapçığı vb.';

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_customer
    ON public.after_sales_vehicle_files(customer_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_serial
    ON public.after_sales_vehicle_files(vehicle_serial_number);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_chassis
    ON public.after_sales_vehicle_files(vehicle_chassis_number);

CREATE INDEX IF NOT EXISTS idx_after_sales_vehicle_files_doc_type
    ON public.after_sales_vehicle_files(document_type);

ALTER TABLE public.after_sales_vehicle_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'after_sales_vehicle_files'
          AND policyname = 'after_sales_vehicle_files_select_authenticated'
    ) THEN
        CREATE POLICY after_sales_vehicle_files_select_authenticated
            ON public.after_sales_vehicle_files
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'after_sales_vehicle_files'
          AND policyname = 'after_sales_vehicle_files_insert_authenticated'
    ) THEN
        CREATE POLICY after_sales_vehicle_files_insert_authenticated
            ON public.after_sales_vehicle_files
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'after_sales_vehicle_files'
          AND policyname = 'after_sales_vehicle_files_update_authenticated'
    ) THEN
        CREATE POLICY after_sales_vehicle_files_update_authenticated
            ON public.after_sales_vehicle_files
            FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'after_sales_vehicle_files'
          AND policyname = 'after_sales_vehicle_files_delete_authenticated'
    ) THEN
        CREATE POLICY after_sales_vehicle_files_delete_authenticated
            ON public.after_sales_vehicle_files
            FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'after_sales_files'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('after_sales_files', 'after_sales_files', false);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'after_sales_files_insert_authenticated'
    ) THEN
        CREATE POLICY after_sales_files_insert_authenticated
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'after_sales_files');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'after_sales_files_select_authenticated'
    ) THEN
        CREATE POLICY after_sales_files_select_authenticated
            ON storage.objects
            FOR SELECT
            TO authenticated
            USING (bucket_id = 'after_sales_files');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'after_sales_files_update_authenticated'
    ) THEN
        CREATE POLICY after_sales_files_update_authenticated
            ON storage.objects
            FOR UPDATE
            TO authenticated
            USING (bucket_id = 'after_sales_files')
            WITH CHECK (bucket_id = 'after_sales_files');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'after_sales_files_delete_authenticated'
    ) THEN
        CREATE POLICY after_sales_files_delete_authenticated
            ON storage.objects
            FOR DELETE
            TO authenticated
            USING (bucket_id = 'after_sales_files');
    END IF;
END $$;

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
