-- ============================================================================
-- POLİVALANS (ÇOK YÖNLÜLÜK MATRİSİ) MODÜLÜ
-- Personel yetkinlik, gelişim ve eğitim ihtiyaçlarını takip sistemi
-- ============================================================================

-- ============================================================================
-- 1. Yetkinlik Kategorileri (Skill Categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
    icon VARCHAR(50), -- Icon name
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE skill_categories IS 'Yetkinlik kategorileri (örn: Kaynak İşlemleri, Kalite Kontrol, Makine Operasyonu)';
COMMENT ON COLUMN skill_categories.color IS 'Kategori rengi (hex formatında)';
COMMENT ON COLUMN skill_categories.order_index IS 'Gösterim sırası';

-- ============================================================================
-- 2. Yetkinlikler (Skills)
-- ============================================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE, -- Yetkinlik kodu (örn: WLD-001)
    
    -- Yetkinlik özellikleri
    requires_certification BOOLEAN DEFAULT false, -- Sertifika gerektirir mi?
    certification_validity_days INTEGER, -- Sertifika geçerlilik süresi (gün)
    is_critical BOOLEAN DEFAULT false, -- Kritik yetkinlik mi?
    
    -- Beklenen seviye
    target_level INTEGER DEFAULT 3 CHECK (target_level >= 0 AND target_level <= 4),
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE skills IS 'Tüm yetkinliklerin tanımları';
COMMENT ON COLUMN skills.requires_certification IS 'Bu yetkinlik sertifika gerektiriyor mu?';
COMMENT ON COLUMN skills.certification_validity_days IS 'Sertifika geçerlilik süresi (gün cinsinden)';
COMMENT ON COLUMN skills.is_critical IS 'İş güvenliği veya kalite için kritik yetkinlik';
COMMENT ON COLUMN skills.target_level IS 'Organizasyonun hedeflediği minimum seviye';

-- ============================================================================
-- 3. Personel Yetkinlikleri (Personnel Skills)
-- ============================================================================
CREATE TABLE IF NOT EXISTS personnel_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    -- Yetkinlik seviyesi (0-4)
    current_level INTEGER NOT NULL DEFAULT 0 CHECK (current_level >= 0 AND current_level <= 4),
    target_level INTEGER CHECK (target_level >= 0 AND target_level <= 4),
    
    -- Sertifikasyon bilgileri
    is_certified BOOLEAN DEFAULT false,
    certification_date DATE,
    certification_expiry_date DATE,
    certification_number VARCHAR(100),
    certification_authority VARCHAR(200),
    
    -- Değerlendirme bilgileri
    last_assessment_date DATE,
    last_assessment_score DECIMAL(5,2), -- 0-100 arası puan
    assessor_id UUID REFERENCES personnel(id) ON DELETE SET NULL,
    assessment_notes TEXT,
    
    -- Eğitim bilgileri
    training_required BOOLEAN DEFAULT false,
    training_priority VARCHAR(20) CHECK (training_priority IN ('Düşük', 'Orta', 'Yüksek', 'Kritik')),
    last_training_date DATE,
    next_training_date DATE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Bir personelin aynı yetkinliği sadece bir kez olabilir
    UNIQUE(personnel_id, skill_id)
);

COMMENT ON TABLE personnel_skills IS 'Personel-yetkinlik ilişkileri ve seviye bilgileri';
COMMENT ON COLUMN personnel_skills.current_level IS '0: Bilgi yok, 1: Temel, 2: Gözetimli, 3: Bağımsız, 4: Eğitmen';
COMMENT ON COLUMN personnel_skills.target_level IS 'Bu personel için hedeflenen seviye';
COMMENT ON COLUMN personnel_skills.training_required IS 'Eğitim ihtiyacı var mı?';

-- ============================================================================
-- 4. Yetkinlik Değerlendirme Geçmişi (Skill Assessment History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_skill_id UUID NOT NULL REFERENCES personnel_skills(id) ON DELETE CASCADE,
    
    -- Değerlendirme bilgileri
    assessment_date DATE NOT NULL,
    previous_level INTEGER CHECK (previous_level >= 0 AND previous_level <= 4),
    new_level INTEGER NOT NULL CHECK (new_level >= 0 AND new_level <= 4),
    score DECIMAL(5,2), -- 0-100 arası puan
    
    -- Değerlendirici
    assessor_id UUID REFERENCES personnel(id) ON DELETE SET NULL,
    assessor_name VARCHAR(200),
    
    -- Değerlendirme detayları
    assessment_method VARCHAR(50), -- 'Teorik Test', 'Pratik Değerlendirme', 'Gözlem', vb.
    strengths TEXT,
    areas_for_improvement TEXT,
    notes TEXT,
    
    -- Belgeler
    document_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE skill_assessments IS 'Yetkinlik değerlendirme geçmişi';
COMMENT ON COLUMN skill_assessments.assessment_method IS 'Değerlendirme yöntemi';

-- ============================================================================
-- 5. Polivalans Hedefleri (Polyvalence Targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS polyvalence_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department VARCHAR(200) NOT NULL,
    position VARCHAR(200),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required_level INTEGER NOT NULL CHECK (required_level >= 0 AND required_level <= 4),
    is_mandatory BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(department, position, skill_id)
);

COMMENT ON TABLE polyvalence_targets IS 'Departman/pozisyon bazlı yetkinlik hedefleri';
COMMENT ON COLUMN polyvalence_targets.required_level IS 'Bu pozisyon için gerekli minimum seviye';

-- ============================================================================
-- 6. İndeksler (Performance Optimization)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_personnel_skills_personnel ON personnel_skills(personnel_id);
CREATE INDEX IF NOT EXISTS idx_personnel_skills_skill ON personnel_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_personnel_skills_level ON personnel_skills(current_level);
CREATE INDEX IF NOT EXISTS idx_personnel_skills_certified ON personnel_skills(is_certified);
CREATE INDEX IF NOT EXISTS idx_personnel_skills_training ON personnel_skills(training_required);
CREATE INDEX IF NOT EXISTS idx_personnel_skills_expiry ON personnel_skills(certification_expiry_date);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category_id);
CREATE INDEX IF NOT EXISTS idx_skills_active ON skills(is_active);
CREATE INDEX IF NOT EXISTS idx_skills_critical ON skills(is_critical);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_personnel_skill ON skill_assessments(personnel_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_date ON skill_assessments(assessment_date);

-- ============================================================================
-- 7. Örnek Veri (Sample Data)
-- ============================================================================

-- Yetkinlik kategorileri
INSERT INTO skill_categories (name, description, color, icon, order_index) VALUES
    ('Kaynak İşlemleri', 'TIG, MIG, MAG kaynak teknikleri', '#EF4444', 'Flame', 1),
    ('Kalite Kontrol', 'Ölçüm, muayene ve test yetkinlikleri', '#3B82F6', 'ShieldCheck', 2),
    ('Makine Operasyonu', 'CNC, pres, kesme makineleri', '#10B981', 'Settings', 3),
    ('İş Güvenliği', 'İSG sertifikaları ve güvenlik prosedürleri', '#F59E0B', 'AlertTriangle', 4),
    ('Liderlik', 'Ekip yönetimi ve liderlik becerileri', '#8B5CF6', 'Users', 5)
ON CONFLICT DO NOTHING;

-- Örnek yetkinlikler
INSERT INTO skills (category_id, name, code, requires_certification, certification_validity_days, is_critical, target_level, description) 
SELECT 
    cat.id,
    'TIG Kaynak (Paslanmaz Çelik)',
    'WLD-TIG-001',
    true,
    1095, -- 3 yıl
    true,
    3,
    'Paslanmaz çelik malzemelerde TIG kaynak yapabilme yetkinliği'
FROM skill_categories cat WHERE cat.name = 'Kaynak İşlemleri'
ON CONFLICT (code) DO NOTHING;

INSERT INTO skills (category_id, name, code, requires_certification, certification_validity_days, is_critical, target_level, description) 
SELECT 
    cat.id,
    'Kumpas ve Mikrometre Kullanımı',
    'QC-MEAS-001',
    false,
    NULL,
    false,
    3,
    'Hassas ölçüm aletleri ile doğru ölçüm yapabilme'
FROM skill_categories cat WHERE cat.name = 'Kalite Kontrol'
ON CONFLICT (code) DO NOTHING;

INSERT INTO skills (category_id, name, code, requires_certification, certification_validity_days, is_critical, target_level, description) 
SELECT 
    cat.id,
    'CNC Torna Programlama',
    'MCH-CNC-001',
    true,
    730, -- 2 yıl
    false,
    3,
    'CNC torna makinesi programlama ve operasyon'
FROM skill_categories cat WHERE cat.name = 'Makine Operasyonu'
ON CONFLICT (code) DO NOTHING;

INSERT INTO skills (category_id, name, code, requires_certification, certification_validity_days, is_critical, target_level, description) 
SELECT 
    cat.id,
    'İş Güvenliği Uzmanlığı',
    'HSE-EXPERT-001',
    true,
    365, -- 1 yıl
    true,
    4,
    'İSG mevzuatı ve risk değerlendirme uzmanlığı'
FROM skill_categories cat WHERE cat.name = 'İş Güvenliği'
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 8. Trigger: updated_at otomatik güncelleme
-- ============================================================================
CREATE OR REPLACE FUNCTION update_polyvalence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skill_categories_updated_at BEFORE UPDATE ON skill_categories
    FOR EACH ROW EXECUTE FUNCTION update_polyvalence_updated_at();

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_polyvalence_updated_at();

CREATE TRIGGER update_personnel_skills_updated_at BEFORE UPDATE ON personnel_skills
    FOR EACH ROW EXECUTE FUNCTION update_polyvalence_updated_at();

-- ============================================================================
-- 9. View: Polivalans Özet Raporu
-- ============================================================================
CREATE OR REPLACE VIEW polyvalence_summary AS
SELECT 
    p.id as personnel_id,
    p.full_name,
    p.department,
    p.position,
    COUNT(ps.id) as total_skills,
    COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END) as proficient_skills,
    COUNT(CASE WHEN ps.is_certified THEN 1 END) as certified_skills,
    COUNT(CASE WHEN ps.training_required THEN 1 END) as training_needs,
    ROUND(AVG(ps.current_level)::numeric, 2) as avg_skill_level,
    ROUND((COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END)::float / NULLIF(COUNT(ps.id), 0) * 100)::numeric, 1) as polyvalence_score
FROM personnel p
LEFT JOIN personnel_skills ps ON p.id = ps.personnel_id
GROUP BY p.id, p.full_name, p.department, p.position;

COMMENT ON VIEW polyvalence_summary IS 'Personel bazlı polivalans özet istatistikleri';

-- ============================================================================
-- 10. View: Sertifika Geçerlilik Uyarıları
-- ============================================================================
CREATE OR REPLACE VIEW certification_expiry_alerts AS
SELECT 
    ps.id,
    p.full_name as personnel_name,
    p.department,
    s.name as skill_name,
    s.code as skill_code,
    ps.certification_date,
    ps.certification_expiry_date,
    ps.certification_number,
    CASE 
        WHEN ps.certification_expiry_date < CURRENT_DATE THEN 'Süresi Dolmuş'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Kritik (30 gün içinde)'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'Uyarı (90 gün içinde)'
        ELSE 'Geçerli'
    END as status,
    ps.certification_expiry_date - CURRENT_DATE as days_remaining
FROM personnel_skills ps
JOIN personnel p ON ps.personnel_id = p.id
JOIN skills s ON ps.skill_id = s.id
WHERE ps.is_certified = true
    AND s.requires_certification = true
    AND ps.certification_expiry_date IS NOT NULL
ORDER BY ps.certification_expiry_date ASC;

COMMENT ON VIEW certification_expiry_alerts IS 'Sertifika geçerlilik uyarı sistemi';

-- ============================================================================
-- 11. Function: Polivalans Skoru Hesaplama
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_polyvalence_score(p_personnel_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_score DECIMAL;
BEGIN
    SELECT 
        ROUND((COUNT(CASE WHEN current_level >= 3 THEN 1 END)::float / 
               NULLIF(COUNT(*), 0) * 100)::numeric, 1)
    INTO v_score
    FROM personnel_skills
    WHERE personnel_id = p_personnel_id;
    
    RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. Başarı Mesajı
-- ============================================================================
DO $$
DECLARE
    v_categories INTEGER;
    v_skills INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_categories FROM skill_categories;
    SELECT COUNT(*) INTO v_skills FROM skills;
    
    RAISE NOTICE '✅ Polivalans Modülü başarıyla oluşturuldu!';
    RAISE NOTICE '📊 % yetkinlik kategorisi oluşturuldu', v_categories;
    RAISE NOTICE '🎯 % yetkinlik tanımı eklendi', v_skills;
    RAISE NOTICE '📈 2 adet view (rapor) oluşturuldu';
    RAISE NOTICE '🔍 Polivalans özet raporu: polyvalence_summary';
    RAISE NOTICE '⚠️  Sertifika uyarı sistemi: certification_expiry_alerts';
END $$;

