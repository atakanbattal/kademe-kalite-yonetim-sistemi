-- FMEA modülü: PFMEA/DFMEA projeleri ve çalışma sayfası satırları

CREATE TABLE IF NOT EXISTS public.fmea_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  part_number text,
  part_name text,
  revision text,
  revision_date date,
  company_name text,
  customer_names text[] DEFAULT '{}',
  team_members text[] DEFAULT '{}',
  analysis_type text NOT NULL DEFAULT 'PFMEA' CHECK (analysis_type IN (
    'PFMEA', 'DFMEA', 'REVERSE_PFMEA', 'LFMEA', 'MFMEA', 'SFMEA', 'SWFMEA', 'UFMEA'
  )),
  standard text NOT NULL DEFAULT 'AIAG_VDA' CHECK (standard IN ('AIAG', 'VDA', 'AIAG_VDA')),
  notes text,
  five_topics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'taslak' CHECK (status IN ('taslak', 'aktif', 'arsiv')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fmea_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.fmea_projects(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  process_step text,
  function_text text,
  failure_mode text,
  effect text,
  severity int CHECK (severity IS NULL OR (severity >= 1 AND severity <= 10)),
  classification text,
  cause text,
  occurrence int CHECK (occurrence IS NULL OR (occurrence >= 1 AND occurrence <= 10)),
  current_prevention text,
  current_detection text,
  detection int CHECK (detection IS NULL OR (detection >= 1 AND detection <= 10)),
  rpn int,
  ap_level text CHECK (ap_level IS NULL OR ap_level IN ('HIGH', 'MEDIUM', 'LOW')),
  recommended_action text,
  responsible text,
  target_date date,
  actions_taken text,
  line_status text DEFAULT 'acik',
  s_after int CHECK (s_after IS NULL OR (s_after >= 1 AND s_after <= 10)),
  o_after int CHECK (o_after IS NULL OR (o_after >= 1 AND o_after <= 10)),
  d_after int CHECK (d_after IS NULL OR (d_after >= 1 AND d_after <= 10)),
  rpn_after int,
  ap_after text CHECK (ap_after IS NULL OR ap_after IN ('HIGH', 'MEDIUM', 'LOW')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmea_lines_project ON public.fmea_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_fmea_lines_sort ON public.fmea_lines(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fmea_projects_status ON public.fmea_projects(status);
CREATE INDEX IF NOT EXISTS idx_fmea_projects_updated ON public.fmea_projects(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_fmea_table_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fmea_projects_updated_at ON public.fmea_projects;
CREATE TRIGGER trg_fmea_projects_updated_at
  BEFORE UPDATE ON public.fmea_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_fmea_table_updated_at();

DROP TRIGGER IF EXISTS trg_fmea_lines_updated_at ON public.fmea_lines;
CREATE TRIGGER trg_fmea_lines_updated_at
  BEFORE UPDATE ON public.fmea_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_fmea_table_updated_at();

ALTER TABLE public.fmea_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fmea_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmea_projects_select_authenticated" ON public.fmea_projects;
DROP POLICY IF EXISTS "fmea_projects_insert_authenticated" ON public.fmea_projects;
DROP POLICY IF EXISTS "fmea_projects_update_authenticated" ON public.fmea_projects;
DROP POLICY IF EXISTS "fmea_projects_delete_authenticated" ON public.fmea_projects;

CREATE POLICY "fmea_projects_select_authenticated"
  ON public.fmea_projects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fmea_projects_insert_authenticated"
  ON public.fmea_projects FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "fmea_projects_update_authenticated"
  ON public.fmea_projects FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "fmea_projects_delete_authenticated"
  ON public.fmea_projects FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fmea_lines_select_authenticated" ON public.fmea_lines;
DROP POLICY IF EXISTS "fmea_lines_insert_authenticated" ON public.fmea_lines;
DROP POLICY IF EXISTS "fmea_lines_update_authenticated" ON public.fmea_lines;
DROP POLICY IF EXISTS "fmea_lines_delete_authenticated" ON public.fmea_lines;

CREATE POLICY "fmea_lines_select_authenticated"
  ON public.fmea_lines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fmea_lines_insert_authenticated"
  ON public.fmea_lines FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "fmea_lines_update_authenticated"
  ON public.fmea_lines FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "fmea_lines_delete_authenticated"
  ON public.fmea_lines FOR DELETE TO authenticated
  USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fmea_projects'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fmea_projects;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fmea_lines'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fmea_lines;
  END IF;
END $$;

COMMENT ON TABLE public.fmea_projects IS 'FMEA analiz projeleri (PFMEA, DFMEA vb.)';
COMMENT ON TABLE public.fmea_lines IS 'FMEA çalışma sayfası satırları';
