-- Foreign Key Constraint Düzeltmeleri
-- spc_msa_studies tablosundaki foreign key constraint'leri güncelle

-- Önce mevcut constraint'i kaldır
ALTER TABLE spc_msa_studies 
DROP CONSTRAINT IF EXISTS spc_msa_studies_characteristic_id_fkey;

ALTER TABLE spc_msa_studies 
DROP CONSTRAINT IF EXISTS spc_msa_studies_measurement_equipment_id_fkey;

-- Yeni constraint'leri ON DELETE CASCADE ve ON DELETE SET NULL ile ekle
ALTER TABLE spc_msa_studies 
ADD CONSTRAINT spc_msa_studies_characteristic_id_fkey 
FOREIGN KEY (characteristic_id) 
REFERENCES spc_characteristics(id) 
ON DELETE CASCADE;

ALTER TABLE spc_msa_studies 
ADD CONSTRAINT spc_msa_studies_measurement_equipment_id_fkey 
FOREIGN KEY (measurement_equipment_id) 
REFERENCES equipments(id) 
ON DELETE SET NULL;

