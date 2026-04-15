-- FMEA modülü UI: mevcut fmea_projects tablosuna ek alanlar (çalışma sayfası ile uyum)

ALTER TABLE public.fmea_projects
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS customer_names text[],
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS standard text DEFAULT 'AIAG_VDA',
  ADD COLUMN IF NOT EXISTS five_topics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS team_member_names text[] DEFAULT '{}';

COMMENT ON COLUMN public.fmea_projects.company_name IS 'Firma adı (FMEA kapak)';
COMMENT ON COLUMN public.fmea_projects.customer_names IS 'Müşteri adları (metin listesi)';
COMMENT ON COLUMN public.fmea_projects.team_member_names IS 'Ekip üyeleri (metin listesi; team_members UUID alanından ayrı)';
