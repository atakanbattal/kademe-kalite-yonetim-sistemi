ALTER TABLE public.after_sales_vehicle_registry
ADD COLUMN IF NOT EXISTS production_date DATE;

CREATE TABLE IF NOT EXISTS public.after_sales_product_boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_category VARCHAR(100) NOT NULL,
    vehicle_model_code VARCHAR(100) NOT NULL,
    bom_name VARCHAR(255),
    revision_no INTEGER NOT NULL DEFAULT 1,
    revision_date DATE,
    effective_from DATE,
    effective_to DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT after_sales_product_boms_revision_unique UNIQUE (vehicle_category, vehicle_model_code, revision_no)
);

COMMENT ON TABLE public.after_sales_product_boms IS 'Satış sonrası ürün ağaçları ve BOM revizyonları.';
COMMENT ON COLUMN public.after_sales_product_boms.effective_from IS 'Bu BOM revizyonunun kullanılmaya başlandığı tarih.';
COMMENT ON COLUMN public.after_sales_product_boms.effective_to IS 'Revizyonun geçerliliğinin sona erdiği tarih.';

CREATE INDEX IF NOT EXISTS idx_after_sales_product_boms_model
    ON public.after_sales_product_boms(vehicle_category, vehicle_model_code);

CREATE INDEX IF NOT EXISTS idx_after_sales_product_boms_active
    ON public.after_sales_product_boms(is_active, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS public.after_sales_part_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_code VARCHAR(120) NOT NULL UNIQUE,
    current_part_name VARCHAR(255) NOT NULL,
    base_unit VARCHAR(50) DEFAULT 'Adet',
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    critical_stock_level NUMERIC(12,2) NOT NULL DEFAULT 0,
    min_lead_time_days INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_part_master IS 'Satış sonrası parça ana kartları ve SSH depo stok özetleri.';

CREATE TABLE IF NOT EXISTS public.after_sales_part_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES public.after_sales_part_master(id) ON DELETE CASCADE,
    revision_no VARCHAR(50) NOT NULL,
    revision_date DATE,
    part_name VARCHAR(255) NOT NULL,
    specification_summary TEXT,
    dimension_summary TEXT,
    change_summary TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT after_sales_part_revisions_unique UNIQUE (part_id, revision_no)
);

COMMENT ON TABLE public.after_sales_part_revisions IS 'Parça kartlarına bağlı revizyon kayıtları.';

CREATE INDEX IF NOT EXISTS idx_after_sales_part_revisions_part
    ON public.after_sales_part_revisions(part_id, revision_date DESC);

CREATE TABLE IF NOT EXISTS public.after_sales_bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES public.after_sales_product_boms(id) ON DELETE CASCADE,
    part_id UUID REFERENCES public.after_sales_part_master(id) ON DELETE SET NULL,
    part_revision_id UUID REFERENCES public.after_sales_part_revisions(id) ON DELETE SET NULL,
    part_code VARCHAR(120),
    part_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Adet',
    level INTEGER NOT NULL DEFAULT 1,
    parent_part_code VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_bom_items IS 'Satış sonrası ürün ağaçlarına bağlı parça kalemleri.';
COMMENT ON COLUMN public.after_sales_bom_items.level IS 'Ürün ağacındaki seviye bilgisi.';
COMMENT ON COLUMN public.after_sales_bom_items.parent_part_code IS 'Üst kalem referansı.';

CREATE INDEX IF NOT EXISTS idx_after_sales_bom_items_bom
    ON public.after_sales_bom_items(bom_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_bom_items_code
    ON public.after_sales_bom_items(part_code);

CREATE INDEX IF NOT EXISTS idx_after_sales_bom_items_name
    ON public.after_sales_bom_items(part_name);

ALTER TABLE public.after_sales_service_operation_parts
ADD COLUMN IF NOT EXISTS part_id UUID REFERENCES public.after_sales_part_master(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS part_revision_id UUID REFERENCES public.after_sales_part_revisions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.after_sales_part_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES public.after_sales_part_master(id) ON DELETE CASCADE,
    part_revision_id UUID REFERENCES public.after_sales_part_revisions(id) ON DELETE SET NULL,
    movement_type VARCHAR(80) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    reference_operation_id UUID REFERENCES public.after_sales_service_operations(id) ON DELETE SET NULL,
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.after_sales_part_stock_movements IS 'SSH depo stok hareket kayıtları.';

CREATE INDEX IF NOT EXISTS idx_after_sales_part_stock_movements_part
    ON public.after_sales_part_stock_movements(part_id, created_at DESC);

ALTER TABLE public.after_sales_product_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_part_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_part_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_sales_part_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_table TEXT;
BEGIN
    FOREACH policy_table IN ARRAY ARRAY[
        'after_sales_product_boms',
        'after_sales_bom_items',
        'after_sales_part_master',
        'after_sales_part_revisions',
        'after_sales_part_stock_movements'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
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
            SELECT 1
            FROM pg_policies
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
            SELECT 1
            FROM pg_policies
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
            SELECT 1
            FROM pg_policies
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
