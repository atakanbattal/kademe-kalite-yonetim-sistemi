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
