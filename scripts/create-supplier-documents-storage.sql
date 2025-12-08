-- ====================================================
-- Tedarikçi Dokümanları Storage Bucket ve Policies
-- ====================================================
-- Bu migration supplier_documents bucket'ını ve gerekli politikaları oluşturur
-- ====================================================

-- Not: Storage bucket'ları Supabase Dashboard'dan oluşturulmalı
-- Bu SQL sadece referans içindir

-- 1. Storage Bucket Oluşturma (Supabase Dashboard'dan yapılmalı)
-- Bucket adı: supplier_documents
-- Public: false (sadece authenticated users)
-- File size limit: 50 MB
-- Allowed MIME types: image/*, video/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation, text/*, application/json

-- 2. Storage Policies (RLS)

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
-- Not: Storage bucket'ı Supabase Dashboard'dan oluşturun:
-- 1. Storage → Create Bucket
-- 2. Bucket name: supplier_documents
-- 3. Public: false
-- 4. File size limit: 50 MB
-- 5. Policies yukarıdaki SQL ile oluşturulacak
-- ====================================================

