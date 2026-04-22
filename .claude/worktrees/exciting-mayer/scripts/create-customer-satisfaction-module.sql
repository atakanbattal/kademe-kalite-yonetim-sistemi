-- Müşteri Memnuniyeti Modülü
-- ISO 9001:2015 Madde 9.1.2 - Customer Satisfaction

-- 1. Müşteri Memnuniyet Anketleri
CREATE TABLE IF NOT EXISTS customer_satisfaction_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_name VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    
    -- Anket Bilgileri
    survey_type VARCHAR(50) NOT NULL, -- 'NPS', 'CSAT', 'CES', 'Custom'
    survey_date DATE NOT NULL,
    period VARCHAR(20), -- 'Q1', 'Q2', 'Q3', 'Q4', 'Annual'
    
    -- Sonuçlar
    nps_score INTEGER, -- Net Promoter Score (-100 to 100)
    csat_score DECIMAL(5, 2), -- Customer Satisfaction (1-5)
    ces_score DECIMAL(5, 2), -- Customer Effort Score (1-7)
    overall_score DECIMAL(5, 2), -- Genel memnuniyet skoru
    
    -- Detaylar
    responses JSONB, -- Anket cevapları (esnek yapı)
    comments TEXT,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Anket Soruları ve Cevapları
CREATE TABLE IF NOT EXISTS customer_survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES customer_satisfaction_surveys(id) ON DELETE CASCADE,
    
    -- Soru Bilgileri
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'Rating', 'Multiple Choice', 'Text', 'Yes/No'
    category VARCHAR(100), -- 'Product', 'Service', 'Delivery', 'Communication'
    
    -- Cevap
    answer_value DECIMAL(10, 2), -- Rating için
    answer_text TEXT, -- Text cevaplar için
    answer_options JSONB, -- Multiple choice için
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Müşteri Geri Bildirimleri
CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    
    -- Geri Bildirim Bilgileri
    feedback_type VARCHAR(50) NOT NULL, -- 'Complaint', 'Suggestion', 'Praise', 'Question'
    feedback_date DATE NOT NULL,
    subject VARCHAR(255),
    description TEXT NOT NULL,
    
    -- Kategoriler
    category VARCHAR(100), -- 'Product Quality', 'Delivery', 'Service', 'Communication'
    priority VARCHAR(50), -- 'Low', 'Medium', 'High', 'Critical'
    
    -- Durum
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Closed'
    resolution TEXT,
    resolved_date DATE,
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Müşteri Memnuniyet Trendleri
CREATE TABLE IF NOT EXISTS customer_satisfaction_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    
    -- Trend Verileri
    period_type VARCHAR(20) NOT NULL, -- 'Monthly', 'Quarterly', 'Yearly'
    period_value DATE NOT NULL,
    
    -- Skorlar
    nps_score INTEGER,
    csat_score DECIMAL(5, 2),
    ces_score DECIMAL(5, 2),
    overall_score DECIMAL(5, 2),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_surveys_customer ON customer_satisfaction_surveys(customer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_date ON customer_satisfaction_surveys(survey_date);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON customer_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON customer_feedback(status);
CREATE INDEX IF NOT EXISTS idx_trends_customer ON customer_satisfaction_trends(customer_id, period_type, period_value);

-- RLS Politikaları
ALTER TABLE customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_satisfaction_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surveys_select" ON customer_satisfaction_surveys FOR SELECT USING (true);
CREATE POLICY "surveys_insert" ON customer_satisfaction_surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "surveys_update" ON customer_satisfaction_surveys FOR UPDATE USING (true);
CREATE POLICY "surveys_delete" ON customer_satisfaction_surveys FOR DELETE USING (true);

CREATE POLICY "questions_select" ON customer_survey_questions FOR SELECT USING (true);
CREATE POLICY "questions_insert" ON customer_survey_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "questions_update" ON customer_survey_questions FOR UPDATE USING (true);
CREATE POLICY "questions_delete" ON customer_survey_questions FOR DELETE USING (true);

CREATE POLICY "feedback_select" ON customer_feedback FOR SELECT USING (true);
CREATE POLICY "feedback_insert" ON customer_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback_update" ON customer_feedback FOR UPDATE USING (true);
CREATE POLICY "feedback_delete" ON customer_feedback FOR DELETE USING (true);

CREATE POLICY "trends_select" ON customer_satisfaction_trends FOR SELECT USING (true);
CREATE POLICY "trends_insert" ON customer_satisfaction_trends FOR INSERT WITH CHECK (true);
CREATE POLICY "trends_update" ON customer_satisfaction_trends FOR UPDATE USING (true);
CREATE POLICY "trends_delete" ON customer_satisfaction_trends FOR DELETE USING (true);

-- Fonksiyon: NPS hesaplama
CREATE OR REPLACE FUNCTION calculate_nps_score(
    p_survey_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_promoters INTEGER;
    v_detractors INTEGER;
    v_total INTEGER;
    v_nps INTEGER;
BEGIN
    -- Promoters (9-10), Passives (7-8), Detractors (0-6)
    SELECT 
        COUNT(*) FILTER (WHERE answer_value >= 9),
        COUNT(*) FILTER (WHERE answer_value <= 6),
        COUNT(*)
    INTO v_promoters, v_detractors, v_total
    FROM customer_survey_questions
    WHERE survey_id = p_survey_id
        AND question_type = 'Rating'
        AND question_text LIKE '%NPS%';

    IF v_total > 0 THEN
        v_nps := ROUND(((v_promoters::DECIMAL / v_total) - (v_detractors::DECIMAL / v_total)) * 100);
    ELSE
        v_nps := 0;
    END IF;

    RETURN v_nps;
END;
$$ LANGUAGE plpgsql;

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_surveys_updated_at
    BEFORE UPDATE ON customer_satisfaction_surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON customer_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

