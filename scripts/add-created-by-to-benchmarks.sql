-- ============================================================================
-- BENCHMARK TABLOLARINA CREATED_BY KOLONU EKLEME
-- ============================================================================
-- Bu script benchmarks ve diğer benchmark tablolarına created_by kolonunu ekler

-- 1. benchmarks tablosuna created_by kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benchmarks' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE benchmarks 
        ADD COLUMN created_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'created_by kolonu benchmarks tablosuna eklendi';
    ELSE
        RAISE NOTICE 'created_by kolonu zaten mevcut';
    END IF;
END $$;

-- 2. benchmark_pros_cons tablosuna created_by kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benchmark_pros_cons' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE benchmark_pros_cons 
        ADD COLUMN created_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'created_by kolonu benchmark_pros_cons tablosuna eklendi';
    ELSE
        RAISE NOTICE 'created_by kolonu benchmark_pros_cons tablosunda zaten mevcut';
    END IF;
END $$;

-- 3. benchmark_documents tablosuna uploaded_by kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benchmark_documents' 
        AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE benchmark_documents 
        ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'uploaded_by kolonu benchmark_documents tablosuna eklendi';
    ELSE
        RAISE NOTICE 'uploaded_by kolonu benchmark_documents tablosunda zaten mevcut';
    END IF;
END $$;

-- 4. benchmark_activity_log tablosuna performed_by kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benchmark_activity_log' 
        AND column_name = 'performed_by'
    ) THEN
        ALTER TABLE benchmark_activity_log 
        ADD COLUMN performed_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'performed_by kolonu benchmark_activity_log tablosuna eklendi';
    ELSE
        RAISE NOTICE 'performed_by kolonu benchmark_activity_log tablosunda zaten mevcut';
    END IF;
END $$;

-- 5. benchmark_reports tablosuna generated_by kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benchmark_reports' 
        AND column_name = 'generated_by'
    ) THEN
        ALTER TABLE benchmark_reports 
        ADD COLUMN generated_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'generated_by kolonu benchmark_reports tablosuna eklendi';
    ELSE
        RAISE NOTICE 'generated_by kolonu benchmark_reports tablosunda zaten mevcut';
    END IF;
END $$;

-- 6. İndeksleri ekle (performans için)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_benchmarks_created_by'
    ) THEN
        CREATE INDEX idx_benchmarks_created_by ON benchmarks(created_by);
        RAISE NOTICE 'idx_benchmarks_created_by indeksi oluşturuldu';
    END IF;
END $$;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BENCHMARK TABLOLARI GÜNCELLEME TAMAMLANDI';
    RAISE NOTICE '============================================================================';
END $$;

