-- Quality Costs Tablosuna Kolonları Zorla Ekle
-- Bu script kolonları kesinlikle ekler ve cache'i yeniler

-- 1. Kolonları ekle (IF NOT EXISTS ile güvenli)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS quality_control_duration INTEGER;

-- 2. Yorumlar ekle
COMMENT ON COLUMN quality_costs.source_type IS 'Kaynak tipi: produced_vehicle, incoming_inspection, manual, vb.';
COMMENT ON COLUMN quality_costs.source_record_id IS 'Kaynak kayıt ID referansı (quality_inspections tablosu için)';
COMMENT ON COLUMN quality_costs.quality_control_duration IS 'Kalite kontrol süresi (dakika cinsinden)';

-- 3. İndeksler oluştur (IF NOT EXISTS ile güvenli)
CREATE INDEX IF NOT EXISTS idx_quality_costs_source ON quality_costs(source_type, source_record_id);
CREATE INDEX IF NOT EXISTS idx_quality_costs_quality_control_duration ON quality_costs(quality_control_duration);

-- 4. Mevcut kayıtları güncelle (varsayılan: manuel)
UPDATE quality_costs
SET source_type = 'manual'
WHERE source_type IS NULL;

-- 5. Schema cache'i yenilemek için bir sorgu çalıştır
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quality_costs' 
AND column_name IN ('source_type', 'source_record_id', 'quality_control_duration');

