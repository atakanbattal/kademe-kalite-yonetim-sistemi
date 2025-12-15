-- ============================================================================
-- ÜRÜN YÖNETİMİ MODÜLÜ
-- Merkezi ürün, araç tipi, parça kodu yönetimi
-- Tüm modüller buradan veri çekecek
-- ============================================================================

-- ============================================================================
-- 1. Ürün Kategorileri
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(100) UNIQUE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id),
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_categories IS 'Ürün kategorileri (Araç Tipleri, Parçalar, vb.)';

-- Varsayılan kategoriler
INSERT INTO product_categories (category_code, category_name, order_index) VALUES
    ('VEHICLE_TYPES', 'Araç Tipleri', 1),
    ('PARTS', 'Parçalar', 2),
    ('TOOLS', 'Araçlar', 3),
    ('MATERIALS', 'Malzemeler', 4)
ON CONFLICT (category_code) DO NOTHING;

-- ============================================================================
-- 2. Ürünler (Merkezi Ürün Tablosu)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
    
    -- Ürün Bilgileri
    description TEXT,
    specifications JSONB, -- Esnek özellikler: {"ağırlık": "500kg", "boyut": "100x200", vb.}
    
    -- Parça Bilgileri (parça kategorisi için)
    part_number VARCHAR(100), -- Parça numarası
    drawing_number VARCHAR(100), -- Teknik resim numarası
    revision VARCHAR(50), -- Revizyon
    
    -- Araç Tipi Bilgileri (araç tipi kategorisi için)
    vehicle_model VARCHAR(100), -- Model
    vehicle_year INTEGER, -- Yıl
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Merkezi ürün tablosu - tüm modüller buradan veri çeker';
COMMENT ON COLUMN products.category_id IS 'Ürün kategorisi (Araç Tipi, Parça, Araç, Malzeme)';
COMMENT ON COLUMN products.specifications IS 'Esnek özellikler JSONB formatında';

-- ============================================================================
-- 3. İndeksler
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_part_number ON products(part_number);
CREATE INDEX IF NOT EXISTS idx_products_vehicle_model ON products(vehicle_model);
CREATE INDEX IF NOT EXISTS idx_product_categories_code ON product_categories(category_code);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active);

-- ============================================================================
-- 4. RLS (Row Level Security) Politikaları
-- ============================================================================

-- Product Categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar ürün kategorilerini görebilir"
    ON product_categories FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürün kategorileri ekleyebilir"
    ON product_categories FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürün kategorilerini güncelleyebilir"
    ON product_categories FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürün kategorilerini silebilir"
    ON product_categories FOR DELETE
    USING (auth.role() = 'authenticated');

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar ürünleri görebilir"
    ON products FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürünler ekleyebilir"
    ON products FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürünleri güncelleyebilir"
    ON products FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar ürünleri silebilir"
    ON products FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. Varsayılan Veriler (Mevcut araç tiplerini ekle)
-- ============================================================================
-- Araç Tipleri kategorisindeki ürünleri ekle
INSERT INTO products (product_code, product_name, category_id)
SELECT 
    product_code,
    product_name,
    (SELECT id FROM product_categories WHERE category_code = 'VEHICLE_TYPES' LIMIT 1) as category_id
FROM (VALUES
    ('FTH-240', 'FTH-240'),
    ('Çelik-2000', 'Çelik-2000'),
    ('AGA2100', 'AGA2100'),
    ('AGA3000', 'AGA3000'),
    ('AGA6000', 'AGA6000'),
    ('Kompost Makinesi', 'Kompost Makinesi'),
    ('Çay Toplama Makinesi', 'Çay Toplama Makinesi'),
    ('KDM 35', 'KDM 35'),
    ('KDM 70', 'KDM 70'),
    ('KDM 80', 'KDM 80'),
    ('Rusya Motor Odası', 'Rusya Motor Odası'),
    ('Ural', 'Ural'),
    ('HSCK', 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)'),
    ('Traktör Kabin', 'Traktör Kabin'),
    ('Genel Hurda', 'Genel Hurda')
) AS v(product_code, product_name)
WHERE (SELECT id FROM product_categories WHERE category_code = 'VEHICLE_TYPES' LIMIT 1) IS NOT NULL
ON CONFLICT (product_code) DO NOTHING;

