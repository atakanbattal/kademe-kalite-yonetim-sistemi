-- Produced Vehicles modülünden kalitesizlik maliyeti entegrasyonu için veritabanı güncellemeleri
-- Bu script Supabase SQL editöründe çalıştırılmalıdır

-- 1. Quality Costs tablosuna kaynak bilgileri ekle
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS source_record_id UUID;

-- 2. Quality control duration kolonu ekle (eğer yoksa)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS quality_control_duration INTEGER;

-- 3. Yorumlar ekle
COMMENT ON COLUMN quality_costs.source_type IS 'Kaynak tipi: produced_vehicle, incoming_inspection, manual, vb.';
COMMENT ON COLUMN quality_costs.source_record_id IS 'Kaynak kayıt ID referansı (quality_inspections tablosu için)';
COMMENT ON COLUMN quality_costs.quality_control_duration IS 'Kalite kontrol süresi (dakika cinsinden)';

-- 4. İndeksler ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_quality_costs_source ON quality_costs(source_type, source_record_id);
CREATE INDEX IF NOT EXISTS idx_quality_costs_quality_control_duration ON quality_costs(quality_control_duration);

-- 5. Mevcut kayıtları güncelle (varsayılan: manuel)
UPDATE quality_costs
SET source_type = 'manual'
WHERE source_type IS NULL;

