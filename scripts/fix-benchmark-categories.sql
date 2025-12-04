-- Benchmark Kategorilerini Kontrol Et ve Düzelt

-- Önce mevcut kategorileri kontrol et
SELECT * FROM benchmark_categories ORDER BY order_index;

-- Eğer boşsa, varsayılan kategorileri ekle
INSERT INTO benchmark_categories (name, description, color, icon, order_index, is_active) 
VALUES
    ('Ürün Karşılaştırma', 'Ürün özellikleri ve performans kıyaslamaları', '#3B82F6', 'Package', 1, true),
    ('Süreç Karşılaştırma', 'İş süreçleri ve metodoloji kıyaslamaları', '#10B981', 'Workflow', 2, true),
    ('Teknoloji Karşılaştırma', 'Teknoloji ve yazılım çözümleri kıyaslamaları', '#F59E0B', 'Cpu', 3, true),
    ('Tedarikçi Karşılaştırma', 'Tedarikçi kalite ve maliyet kıyaslamaları', '#8B5CF6', 'Truck', 4, true),
    ('Ekipman Karşılaştırma', 'Makine ve ekipman yatırım kıyaslamaları', '#EF4444', 'Settings', 5, true),
    ('Malzeme Karşılaştırma', 'Hammadde ve malzeme alternatif kıyaslamaları', '#06B6D4', 'Box', 6, true)
ON CONFLICT DO NOTHING;

-- Kategorileri tekrar göster
SELECT 
    id,
    name,
    description,
    color,
    icon,
    order_index,
    is_active,
    created_at
FROM benchmark_categories 
ORDER BY order_index;

-- Benchmark tablosunda is_active kontrolünü kaldıralım (opsiyonel)
-- Eğer is_active true olmayanlar varsa onları aktif yapalım
UPDATE benchmark_categories 
SET is_active = true 
WHERE is_active = false;

