-- Müşteri Şikayetleri Yönetim Sistemi - Veritabanı Tabloları
-- Bu script Supabase SQL editöründe çalıştırılmalıdır

-- 1. Müşteriler Tablosu
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_type VARCHAR(50) NOT NULL, -- 'OEM', 'Tier1', 'Tier2', 'Perakende', 'Diğer'
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Türkiye',
    tax_number VARCHAR(50),
    contract_start_date DATE,
    contract_end_date DATE,
    annual_revenue DECIMAL(15, 2),
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Müşteri Şikayetleri Tablosu
CREATE TABLE IF NOT EXISTS customer_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    complaint_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Şikayet Bilgileri
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    complaint_source VARCHAR(100), -- 'Email', 'Telefon', 'Portal', 'Saha Ziyareti', 'Diğer'
    complaint_category VARCHAR(100), -- 'Ürün Kalitesi', 'Teslimat', 'Dokümantasyon', 'Hizmet', 'Diğer'
    severity VARCHAR(50) NOT NULL DEFAULT 'Orta', -- 'Kritik', 'Yüksek', 'Orta', 'Düşük'
    
    -- Ürün/Parça Bilgileri
    product_code VARCHAR(100),
    product_name VARCHAR(255),
    batch_number VARCHAR(100),
    quantity_affected INTEGER,
    production_date DATE,
    
    -- Sorumluluk
    responsible_department_id UUID REFERENCES cost_settings(id),
    responsible_person_id UUID REFERENCES personnel(id),
    assigned_to_id UUID REFERENCES personnel(id),
    
    -- Durum Takibi
    status VARCHAR(50) NOT NULL DEFAULT 'Açık', -- 'Açık', 'Analiz Aşamasında', 'Aksiyon Alınıyor', 'Doğrulama Bekleniyor', 'Kapalı', 'İptal'
    priority VARCHAR(50) NOT NULL DEFAULT 'Normal', -- 'Acil', 'Yüksek', 'Normal', 'Düşük'
    
    -- Tarihler
    target_close_date DATE,
    actual_close_date DATE,
    
    -- Müşteri Etkisi
    customer_impact TEXT,
    financial_impact DECIMAL(15, 2),
    
    -- İlişkili Kayıtlar
    related_nc_id UUID REFERENCES non_conformities(id),
    related_deviation_id UUID REFERENCES deviations(id),
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Şikayet Analizleri Tablosu (5N1K, Balık Kılçığı, 5 Neden)
CREATE TABLE IF NOT EXISTS complaint_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES customer_complaints(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- '5N1K', 'Balık Kılçığı', '5 Neden', 'FMEA', 'Diğer'
    
    -- 5N1K Analizi
    what_ne TEXT, -- Ne oldu?
    where_nerede TEXT, -- Nerede oldu?
    when_ne_zaman TEXT, -- Ne zaman oldu?
    who_kim TEXT, -- Kim tespit etti / sorumlu?
    why_neden TEXT, -- Neden oldu?
    how_nasil TEXT, -- Nasıl tespit edildi / çözüldü?
    
    -- Balık Kılçığı Analizi (Ishikawa Diagram)
    fishbone_method JSONB, -- İnsan (Man)
    fishbone_machine JSONB, -- Makine (Machine)
    fishbone_material JSONB, -- Malzeme (Material)
    fishbone_measurement JSONB, -- Ölçüm (Measurement)
    fishbone_environment JSONB, -- Çevre (Environment)
    fishbone_management JSONB, -- Yönetim (Management/Mother Nature)
    
    -- 5 Neden Analizi (5 Why)
    why_1 TEXT,
    why_2 TEXT,
    why_3 TEXT,
    why_4 TEXT,
    why_5 TEXT,
    root_cause TEXT, -- Kök neden
    
    -- Analiz Sonuçları
    analysis_summary TEXT,
    immediate_action TEXT, -- Anlık aksiyon
    preventive_action TEXT, -- Önleyici aksiyon
    
    -- Analizci Bilgileri
    analyzed_by UUID REFERENCES personnel(id),
    analysis_date TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Şikayet Aksiyonları Tablosu
CREATE TABLE IF NOT EXISTS complaint_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES customer_complaints(id) ON DELETE CASCADE,
    
    action_type VARCHAR(50) NOT NULL, -- 'Anlık Aksiyon', 'Düzeltici Aksiyon', 'Önleyici Aksiyon', 'İyileştirme'
    action_title VARCHAR(255) NOT NULL,
    action_description TEXT NOT NULL,
    
    -- Sorumluluk
    responsible_person_id UUID REFERENCES personnel(id),
    responsible_department_id UUID REFERENCES cost_settings(id),
    
    -- Tarihler
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_completion_date DATE,
    
    -- Durum
    status VARCHAR(50) NOT NULL DEFAULT 'Planlandı', -- 'Planlandı', 'Devam Ediyor', 'Tamamlandı', 'İptal', 'Ertelendi'
    completion_percentage INTEGER DEFAULT 0,
    
    -- Etkinlik Değerlendirmesi
    effectiveness_verified BOOLEAN DEFAULT false,
    effectiveness_verification_date DATE,
    effectiveness_notes TEXT,
    verified_by UUID REFERENCES personnel(id),
    
    -- Maliyet
    estimated_cost DECIMAL(15, 2),
    actual_cost DECIMAL(15, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Şikayet Dokümanları Tablosu
CREATE TABLE IF NOT EXISTS complaint_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES customer_complaints(id) ON DELETE CASCADE,
    
    document_type VARCHAR(100) NOT NULL, -- 'Şikayet Formu', 'Fotoğraf', 'Rapor', '8D Raporu', 'Test Sonucu', 'Email', 'Diğer'
    document_name VARCHAR(255) NOT NULL,
    document_description TEXT,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_type VARCHAR(50), -- 'pdf', 'jpg', 'png', 'xlsx', 'docx', etc.
    file_size INTEGER, -- Bytes
    
    uploaded_by UUID REFERENCES personnel(id),
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Müşteri İletişim Geçmişi Tablosu
CREATE TABLE IF NOT EXISTS customer_communication_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES customer_complaints(id) ON DELETE CASCADE,
    
    communication_type VARCHAR(50) NOT NULL, -- 'Email', 'Telefon', 'Toplantı', 'Ziyaret', 'Diğer'
    communication_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contact_person VARCHAR(255),
    subject VARCHAR(500),
    notes TEXT NOT NULL,
    
    communicated_by UUID REFERENCES personnel(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Müşteri Skorları/Değerlendirmeleri
CREATE TABLE IF NOT EXISTS customer_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    evaluation_period VARCHAR(50), -- '2024-Q1', '2024-01', etc.
    
    -- Skorlar
    total_complaints INTEGER DEFAULT 0,
    critical_complaints INTEGER DEFAULT 0,
    resolved_complaints INTEGER DEFAULT 0,
    avg_resolution_days DECIMAL(5, 2),
    
    -- Kalite Metrikleri
    on_time_delivery_rate DECIMAL(5, 2), -- %
    quality_score DECIMAL(5, 2), -- 0-100
    customer_satisfaction_score DECIMAL(5, 2), -- 0-100
    
    -- Finansal
    total_financial_impact DECIMAL(15, 2),
    
    notes TEXT,
    evaluated_by UUID REFERENCES personnel(id),
    evaluation_date TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, evaluation_period)
);

-- İndeksler (Performans için)
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_active ON customers(is_active);
CREATE INDEX idx_complaints_customer ON customer_complaints(customer_id);
CREATE INDEX idx_complaints_status ON customer_complaints(status);
CREATE INDEX idx_complaints_date ON customer_complaints(complaint_date);
CREATE INDEX idx_complaints_severity ON customer_complaints(severity);
CREATE INDEX idx_analyses_complaint ON complaint_analyses(complaint_id);
CREATE INDEX idx_actions_complaint ON complaint_actions(complaint_id);
CREATE INDEX idx_actions_status ON complaint_actions(status);
CREATE INDEX idx_documents_complaint ON complaint_documents(complaint_id);
CREATE INDEX idx_communication_complaint ON customer_communication_history(complaint_id);
CREATE INDEX idx_scores_customer ON customer_scores(customer_id);

-- Row Level Security (RLS) Politikaları
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_communication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_scores ENABLE ROW LEVEL SECURITY;

-- Tüm authenticated kullanıcılar okuyabilir
CREATE POLICY "Enable read access for authenticated users" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON customer_complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON complaint_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON complaint_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON complaint_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON customer_communication_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON customer_scores FOR SELECT TO authenticated USING (true);

-- Authenticated kullanıcılar ekleyebilir/güncelleyebilir/silebilir
CREATE POLICY "Enable insert for authenticated users" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON customers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customer_complaints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON customer_complaints FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON customer_complaints FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON complaint_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON complaint_analyses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON complaint_analyses FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON complaint_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON complaint_actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON complaint_actions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON complaint_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON complaint_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON complaint_documents FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customer_communication_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON customer_communication_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON customer_communication_history FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customer_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON customer_scores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON customer_scores FOR DELETE TO authenticated USING (true);

-- Otomatik güncellenen updated_at trigger'ları
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_complaints_updated_at BEFORE UPDATE ON customer_complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_complaint_analyses_updated_at BEFORE UPDATE ON complaint_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_complaint_actions_updated_at BEFORE UPDATE ON complaint_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Şikayet numarası otomatik oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    current_year := TO_CHAR(NOW(), 'YYYY');
    
    -- Bu yıl için en son şikayet numarasını bul
    SELECT COALESCE(MAX(CAST(SUBSTRING(complaint_number FROM 'CS-' || current_year || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM customer_complaints
    WHERE complaint_number LIKE 'CS-' || current_year || '-%';
    
    new_number := 'CS-' || current_year || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Şikayet oluşturulurken otomatik numara atama
CREATE OR REPLACE FUNCTION set_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.complaint_number IS NULL OR NEW.complaint_number = '' THEN
        NEW.complaint_number := generate_complaint_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_complaint_number
BEFORE INSERT ON customer_complaints
FOR EACH ROW
EXECUTE FUNCTION set_complaint_number();

-- Storage bucket oluşturma (Supabase Dashboard'dan da yapılabilir)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('complaint_attachments', 'complaint_attachments', false);

-- Storage policy (bucket oluşturulduktan sonra)
-- CREATE POLICY "Authenticated users can upload complaint attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'complaint_attachments');
-- CREATE POLICY "Authenticated users can view complaint attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'complaint_attachments');
-- CREATE POLICY "Authenticated users can update complaint attachments" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'complaint_attachments');
-- CREATE POLICY "Authenticated users can delete complaint attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'complaint_attachments');

-- Başarıyla tamamlandı
SELECT 'Müşteri Şikayetleri Yönetim Sistemi tabloları başarıyla oluşturuldu!' AS message;
