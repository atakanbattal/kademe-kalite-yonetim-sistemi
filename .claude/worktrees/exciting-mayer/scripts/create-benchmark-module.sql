-- ============================================================================
-- BENCHMARK (KIYASLAMA) MODÜLÜ
-- Ürün, süreç, teknoloji ve tedarikçi karşılaştırmalarını yönetim sistemi
-- ============================================================================

-- ============================================================================
-- 1. Benchmark Kategorileri
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
    icon VARCHAR(50), -- Icon name (lucide-react)
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_categories IS 'Benchmark kategorileri (Ürün, Süreç, Teknoloji, Tedarikçi, vb.)';

-- Varsayılan kategoriler
INSERT INTO benchmark_categories (name, description, color, icon, order_index) VALUES
    ('Ürün Karşılaştırma', 'Ürün özellikleri ve performans kıyaslamaları', '#3B82F6', 'Package', 1),
    ('Süreç Karşılaştırma', 'İş süreçleri ve metodoloji kıyaslamaları', '#10B981', 'Workflow', 2),
    ('Teknoloji Karşılaştırma', 'Teknoloji ve yazılım çözümleri kıyaslamaları', '#F59E0B', 'Cpu', 3),
    ('Tedarikçi Karşılaştırma', 'Tedarikçi kalite ve maliyet kıyaslamaları', '#8B5CF6', 'Truck', 4),
    ('Ekipman Karşılaştırma', 'Makine ve ekipman yatırım kıyaslamaları', '#EF4444', 'Settings', 5),
    ('Malzeme Karşılaştırma', 'Hammadde ve malzeme alternatif kıyaslamaları', '#06B6D4', 'Box', 6)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Benchmark Ana Kayıtları
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_number VARCHAR(50) UNIQUE NOT NULL,
    category_id UUID NOT NULL REFERENCES benchmark_categories(id) ON DELETE RESTRICT,
    
    -- Temel Bilgiler
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    objective TEXT, -- Benchmark amacı
    scope TEXT, -- Kapsam
    
    -- Durum ve Öncelik
    status VARCHAR(50) NOT NULL DEFAULT 'Taslak', -- 'Taslak', 'Devam Ediyor', 'Analiz Aşamasında', 'Onay Bekliyor', 'Tamamlandı', 'İptal'
    priority VARCHAR(50) NOT NULL DEFAULT 'Normal', -- 'Kritik', 'Yüksek', 'Normal', 'Düşük'
    
    -- Sorumluluk
    owner_id UUID REFERENCES personnel(id), -- Benchmark sorumlusu
    department_id UUID REFERENCES cost_settings(id), -- İlgili departman
    team_members UUID[], -- Ekip üyeleri (personnel.id array)
    
    -- Tarihler
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    review_date DATE, -- Son değerlendirme tarihi
    
    -- Bütçe ve Maliyet
    estimated_budget DECIMAL(15, 2),
    actual_cost DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'TRY',
    
    -- Karar ve Sonuç
    final_decision TEXT, -- Nihai karar
    selected_option_id UUID, -- Seçilen alternatif (benchmark_items tablosundan)
    decision_rationale TEXT, -- Karar gerekçesi
    expected_benefits TEXT, -- Beklenen faydalar
    implementation_plan TEXT, -- Uygulama planı
    
    -- Onay Bilgileri
    approval_status VARCHAR(50) DEFAULT 'Bekliyor', -- 'Bekliyor', 'Onaylandı', 'Reddedildi', 'Revizyon Gerekli'
    approved_by UUID REFERENCES personnel(id),
    approval_date TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- İlişkili Kayıtlar
    related_nc_id UUID REFERENCES non_conformities(id),
    related_deviation_id UUID REFERENCES deviations(id),
    related_kaizen_id UUID REFERENCES kaizen_forms(id),
    
    -- Etiketler ve Notlar
    tags TEXT[], -- Anahtar kelimeler
    notes TEXT,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmarks IS 'Benchmark ana kayıtları - karşılaştırma projelerinin ana bilgileri';
COMMENT ON COLUMN benchmarks.team_members IS 'Benchmark ekibinde yer alan personel ID listesi';
COMMENT ON COLUMN benchmarks.selected_option_id IS 'Karşılaştırma sonucu seçilen alternatif';

-- ============================================================================
-- 3. Benchmark Alternatifleri/Öğeleri
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    
    -- Alternatif Bilgileri
    item_name VARCHAR(300) NOT NULL,
    item_code VARCHAR(100), -- Ürün/parça kodu
    description TEXT,
    supplier_id UUID REFERENCES suppliers(id), -- Tedarikçi (varsa)
    manufacturer VARCHAR(200), -- Üretici firma
    model_number VARCHAR(100), -- Model/seri numarası
    
    -- Teknik Özellikler (JSON olarak saklanacak)
    specifications JSONB, -- Esnek yapı: {"boyut": "100x200", "ağırlık": "5kg", vb.}
    
    -- Maliyet Bilgileri
    unit_price DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'TRY',
    minimum_order_quantity INTEGER,
    lead_time_days INTEGER, -- Tedarik süresi (gün)
    payment_terms VARCHAR(200), -- Ödeme koşulları
    
    -- Kalite ve Performans
    quality_score DECIMAL(5, 2), -- 0-100 arası
    performance_score DECIMAL(5, 2), -- 0-100 arası
    reliability_score DECIMAL(5, 2), -- 0-100 arası
    
    -- Sıralama ve Durum
    rank_order INTEGER DEFAULT 0, -- Sıralama (1, 2, 3...)
    is_current_solution BOOLEAN DEFAULT false, -- Mevcut çözüm mü?
    is_recommended BOOLEAN DEFAULT false, -- Önerilen seçenek mi?
    
    -- Notlar
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_items IS 'Benchmark alternatifleri - karşılaştırılan ürün/süreç/teknoloji seçenekleri';
COMMENT ON COLUMN benchmark_items.specifications IS 'Teknik özellikler JSON formatında';
COMMENT ON COLUMN benchmark_items.rank_order IS 'Genel sıralama (1=en iyi)';

-- ============================================================================
-- 4. Avantaj ve Dezavantajlar
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_pros_cons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_item_id UUID NOT NULL REFERENCES benchmark_items(id) ON DELETE CASCADE,
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('Avantaj', 'Dezavantaj')),
    category VARCHAR(100), -- 'Maliyet', 'Kalite', 'Teslimat', 'Teknik', 'Operasyonel', vb.
    description TEXT NOT NULL,
    impact_level VARCHAR(50), -- 'Kritik', 'Yüksek', 'Orta', 'Düşük'
    
    -- Kanıt ve Referanslar
    evidence TEXT, -- Kanıt açıklaması
    reference_documents UUID[], -- Doküman ID'leri
    
    -- Sıralama
    order_index INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_pros_cons IS 'Benchmark alternatifleri için avantaj ve dezavantajlar';
COMMENT ON COLUMN benchmark_pros_cons.reference_documents IS 'İlgili doküman ID listesi';

-- ============================================================================
-- 5. Karşılaştırma Kriterleri ve Skorlar
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    
    -- Kriter Bilgileri
    criterion_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'Maliyet', 'Kalite', 'Teknik', 'Operasyonel', 'Çevresel', vb.
    
    -- Ağırlıklandırma
    weight DECIMAL(5, 2) NOT NULL DEFAULT 1.0, -- Kriter ağırlığı (%)
    
    -- Ölçüm Yöntemi
    measurement_unit VARCHAR(50), -- 'TRY', 'Gün', 'Adet', 'Puan', vb.
    scoring_method VARCHAR(50) DEFAULT 'Numerical', -- 'Numerical', 'Rating', 'Binary', 'Text'
    min_value DECIMAL(15, 2), -- Minimum değer
    max_value DECIMAL(15, 2), -- Maximum değer
    target_value DECIMAL(15, 2), -- Hedef değer
    
    -- Sıralama
    order_index INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_criteria IS 'Benchmark değerlendirme kriterleri ve ağırlıkları';

-- ============================================================================
-- 6. Kriter Skorları
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_item_id UUID NOT NULL REFERENCES benchmark_items(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES benchmark_criteria(id) ON DELETE CASCADE,
    
    -- Skor Bilgileri
    raw_value DECIMAL(15, 2), -- Ham değer
    normalized_score DECIMAL(5, 2), -- Normalize edilmiş skor (0-100)
    weighted_score DECIMAL(5, 2), -- Ağırlıklı skor
    
    -- Değerlendirme
    rating VARCHAR(50), -- 'Mükemmel', 'İyi', 'Orta', 'Zayıf'
    notes TEXT,
    
    -- Değerlendirici
    evaluated_by UUID REFERENCES personnel(id),
    evaluation_date TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(benchmark_item_id, criterion_id)
);

COMMENT ON TABLE benchmark_scores IS 'Her alternatif için kriter bazlı skorlar';

-- ============================================================================
-- 7. Kanıt Dokümanları
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID REFERENCES benchmarks(id) ON DELETE CASCADE,
    benchmark_item_id UUID REFERENCES benchmark_items(id) ON DELETE CASCADE,
    
    -- Doküman Bilgileri
    document_type VARCHAR(100) NOT NULL, -- 'Teknik Şartname', 'Teklif', 'Test Raporu', 'Sertifika', 'Fotoğraf', 'Diğer'
    document_title VARCHAR(300) NOT NULL,
    description TEXT,
    
    -- Dosya Bilgileri
    file_path TEXT NOT NULL, -- Supabase storage path
    file_name VARCHAR(300) NOT NULL,
    file_type VARCHAR(50), -- MIME type
    file_size BIGINT, -- Bytes
    
    -- Metadata
    document_date DATE,
    document_number VARCHAR(100), -- Doküman numarası
    version VARCHAR(20), -- Versiyon
    
    -- Etiketler
    tags TEXT[],
    
    -- Yükleyen
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_documents IS 'Benchmark kanıt dokümanları ve ekleri';

-- ============================================================================
-- 8. Benchmark Onay Akışı
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    
    -- Onaylayıcı Bilgileri
    approver_id UUID NOT NULL REFERENCES personnel(id),
    approver_role VARCHAR(100), -- 'Kalite Müdürü', 'Genel Müdür', 'Satın Alma Müdürü', vb.
    approval_level INTEGER DEFAULT 1, -- Onay seviyesi (1, 2, 3...)
    
    -- Onay Durumu
    status VARCHAR(50) NOT NULL DEFAULT 'Bekliyor', -- 'Bekliyor', 'Onaylandı', 'Reddedildi', 'Revizyon İstendi'
    decision_date TIMESTAMPTZ,
    
    -- Yorum ve Notlar
    comments TEXT,
    conditions TEXT, -- Onay koşulları
    
    -- Bildirim
    notified_at TIMESTAMPTZ,
    reminder_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_approvals IS 'Benchmark onay akış tablosu';

-- ============================================================================
-- 9. Benchmark Aktivite Geçmişi
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    
    activity_type VARCHAR(100) NOT NULL, -- 'Oluşturuldu', 'Güncellendi', 'Durum Değişti', 'Alternatif Eklendi', 'Onaya Gönderildi', vb.
    description TEXT NOT NULL,
    
    -- Değişiklik Detayları
    old_value JSONB,
    new_value JSONB,
    
    -- Aktiviteyi Yapan
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_activity_log IS 'Benchmark kayıtları aktivite geçmişi';

-- ============================================================================
-- 10. Benchmark Karşılaştırma Raporları (Snapshot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS benchmark_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    
    -- Rapor Bilgileri
    report_number VARCHAR(50) UNIQUE NOT NULL,
    report_title VARCHAR(300) NOT NULL,
    report_type VARCHAR(50) DEFAULT 'Final', -- 'Taslak', 'Ara Rapor', 'Final'
    
    -- Rapor İçeriği (Snapshot - o anki durum)
    report_data JSONB NOT NULL, -- Tüm karşılaştırma verisi
    summary TEXT, -- Özet
    conclusions TEXT, -- Sonuçlar
    recommendations TEXT, -- Öneriler
    
    -- Grafik ve Görselleştirme Tercihleri
    chart_types TEXT[], -- 'radar', 'bar', 'table', vb.
    
    -- Oluşturan
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE benchmark_reports IS 'Benchmark karşılaştırma raporları (anlık durum kayıtları)';

-- ============================================================================
-- İndeksler (Performans Optimizasyonu)
-- ============================================================================
CREATE INDEX idx_benchmarks_status ON benchmarks(status);
CREATE INDEX idx_benchmarks_category ON benchmarks(category_id);
CREATE INDEX idx_benchmarks_owner ON benchmarks(owner_id);
CREATE INDEX idx_benchmarks_dates ON benchmarks(start_date, target_completion_date);
CREATE INDEX idx_benchmarks_approval_status ON benchmarks(approval_status);

CREATE INDEX idx_benchmark_items_benchmark ON benchmark_items(benchmark_id);
CREATE INDEX idx_benchmark_items_supplier ON benchmark_items(supplier_id);
CREATE INDEX idx_benchmark_items_recommended ON benchmark_items(is_recommended);

CREATE INDEX idx_benchmark_pros_cons_item ON benchmark_pros_cons(benchmark_item_id);
CREATE INDEX idx_benchmark_pros_cons_type ON benchmark_pros_cons(type);

CREATE INDEX idx_benchmark_criteria_benchmark ON benchmark_criteria(benchmark_id);
CREATE INDEX idx_benchmark_scores_item ON benchmark_scores(benchmark_item_id);
CREATE INDEX idx_benchmark_scores_criterion ON benchmark_scores(criterion_id);

CREATE INDEX idx_benchmark_documents_benchmark ON benchmark_documents(benchmark_id);
CREATE INDEX idx_benchmark_documents_item ON benchmark_documents(benchmark_item_id);

CREATE INDEX idx_benchmark_approvals_benchmark ON benchmark_approvals(benchmark_id);
CREATE INDEX idx_benchmark_approvals_approver ON benchmark_approvals(approver_id);
CREATE INDEX idx_benchmark_approvals_status ON benchmark_approvals(status);

CREATE INDEX idx_benchmark_activity_benchmark ON benchmark_activity_log(benchmark_id);
CREATE INDEX idx_benchmark_reports_benchmark ON benchmark_reports(benchmark_id);

-- ============================================================================
-- RLS (Row Level Security) Politikaları
-- ============================================================================
ALTER TABLE benchmark_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_pros_cons ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_reports ENABLE ROW LEVEL SECURITY;

-- Tüm authenticated kullanıcılar okuyabilir
CREATE POLICY "Allow read for authenticated users" ON benchmark_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_pros_cons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated users" ON benchmark_reports FOR SELECT TO authenticated USING (true);

-- Authenticated kullanıcılar ekleyebilir/güncelleyebilir
CREATE POLICY "Allow insert for authenticated users" ON benchmarks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmarks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmark_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_pros_cons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmark_pros_cons FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_criteria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmark_criteria FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmark_scores FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for authenticated users" ON benchmark_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON benchmark_approvals FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON benchmark_activity_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for authenticated users" ON benchmark_reports FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- Fonksiyonlar
-- ============================================================================

-- Benchmark numarası üretme fonksiyonu
CREATE OR REPLACE FUNCTION generate_benchmark_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_number VARCHAR(50);
    year_part VARCHAR(4);
    sequence_part INTEGER;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(benchmark_number FROM 'BMK-' || year_part || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_part
    FROM benchmarks
    WHERE benchmark_number LIKE 'BMK-' || year_part || '-%';
    
    new_number := 'BMK-' || year_part || '-' || LPAD(sequence_part::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Benchmark rapor numarası üretme fonksiyonu
CREATE OR REPLACE FUNCTION generate_benchmark_report_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_number VARCHAR(50);
    year_part VARCHAR(4);
    sequence_part INTEGER;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 'RPT-BMK-' || year_part || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_part
    FROM benchmark_reports
    WHERE report_number LIKE 'RPT-BMK-' || year_part || '-%';
    
    new_number := 'RPT-BMK-' || year_part || '-' || LPAD(sequence_part::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Otomatik updated_at tetikleyicileri
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_benchmark_categories_updated_at BEFORE UPDATE ON benchmark_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmarks_updated_at BEFORE UPDATE ON benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_items_updated_at BEFORE UPDATE ON benchmark_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_pros_cons_updated_at BEFORE UPDATE ON benchmark_pros_cons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_criteria_updated_at BEFORE UPDATE ON benchmark_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_scores_updated_at BEFORE UPDATE ON benchmark_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_approvals_updated_at BEFORE UPDATE ON benchmark_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Supabase Storage Bucket
-- ============================================================================

-- Not: Bu kısım Supabase Dashboard'dan manuel olarak yapılmalı veya SQL ile:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('benchmark_documents', 'benchmark_documents', false);

-- Storage politikaları
-- CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'benchmark_documents');
-- CREATE POLICY "Authenticated users can read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'benchmark_documents');

COMMENT ON FUNCTION generate_benchmark_number IS 'BMK-YYYY-#### formatında benzersiz benchmark numarası üretir';
COMMENT ON FUNCTION generate_benchmark_report_number IS 'RPT-BMK-YYYY-#### formatında benzersiz rapor numarası üretir';

