-- Süreç Akış Şemaları modülü — birim / akış / adım / doküman bağlantıları

CREATE TABLE IF NOT EXISTS public.process_flow_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    subtitle text,
    owner_role text,
    roles text,
    purpose text,
    is_ideal_process boolean NOT NULL DEFAULT false,
    key_document_codes text[] NOT NULL DEFAULT '{}'::text[],
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.process_flows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL REFERENCES public.process_flow_units(id) ON DELETE CASCADE,
    title text NOT NULL,
    intro text,
    header_document_codes text[] NOT NULL DEFAULT '{}'::text[],
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_process_flows_unit_id ON public.process_flows(unit_id);

CREATE TABLE IF NOT EXISTS public.process_flow_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id uuid NOT NULL REFERENCES public.process_flows(id) ON DELETE CASCADE,
    step_type text NOT NULL CHECK (step_type IN ('start', 'process', 'subprocess', 'io', 'decision', 'end', 'note')),
    text text NOT NULL DEFAULT '',
    role text,
    decision_question text,
    decision_yes_text text,
    decision_no_text text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_process_flow_steps_flow_id ON public.process_flow_steps(flow_id);

CREATE TABLE IF NOT EXISTS public.process_flow_step_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id uuid NOT NULL REFERENCES public.process_flow_steps(id) ON DELETE CASCADE,
    document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
    document_code text NOT NULL,
    section_ref text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_process_flow_step_documents_step_id ON public.process_flow_step_documents(step_id);
CREATE INDEX IF NOT EXISTS idx_process_flow_step_documents_document_id ON public.process_flow_step_documents(document_id);

CREATE OR REPLACE FUNCTION public.set_process_flow_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_flow_units_updated_at ON public.process_flow_units;
CREATE TRIGGER trg_process_flow_units_updated_at
    BEFORE UPDATE ON public.process_flow_units
    FOR EACH ROW EXECUTE FUNCTION public.set_process_flow_updated_at();

DROP TRIGGER IF EXISTS trg_process_flows_updated_at ON public.process_flows;
CREATE TRIGGER trg_process_flows_updated_at
    BEFORE UPDATE ON public.process_flows
    FOR EACH ROW EXECUTE FUNCTION public.set_process_flow_updated_at();

DROP TRIGGER IF EXISTS trg_process_flow_steps_updated_at ON public.process_flow_steps;
CREATE TRIGGER trg_process_flow_steps_updated_at
    BEFORE UPDATE ON public.process_flow_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_process_flow_updated_at();

ALTER TABLE public.process_flow_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_flow_step_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfu_select" ON public.process_flow_units;
CREATE POLICY "pfu_select" ON public.process_flow_units FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pff_select" ON public.process_flows;
CREATE POLICY "pff_select" ON public.process_flows FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pfs_select" ON public.process_flow_steps;
CREATE POLICY "pfs_select" ON public.process_flow_steps FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pfsd_select" ON public.process_flow_step_documents;
CREATE POLICY "pfsd_select" ON public.process_flow_step_documents FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfu_write" ON public.process_flow_units;
CREATE POLICY "pfu_write" ON public.process_flow_units FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pff_write" ON public.process_flows;
CREATE POLICY "pff_write" ON public.process_flows FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pfs_write" ON public.process_flow_steps;
CREATE POLICY "pfs_write" ON public.process_flow_steps FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pfsd_write" ON public.process_flow_step_documents;
CREATE POLICY "pfsd_write" ON public.process_flow_step_documents FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.process_flow_units IS 'KYS birim süreç akış şemaları — birim düzeyi meta veri';
COMMENT ON TABLE public.process_flows IS 'Birim altındaki alt akışlar (A/B/C …)';
COMMENT ON TABLE public.process_flow_steps IS 'Akış adımları: başlangıç, işlem, karar, bitiş vb.';
COMMENT ON TABLE public.process_flow_step_documents IS 'Adım–doküman (PR/TL/FR/SM) bağlantıları';
