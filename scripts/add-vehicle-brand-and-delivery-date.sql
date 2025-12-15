-- quality_inspections tablosuna vehicle_brand ve delivery_due_date sütunlarını ekle

-- Marka sütunu (belirli araç tipleri için)
ALTER TABLE quality_inspections 
ADD COLUMN IF NOT EXISTS vehicle_brand VARCHAR(50);

-- Termin tarihi sütunu
ALTER TABLE quality_inspections 
ADD COLUMN IF NOT EXISTS delivery_due_date DATE;

-- Yorumlar
COMMENT ON COLUMN quality_inspections.vehicle_brand IS 'Araç markası (FORD, OTOKAR, ISUZU, MERCEDES, MITSUBISHI, IVECO)';
COMMENT ON COLUMN quality_inspections.delivery_due_date IS 'Sevk termin tarihi';

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_quality_inspections_delivery_due_date ON quality_inspections(delivery_due_date);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_vehicle_brand ON quality_inspections(vehicle_brand);
