-- Process Control Plans tablosuna revision_notes kolonu ekle
ALTER TABLE process_control_plans 
ADD COLUMN IF NOT EXISTS revision_notes TEXT;

COMMENT ON COLUMN process_control_plans.revision_notes IS 'Revizyon notları - revizyon yapıldığında buraya not eklenir';

