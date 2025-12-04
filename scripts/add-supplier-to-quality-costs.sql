-- Quality Costs tablosuna tedarikçi ilişkisi ve eksik kolonlar ekleme
-- Bu script Supabase SQL editöründe çalıştırılmalıdır

-- 1. Tedarikçi ID kolonu ekle (Foreign Key)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. Tedarikçi uygunsuzluğu flag'i ekle
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS is_supplier_nc BOOLEAN DEFAULT false;

-- 3. Sorumlu personel ID kolonu ekle (eğer yoksa)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS responsible_personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL;

-- 4. İndeksler ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_quality_costs_supplier_id ON quality_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quality_costs_responsible_personnel_id ON quality_costs(responsible_personnel_id);

-- 5. Mevcut kayıtları güncelle (varsayılan değerler)
UPDATE quality_costs 
SET is_supplier_nc = false 
WHERE is_supplier_nc IS NULL;

-- 6. Yorumlar ekle
COMMENT ON COLUMN quality_costs.supplier_id IS 'Tedarikçi kaynaklı maliyet ise tedarikçi ID referansı';
COMMENT ON COLUMN quality_costs.is_supplier_nc IS 'Bu maliyet kaydı tedarikçi hatasından mı kaynaklanıyor?';
COMMENT ON COLUMN quality_costs.responsible_personnel_id IS 'Yeniden işlem için sorumlu personel referansı';

