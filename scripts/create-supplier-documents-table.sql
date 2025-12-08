-- ====================================================
-- Tedarikçi Doküman Yönetimi Tablosu
-- ====================================================
-- Bu migration tedarikçilerden gelen tüm dokümanları saklamak için tablo oluşturur
-- ====================================================

-- 1. supplier_documents tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.supplier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- Aksiyon Planı, Kalite Belgesi, Test Raporu, Görsel, vb.
    document_name VARCHAR(500) NOT NULL,
    document_description TEXT,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50), -- pdf, jpg, png, docx, xlsx, vb.
    file_size BIGINT, -- bytes
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date DATE, -- Geçerlilik tarihi (opsiyonel)
    status VARCHAR(50) DEFAULT 'Aktif', -- Aktif, Arşiv, İptal
    tags TEXT[], -- Etiketler (arama için)
    related_nc_id UUID REFERENCES public.non_conformities(id) ON DELETE SET NULL, -- İlgili uygunsuzluk
    related_audit_id UUID REFERENCES public.supplier_audit_plans(id) ON DELETE SET NULL, -- İlgili denetim
    metadata JSONB, -- Ek bilgiler (JSON formatında)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Index'ler oluştur
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON public.supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_document_type ON public.supplier_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_status ON public.supplier_documents(status);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_uploaded_at ON public.supplier_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_related_nc ON public.supplier_documents(related_nc_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_related_audit ON public.supplier_documents(related_audit_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_tags ON public.supplier_documents USING GIN(tags);

-- 3. updated_at trigger'ı
CREATE OR REPLACE FUNCTION update_supplier_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supplier_documents_updated_at ON public.supplier_documents;
CREATE TRIGGER trigger_update_supplier_documents_updated_at
    BEFORE UPDATE ON public.supplier_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_documents_updated_at();

-- 4. RLS Policies
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all supplier documents
CREATE POLICY "Authenticated users can read supplier documents"
    ON public.supplier_documents
    FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert supplier documents
CREATE POLICY "Authenticated users can insert supplier documents"
    ON public.supplier_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can update supplier documents
CREATE POLICY "Authenticated users can update supplier documents"
    ON public.supplier_documents
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Authenticated users can delete supplier documents
CREATE POLICY "Authenticated users can delete supplier documents"
    ON public.supplier_documents
    FOR DELETE
    TO authenticated
    USING (true);

-- 5. Kolon açıklamaları
COMMENT ON TABLE public.supplier_documents IS 'Tedarikçilerden gelen tüm dokümanlar, raporlar, belgeler ve görseller';
COMMENT ON COLUMN public.supplier_documents.document_type IS 'Doküman tipi: Aksiyon Planı, Kalite Belgesi, Test Raporu, Görsel, Denetim Raporu, vb.';
COMMENT ON COLUMN public.supplier_documents.tags IS 'Dokümanları kategorize etmek için etiketler';
COMMENT ON COLUMN public.supplier_documents.metadata IS 'Ek bilgiler (JSON formatında)';
COMMENT ON COLUMN public.supplier_documents.related_nc_id IS 'İlgili uygunsuzluk kaydı (varsa)';
COMMENT ON COLUMN public.supplier_documents.related_audit_id IS 'İlgili denetim kaydı (varsa)';

-- ====================================================
-- Migration Tamamlandı!
-- ====================================================

