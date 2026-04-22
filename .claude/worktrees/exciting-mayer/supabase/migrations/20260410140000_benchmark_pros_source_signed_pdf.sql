-- Otomatik üretilen avantaj/dezavantaj satırlarını ayırt etmek için
ALTER TABLE benchmark_pros_cons ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
COMMENT ON COLUMN benchmark_pros_cons.source IS 'manual | auto';

UPDATE benchmark_pros_cons SET source = 'manual' WHERE source IS NULL;

-- Onaylı benchmark için imzalı PDF (storage path)
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS approval_signed_pdf_path TEXT;
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS approval_signed_pdf_name TEXT;
COMMENT ON COLUMN benchmarks.approval_signed_pdf_path IS 'documents bucket: benchmark-documents/...';
COMMENT ON COLUMN benchmarks.approval_signed_pdf_name IS 'Orijinal dosya adı';
