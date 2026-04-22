-- ====================================================
-- Tedarikçi Doküman Yönetimi - TAM MIGRATION
-- ====================================================
-- Bu migration tedarikçi doküman yönetimi için gerekli tüm yapıları oluşturur
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
-- Storage Bucket ve Policies
-- ====================================================
-- Not: Storage bucket'ı Supabase Dashboard'dan oluşturun:
-- 1. Storage → Create Bucket
-- 2. Bucket name: supplier_documents
-- 3. Public: false
-- 4. File size limit: 50 MB
-- 5. Allowed MIME types: image/*, video/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation, text/*, application/json
-- ====================================================

-- Storage Policies (RLS) - Bucket oluşturulduktan sonra çalıştırın

-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload supplier documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'supplier_documents' AND
    (storage.foldername(name))[1] = 'suppliers'
);

-- Authenticated users can read files
CREATE POLICY "Authenticated users can read supplier documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'supplier_documents'
);

-- Authenticated users can update files (sadece kendi yükledikleri)
CREATE POLICY "Authenticated users can update supplier documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'supplier_documents' AND
    owner = auth.uid()
)
WITH CHECK (
    bucket_id = 'supplier_documents' AND
    owner = auth.uid()
);

-- Authenticated users can delete files (sadece kendi yükledikleri)
CREATE POLICY "Authenticated users can delete supplier documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'supplier_documents' AND
    owner = auth.uid()
);

-- ====================================================
-- Migration Tamamlandı!
-- ====================================================
-- Yapılacaklar:
-- 1. Bu SQL'i Supabase Dashboard'da çalıştırın
-- 2. Storage → Create Bucket → supplier_documents oluşturun
-- 3. Storage policies yukarıdaki SQL ile oluşturulacak
-- ====================================================

