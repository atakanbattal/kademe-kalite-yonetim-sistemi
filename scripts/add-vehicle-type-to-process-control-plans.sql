-- Process Control Plans tablosuna vehicle_type kolonu ekle
ALTER TABLE process_control_plans 
ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(255);

-- Mevcut equipment_id'leri vehicle_type'a çevir (eğer process_control_equipment tablosunda equipment_type varsa)
-- Bu migration sadece kolonu ekler, veri migrasyonu gerekirse ayrı bir script ile yapılabilir

COMMENT ON COLUMN process_control_plans.vehicle_type IS 'Araç tipi (products tablosundan)';

