-- FMEA: uygulama ayarları (eşik değerler) ve kontrol planı takip kayıtları

-- Tek satır ayarlar (id = 1)
CREATE TABLE IF NOT EXISTS public.fmea_app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rpn_action_threshold int NOT NULL DEFAULT 100,
  rpn_after_action_threshold int,
  alert_on_ap_high boolean NOT NULL DEFAULT true,
  alert_on_ap_medium boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.fmea_app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.fmea_app_settings IS 'FMEA modülü global eşikler (tek satır id=1)';
COMMENT ON COLUMN public.fmea_app_settings.rpn_after_action_threshold IS 'NULL ise rpn_action_threshold ile aynı kabul edilir';

-- FMEA satırlarına kontrol planı entegrasyon notu
ALTER TABLE public.fmea_lines
  ADD COLUMN IF NOT EXISTS cp_integration_note text;

COMMENT ON COLUMN public.fmea_lines.cp_integration_note IS 'Karakteristik/ölçüm veya KP ile ilgili serbest not (kontrol planı uyarısı için)';

-- Kontrol planı takip kayıtları

CREATE TABLE IF NOT EXISTS public.fmea_control_plan_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.fmea_projects(id) ON DELETE CASCADE,
  line_id uuid REFERENCES public.fmea_lines(id) ON DELETE SET NULL,
  trigger_type text NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('rpn_threshold', 'rpn_after_threshold', 'ap_high', 'ap_medium', 'cp_note', 'manual')),
  control_plan_kind text NOT NULL CHECK (control_plan_kind IN ('incoming', 'process')),
  control_plan_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  note text,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmea_cp_followups_project ON public.fmea_control_plan_followups(project_id);
CREATE INDEX IF NOT EXISTS idx_fmea_cp_followups_status ON public.fmea_control_plan_followups(status);

CREATE OR REPLACE FUNCTION public.set_fmea_cp_followups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fmea_cp_followups_updated_at ON public.fmea_control_plan_followups;
CREATE TRIGGER trg_fmea_cp_followups_updated_at
  BEFORE UPDATE ON public.fmea_control_plan_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_fmea_cp_followups_updated_at();

ALTER TABLE public.fmea_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fmea_control_plan_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmea_app_settings_select" ON public.fmea_app_settings;
DROP POLICY IF EXISTS "fmea_app_settings_update" ON public.fmea_app_settings;
DROP POLICY IF EXISTS "fmea_app_settings_insert" ON public.fmea_app_settings;

CREATE POLICY "fmea_app_settings_select"
  ON public.fmea_app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "fmea_app_settings_insert"
  ON public.fmea_app_settings FOR INSERT TO authenticated WITH CHECK (id = 1);

CREATE POLICY "fmea_app_settings_update"
  ON public.fmea_app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fmea_cp_followups_select" ON public.fmea_control_plan_followups;
DROP POLICY IF EXISTS "fmea_cp_followups_insert" ON public.fmea_control_plan_followups;
DROP POLICY IF EXISTS "fmea_cp_followups_update" ON public.fmea_control_plan_followups;
DROP POLICY IF EXISTS "fmea_cp_followups_delete" ON public.fmea_control_plan_followups;

CREATE POLICY "fmea_cp_followups_select"
  ON public.fmea_control_plan_followups FOR SELECT TO authenticated USING (true);

CREATE POLICY "fmea_cp_followups_insert"
  ON public.fmea_control_plan_followups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "fmea_cp_followups_update"
  ON public.fmea_control_plan_followups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fmea_cp_followups_delete"
  ON public.fmea_control_plan_followups FOR DELETE TO authenticated USING (true);
