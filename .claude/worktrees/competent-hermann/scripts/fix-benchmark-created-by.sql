-- BENCHMARK CREATED_BY KOLONU HIZLI ÇÖZÜM
-- Supabase Dashboard > SQL Editor'de çalıştırın

-- 1. benchmarks tablosuna created_by kolonu ekle
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmarks') THEN
        ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'benchmarks.created_by eklendi';
    END IF;
END $$;

-- 2. benchmark_pros_cons tablosuna created_by kolonu ekle (tablo varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmark_pros_cons') THEN
        ALTER TABLE benchmark_pros_cons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'benchmark_pros_cons.created_by eklendi';
    ELSE
        RAISE NOTICE 'benchmark_pros_cons tablosu mevcut değil, atlanıyor';
    END IF;
END $$;

-- 3. benchmark_documents tablosuna uploaded_by kolonu ekle (tablo varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmark_documents') THEN
        ALTER TABLE benchmark_documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'benchmark_documents.uploaded_by eklendi';
    ELSE
        RAISE NOTICE 'benchmark_documents tablosu mevcut değil, atlanıyor';
    END IF;
END $$;

-- 4. benchmark_activity_log tablosuna performed_by kolonu ekle (tablo varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmark_activity_log') THEN
        ALTER TABLE benchmark_activity_log ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'benchmark_activity_log.performed_by eklendi';
    ELSE
        RAISE NOTICE 'benchmark_activity_log tablosu mevcut değil, atlanıyor';
    END IF;
END $$;

-- 5. benchmark_reports tablosuna generated_by kolonu ekle (tablo varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmark_reports') THEN
        ALTER TABLE benchmark_reports ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'benchmark_reports.generated_by eklendi';
    ELSE
        RAISE NOTICE 'benchmark_reports tablosu mevcut değil, atlanıyor';
    END IF;
END $$;

-- 6. İndeks ekle (performans için)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmarks') THEN
        CREATE INDEX IF NOT EXISTS idx_benchmarks_created_by ON benchmarks(created_by);
        RAISE NOTICE 'idx_benchmarks_created_by indeksi eklendi';
    END IF;
END $$;

-- Tamamlandı!
SELECT 'Benchmark created_by kolonları başarıyla eklendi!' as sonuc;


