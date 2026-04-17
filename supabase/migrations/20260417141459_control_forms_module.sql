-- =============================================================
-- KONTROL FORMLARI MODÜLÜ
-- Şablonlar, bölümler, maddeler, revizyonlar ve dolum kayıtları
-- =============================================================

-- 1) Ana şablon tablosu
CREATE TABLE IF NOT EXISTS public.control_form_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    publish_date date DEFAULT CURRENT_DATE,
    revision_no integer NOT NULL DEFAULT 0,
    revision_date date DEFAULT CURRENT_DATE,
    references_text text,
    product_ids uuid[] DEFAULT '{}'::uuid[],
    header_fields jsonb DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.control_form_templates IS 'Kontrol formu şablonları. product_ids array: bu şablon birden fazla araç tipine uygulanabilir.';
COMMENT ON COLUMN public.control_form_templates.header_fields IS 'Şablona özel üstbilgi alanları [{key, label, type}] - örn: Marka, Tipi, Modeli, Şase No, Motor No, Emisyon Sınıfı';

-- 2) Bölümler / Kategoriler
CREATE TABLE IF NOT EXISTS public.control_form_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.control_form_templates(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_form_sections_template_id ON public.control_form_sections(template_id);

-- 3) Maddeler
CREATE TABLE IF NOT EXISTS public.control_form_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES public.control_form_sections(id) ON DELETE CASCADE,
    text text NOT NULL,
    item_type text NOT NULL DEFAULT 'visual' CHECK (item_type IN ('visual', 'measurement')),
    reference_value text,
    unit text,
    measurement_equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
    measurement_equipment_name text,
    is_required boolean NOT NULL DEFAULT true,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_form_items_section_id ON public.control_form_items(section_id);
COMMENT ON COLUMN public.control_form_items.item_type IS 'visual: KABUL/RET seçimi | measurement: ölçüm aleti + referans değer + ölçülen değer';

-- 4) Revizyon geçmişi (auto snapshot)
CREATE TABLE IF NOT EXISTS public.control_form_template_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.control_form_templates(id) ON DELETE CASCADE,
    revision_no integer NOT NULL,
    revision_date date NOT NULL DEFAULT CURRENT_DATE,
    changes_summary text,
    snapshot jsonb NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, revision_no)
);
CREATE INDEX IF NOT EXISTS idx_control_form_template_revisions_template ON public.control_form_template_revisions(template_id, revision_no DESC);

-- 5) Doldurulmuş form kayıtları
CREATE TABLE IF NOT EXISTS public.control_form_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.control_form_templates(id) ON DELETE RESTRICT,
    template_revision_no integer NOT NULL,
    execution_no text UNIQUE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text,
    serial_number text,
    chassis_no text,
    customer text,
    inspection_date date DEFAULT CURRENT_DATE,
    shipment_date date,
    header_data jsonb DEFAULT '{}'::jsonb,
    result text CHECK (result IN ('ONAY', 'SARTLI_KABUL', 'RET', NULL)),
    result_date date,
    inspector_name text,
    inspector_notes text,
    missing_items text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_form_executions_template ON public.control_form_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_control_form_executions_serial ON public.control_form_executions(serial_number);

-- 6) Dolum sonuç satırları
CREATE TABLE IF NOT EXISTS public.control_form_execution_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id uuid NOT NULL REFERENCES public.control_form_executions(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.control_form_items(id) ON DELETE SET NULL,
    section_name text NOT NULL,
    item_text text NOT NULL,
    item_type text NOT NULL,
    reference_value text,
    measured_value text,
    result text CHECK (result IN ('accept', 'reject', NULL)),
    notes text,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_form_execution_results_execution ON public.control_form_execution_results(execution_id);

-- =============================================================
-- Yardımcı fonksiyonlar & trigger'lar
-- =============================================================

CREATE OR REPLACE FUNCTION public.generate_control_form_document_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num integer;
    candidate text;
BEGIN
    SELECT COALESCE(MAX(
        CASE WHEN document_no ~ ('^KAL-FR-' || current_year || '-[0-9]{4}$')
        THEN (split_part(document_no, '-', 4))::int ELSE 0 END), 0) + 1
    INTO next_num
    FROM public.control_form_templates;
    candidate := 'KAL-FR-' || current_year || '-' || lpad(next_num::text, 4, '0');
    RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_control_form_execution_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num integer;
BEGIN
    SELECT COALESCE(MAX(
        CASE WHEN execution_no ~ ('^CF-' || current_year || '-[0-9]{4}$')
        THEN (split_part(execution_no, '-', 3))::int ELSE 0 END), 0) + 1
    INTO next_num
    FROM public.control_form_executions;
    RETURN 'CF-' || current_year || '-' || lpad(next_num::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_control_form_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_control_form_templates ON public.control_form_templates;
CREATE TRIGGER set_updated_at_control_form_templates BEFORE UPDATE ON public.control_form_templates
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_control_form_sections ON public.control_form_sections;
CREATE TRIGGER set_updated_at_control_form_sections BEFORE UPDATE ON public.control_form_sections
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_control_form_items ON public.control_form_items;
CREATE TRIGGER set_updated_at_control_form_items BEFORE UPDATE ON public.control_form_items
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_control_form_executions ON public.control_form_executions;
CREATE TRIGGER set_updated_at_control_form_executions BEFORE UPDATE ON public.control_form_executions
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_control_form_templates_bi()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.document_no IS NULL OR NEW.document_no = '' THEN
        NEW.document_no := public.generate_control_form_document_no();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_document_no_control_form_templates ON public.control_form_templates;
CREATE TRIGGER set_document_no_control_form_templates BEFORE INSERT ON public.control_form_templates
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_templates_bi();

CREATE OR REPLACE FUNCTION public.tg_control_form_executions_bi()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.execution_no IS NULL OR NEW.execution_no = '' THEN
        NEW.execution_no := public.generate_control_form_execution_no();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_execution_no_control_form_executions ON public.control_form_executions;
CREATE TRIGGER set_execution_no_control_form_executions BEFORE INSERT ON public.control_form_executions
    FOR EACH ROW EXECUTE FUNCTION public.tg_control_form_executions_bi();

-- =============================================================
-- Revizyon bump RPC
-- =============================================================
CREATE OR REPLACE FUNCTION public.bump_control_form_template_revision(
    p_template_id uuid,
    p_changes_summary text DEFAULT NULL
)
RETURNS TABLE(revision_no integer, revision_date date)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_rev integer;
    v_snapshot jsonb;
BEGIN
    SELECT jsonb_build_object(
        'template', to_jsonb(t),
        'sections', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'section', to_jsonb(s),
                    'items', COALESCE((
                        SELECT jsonb_agg(to_jsonb(i) ORDER BY i.order_index)
                        FROM public.control_form_items i WHERE i.section_id = s.id
                    ), '[]'::jsonb)
                ) ORDER BY s.order_index
            )
            FROM public.control_form_sections s WHERE s.template_id = t.id
        ), '[]'::jsonb)
    ) INTO v_snapshot
    FROM public.control_form_templates t
    WHERE t.id = p_template_id;

    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'Şablon bulunamadı: %', p_template_id;
    END IF;

    UPDATE public.control_form_templates AS t
    SET revision_no = t.revision_no + 1,
        revision_date = CURRENT_DATE
    WHERE t.id = p_template_id
    RETURNING t.revision_no INTO v_new_rev;

    INSERT INTO public.control_form_template_revisions (template_id, revision_no, revision_date, changes_summary, snapshot, created_by)
    VALUES (p_template_id, v_new_rev, CURRENT_DATE, p_changes_summary, v_snapshot, auth.uid());

    RETURN QUERY SELECT v_new_rev, CURRENT_DATE;
END;
$$;

-- =============================================================
-- Toplu madde ekleme RPC
-- =============================================================
CREATE OR REPLACE FUNCTION public.bulk_add_item_to_templates(
    p_template_ids uuid[],
    p_section_name text,
    p_item_text text,
    p_item_type text DEFAULT 'visual',
    p_reference_value text DEFAULT NULL,
    p_unit text DEFAULT NULL,
    p_measurement_equipment_id uuid DEFAULT NULL,
    p_measurement_equipment_name text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template_id uuid;
    v_section_id uuid;
    v_max_order integer;
    v_max_item_order integer;
    v_affected integer := 0;
BEGIN
    FOREACH v_template_id IN ARRAY p_template_ids LOOP
        SELECT id INTO v_section_id
        FROM public.control_form_sections
        WHERE template_id = v_template_id AND name = p_section_name
        LIMIT 1;

        IF v_section_id IS NULL THEN
            SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_max_order
            FROM public.control_form_sections WHERE template_id = v_template_id;
            INSERT INTO public.control_form_sections (template_id, name, order_index)
            VALUES (v_template_id, p_section_name, v_max_order)
            RETURNING id INTO v_section_id;
        END IF;

        SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_max_item_order
        FROM public.control_form_items WHERE section_id = v_section_id;

        INSERT INTO public.control_form_items (
            section_id, text, item_type, reference_value, unit,
            measurement_equipment_id, measurement_equipment_name, order_index
        ) VALUES (
            v_section_id, p_item_text, p_item_type, p_reference_value, p_unit,
            p_measurement_equipment_id, p_measurement_equipment_name, v_max_item_order
        );

        PERFORM public.bump_control_form_template_revision(v_template_id, 'Toplu ekleme: ' || p_item_text);

        v_affected := v_affected + 1;
    END LOOP;
    RETURN v_affected;
END;
$$;

-- =============================================================
-- RLS politikaları
-- =============================================================
ALTER TABLE public.control_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_form_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_form_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_form_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_form_execution_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cft_select" ON public.control_form_templates;
CREATE POLICY "cft_select" ON public.control_form_templates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfs_select" ON public.control_form_sections;
CREATE POLICY "cfs_select" ON public.control_form_sections FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfi_select" ON public.control_form_items;
CREATE POLICY "cfi_select" ON public.control_form_items FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cftr_select" ON public.control_form_template_revisions;
CREATE POLICY "cftr_select" ON public.control_form_template_revisions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfe_select" ON public.control_form_executions;
CREATE POLICY "cfe_select" ON public.control_form_executions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfer_select" ON public.control_form_execution_results;
CREATE POLICY "cfer_select" ON public.control_form_execution_results FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cft_write" ON public.control_form_templates;
CREATE POLICY "cft_write" ON public.control_form_templates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfs_write" ON public.control_form_sections;
CREATE POLICY "cfs_write" ON public.control_form_sections FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfi_write" ON public.control_form_items;
CREATE POLICY "cfi_write" ON public.control_form_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cftr_write" ON public.control_form_template_revisions;
CREATE POLICY "cftr_write" ON public.control_form_template_revisions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfe_write" ON public.control_form_executions;
CREATE POLICY "cfe_write" ON public.control_form_executions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cfer_write" ON public.control_form_execution_results;
CREATE POLICY "cfer_write" ON public.control_form_execution_results FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

GRANT EXECUTE ON FUNCTION public.generate_control_form_document_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_control_form_execution_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_control_form_template_revision(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_add_item_to_templates(uuid[], text, text, text, text, text, uuid, text) TO authenticated;
