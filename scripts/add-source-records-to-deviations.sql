-- Sapma Onaylarına Kaynak Kayıt Referansı Ekleme
-- Bu script Supabase SQL editöründe çalıştırılmalıdır

-- 1. Kaynak tipi kolonu ekle
ALTER TABLE deviations
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

-- 2. Kaynak kayıt ID'si kolonu ekle
ALTER TABLE deviations
ADD COLUMN IF NOT EXISTS source_record_id UUID;

-- 3. Kaynak kayıt detayları (JSON) - Opsiyonel, hızlı erişim için
ALTER TABLE deviations
ADD COLUMN IF NOT EXISTS source_record_details JSONB;

-- 4. Yorumlar ekle
COMMENT ON COLUMN deviations.source_type IS 'Kaynak kayıt tipi: incoming_inspection, quarantine, quality_cost, leak_test, dynamic_balance, produced_vehicle_fault, customer_complaint, fixture_nonconformity, manual';
COMMENT ON COLUMN deviations.source_record_id IS 'İlgili kayıt ID referansı (girdi, üretim ve kalite modüllerindeki kaynak kayıtlar)';
COMMENT ON COLUMN deviations.source_record_details IS 'Kaynak kayıt detayları (part_code, quantity, supplier vb.)';

-- 5. İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_deviations_source ON deviations(source_type, source_record_id);

-- 6. Mevcut kayıtları güncelle (varsayılan: manuel)
UPDATE deviations
SET source_type = 'manual'
WHERE source_type IS NULL;

-- 6b. Eski veya desteklenmeyen source_type değerlerini güvenli şekilde normalize et
UPDATE deviations
SET
    source_record_details = jsonb_strip_nulls(
        COALESCE(source_record_details, '{}'::jsonb) ||
        jsonb_build_object('legacy_source_type', source_type)
    ),
    source_type = 'manual'
WHERE source_type IS NOT NULL
  AND (
      btrim(source_type) = ''
      OR source_type NOT IN (
          'incoming_inspection',
          'quarantine',
          'quality_cost',
          'leak_test',
          'dynamic_balance',
          'produced_vehicle_fault',
          'customer_complaint',
          'fixture_nonconformity',
          'manual'
      )
  );

-- 7. Check constraint ekle (sadece valid source_type değerlerine izin ver)
ALTER TABLE deviations
ADD CONSTRAINT check_valid_source_type
CHECK (source_type IN (
    'incoming_inspection',
    'quarantine',
    'quality_cost',
    'leak_test',
    'dynamic_balance',
    'produced_vehicle_fault',
    'customer_complaint',
    'fixture_nonconformity',
    'manual'
) OR source_type IS NULL);
