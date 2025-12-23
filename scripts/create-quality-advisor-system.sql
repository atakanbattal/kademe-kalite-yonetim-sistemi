-- =====================================================
-- KALİTE SİSTEMİ DANIŞMANI (Quality System Advisor)
-- Tüm modülleri analiz edip proaktif öneriler sunar
-- =====================================================

-- Advisor sonuçlarını saklamak için tablo
CREATE TABLE IF NOT EXISTS quality_advisor_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    analysis_date TIMESTAMPTZ DEFAULT NOW(),
    total_score NUMERIC(5,2), -- 0-100 arası genel sağlık puanı
    module_scores JSONB, -- Her modül için ayrı puan
    recommendations JSONB, -- Öneriler listesi
    alerts JSONB, -- Acil uyarılar
    trends JSONB, -- Trend analizi
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS politikası
ALTER TABLE quality_advisor_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can view their advisor results"
    ON quality_advisor_results FOR ALL USING (true);

-- =====================================================
-- ANA ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_quality_system()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_nc_analysis JSONB;
    v_audit_analysis JSONB;
    v_supplier_analysis JSONB;
    v_calibration_analysis JSONB;
    v_document_analysis JSONB;
    v_training_analysis JSONB;
    v_complaint_analysis JSONB;
    v_kpi_analysis JSONB;
    v_kaizen_analysis JSONB;
    v_quarantine_analysis JSONB;
    v_task_analysis JSONB;
    v_incoming_analysis JSONB;
    v_total_score NUMERIC(5,2) := 0;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- 1. NC (Uygunsuzluk) Analizi
    SELECT analyze_nc_module() INTO v_nc_analysis;
    
    -- 2. İç Denetim Analizi
    SELECT analyze_audit_module() INTO v_audit_analysis;
    
    -- 3. Tedarikçi Analizi
    SELECT analyze_supplier_module() INTO v_supplier_analysis;
    
    -- 4. Kalibrasyon Analizi
    SELECT analyze_calibration_module() INTO v_calibration_analysis;
    
    -- 5. Doküman Analizi
    SELECT analyze_document_module() INTO v_document_analysis;
    
    -- 6. Eğitim Analizi
    SELECT analyze_training_module() INTO v_training_analysis;
    
    -- 7. Müşteri Şikayeti Analizi
    SELECT analyze_complaint_module() INTO v_complaint_analysis;
    
    -- 8. KPI Analizi
    SELECT analyze_kpi_module() INTO v_kpi_analysis;
    
    -- 9. Kaizen Analizi
    SELECT analyze_kaizen_module() INTO v_kaizen_analysis;
    
    -- 10. Karantina Analizi
    SELECT analyze_quarantine_module() INTO v_quarantine_analysis;
    
    -- 11. Görev Analizi
    SELECT analyze_task_module() INTO v_task_analysis;
    
    -- 12. Giriş Kalite Analizi
    SELECT analyze_incoming_module() INTO v_incoming_analysis;
    
    -- Toplam skoru hesapla (ağırlıklı ortalama)
    v_total_score := (
        COALESCE((v_nc_analysis->>'score')::NUMERIC, 100) * 0.15 +
        COALESCE((v_audit_analysis->>'score')::NUMERIC, 100) * 0.10 +
        COALESCE((v_supplier_analysis->>'score')::NUMERIC, 100) * 0.10 +
        COALESCE((v_calibration_analysis->>'score')::NUMERIC, 100) * 0.08 +
        COALESCE((v_document_analysis->>'score')::NUMERIC, 100) * 0.07 +
        COALESCE((v_training_analysis->>'score')::NUMERIC, 100) * 0.07 +
        COALESCE((v_complaint_analysis->>'score')::NUMERIC, 100) * 0.12 +
        COALESCE((v_kpi_analysis->>'score')::NUMERIC, 100) * 0.10 +
        COALESCE((v_kaizen_analysis->>'score')::NUMERIC, 100) * 0.05 +
        COALESCE((v_quarantine_analysis->>'score')::NUMERIC, 100) * 0.06 +
        COALESCE((v_task_analysis->>'score')::NUMERIC, 100) * 0.05 +
        COALESCE((v_incoming_analysis->>'score')::NUMERIC, 100) * 0.05
    );
    
    -- Tüm önerileri birleştir
    v_recommendations := COALESCE(v_nc_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_audit_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_supplier_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_calibration_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_document_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_training_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_complaint_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_kpi_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_kaizen_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_quarantine_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_task_analysis->'recommendations', '[]'::JSONB) ||
                         COALESCE(v_incoming_analysis->'recommendations', '[]'::JSONB);
    
    -- Tüm uyarıları birleştir
    v_alerts := COALESCE(v_nc_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_audit_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_supplier_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_calibration_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_document_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_training_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_complaint_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_kpi_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_quarantine_analysis->'alerts', '[]'::JSONB) ||
                COALESCE(v_task_analysis->'alerts', '[]'::JSONB);
    
    -- Sonucu oluştur
    v_result := jsonb_build_object(
        'analysis_date', NOW(),
        'total_score', ROUND(v_total_score, 1),
        'health_status', CASE 
            WHEN v_total_score >= 90 THEN 'Mükemmel'
            WHEN v_total_score >= 75 THEN 'İyi'
            WHEN v_total_score >= 60 THEN 'Orta'
            WHEN v_total_score >= 40 THEN 'Dikkat Gerekli'
            ELSE 'Kritik'
        END,
        'module_scores', jsonb_build_object(
            'nc', v_nc_analysis,
            'audit', v_audit_analysis,
            'supplier', v_supplier_analysis,
            'calibration', v_calibration_analysis,
            'document', v_document_analysis,
            'training', v_training_analysis,
            'complaint', v_complaint_analysis,
            'kpi', v_kpi_analysis,
            'kaizen', v_kaizen_analysis,
            'quarantine', v_quarantine_analysis,
            'task', v_task_analysis,
            'incoming', v_incoming_analysis
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts,
        'summary', jsonb_build_object(
            'total_recommendations', jsonb_array_length(v_recommendations),
            'total_alerts', jsonb_array_length(v_alerts),
            'critical_alerts', (SELECT COUNT(*) FROM jsonb_array_elements(v_alerts) a WHERE a->>'priority' = 'CRITICAL'),
            'high_alerts', (SELECT COUNT(*) FROM jsonb_array_elements(v_alerts) a WHERE a->>'priority' = 'HIGH')
        )
    );
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', SQLERRM,
        'analysis_date', NOW()
    );
END;
$$;

-- =====================================================
-- NC (UYGUNSUZLUK) ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_nc_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_open_count INTEGER;
    v_old_open_count INTEGER;
    v_overdue_8d_count INTEGER;
    v_this_month_count INTEGER;
    v_last_month_count INTEGER;
    v_avg_close_days NUMERIC;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Açık NC sayısı
    SELECT COUNT(*) INTO v_open_count 
    FROM non_conformities WHERE status IN ('Açık', 'İşlemde');
    
    -- 60 günden eski açık NC
    SELECT COUNT(*) INTO v_old_open_count 
    FROM non_conformities 
    WHERE status IN ('Açık', 'İşlemde') 
    AND created_at < NOW() - INTERVAL '60 days';
    
    -- Gecikmiş 8D/DF
    SELECT COUNT(*) INTO v_overdue_8d_count 
    FROM non_conformities 
    WHERE type IN ('8D', 'DF') 
    AND status IN ('Açık', 'İşlemde')
    AND due_at < NOW();
    
    -- Bu ay oluşturulan NC
    SELECT COUNT(*) INTO v_this_month_count 
    FROM non_conformities 
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
    
    -- Geçen ay oluşturulan NC
    SELECT COUNT(*) INTO v_last_month_count 
    FROM non_conformities 
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    
    -- Ortalama kapatma süresi
    SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) INTO v_avg_close_days
    FROM non_conformities 
    WHERE status = 'Kapatıldı' 
    AND closed_at >= NOW() - INTERVAL '90 days';
    
    -- Skor hesapla
    IF v_open_count > 50 THEN v_score := v_score - 15; END IF;
    IF v_old_open_count > 10 THEN v_score := v_score - 20; END IF;
    IF v_overdue_8d_count > 5 THEN v_score := v_score - 25; END IF;
    IF COALESCE(v_avg_close_days, 0) > 30 THEN v_score := v_score - 10; END IF;
    
    -- Öneriler
    IF v_old_open_count > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'NC',
                'priority', 'HIGH',
                'title', v_old_open_count || ' adet NC 60 günden fazla açık',
                'description', 'Uzun süredir açık kalan uygunsuzlukları gözden geçirin ve kapatma aksiyonlarını hızlandırın.',
                'action', 'NC modülüne gidin ve eski kayıtları filtreleyin'
            )
        );
    END IF;
    
    IF v_overdue_8d_count > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'NC',
                'priority', 'CRITICAL',
                'title', v_overdue_8d_count || ' adet 8D/DF kaydı gecikmiş',
                'description', 'Termin tarihi geçmiş 8D/DF kayıtları var. Acil aksiyon gerekiyor.',
                'action', '8D/DF modülüne gidin'
            )
        );
    END IF;
    
    IF v_this_month_count > v_last_month_count * 1.5 AND v_last_month_count > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'NC',
                'priority', 'HIGH',
                'title', 'NC sayısında artış trendi',
                'description', 'Bu ay (' || v_this_month_count || ') geçen aya (' || v_last_month_count || ') göre %' || 
                    ROUND(((v_this_month_count - v_last_month_count)::NUMERIC / v_last_month_count) * 100) || ' artış var.',
                'action', 'Kök neden analizini gözden geçirin'
            )
        );
    END IF;
    
    IF v_open_count = 0 AND v_this_month_count = 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'NC',
                'priority', 'NORMAL',
                'title', 'Uzun süredir NC kaydı yok',
                'description', 'Kalite sisteminin aktif kullanıldığından emin olun. NC kayıtlarının düzenli açılması kalite bilincini gösterir.',
                'action', 'Kalite farkındalık eğitimi düzenleyin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'open_count', v_open_count,
            'old_open_count', v_old_open_count,
            'overdue_8d_count', v_overdue_8d_count,
            'this_month_count', v_this_month_count,
            'last_month_count', v_last_month_count,
            'avg_close_days', ROUND(COALESCE(v_avg_close_days, 0), 1)
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- İÇ DENETİM ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_audit_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_audits INTEGER;
    v_completed_audits INTEGER;
    v_last_audit_date DATE;
    v_days_since_last INTEGER;
    v_planned_audits INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam denetim sayısı (bu yıl)
    SELECT COUNT(*) INTO v_total_audits 
    FROM audits 
    WHERE EXTRACT(YEAR FROM audit_date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Tamamlanan denetim sayısı (bu yıl)
    SELECT COUNT(*) INTO v_completed_audits 
    FROM audits 
    WHERE status = 'Tamamlandı'
    AND EXTRACT(YEAR FROM audit_date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Son denetim tarihi
    SELECT MAX(audit_date) INTO v_last_audit_date 
    FROM audits 
    WHERE status = 'Tamamlandı';
    
    v_days_since_last := COALESCE(CURRENT_DATE - v_last_audit_date, 999);
    
    -- Planlanmış denetimler (gelecek 30 gün)
    SELECT COUNT(*) INTO v_planned_audits 
    FROM audits 
    WHERE status = 'Planlandı'
    AND audit_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
    
    -- Skor hesapla
    IF v_days_since_last > 90 THEN v_score := v_score - 30; END IF;
    IF v_days_since_last > 60 THEN v_score := v_score - 15; END IF;
    IF v_completed_audits < 4 AND EXTRACT(MONTH FROM CURRENT_DATE) > 6 THEN 
        v_score := v_score - 20; 
    END IF;
    
    -- Uyarılar ve öneriler
    IF v_days_since_last > 90 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Denetim',
                'priority', 'CRITICAL',
                'title', v_days_since_last || ' gündür iç denetim yapılmadı',
                'description', 'ISO standartları düzenli iç denetim yapılmasını gerektirir. Acil denetim planlayın.',
                'action', 'Denetim modülüne gidin ve yeni denetim planlayın'
            )
        );
    ELSIF v_days_since_last > 60 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Denetim',
                'priority', 'HIGH',
                'title', 'İç denetim planlaması gerekiyor',
                'description', 'Son iç denetimden ' || v_days_since_last || ' gün geçti. Yeni denetim planlamayı düşünün.',
                'action', 'Denetim takvimini gözden geçirin'
            )
        );
    END IF;
    
    IF v_planned_audits = 0 AND v_days_since_last > 30 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Denetim',
                'priority', 'NORMAL',
                'title', 'Gelecek 30 gün için planlı denetim yok',
                'description', 'Önümüzdeki ay için denetim planı yapmanız önerilir.',
                'action', 'Yıllık denetim planınızı gözden geçirin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_audits_this_year', v_total_audits,
            'completed_audits', v_completed_audits,
            'days_since_last_audit', v_days_since_last,
            'planned_next_30_days', v_planned_audits
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- TEDARİKÇİ ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_supplier_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_suppliers INTEGER;
    v_low_performance INTEGER;
    v_no_audit_90_days INTEGER;
    v_pending_audits INTEGER;
    v_rejection_rate NUMERIC;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam onaylı tedarikçi
    SELECT COUNT(*) INTO v_total_suppliers 
    FROM suppliers WHERE status = 'Onaylı';
    
    -- Düşük performanslı tedarikçiler (kalite puanı < 70)
    SELECT COUNT(*) INTO v_low_performance 
    FROM suppliers 
    WHERE status = 'Onaylı' 
    AND COALESCE(quality_performance, 100) < 70;
    
    -- 90 günden fazla denetim yapılmamış tedarikçiler
    SELECT COUNT(*) INTO v_no_audit_90_days
    FROM suppliers s
    WHERE s.status = 'Onaylı'
    AND s.risk_class = 'Yüksek'
    AND NOT EXISTS (
        SELECT 1 FROM supplier_audit_plans sa 
        WHERE sa.supplier_id = s.id 
        AND sa.status = 'Tamamlandı'
        AND sa.actual_date >= CURRENT_DATE - INTERVAL '90 days'
    );
    
    -- Bekleyen tedarikçi denetimleri
    SELECT COUNT(*) INTO v_pending_audits
    FROM supplier_audit_plans 
    WHERE status = 'Planlandı' 
    AND planned_date < CURRENT_DATE;
    
    -- Red oranı (son 30 gün)
    SELECT COALESCE(
        (SUM(COALESCE(quantity_rejected, 0))::NUMERIC / NULLIF(SUM(quantity_received), 0)) * 100,
        0
    ) INTO v_rejection_rate
    FROM incoming_inspections 
    WHERE inspection_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Skor hesapla
    IF v_low_performance > 3 THEN v_score := v_score - 20; END IF;
    IF v_no_audit_90_days > 0 THEN v_score := v_score - 15; END IF;
    IF v_pending_audits > 2 THEN v_score := v_score - 15; END IF;
    IF v_rejection_rate > 5 THEN v_score := v_score - 20; END IF;
    
    -- Uyarılar ve öneriler
    IF v_no_audit_90_days > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Tedarikçi',
                'priority', 'HIGH',
                'title', v_no_audit_90_days || ' yüksek riskli tedarikçi denetlenmedi',
                'description', '90 günden fazla denetim yapılmamış yüksek riskli tedarikçiler var.',
                'action', 'Tedarikçi denetim planını güncelleyin'
            )
        );
    END IF;
    
    IF v_pending_audits > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Tedarikçi',
                'priority', 'HIGH',
                'title', v_pending_audits || ' adet tedarikçi denetimi gecikmiş',
                'description', 'Planlanan tedarikçi denetimleri zamanında yapılmadı.',
                'action', 'Gecikmiş denetimleri tamamlayın'
            )
        );
    END IF;
    
    IF v_rejection_rate > 3 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Tedarikçi',
                'priority', CASE WHEN v_rejection_rate > 5 THEN 'CRITICAL' ELSE 'HIGH' END,
                'title', 'Tedarikçi red oranı yüksek: %' || ROUND(v_rejection_rate, 1),
                'description', 'Son 30 günde giriş kontrol red oranı yüksek seyrediyor.',
                'action', 'Tedarikçi geliştirme planı oluşturun'
            )
        );
    END IF;
    
    IF v_low_performance > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Tedarikçi',
                'priority', 'NORMAL',
                'title', v_low_performance || ' tedarikçinin performansı düşük',
                'description', 'Kalite performansı %70 altında olan tedarikçiler için aksiyon alın.',
                'action', 'Tedarikçi performans kartlarını inceleyin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_approved_suppliers', v_total_suppliers,
            'low_performance_count', v_low_performance,
            'no_audit_90_days', v_no_audit_90_days,
            'pending_audits', v_pending_audits,
            'rejection_rate_30_days', ROUND(COALESCE(v_rejection_rate, 0), 2)
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- KALİBRASYON ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_calibration_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_equipment INTEGER;
    v_overdue_count INTEGER;
    v_due_30_days INTEGER;
    v_no_calibration INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam aktif ekipman
    SELECT COUNT(*) INTO v_total_equipment 
    FROM equipments WHERE status = 'Aktif';
    
    -- Kalibrasyonu gecikmiş ekipman
    SELECT COUNT(*) INTO v_overdue_count
    FROM equipments e
    WHERE e.status = 'Aktif'
    AND EXISTS (
        SELECT 1 FROM equipment_calibrations ec 
        WHERE ec.equipment_id = e.id 
        AND ec.is_active = true
        AND ec.next_calibration_date < CURRENT_DATE
    );
    
    -- Önümüzdeki 30 gün kalibrasyon gerekecek
    SELECT COUNT(*) INTO v_due_30_days
    FROM equipments e
    WHERE e.status = 'Aktif'
    AND EXISTS (
        SELECT 1 FROM equipment_calibrations ec 
        WHERE ec.equipment_id = e.id 
        AND ec.is_active = true
        AND ec.next_calibration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    );
    
    -- Hiç kalibrasyon kaydı olmayan ekipman
    SELECT COUNT(*) INTO v_no_calibration
    FROM equipments e
    WHERE e.status = 'Aktif'
    AND e.calibration_frequency_months IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM equipment_calibrations ec WHERE ec.equipment_id = e.id
    );
    
    -- Skor hesapla
    IF v_overdue_count > 0 THEN v_score := v_score - (v_overdue_count * 10); END IF;
    IF v_no_calibration > 5 THEN v_score := v_score - 15; END IF;
    
    -- Uyarılar
    IF v_overdue_count > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Kalibrasyon',
                'priority', 'CRITICAL',
                'title', v_overdue_count || ' ekipmanın kalibrasyonu gecikmiş',
                'description', 'Kalibrasyon süresi geçmiş ekipmanlarla ölçüm yapılmamalıdır!',
                'action', 'Kalibrasyon modülüne gidin ve acil kalibrasyon planlayın'
            )
        );
    END IF;
    
    IF v_due_30_days > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Kalibrasyon',
                'priority', 'HIGH',
                'title', v_due_30_days || ' ekipman 30 gün içinde kalibrasyon gerektirecek',
                'description', 'Kalibrasyon planlamasını şimdiden yapın.',
                'action', 'Kalibrasyon takvimini kontrol edin'
            )
        );
    END IF;
    
    IF v_no_calibration > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Kalibrasyon',
                'priority', 'NORMAL',
                'title', v_no_calibration || ' ekipmanın kalibrasyon kaydı yok',
                'description', 'Kalibrasyona tabi olması gereken ekipmanların kayıtlarını tamamlayın.',
                'action', 'Ekipman listesini gözden geçirin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_equipment', v_total_equipment,
            'overdue_calibrations', v_overdue_count,
            'due_in_30_days', v_due_30_days,
            'no_calibration_record', v_no_calibration
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- DOKÜMAN ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_document_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_documents INTEGER;
    v_expiring_30_days INTEGER;
    v_expired INTEGER;
    v_no_review_date INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam aktif doküman
    SELECT COUNT(*) INTO v_total_documents 
    FROM documents WHERE is_active = true AND is_archived = false;
    
    -- 30 gün içinde süresi dolacak
    SELECT COUNT(*) INTO v_expiring_30_days
    FROM documents 
    WHERE is_active = true 
    AND valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
    
    -- Süresi dolmuş dokümanlar
    SELECT COUNT(*) INTO v_expired
    FROM documents 
    WHERE is_active = true 
    AND valid_until < CURRENT_DATE;
    
    -- Revizyon tarihi geçmiş dokümanlar
    SELECT COUNT(*) INTO v_no_review_date
    FROM documents 
    WHERE is_active = true 
    AND next_review_date < CURRENT_DATE;
    
    -- Skor hesapla
    IF v_expired > 0 THEN v_score := v_score - (v_expired * 5); END IF;
    IF v_no_review_date > 10 THEN v_score := v_score - 15; END IF;
    
    -- Uyarılar
    IF v_expired > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Doküman',
                'priority', 'HIGH',
                'title', v_expired || ' dokümanın geçerlilik süresi dolmuş',
                'description', 'Süresi dolmuş dokümanlar kullanılmamalıdır. Revize edin veya arşivleyin.',
                'action', 'Doküman yönetimi modülüne gidin'
            )
        );
    END IF;
    
    IF v_expiring_30_days > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Doküman',
                'priority', 'NORMAL',
                'title', v_expiring_30_days || ' doküman 30 gün içinde geçerliliğini yitirecek',
                'description', 'Revizyon planlaması yapın.',
                'action', 'Doküman revizyon takvimini kontrol edin'
            )
        );
    END IF;
    
    IF v_no_review_date > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Doküman',
                'priority', 'NORMAL',
                'title', v_no_review_date || ' dokümanın revizyon tarihi geçmiş',
                'description', 'Periyodik gözden geçirme yapılması gereken dokümanlar var.',
                'action', 'Doküman gözden geçirme planı yapın'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_documents', v_total_documents,
            'expiring_30_days', v_expiring_30_days,
            'expired', v_expired,
            'review_overdue', v_no_review_date
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- EĞİTİM ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_training_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_trainings INTEGER;
    v_completed_trainings INTEGER;
    v_upcoming_trainings INTEGER;
    v_low_participation NUMERIC;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Bu yıl planlanan eğitimler
    SELECT COUNT(*) INTO v_total_trainings 
    FROM trainings 
    WHERE EXTRACT(YEAR FROM scheduled_date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Tamamlanan eğitimler
    SELECT COUNT(*) INTO v_completed_trainings 
    FROM trainings 
    WHERE status = 'Tamamlandı'
    AND EXTRACT(YEAR FROM scheduled_date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Önümüzdeki 30 gün eğitim
    SELECT COUNT(*) INTO v_upcoming_trainings
    FROM trainings 
    WHERE status = 'Planlandı'
    AND scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
    
    -- Ortalama katılım oranı
    SELECT COALESCE(AVG(
        CASE WHEN t.capacity > 0 THEN 
            (SELECT COUNT(*) FROM training_participants tp WHERE tp.training_id = t.id)::NUMERIC / t.capacity * 100
        ELSE 100 END
    ), 100) INTO v_low_participation
    FROM trainings t
    WHERE t.status = 'Tamamlandı'
    AND t.scheduled_date >= CURRENT_DATE - INTERVAL '90 days';
    
    -- Skor hesapla
    IF v_total_trainings = 0 THEN v_score := v_score - 30; END IF;
    IF v_low_participation < 70 THEN v_score := v_score - 15; END IF;
    IF v_upcoming_trainings = 0 AND EXTRACT(MONTH FROM CURRENT_DATE) < 11 THEN 
        v_score := v_score - 10; 
    END IF;
    
    -- Öneriler
    IF v_total_trainings < 4 AND EXTRACT(MONTH FROM CURRENT_DATE) > 3 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Eğitim',
                'priority', 'HIGH',
                'title', 'Eğitim planı yetersiz',
                'description', 'Bu yıl sadece ' || v_total_trainings || ' eğitim planlanmış. Yıllık eğitim planınızı gözden geçirin.',
                'action', 'Eğitim modülüne gidin ve yeni eğitimler planlayın'
            )
        );
    END IF;
    
    IF v_upcoming_trainings = 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Eğitim',
                'priority', 'NORMAL',
                'title', 'Önümüzdeki 30 gün eğitim planlanmamış',
                'description', 'Düzenli eğitim faaliyetleri kalite bilincini artırır.',
                'action', 'Eğitim takvimini kontrol edin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_trainings_this_year', v_total_trainings,
            'completed_trainings', v_completed_trainings,
            'upcoming_30_days', v_upcoming_trainings,
            'avg_participation_rate', ROUND(COALESCE(v_low_participation, 0), 1)
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- MÜŞTERİ ŞİKAYETİ ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_complaint_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_open_complaints INTEGER;
    v_overdue_complaints INTEGER;
    v_this_month INTEGER;
    v_last_month INTEGER;
    v_avg_resolution_days NUMERIC;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Açık şikayetler
    SELECT COUNT(*) INTO v_open_complaints 
    FROM customer_complaints 
    WHERE status NOT IN ('Kapatıldı', 'Çözüldü');
    
    -- Gecikmiş şikayetler (hedef kapanış tarihi geçmiş)
    SELECT COUNT(*) INTO v_overdue_complaints
    FROM customer_complaints 
    WHERE status NOT IN ('Kapatıldı', 'Çözüldü')
    AND target_close_date < CURRENT_DATE;
    
    -- Bu ay gelen şikayet
    SELECT COUNT(*) INTO v_this_month
    FROM customer_complaints 
    WHERE DATE_TRUNC('month', complaint_date) = DATE_TRUNC('month', CURRENT_DATE);
    
    -- Geçen ay gelen şikayet
    SELECT COUNT(*) INTO v_last_month
    FROM customer_complaints 
    WHERE DATE_TRUNC('month', complaint_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    
    -- Ortalama çözüm süresi
    SELECT AVG(actual_close_date - complaint_date) INTO v_avg_resolution_days
    FROM customer_complaints 
    WHERE actual_close_date IS NOT NULL
    AND actual_close_date >= CURRENT_DATE - INTERVAL '90 days';
    
    -- Skor hesapla
    IF v_overdue_complaints > 0 THEN v_score := v_score - (v_overdue_complaints * 15); END IF;
    IF v_open_complaints > 10 THEN v_score := v_score - 15; END IF;
    IF COALESCE(v_avg_resolution_days, 0) > 30 THEN v_score := v_score - 10; END IF;
    
    -- Uyarılar
    IF v_overdue_complaints > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Müşteri Şikayeti',
                'priority', 'CRITICAL',
                'title', v_overdue_complaints || ' müşteri şikayeti SLA süresini aştı',
                'description', 'Müşteri memnuniyeti için şikayetleri zamanında kapatın.',
                'action', 'Şikayet modülüne gidin ve gecikmiş şikayetleri inceleyin'
            )
        );
    END IF;
    
    IF v_this_month > v_last_month * 1.5 AND v_last_month > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Müşteri Şikayeti',
                'priority', 'HIGH',
                'title', 'Müşteri şikayetlerinde artış trendi',
                'description', 'Bu ay (' || v_this_month || ') geçen aya (' || v_last_month || ') göre şikayetler arttı.',
                'action', 'Kök neden analizi yapın'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'open_complaints', v_open_complaints,
            'overdue_complaints', v_overdue_complaints,
            'this_month_count', v_this_month,
            'last_month_count', v_last_month,
            'avg_resolution_days', ROUND(COALESCE(v_avg_resolution_days, 0), 1)
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- KPI ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_kpi_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_kpis INTEGER;
    v_on_target INTEGER;
    v_below_target INTEGER;
    v_no_data INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam KPI
    SELECT COUNT(*) INTO v_total_kpis FROM kpis;
    
    -- Hedefe ulaşan KPI
    SELECT COUNT(*) INTO v_on_target
    FROM kpis
    WHERE current_value IS NOT NULL 
    AND target_value IS NOT NULL
    AND (
        (target_direction = 'increase' AND current_value >= target_value)
        OR (target_direction = 'decrease' AND current_value <= target_value)
    );
    
    -- Hedefin altında KPI
    SELECT COUNT(*) INTO v_below_target
    FROM kpis
    WHERE current_value IS NOT NULL 
    AND target_value IS NOT NULL
    AND (
        (target_direction = 'increase' AND current_value < target_value)
        OR (target_direction = 'decrease' AND current_value > target_value)
    );
    
    -- Veri girilmemiş KPI
    SELECT COUNT(*) INTO v_no_data
    FROM kpis
    WHERE current_value IS NULL;
    
    -- Skor hesapla
    IF v_total_kpis > 0 THEN
        v_score := (v_on_target::NUMERIC / v_total_kpis) * 100;
    END IF;
    IF v_no_data > v_total_kpis * 0.3 THEN v_score := v_score - 15; END IF;
    
    -- Uyarılar
    IF v_below_target > v_total_kpis * 0.5 AND v_total_kpis > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'KPI',
                'priority', 'HIGH',
                'title', 'KPI''lerin %' || ROUND((v_below_target::NUMERIC / v_total_kpis) * 100) || ' hedefin altında',
                'description', v_below_target || ' KPI hedefin altında. İyileştirme aksiyonları alın.',
                'action', 'KPI Dashboard''u inceleyin'
            )
        );
    END IF;
    
    IF v_no_data > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'KPI',
                'priority', 'NORMAL',
                'title', v_no_data || ' KPI için veri girilmemiş',
                'description', 'Tüm KPI''lar için güncel veri girin.',
                'action', 'KPI verilerini güncelleyin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_kpis', v_total_kpis,
            'on_target', v_on_target,
            'below_target', v_below_target,
            'no_data', v_no_data,
            'achievement_rate', CASE WHEN v_total_kpis > 0 THEN 
                ROUND((v_on_target::NUMERIC / v_total_kpis) * 100, 1) ELSE 0 END
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- KAİZEN ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_kaizen_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_kaizen INTEGER;
    v_pending INTEGER;
    v_completed INTEGER;
    v_this_year INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Toplam kaizen
    SELECT COUNT(*) INTO v_total_kaizen FROM kaizen_entries;
    
    -- Bekleyen öneriler
    SELECT COUNT(*) INTO v_pending
    FROM kaizen_entries WHERE status IN ('Taslak', 'Değerlendirmede');
    
    -- Tamamlanan
    SELECT COUNT(*) INTO v_completed
    FROM kaizen_entries WHERE status = 'Tamamlandı';
    
    -- Bu yıl oluşturulan
    SELECT COUNT(*) INTO v_this_year
    FROM kaizen_entries 
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Skor hesapla
    IF v_this_year < 2 AND EXTRACT(MONTH FROM CURRENT_DATE) > 3 THEN 
        v_score := v_score - 20; 
    END IF;
    IF v_pending > 5 THEN v_score := v_score - 10; END IF;
    
    -- Öneriler
    IF v_this_year < 2 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Kaizen',
                'priority', 'NORMAL',
                'title', 'Kaizen aktivitesi düşük',
                'description', 'Bu yıl sadece ' || v_this_year || ' kaizen önerisi var. Sürekli iyileştirme kültürünü teşvik edin.',
                'action', 'Kaizen kampanyası düzenleyin'
            )
        );
    END IF;
    
    IF v_pending > 3 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Kaizen',
                'priority', 'NORMAL',
                'title', v_pending || ' kaizen önerisi değerlendirme bekliyor',
                'description', 'Çalışan önerilerini zamanında değerlendirin.',
                'action', 'Kaizen modülüne gidin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_kaizen', v_total_kaizen,
            'pending', v_pending,
            'completed', v_completed,
            'this_year_count', v_this_year
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- KARANTİNA ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_quarantine_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_count INTEGER;
    v_long_stay INTEGER;
    v_pending_decision INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Aktif karantina kayıtları
    SELECT COUNT(*) INTO v_active_count
    FROM quarantine_records WHERE status = 'Karantinada';
    
    -- 30 günden fazla karantinada
    SELECT COUNT(*) INTO v_long_stay
    FROM quarantine_records 
    WHERE status = 'Karantinada'
    AND quarantine_date < CURRENT_DATE - INTERVAL '30 days';
    
    -- Karar bekleyen
    SELECT COUNT(*) INTO v_pending_decision
    FROM quarantine_records 
    WHERE status = 'Karantinada'
    AND decision IS NULL;
    
    -- Skor hesapla
    IF v_long_stay > 0 THEN v_score := v_score - (v_long_stay * 10); END IF;
    IF v_active_count > 20 THEN v_score := v_score - 15; END IF;
    
    -- Uyarılar
    IF v_long_stay > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Karantina',
                'priority', 'HIGH',
                'title', v_long_stay || ' kayıt 30 günden fazla karantinada',
                'description', 'Uzun süreli karantina kayıtları stok maliyeti ve alan işgali oluşturur.',
                'action', 'Karantina modülüne gidin ve karar verin'
            )
        );
    END IF;
    
    IF v_pending_decision > 5 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Karantina',
                'priority', 'NORMAL',
                'title', v_pending_decision || ' kayıt karar bekliyor',
                'description', 'Karantina kararlarını hızlandırın.',
                'action', 'Karantina kayıtlarını inceleyin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'active_count', v_active_count,
            'long_stay_count', v_long_stay,
            'pending_decision', v_pending_decision
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- GÖREV ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_task_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_open_tasks INTEGER;
    v_overdue_tasks INTEGER;
    v_blocked_tasks INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Açık görevler
    SELECT COUNT(*) INTO v_open_tasks
    FROM tasks WHERE status NOT IN ('Tamamlandı', 'İptal');
    
    -- Gecikmiş görevler
    SELECT COUNT(*) INTO v_overdue_tasks
    FROM tasks 
    WHERE status NOT IN ('Tamamlandı', 'İptal')
    AND due_date < NOW();
    
    -- Bloklanmış görevler
    SELECT COUNT(*) INTO v_blocked_tasks
    FROM tasks WHERE blocked_reason IS NOT NULL AND blocked_reason != '';
    
    -- Skor hesapla
    IF v_overdue_tasks > 5 THEN v_score := v_score - 25; END IF;
    IF v_blocked_tasks > 3 THEN v_score := v_score - 15; END IF;
    
    -- Uyarılar
    IF v_overdue_tasks > 0 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Görev',
                'priority', CASE WHEN v_overdue_tasks > 10 THEN 'CRITICAL' ELSE 'HIGH' END,
                'title', v_overdue_tasks || ' görev gecikmiş',
                'description', 'Termin tarihi geçmiş görevleri tamamlayın veya yeniden planlayın.',
                'action', 'Görev Yönetimi modülüne gidin'
            )
        );
    END IF;
    
    IF v_blocked_tasks > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Görev',
                'priority', 'NORMAL',
                'title', v_blocked_tasks || ' görev bloklanmış durumda',
                'description', 'Bloklanmış görevlerin engellerini kaldırın.',
                'action', 'Bloklanmış görevleri inceleyin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'open_tasks', v_open_tasks,
            'overdue_tasks', v_overdue_tasks,
            'blocked_tasks', v_blocked_tasks
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- GİRİŞ KALİTE ANALİZ FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION analyze_incoming_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_inspections INTEGER;
    v_rejection_rate NUMERIC;
    v_conditional_rate NUMERIC;
    v_pending_inkr INTEGER;
    v_score NUMERIC := 100;
    v_recommendations JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
BEGIN
    -- Son 30 gün toplam kontrol
    SELECT COUNT(*) INTO v_total_inspections
    FROM incoming_inspections 
    WHERE inspection_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Red oranı
    SELECT COALESCE(
        (SUM(COALESCE(quantity_rejected, 0))::NUMERIC / NULLIF(SUM(quantity_received), 0)) * 100, 0
    ) INTO v_rejection_rate
    FROM incoming_inspections 
    WHERE inspection_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Şartlı kabul oranı
    SELECT COALESCE(
        (SUM(COALESCE(quantity_conditional, 0))::NUMERIC / NULLIF(SUM(quantity_received), 0)) * 100, 0
    ) INTO v_conditional_rate
    FROM incoming_inspections 
    WHERE inspection_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Bekleyen INKR
    SELECT COUNT(*) INTO v_pending_inkr
    FROM inkr_reports WHERE status = 'Beklemede';
    
    -- Skor hesapla
    IF v_rejection_rate > 5 THEN v_score := v_score - 25; END IF;
    IF v_conditional_rate > 10 THEN v_score := v_score - 15; END IF;
    IF v_pending_inkr > 5 THEN v_score := v_score - 10; END IF;
    
    -- Uyarılar
    IF v_rejection_rate > 3 THEN
        v_alerts := v_alerts || jsonb_build_array(
            jsonb_build_object(
                'module', 'Giriş Kalite',
                'priority', CASE WHEN v_rejection_rate > 5 THEN 'CRITICAL' ELSE 'HIGH' END,
                'title', 'Giriş kontrol red oranı yüksek: %' || ROUND(v_rejection_rate, 1),
                'description', 'Tedarikçi kalite sorunları var. Tedarikçi geliştirme aksiyonları alın.',
                'action', 'Giriş Kalite modülünü inceleyin'
            )
        );
    END IF;
    
    IF v_conditional_rate > 10 THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object(
                'module', 'Giriş Kalite',
                'priority', 'HIGH',
                'title', 'Şartlı kabul oranı yüksek: %' || ROUND(v_conditional_rate, 1),
                'description', 'Çok fazla şartlı kabul yapılıyor. Risk değerlendirmesi yapın.',
                'action', 'Şartlı kabul kriterlerini gözden geçirin'
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'score', GREATEST(v_score, 0),
        'metrics', jsonb_build_object(
            'total_inspections_30_days', v_total_inspections,
            'rejection_rate', ROUND(COALESCE(v_rejection_rate, 0), 2),
            'conditional_rate', ROUND(COALESCE(v_conditional_rate, 0), 2),
            'pending_inkr', v_pending_inkr
        ),
        'recommendations', v_recommendations,
        'alerts', v_alerts
    );
END;
$$;

-- =====================================================
-- BİLDİRİM OLUŞTURMA FONKSİYONU
-- Advisor sonuçlarından bildirim oluşturur
-- =====================================================
CREATE OR REPLACE FUNCTION create_advisor_notifications(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_analysis JSONB;
    v_alert JSONB;
    v_notification_count INTEGER := 0;
    v_existing_count INTEGER;
BEGIN
    -- Analizi çalıştır
    SELECT analyze_quality_system() INTO v_analysis;
    
    -- Her alert için bildirim oluştur
    FOR v_alert IN SELECT * FROM jsonb_array_elements(v_analysis->'alerts')
    LOOP
        -- Duplicate kontrolü
        SELECT COUNT(*) INTO v_existing_count
        FROM notifications
        WHERE user_id = p_user_id
        AND title = v_alert->>'title'
        AND created_at >= NOW() - INTERVAL '24 hours';
        
        IF v_existing_count = 0 THEN
            INSERT INTO notifications (
                user_id,
                notification_type,
                title,
                message,
                related_module,
                priority,
                action_url
            ) VALUES (
                p_user_id,
                CASE 
                    WHEN v_alert->>'module' = 'NC' THEN 'NC_CREATED'
                    WHEN v_alert->>'module' = 'Denetim' THEN 'AUDIT_DUE'
                    WHEN v_alert->>'module' = 'Tedarikçi' THEN 'SUPPLIER_REJECTION'
                    WHEN v_alert->>'module' = 'Kalibrasyon' THEN 'CALIBRATION_DUE'
                    WHEN v_alert->>'module' = 'Doküman' THEN 'DOCUMENT_EXPIRING'
                    WHEN v_alert->>'module' = 'Müşteri Şikayeti' THEN 'COMPLAINT_SLA_WARNING'
                    WHEN v_alert->>'module' = 'KPI' THEN 'KPI_TARGET_MISSED'
                    WHEN v_alert->>'module' = 'Görev' THEN 'TASK_DUE'
                    WHEN v_alert->>'module' = 'Karantina' THEN 'QUARANTINE_LONG_STAY'
                    ELSE '8D_OVERDUE'
                END,
                v_alert->>'title',
                v_alert->>'description',
                v_alert->>'module',
                COALESCE(v_alert->>'priority', 'NORMAL'),
                v_alert->>'action'
            );
            v_notification_count := v_notification_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_notification_count;
END;
$$;

-- =====================================================
-- DANIŞMAN ÇALIŞTIRMA FONKSİYONU (Ana Fonksiyon)
-- =====================================================
CREATE OR REPLACE FUNCTION run_quality_advisor(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_analysis JSONB;
    v_notification_count INTEGER;
BEGIN
    -- User ID belirle
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Analizi çalıştır
    SELECT analyze_quality_system() INTO v_analysis;
    
    -- Eğer user_id varsa bildirimleri oluştur
    IF v_user_id IS NOT NULL THEN
        SELECT create_advisor_notifications(v_user_id) INTO v_notification_count;
        v_analysis := v_analysis || jsonb_build_object('notifications_created', v_notification_count);
    END IF;
    
    -- Sonucu kaydet
    IF v_user_id IS NOT NULL THEN
        INSERT INTO quality_advisor_results (
            user_id,
            total_score,
            module_scores,
            recommendations,
            alerts,
            trends
        ) VALUES (
            v_user_id,
            (v_analysis->>'total_score')::NUMERIC,
            v_analysis->'module_scores',
            v_analysis->'recommendations',
            v_analysis->'alerts',
            v_analysis->'trends'
        );
    END IF;
    
    RETURN v_analysis;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION analyze_quality_system() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_nc_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_audit_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_supplier_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_calibration_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_document_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_training_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_complaint_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_kpi_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_kaizen_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_quarantine_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_task_module() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_incoming_module() TO authenticated;
GRANT EXECUTE ON FUNCTION create_advisor_notifications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION run_quality_advisor(UUID) TO authenticated;

