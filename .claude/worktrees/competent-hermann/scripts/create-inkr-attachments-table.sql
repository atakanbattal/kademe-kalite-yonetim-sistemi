-- ====================================================
-- INKR Ekleri Tablosu
-- ====================================================
-- Bu migration INKR raporlarına eklenen dosyaları saklamak için tablo oluşturur
-- ====================================================

-- 1. inkr_attachments tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.inkr_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inkr_report_id UUID NOT NULL REFERENCES public.inkr_reports(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100), -- MIME type (application/pdf, image/jpeg, vb.)
    file_size BIGINT, -- bytes
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Index'ler oluştur
CREATE INDEX IF NOT EXISTS idx_inkr_attachments_inkr_report_id ON public.inkr_attachments(inkr_report_id);
CREATE INDEX IF NOT EXISTS idx_inkr_attachments_uploaded_at ON public.inkr_attachments(uploaded_at DESC);

-- 3. RLS Politikaları
ALTER TABLE public.inkr_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inkr_attachments_select" ON public.inkr_attachments
    FOR SELECT USING (true);

CREATE POLICY "inkr_attachments_insert" ON public.inkr_attachments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "inkr_attachments_update" ON public.inkr_attachments
    FOR UPDATE USING (true);

CREATE POLICY "inkr_attachments_delete" ON public.inkr_attachments
    FOR DELETE USING (true);

COMMENT ON TABLE public.inkr_attachments IS 'INKR raporlarına eklenen dosyalar';

