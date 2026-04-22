-- Akıllı hedef önerisi: Tüm mantık hatalarını düzelt
-- 1) % birimi: 100 tavan, v_worst bump cap'i eziyordu -> son adımda cap
-- 2) adet birimi: v_worst (MAX) bump aykırı değerleri tetikliyordu (ort 8.17 iken 28.35) -> kaldırıldı
-- 3) adet/% karışıklığı: mevcut değer esas alınır
CREATE OR REPLACE FUNCTION get_smart_target_suggestion(p_kpi_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_direction text;
    v_unit text;
    v_current_target numeric;
    v_current_value numeric;
    v_recent_avg numeric;
    v_best numeric;
    v_worst numeric;
    v_min_val numeric;
    v_suggested numeric;
    v_reason text;
    v_months_count int;
    v_last_actual numeric;
    v_prev_actual numeric;
    v_use_current boolean := false;
    v_is_pct boolean := false;
BEGIN
    SELECT target_direction, COALESCE(target_value, 0), unit, current_value
    INTO v_direction, v_current_target, v_unit, v_current_value
    FROM kpis WHERE id = p_kpi_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'KPI bulunamadı'); END IF;

    v_is_pct := (v_unit IS NOT NULL AND position('%' in v_unit) > 0);

    WITH last_months AS (
        SELECT actual_value::numeric as av, year, month,
               ROW_NUMBER() OVER (ORDER BY year DESC, month DESC) as rn
        FROM kpi_monthly_data
        WHERE kpi_id = p_kpi_id AND actual_value IS NOT NULL
        ORDER BY year DESC, month DESC
        LIMIT 12
    ),
    stats AS (
        SELECT COUNT(*) as cnt, AVG(av) as avg_val, MIN(av) as min_val, MAX(av) as max_val,
               (SELECT av FROM last_months WHERE rn = 1 LIMIT 1) as last_val,
               (SELECT av FROM last_months WHERE rn = 2 LIMIT 1) as prev_val
        FROM last_months
    )
    SELECT cnt, avg_val, min_val, max_val, last_val, prev_val
    INTO v_months_count, v_recent_avg, v_min_val, v_worst, v_last_actual, v_prev_actual
    FROM stats;

    v_recent_avg := COALESCE(v_recent_avg, 0);
    v_best := COALESCE(v_min_val, v_recent_avg);
    v_worst := COALESCE(v_worst, v_recent_avg);

    -- Birim % ise ve geçmiş ortalama düşük (<30) ama mevcut değer yüksek (>50): adet/% karışıklığı
    IF v_is_pct AND v_current_value IS NOT NULL AND v_current_value > 50
       AND v_recent_avg < 30 AND v_recent_avg > 0 THEN
        v_use_current := true;
        v_recent_avg := v_current_value;
        v_reason := 'Mevcut performans (' || ROUND(v_current_value, 2) || '%) esas alındı. Geçmiş veri birim uyumsuzluğu nedeniyle kullanılmadı. ';
    END IF;

    -- "Düşük daha iyi" KPI'larda: mevcut değer geçmiş ortalamadan çok daha iyiyse (örn. formül değişikliği)
    -- geçmiş veri güvenilir değildir, mevcut değeri esas al (örn. Ortalama Kalite Kontrol Süresi RPC düzeltmesi)
    IF NOT v_use_current AND COALESCE(v_direction, 'increase') = 'decrease'
       AND v_current_value IS NOT NULL AND v_current_value > 0 AND v_recent_avg > 0
       AND v_current_value < v_recent_avg * 0.5 THEN
        v_use_current := true;
        v_reason := 'Mevcut performans (' || ROUND(v_current_value, 2) || ') esas alındı. Geçmiş veri formül değişikliği nedeniyle kullanılmadı. ';
        v_recent_avg := v_current_value;
    END IF;

    IF v_months_count < 1 AND NOT v_use_current THEN
        IF v_current_value IS NOT NULL AND v_current_value > 0 THEN
            v_recent_avg := v_current_value;
            v_reason := 'Henüz aylık veri yok. Mevcut değer (' || ROUND(v_current_value, 2) || '%) esas alındı. ';
        ELSE
            RETURN jsonb_build_object('success', true, 'suggested_value', v_current_target,
                'reason', 'Henüz yeterli geçmiş veri yok. Mevcut hedefi kullanın veya manuel girin.',
                'confidence', 0, 'trend', 'unknown', 'recent_avg', null, 'best_month', null, 'months_analyzed', 0);
        END IF;
    END IF;

    IF COALESCE(v_direction, 'increase') = 'decrease' THEN
        v_suggested := v_recent_avg * 0.92;
        IF v_best > 0 AND v_suggested < v_best * 0.85 THEN v_suggested := v_best * 0.9; END IF;
        IF v_suggested < 0 THEN v_suggested := 0; END IF;
        v_reason := COALESCE(v_reason, '') || 'Son ' || LEAST(v_months_count, 3) || ' ay ort: ' || ROUND(v_recent_avg, 2) || '. Öneri: yaklaşık %8 iyileştirme (düşük daha iyi).';
    ELSE
        v_suggested := v_recent_avg * 1.08;
        -- v_worst (MAX) bump KALDIRILDI: ort 8.17 iken bir ay 27 olunca 28.35 öneriyordu
        -- Öneri sadece ortalamadan %8 artış olmalı
    END IF;

    -- % birimi: 100 tavan MUTLAKA uygulanır (v_worst bump 105'e çıkarıyordu)
    IF v_is_pct AND v_suggested > 100 THEN v_suggested := 100; END IF;

    v_reason := v_reason || ' Gerçekçi ve motive edici hedef.';

    RETURN jsonb_build_object('success', true, 'suggested_value', ROUND(v_suggested, 2), 'reason', v_reason,
        'recent_avg', ROUND(v_recent_avg, 2), 'best_month', v_best, 'months_analyzed', v_months_count,
        'confidence', LEAST(100, GREATEST(v_months_count, 1) * 25),
        'trend', CASE WHEN v_prev_actual IS NOT NULL AND v_last_actual < v_prev_actual AND v_direction = 'decrease' THEN 'improving'
                    WHEN v_prev_actual IS NOT NULL AND v_last_actual > v_prev_actual AND v_direction = 'increase' THEN 'improving'
                    WHEN v_prev_actual IS NOT NULL THEN 'declining' ELSE 'stable' END);
END;
$$;
