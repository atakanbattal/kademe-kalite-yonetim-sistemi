-- ============================================================================
-- PROFESYONEL QDMS (Quality Document Management System) SİSTEMİ
-- ============================================================================
-- Bu script profesyonel bir doküman yönetim sistemi oluşturur
-- Özellikler:
-- - Birim bazlı doküman organizasyonu
-- - Detaylı revizyon takibi
-- - Tedarikçi dokümanları yönetimi
-- - Onay süreçleri
-- - Kapsamlı arama ve filtreleme

-- ============================================================================
-- 1. MEVCUT TABLOLARI GENİŞLETME
-- ============================================================================

-- Documents tablosuna yeni kolonlar ekle
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES cost_settings(id),
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS document_category VARCHAR(100), -- 'İç Doküman', 'Tedarikçi Dokümanı', 'Müşteri Dokümanı', 'Dış Doküman'
ADD COLUMN IF NOT EXISTS document_subcategory VARCHAR(100), -- 'Prosedür', 'Talimat', 'Form', 'Sertifika', vb.
ADD COLUMN IF NOT EXISTS document_number VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS classification VARCHAR(50), -- 'Gizli', 'İç Kullanım', 'Genel', 'Yayınlanabilir'
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS related_documents UUID[], -- İlişkili doküman ID'leri
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'Taslak', -- 'Taslak', 'Onay Bekliyor', 'Onaylandı', 'Reddedildi', 'Yayınlandı'
ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'İç Kullanım', -- 'Genel', 'İç Kullanım', 'Gizli', 'Çok Gizli'
ADD COLUMN IF NOT EXISTS review_frequency_months INTEGER, -- Revizyon sıklığı (ay)
ADD COLUMN IF NOT EXISTS next_review_date DATE,
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES personnel(id), -- Doküman sahibi
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Document revisions tablosuna yeni kolonlar ekle
ALTER TABLE document_revisions
ADD COLUMN IF NOT EXISTS revision_status VARCHAR(50) DEFAULT 'Yayınlandı', -- 'Taslak', 'Onay Bekliyor', 'Onaylandı', 'Reddedildi', 'Yayınlandı'
ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES personnel(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by_id UUID REFERENCES personnel(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS effective_date DATE, -- Yürürlük tarihi
ADD COLUMN IF NOT EXISTS superseded_date DATE, -- Yürürlükten kalkma tarihi
ADD COLUMN IF NOT EXISTS change_summary TEXT, -- Değişiklik özeti
ADD COLUMN IF NOT EXISTS reviewed_by_id UUID REFERENCES personnel(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ============================================================================
-- 2. YENİ TABLOLAR
-- ============================================================================

-- Doküman onay akışı
CREATE TABLE IF NOT EXISTS document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES document_revisions(id) ON DELETE CASCADE,
    
    -- Onay bilgileri
    approver_id UUID NOT NULL REFERENCES personnel(id),
    approval_order INTEGER NOT NULL, -- Onay sırası
    approval_status VARCHAR(50) NOT NULL DEFAULT 'Bekliyor', -- 'Bekliyor', 'Onaylandı', 'Reddedildi', 'Atlandı'
    
    -- Onay detayları
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    approval_notes TEXT,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(document_id, revision_id, approver_id, approval_order)
);

COMMENT ON TABLE document_approvals IS 'Doküman onay akışı ve onay geçmişi';

-- Doküman erişim logları
CREATE TABLE IF NOT EXISTS document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES document_revisions(id) ON DELETE SET NULL,
    
    -- Erişim bilgileri
    user_id UUID NOT NULL REFERENCES auth.users(id),
    personnel_id UUID REFERENCES personnel(id),
    access_type VARCHAR(50) NOT NULL, -- 'Görüntüleme', 'İndirme', 'Düzenleme', 'Silme', 'Onaylama'
    ip_address INET,
    user_agent TEXT,
    
    -- Meta
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_access_logs IS 'Doküman erişim logları ve audit trail';

CREATE INDEX IF NOT EXISTS idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_user_id ON document_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_accessed_at ON document_access_logs(accessed_at DESC);

-- Doküman yorumları ve notlar
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES document_revisions(id) ON DELETE CASCADE,
    
    -- Yorum bilgileri
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'Yorum', -- 'Yorum', 'Öneri', 'Düzeltme', 'Soru'
    
    -- Kullanıcı bilgileri
    created_by_id UUID NOT NULL REFERENCES personnel(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Yanıtlar için
    parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    
    -- Durum
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by_id UUID REFERENCES personnel(id)
);

COMMENT ON TABLE document_comments IS 'Doküman yorumları ve geri bildirimler';

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_revision_id ON document_comments(revision_id);

-- Doküman bildirimleri
CREATE TABLE IF NOT EXISTS document_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES document_revisions(id) ON DELETE CASCADE,
    
    -- Bildirim bilgileri
    notification_type VARCHAR(50) NOT NULL, -- 'Yeni Revizyon', 'Onay Bekliyor', 'Süresi Doluyor', 'Revizyon Gerekli'
    notification_title VARCHAR(255) NOT NULL,
    notification_message TEXT,
    
    -- Alıcı
    recipient_id UUID NOT NULL REFERENCES personnel(id),
    
    -- Durum
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_notifications IS 'Doküman bildirimleri';

CREATE INDEX IF NOT EXISTS idx_document_notifications_recipient_id ON document_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_document_notifications_is_read ON document_notifications(is_read);

-- Tedarikçi dokümanları için özel tablo
CREATE TABLE IF NOT EXISTS supplier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Tedarikçi özel bilgiler
    document_category VARCHAR(100) NOT NULL, -- 'Kalite Sertifikası', 'Test Raporu', 'Teknik Şartname', 'İrsaliye', 'Fatura', 'Diğer'
    document_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT true,
    validation_notes TEXT,
    
    -- İlişkili kayıtlar
    related_incoming_inspection_id UUID REFERENCES incoming_inspections(id),
    related_audit_id UUID REFERENCES supplier_audit_plans(id),
    
    -- Meta
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(supplier_id, document_id)
);

COMMENT ON TABLE supplier_documents IS 'Tedarikçi dokümanları ve ilişkileri';

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_document_id ON supplier_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_expiry_date ON supplier_documents(expiry_date);

-- ============================================================================
-- 3. İNDEKSLER
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_department_id ON documents(department_id);
CREATE INDEX IF NOT EXISTS idx_documents_supplier_id ON documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_category ON documents(document_category);
CREATE INDEX IF NOT EXISTS idx_documents_document_subcategory ON documents(document_subcategory);
CREATE INDEX IF NOT EXISTS idx_documents_approval_status ON documents(approval_status);
CREATE INDEX IF NOT EXISTS idx_documents_is_active ON documents(is_active);
CREATE INDEX IF NOT EXISTS idx_documents_is_archived ON documents(is_archived);
CREATE INDEX IF NOT EXISTS idx_documents_next_review_date ON documents(next_review_date);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_keywords ON documents USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_document_revisions_document_id ON document_revisions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_revisions_revision_status ON document_revisions(revision_status);
CREATE INDEX IF NOT EXISTS idx_document_revisions_effective_date ON document_revisions(effective_date);

CREATE INDEX IF NOT EXISTS idx_document_approvals_document_id ON document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_revision_id ON document_approvals(revision_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_approver_id ON document_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_approval_status ON document_approvals(approval_status);

-- ============================================================================
-- 4. FONKSİYONLAR
-- ============================================================================

-- Otomatik doküman numarası oluşturma
CREATE OR REPLACE FUNCTION generate_document_number(
    p_department_id UUID,
    p_document_type VARCHAR,
    p_document_subcategory VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_dept_code VARCHAR(10);
    v_type_code VARCHAR(10);
    v_subcat_code VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_doc_number VARCHAR(100);
BEGIN
    -- Departman kodunu al (unit_code yoksa unit_name'in ilk 3 harfini kullan)
    SELECT COALESCE(SUBSTRING(unit_name, 1, 3), 'GEN') INTO v_dept_code
    FROM cost_settings
    WHERE id = p_department_id;
    
    IF v_dept_code IS NULL THEN
        v_dept_code := 'GEN';
    END IF;
    
    -- Tip kodunu belirle
    CASE p_document_type
        WHEN 'Prosedürler' THEN v_type_code := 'PR';
        WHEN 'Talimatlar' THEN v_type_code := 'TL';
        WHEN 'Formlar' THEN v_type_code := 'FR';
        WHEN 'Kalite Sertifikaları' THEN v_type_code := 'KS';
        WHEN 'Personel Sertifikaları' THEN v_type_code := 'PS';
        ELSE v_type_code := 'DG';
    END CASE;
    
    -- Alt kategori kodunu belirle
    IF p_document_subcategory IS NOT NULL THEN
        v_subcat_code := UPPER(SUBSTRING(p_document_subcategory, 1, 2));
    ELSE
        v_subcat_code := '';
    END IF;
    
    -- Yıl
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Sıra numarasını al
    SELECT COALESCE(MAX(CAST(SUBSTRING(document_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM documents
    WHERE document_number LIKE v_dept_code || '-' || v_type_code || '-' || COALESCE(v_subcat_code || '-', '') || v_year || '-%';
    
    -- Doküman numarasını oluştur
    IF v_subcat_code != '' THEN
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_subcat_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    ELSE
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    END IF;
    
    RETURN v_doc_number;
END;
$$ LANGUAGE plpgsql;

-- Sonraki revizyon tarihini hesapla
CREATE OR REPLACE FUNCTION calculate_next_review_date(
    p_review_frequency_months INTEGER,
    p_last_review_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE AS $$
BEGIN
    IF p_review_frequency_months IS NULL OR p_review_frequency_months <= 0 THEN
        RETURN NULL;
    END IF;
    
    RETURN p_last_review_date + (p_review_frequency_months || ' months')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Doküman revizyonu oluşturma
CREATE OR REPLACE FUNCTION create_document_revision(
    p_document_id UUID,
    p_revision_number VARCHAR,
    p_revision_reason TEXT,
    p_prepared_by_id UUID,
    p_attachments JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_revision_id UUID;
    v_doc RECORD;
BEGIN
    -- Doküman bilgilerini al
    SELECT * INTO v_doc FROM documents WHERE id = p_document_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doküman bulunamadı: %', p_document_id;
    END IF;
    
    -- Yeni revizyon oluştur
    INSERT INTO document_revisions (
        document_id,
        revision_number,
        revision_reason,
        publish_date,
        prepared_by_id,
        user_id,
        attachments,
        revision_status,
        effective_date
    ) VALUES (
        p_document_id,
        p_revision_number,
        p_revision_reason,
        CURRENT_DATE,
        p_prepared_by_id,
        (SELECT id FROM auth.users WHERE id = auth.uid()),
        p_attachments,
        'Taslak',
        CURRENT_DATE
    ) RETURNING id INTO v_revision_id;
    
    -- Dokümanın current_revision_id'sini güncelle
    UPDATE documents
    SET current_revision_id = v_revision_id,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN v_revision_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. TRİGGERLER
-- ============================================================================

-- Doküman numarası otomatik oluşturma trigger'ı
CREATE OR REPLACE FUNCTION auto_generate_document_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
        NEW.document_number := generate_document_number(
            NEW.department_id,
            NEW.document_type,
            NEW.document_subcategory
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_document_number
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION auto_generate_document_number();

-- Next review date otomatik hesaplama
CREATE OR REPLACE FUNCTION auto_calculate_next_review_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.review_frequency_months IS NOT NULL AND NEW.review_frequency_months > 0 THEN
        IF NEW.next_review_date IS NULL THEN
            NEW.next_review_date := calculate_next_review_date(
                NEW.review_frequency_months,
                CURRENT_DATE
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_calculate_next_review_date
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_next_review_date();

-- Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_documents_updated_at
BEFORE UPDATE ON supplier_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. RLS POLİTİKALARI
-- ============================================================================

-- Document approvals için RLS
ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own approvals"
ON document_approvals FOR SELECT
USING (approver_id IN (SELECT id FROM personnel WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "Users can insert approvals"
ON document_approvals FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own approvals"
ON document_approvals FOR UPDATE
USING (approver_id IN (SELECT id FROM personnel WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));

-- Document access logs için RLS
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view access logs"
ON document_access_logs FOR SELECT
USING (true);

CREATE POLICY "Users can insert access logs"
ON document_access_logs FOR INSERT
WITH CHECK (true);

-- Document comments için RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments"
ON document_comments FOR SELECT
USING (true);

CREATE POLICY "Users can insert comments"
ON document_comments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own comments"
ON document_comments FOR UPDATE
USING (created_by_id IN (SELECT id FROM personnel WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));

-- Document notifications için RLS
ALTER TABLE document_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON document_notifications FOR SELECT
USING (recipient_id IN (SELECT id FROM personnel WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "Users can update their own notifications"
ON document_notifications FOR UPDATE
USING (recipient_id IN (SELECT id FROM personnel WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));

-- Supplier documents için RLS
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view supplier documents"
ON supplier_documents FOR SELECT
USING (true);

CREATE POLICY "Users can manage supplier documents"
ON supplier_documents FOR ALL
USING (true);

-- ============================================================================
-- 7. VIEW'LAR
-- ============================================================================

-- Birim bazlı doküman görünümü
CREATE OR REPLACE VIEW documents_by_department AS
SELECT 
    d.*,
    cs.unit_name AS department_name,
    SUBSTRING(cs.unit_name, 1, 3) AS department_code,
    p.full_name AS owner_name,
    dr.revision_number AS current_revision,
    dr.publish_date AS current_revision_date,
    dr.revision_status AS current_revision_status,
    COUNT(DISTINCT dr2.id) AS total_revisions
FROM documents d
LEFT JOIN cost_settings cs ON d.department_id = cs.id
LEFT JOIN personnel p ON d.owner_id = p.id
LEFT JOIN document_revisions dr ON d.current_revision_id = dr.id
LEFT JOIN document_revisions dr2 ON d.id = dr2.document_id
WHERE d.is_archived = false
GROUP BY d.id, cs.unit_name, p.full_name, dr.revision_number, dr.publish_date, dr.revision_status;

-- Tedarikçi dokümanları görünümü
CREATE OR REPLACE VIEW supplier_documents_view AS
SELECT 
    sd.*,
    d.title,
    d.document_type,
    d.document_subcategory,
    d.document_number,
    d.valid_until,
    d.is_active,
    dr.revision_number,
    dr.publish_date,
    s.name AS supplier_name,
    s.supplier_code
FROM supplier_documents sd
JOIN documents d ON sd.document_id = d.id
LEFT JOIN document_revisions dr ON d.current_revision_id = dr.id
JOIN suppliers s ON sd.supplier_id = s.id
WHERE d.is_archived = false;

-- Revizyon geçmişi görünümü
CREATE OR REPLACE VIEW document_revision_history AS
SELECT 
    dr.*,
    d.title AS document_title,
    d.document_number,
    d.document_type,
    d.document_subcategory,
    p1.full_name AS prepared_by_name,
    p2.full_name AS approved_by_name,
    p3.full_name AS reviewed_by_name,
    COUNT(DISTINCT da.id) AS total_approvals,
    COUNT(DISTINCT CASE WHEN da.approval_status = 'Onaylandı' THEN da.id END) AS approved_count,
    COUNT(DISTINCT CASE WHEN da.approval_status = 'Bekliyor' THEN da.id END) AS pending_approvals
FROM document_revisions dr
JOIN documents d ON dr.document_id = d.id
LEFT JOIN personnel p1 ON dr.prepared_by_id = p1.id
LEFT JOIN personnel p2 ON dr.approved_by_id = p2.id
LEFT JOIN personnel p3 ON dr.reviewed_by_id = p3.id
LEFT JOIN document_approvals da ON dr.id = da.revision_id
GROUP BY dr.id, d.title, d.document_number, d.document_type, d.document_subcategory, 
         p1.full_name, p2.full_name, p3.full_name;

-- Süresi yaklaşan dokümanlar
CREATE OR REPLACE VIEW documents_expiring_soon AS
SELECT 
    d.*,
    cs.unit_name AS department_name,
    dr.revision_number,
    dr.publish_date,
    d.next_review_date - CURRENT_DATE AS days_until_review,
    d.valid_until - CURRENT_DATE AS days_until_expiry
FROM documents d
LEFT JOIN cost_settings cs ON d.department_id = cs.id
LEFT JOIN document_revisions dr ON d.current_revision_id = dr.id
WHERE d.is_active = true 
  AND d.is_archived = false
  AND (
    (d.next_review_date IS NOT NULL AND d.next_review_date <= CURRENT_DATE + INTERVAL '30 days')
    OR (d.valid_until IS NOT NULL AND d.valid_until <= CURRENT_DATE + INTERVAL '30 days')
  )
ORDER BY 
    COALESCE(d.next_review_date, d.valid_until) ASC;

-- ============================================================================
-- 8. YORUMLAR
-- ============================================================================

COMMENT ON COLUMN documents.department_id IS 'Dokümanın ait olduğu birim';
COMMENT ON COLUMN documents.supplier_id IS 'Tedarikçi dokümanı ise tedarikçi ID';
COMMENT ON COLUMN documents.document_category IS 'Doküman kategorisi: İç Doküman, Tedarikçi Dokümanı, Müşteri Dokümanı, Dış Doküman';
COMMENT ON COLUMN documents.document_subcategory IS 'Alt kategori: Prosedür, Talimat, Form, Sertifika, vb.';
COMMENT ON COLUMN documents.document_number IS 'Otomatik oluşturulan doküman numarası';
COMMENT ON COLUMN documents.classification IS 'Doküman sınıflandırması: Gizli, İç Kullanım, Genel, Yayınlanabilir';
COMMENT ON COLUMN documents.approval_status IS 'Onay durumu: Taslak, Onay Bekliyor, Onaylandı, Reddedildi, Yayınlandı';
COMMENT ON COLUMN documents.review_frequency_months IS 'Revizyon sıklığı (ay cinsinden)';
COMMENT ON COLUMN documents.next_review_date IS 'Sonraki revizyon tarihi (otomatik hesaplanır)';
COMMENT ON COLUMN documents.owner_id IS 'Doküman sahibi personel';

COMMENT ON COLUMN document_revisions.revision_status IS 'Revizyon durumu';
COMMENT ON COLUMN document_revisions.effective_date IS 'Revizyonun yürürlük tarihi';
COMMENT ON COLUMN document_revisions.superseded_date IS 'Revizyonun yürürlükten kalkma tarihi';
COMMENT ON COLUMN document_revisions.change_summary IS 'Değişiklik özeti';

