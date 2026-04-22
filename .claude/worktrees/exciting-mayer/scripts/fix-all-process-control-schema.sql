-- ============================================================================
-- Process Control Modülü Tüm Şema Düzeltmeleri
-- Eksiklikleri ve uyumsuzlukları düzeltir
-- ============================================================================

-- 1. process_control_plans tablosunda equipment_id'yi nullable yap
ALTER TABLE process_control_plans 
ALTER COLUMN equipment_id DROP NOT NULL;

-- 2. vehicle_type kolonunu ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'process_control_plans' 
        AND column_name = 'vehicle_type'
    ) THEN
        ALTER TABLE process_control_plans 
        ADD COLUMN vehicle_type VARCHAR(255);
    END IF;
END $$;

-- 3. process_control_documents tablosunda equipment_id'yi nullable yap
ALTER TABLE process_control_documents 
ALTER COLUMN equipment_id DROP NOT NULL;

-- vehicle_type kolonunu ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'process_control_documents' 
        AND column_name = 'vehicle_type'
    ) THEN
        ALTER TABLE process_control_documents 
        ADD COLUMN vehicle_type VARCHAR(255);
    END IF;
END $$;

-- 4. process_control_notes tablosunda equipment_id'yi nullable yap
ALTER TABLE process_control_notes 
ALTER COLUMN equipment_id DROP NOT NULL;

-- vehicle_type kolonunu ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'process_control_notes' 
        AND column_name = 'vehicle_type'
    ) THEN
        ALTER TABLE process_control_notes 
        ADD COLUMN vehicle_type VARCHAR(255);
    END IF;
END $$;

-- 5. İndeksler ekle
CREATE INDEX IF NOT EXISTS idx_process_control_plans_vehicle_type ON process_control_plans(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_process_control_documents_vehicle_type ON process_control_documents(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_vehicle_type ON process_control_notes(vehicle_type);

-- 6. Yorumlar ekle
COMMENT ON COLUMN process_control_plans.equipment_id IS 'Process control equipment ID (opsiyonel, vehicle_type kullanılıyorsa null olabilir)';
COMMENT ON COLUMN process_control_plans.vehicle_type IS 'Araç tipi (products tablosundan) - equipment_id veya vehicle_type biri mutlaka olmalı';
COMMENT ON COLUMN process_control_documents.equipment_id IS 'Process control equipment ID (opsiyonel, vehicle_type kullanılıyorsa null olabilir)';
COMMENT ON COLUMN process_control_documents.vehicle_type IS 'Araç tipi (products tablosundan)';
COMMENT ON COLUMN process_control_notes.equipment_id IS 'Process control equipment ID (opsiyonel, vehicle_type kullanılıyorsa null olabilir)';
COMMENT ON COLUMN process_control_notes.vehicle_type IS 'Araç tipi (products tablosundan)';

