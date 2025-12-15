-- ============================================================================
-- PROSES KONTROL YÖNETİMİ MODÜLÜ
-- Üretim araçlarının dokümanları, kontrol planları ve kalite bulgularını yönetim sistemi
-- ============================================================================

-- ============================================================================
-- 1. Proses Kontrol Araçları (Equipment/Tools)
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_control_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_code VARCHAR(100) UNIQUE NOT NULL,
    equipment_name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100), -- 'Araç', 'Kalıp', 'Fixture', 'Jig', 'Diğer'
    description TEXT,
    
    -- Lokasyon ve Sorumluluk
    location VARCHAR(255),
    responsible_unit VARCHAR(100),
    responsible_person_id UUID REFERENCES personnel(id),
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Aktif', -- 'Aktif', 'Bakımda', 'Hurdaya Ayrıldı', 'Arşiv'
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE process_control_equipment IS 'Proses kontrol araçları (kalıp, fixture, jig, vb.)';

-- ============================================================================
-- 2. Proses Kontrol Dokümanları
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_control_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES process_control_equipment(id) ON DELETE CASCADE,
    
    -- Doküman Bilgileri
    document_type VARCHAR(100) NOT NULL, -- 'Teknik Resim', 'Kontrol Planı', 'İş Talimatı', 'Diğer'
    document_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    revision_number INTEGER DEFAULT 0,
    revision_date DATE,
    
    -- Dosya Bilgileri
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50), -- 'PDF', 'DWG', 'DXF', 'DOCX', vb.
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    
    -- Meta
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE process_control_documents IS 'Proses kontrol araçlarına ait dokümanlar';

-- ============================================================================
-- 3. Proses Kontrol Planları
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_control_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES process_control_equipment(id) ON DELETE CASCADE,
    
    -- Plan Bilgileri
    plan_name VARCHAR(255) NOT NULL,
    part_code VARCHAR(100),
    part_name VARCHAR(255),
    revision_number INTEGER DEFAULT 0,
    revision_date TIMESTAMPTZ,
    
    -- Kontrol Planı İçeriği (JSONB - girdi kontrolündeki gibi)
    items JSONB DEFAULT '[]'::jsonb,
    
    -- Dosya Bilgileri (onaylı plan PDF'i)
    file_path TEXT,
    file_name VARCHAR(255),
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE process_control_plans IS 'Proses kontrol planları (girdi kontrolündeki gibi yapı)';
COMMENT ON COLUMN process_control_plans.items IS 'Kontrol planı maddeleri (JSONB array) - her item: characteristic_id, equipment_id, standard_id, tolerance_class, nominal_value, min_value, max_value, tolerance_direction';

-- ============================================================================
-- 4. Proses Kontrol Notları
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_control_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES process_control_equipment(id) ON DELETE CASCADE,
    
    -- Not Tipi
    note_type VARCHAR(50) NOT NULL, -- 'Teknik Resim Notu', 'Parça Kodu Notu', 'Genel Not'
    
    -- Not Bilgileri
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Parça Bilgileri (parça kodlu notlar için)
    part_code VARCHAR(100),
    part_name VARCHAR(255),
    
    -- Teknik Resim Bilgileri (teknik resim notları için)
    document_id UUID REFERENCES process_control_documents(id),
    drawing_revision VARCHAR(50), -- Resim revizyonu
    drawing_location TEXT, -- Resim üzerindeki konum/bölge
    
    -- Durum ve Öncelik
    status VARCHAR(50) DEFAULT 'Açık', -- 'Açık', 'İnceleniyor', 'Çözüldü', 'Kapatıldı'
    priority VARCHAR(50) DEFAULT 'Normal', -- 'Kritik', 'Yüksek', 'Normal', 'Düşük'
    
    -- İlişkili Uygunsuzluk
    related_nc_id UUID REFERENCES non_conformities(id),
    
    -- Ekler
    attachments TEXT[], -- Dosya yolları array
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE process_control_notes IS 'Proses kontrol notları (teknik resim notları ve parça kodlu notlar)';

-- ============================================================================
-- 5. İndeksler
-- ============================================================================

-- Process Control Equipment
CREATE INDEX IF NOT EXISTS idx_process_control_equipment_code ON process_control_equipment(equipment_code);
CREATE INDEX IF NOT EXISTS idx_process_control_equipment_status ON process_control_equipment(status);
CREATE INDEX IF NOT EXISTS idx_process_control_equipment_responsible ON process_control_equipment(responsible_person_id);

-- Process Control Documents
CREATE INDEX IF NOT EXISTS idx_process_control_documents_equipment ON process_control_documents(equipment_id);
CREATE INDEX IF NOT EXISTS idx_process_control_documents_type ON process_control_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_process_control_documents_active ON process_control_documents(is_active);

-- Process Control Plans
CREATE INDEX IF NOT EXISTS idx_process_control_plans_equipment ON process_control_plans(equipment_id);
CREATE INDEX IF NOT EXISTS idx_process_control_plans_part_code ON process_control_plans(part_code);
CREATE INDEX IF NOT EXISTS idx_process_control_plans_active ON process_control_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_process_control_plans_items ON process_control_plans USING GIN (items);

-- Process Control Notes
CREATE INDEX IF NOT EXISTS idx_process_control_notes_equipment ON process_control_notes(equipment_id);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_type ON process_control_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_part_code ON process_control_notes(part_code);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_status ON process_control_notes(status);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_created ON process_control_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_control_notes_nc ON process_control_notes(related_nc_id);

-- ============================================================================
-- 6. RLS (Row Level Security) Politikaları
-- ============================================================================

-- Process Control Equipment
ALTER TABLE process_control_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar proses kontrol araçlarını görebilir"
    ON process_control_equipment FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol araçları ekleyebilir"
    ON process_control_equipment FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol araçlarını güncelleyebilir"
    ON process_control_equipment FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol araçlarını silebilir"
    ON process_control_equipment FOR DELETE
    USING (auth.role() = 'authenticated');

-- Process Control Documents
ALTER TABLE process_control_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar proses kontrol dokümanlarını görebilir"
    ON process_control_documents FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol dokümanları ekleyebilir"
    ON process_control_documents FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol dokümanlarını güncelleyebilir"
    ON process_control_documents FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol dokümanlarını silebilir"
    ON process_control_documents FOR DELETE
    USING (auth.role() = 'authenticated');

-- Process Control Plans
ALTER TABLE process_control_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar proses kontrol planlarını görebilir"
    ON process_control_plans FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol planları ekleyebilir"
    ON process_control_plans FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol planlarını güncelleyebilir"
    ON process_control_plans FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol planlarını silebilir"
    ON process_control_plans FOR DELETE
    USING (auth.role() = 'authenticated');

-- Process Control Notes
ALTER TABLE process_control_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar proses kontrol notlarını görebilir"
    ON process_control_notes FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol notları ekleyebilir"
    ON process_control_notes FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol notlarını güncelleyebilir"
    ON process_control_notes FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Kullanıcılar proses kontrol notlarını silebilir"
    ON process_control_notes FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- 7. Storage Bucket Oluşturma (Supabase Dashboard'dan manuel yapılmalı)
-- ============================================================================
-- Storage bucket: 'process_control'
-- Public: false
-- Allowed MIME types: application/pdf, image/*, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

