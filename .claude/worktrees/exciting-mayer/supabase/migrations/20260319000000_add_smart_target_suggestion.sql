-- Akıllı hedef önerisi: geçmiş verilere göre gerçekçi, motive edici hedef önerir
CREATE OR REPLACE FUNCTION get_smart_target_suggestion(p_kpi_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_direction text;
    v_unit text;
    v_current_target numeric;
    v_recent_avg numeric;
    v_best numeric;
    v_worst numeric;
    v_suggested numeric;
    v_reason text;
    v_months_count int;
    v_last_actual numeric;
    v_prev_actual numeric;
BEGIN
    SELECT target_direction, COALESCE(target_value, 0), unit INTO v_direction, v_current_target, v_unit
    FROM kpis WHERE id = p_kpi_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'KPI bulunamadı'); END IF;

    WITH last_months AS (
        SELECT actual_value::numeric as av, year, month,
               ROW_NUMBER() OVER (ORDER BY year DESC, month DESC) as rn
        FROM kpi_monthly_data
        WHERE kpi_id = p_kpi_id AND actual_value IS NOT NULL
        ORDER BY year DESC, month DESC
        LIMIT 12
    ),
    stats AS (
        SELECT COUNT(*) as cnt, AVG(av) as avg_val, MIN(av) as best_val, MAX(av) as worst_val,
               (SELECT av FROM last_months WHERE rn = 1 LIMIT 1) as last_val,
               (SELECT av FROM last_months WHERE rn = 2 LIMIT 1) as prev_val
        FROM last_months
    )
    SELECT cnt, avg_val, best_val, worst_val, last_val, prev_val
    INTO v_months_count, v_recent_avg, v_best, v_worst, v_last_actual, v_prev_actual
    FROM stats;

    v_recent_avg := COALESCE(v_recent_avg, 0);
    v_best := COALESCE(v_best, v_recent_avg);
    v_worst := COALESCE(v_worst, v_recent_avg);

    IF v_months_count < 1 THEN
        RETURN jsonb_build_object('success', true, 'suggested_value', v_current_target,
            'reason', 'Henüz yeterli geçmiş veri yok. Mevcut hedefi kullanın veya manuel girin.',
            'confidence', 0, 'trend', 'unknown', 'recent_avg', null, 'best_month', null, 'months_analyzed', 0);
    END IF;

    IF COALESCE(v_direction, 'increase') = 'decrease' THEN
        v_suggested := v_recent_avg * 0.92;
        IF v_best > 0 AND v_suggested < v_best * 0.85 THEN v_suggested := v_best * 0.9; END IF;
        IF v_suggested < 0 THEN v_suggested := 0; END IF;
        v_reason := 'Son ' || LEAST(v_months_count, 3) || ' ay ort: ' || ROUND(v_recent_avg, 2) || '. Öneri: yaklaşık %8 iyileştirme (düşük daha iyi).';
    ELSE
        v_suggested := v_recent_avg * 1.08;
        IF (v_unit IS NOT NULL AND position('%' in v_unit) > 0) AND v_suggested > 100 THEN v_suggested := 100; END IF;
        IF v_worst > 0 AND v_suggested < v_worst * 1.05 THEN v_suggested := v_worst * 1.05; END IF;
        v_reason := 'Son ' || LEAST(v_months_count, 3) || ' ay ort: ' || ROUND(v_recent_avg, 2) || '. Öneri: yaklaşık %8 iyileştirme (yüksek daha iyi).';
    END IF;

    v_reason := v_reason || ' Gerçekçi ve motive edici hedef.';

    RETURN jsonb_build_object('success', true, 'suggested_value', ROUND(v_suggested, 2), 'reason', v_reason,
        'recent_avg', ROUND(v_recent_avg, 2), 'best_month', v_best, 'months_analyzed', v_months_count,
        'confidence', LEAST(100, v_months_count * 25),
        'trend', CASE WHEN v_prev_actual IS NOT NULL AND v_last_actual < v_prev_actual AND v_direction = 'decrease' THEN 'improving'
                    WHEN v_prev_actual IS NOT NULL AND v_last_actual > v_prev_actual AND v_direction = 'increase' THEN 'improving'
                    WHEN v_prev_actual IS NOT NULL THEN 'declining' ELSE 'stable' END);
END;
$$;
