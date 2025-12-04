-- Gelişmiş Kalite Veri Analizi Modülü
-- ISO 9001:2015 Madde 9.1 - Performance Evaluation

-- 1. Analiz Raporları
CREATE TABLE IF NOT EXISTS quality_analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'Trend', 'Comparison', 'Forecast', 'Custom'
    
    -- Rapor Parametreleri
    date_range_start DATE,
    date_range_end DATE,
    module_types TEXT[], -- Hangi modüllerden veri çekilecek
    filters JSONB, -- Esnek filtre yapısı
    
    -- Analiz Sonuçları
    analysis_data JSONB, -- Analiz sonuçları (esnek yapı)
    insights TEXT[], -- AI destekli içgörüler
    recommendations TEXT[], -- Öneriler
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trend Analizleri
CREATE TABLE IF NOT EXISTS quality_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL, -- 'PPM', 'NC Count', 'Cost', etc.
    metric_type VARCHAR(50) NOT NULL, -- 'Supplier', 'Internal', 'Customer', 'Cost'
    
    -- Trend Verileri
    period_type VARCHAR(20) NOT NULL, -- 'Daily', 'Weekly', 'Monthly', 'Yearly'
    period_value DATE NOT NULL,
    value DECIMAL(15, 6) NOT NULL,
    
    -- Trend Analizi
    trend_direction VARCHAR(20), -- 'Increasing', 'Decreasing', 'Stable'
    change_percentage DECIMAL(10, 2),
    moving_average DECIMAL(15, 6),
    
    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tahmin Modelleri
CREATE TABLE IF NOT EXISTS quality_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    forecast_type VARCHAR(50) NOT NULL, -- 'Linear', 'Exponential', 'Seasonal'
    
    -- Tahmin Parametreleri
    historical_periods INTEGER NOT NULL, -- Kaç dönem geçmiş veri kullanıldı
    forecast_periods INTEGER NOT NULL, -- Kaç dönem ileri tahmin
    
    -- Tahmin Sonuçları
    forecast_data JSONB, -- Tahmin değerleri ve güven aralıkları
    accuracy_score DECIMAL(5, 2), -- Model doğruluğu (%)
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Karşılaştırma Analizleri
CREATE TABLE IF NOT EXISTS quality_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_name VARCHAR(255) NOT NULL,
    comparison_type VARCHAR(50) NOT NULL, -- 'Period', 'Department', 'Supplier', 'Product'
    
    -- Karşılaştırma Parametreleri
    comparison_data JSONB, -- Karşılaştırılacak gruplar ve metrikler
    
    -- Sonuçlar
    comparison_results JSONB, -- Karşılaştırma sonuçları
    statistical_significance DECIMAL(5, 2), -- İstatistiksel anlamlılık (%)
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_quality_trends_metric ON quality_trends(metric_name, period_type, period_value);
CREATE INDEX IF NOT EXISTS idx_quality_forecasts_metric ON quality_forecasts(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON quality_analytics_reports(report_type);

-- RLS Politikaları
ALTER TABLE quality_analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_reports_select" ON quality_analytics_reports FOR SELECT USING (true);
CREATE POLICY "analytics_reports_insert" ON quality_analytics_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_reports_update" ON quality_analytics_reports FOR UPDATE USING (true);
CREATE POLICY "analytics_reports_delete" ON quality_analytics_reports FOR DELETE USING (true);

CREATE POLICY "trends_select" ON quality_trends FOR SELECT USING (true);
CREATE POLICY "trends_insert" ON quality_trends FOR INSERT WITH CHECK (true);
CREATE POLICY "trends_update" ON quality_trends FOR UPDATE USING (true);
CREATE POLICY "trends_delete" ON quality_trends FOR DELETE USING (true);

CREATE POLICY "forecasts_select" ON quality_forecasts FOR SELECT USING (true);
CREATE POLICY "forecasts_insert" ON quality_forecasts FOR INSERT WITH CHECK (true);
CREATE POLICY "forecasts_update" ON quality_forecasts FOR UPDATE USING (true);
CREATE POLICY "forecasts_delete" ON quality_forecasts FOR DELETE USING (true);

CREATE POLICY "comparisons_select" ON quality_comparisons FOR SELECT USING (true);
CREATE POLICY "comparisons_insert" ON quality_comparisons FOR INSERT WITH CHECK (true);
CREATE POLICY "comparisons_update" ON quality_comparisons FOR UPDATE USING (true);
CREATE POLICY "comparisons_delete" ON quality_comparisons FOR DELETE USING (true);

-- Fonksiyon: Trend analizi hesaplama
CREATE OR REPLACE FUNCTION calculate_trend_analysis(
    p_metric_name VARCHAR,
    p_period_type VARCHAR,
    p_periods INTEGER DEFAULT 12
)
RETURNS JSONB AS $$
DECLARE
    v_trend_data JSONB;
    v_avg_value DECIMAL;
    v_change_pct DECIMAL;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'period', period_value,
            'value', value,
            'moving_avg', moving_average
        ) ORDER BY period_value
    )
    INTO v_trend_data
    FROM quality_trends
    WHERE metric_name = p_metric_name
        AND period_type = p_period_type
        AND period_value >= CURRENT_DATE - (p_periods || ' ' || p_period_type)::INTERVAL
    ORDER BY period_value DESC
    LIMIT p_periods;

    -- Ortalama değer hesapla
    SELECT AVG(value) INTO v_avg_value
    FROM quality_trends
    WHERE metric_name = p_metric_name
        AND period_type = p_period_type
        AND period_value >= CURRENT_DATE - (p_periods || ' ' || p_period_type)::INTERVAL;

    -- Değişim yüzdesi hesapla
    SELECT 
        CASE 
            WHEN LAG(value) OVER (ORDER BY period_value) > 0 
            THEN ((value - LAG(value) OVER (ORDER BY period_value)) / LAG(value) OVER (ORDER BY period_value)) * 100
            ELSE 0
        END
    INTO v_change_pct
    FROM quality_trends
    WHERE metric_name = p_metric_name
        AND period_type = p_period_type
    ORDER BY period_value DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'trend_data', v_trend_data,
        'average_value', v_avg_value,
        'change_percentage', v_change_pct
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_analytics_reports_updated_at
    BEFORE UPDATE ON quality_analytics_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_spc_updated_at();

