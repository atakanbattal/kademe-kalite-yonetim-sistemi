-- Stok Risk Kontrolü Status ve Tarih Alanları Ekleme
-- Bu migration stock_risk_controls tablosuna status, started_at ve completed_at alanlarını ekler

-- Status alanını ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_risk_controls' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE stock_risk_controls 
        ADD COLUMN status VARCHAR(50) DEFAULT 'Beklemede' 
        CHECK (status IN ('Beklemede', 'Başlatıldı', 'Devam Ediyor', 'Tamamlandı'));
    END IF;
END $$;

-- started_at alanını ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_risk_controls' 
        AND column_name = 'started_at'
    ) THEN
        ALTER TABLE stock_risk_controls 
        ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- completed_at alanını ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_risk_controls' 
        AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE stock_risk_controls 
        ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- notes alanını ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_risk_controls' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE stock_risk_controls 
        ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Mevcut kayıtların status'ünü güncelle
UPDATE stock_risk_controls 
SET status = 'Beklemede' 
WHERE status IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_stock_risk_controls_status ON stock_risk_controls(status);
CREATE INDEX IF NOT EXISTS idx_stock_risk_controls_started_at ON stock_risk_controls(started_at);
CREATE INDEX IF NOT EXISTS idx_stock_risk_controls_completed_at ON stock_risk_controls(completed_at);

