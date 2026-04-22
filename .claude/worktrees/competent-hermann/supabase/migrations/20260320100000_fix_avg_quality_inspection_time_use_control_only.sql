-- Ortalama Kalite Kontrol Süresi KPI düzeltmesi
-- Önceki: approved_at - created_at (tüm süreç: bekleme + kontrol + yeniden işlem)
-- Yeni: Sadece control_start → control_end (gerçek muayene süresi, yeniden işlem hariç)
CREATE OR REPLACE FUNCTION get_avg_quality_inspection_time()
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_avg_days NUMERIC;
BEGIN
    WITH waiting_ts AS (
        SELECT inspection_id, MIN(event_timestamp) AS ts
        FROM vehicle_timeline_events
        WHERE event_type = 'waiting_for_shipping_info'
        GROUP BY inspection_id
    ),
    control_starts AS (
        SELECT vte.inspection_id, vte.event_timestamp,
            ROW_NUMBER() OVER (PARTITION BY vte.inspection_id ORDER BY vte.event_timestamp) AS rn
        FROM vehicle_timeline_events vte
        WHERE vte.event_type = 'control_start'
        AND (NOT EXISTS (SELECT 1 FROM waiting_ts w WHERE w.inspection_id = vte.inspection_id)
             OR vte.event_timestamp < (SELECT ts FROM waiting_ts w2 WHERE w2.inspection_id = vte.inspection_id))
    ),
    control_ends AS (
        SELECT vte.inspection_id, vte.event_timestamp,
            ROW_NUMBER() OVER (PARTITION BY vte.inspection_id ORDER BY vte.event_timestamp) AS rn
        FROM vehicle_timeline_events vte
        WHERE vte.event_type = 'control_end'
        AND (NOT EXISTS (SELECT 1 FROM waiting_ts w WHERE w.inspection_id = vte.inspection_id)
             OR vte.event_timestamp < (SELECT ts FROM waiting_ts w2 WHERE w2.inspection_id = vte.inspection_id))
    ),
    pairs AS (
        SELECT s.inspection_id,
            EXTRACT(EPOCH FROM (e.event_timestamp - s.event_timestamp)) / 86400 AS duration_days
        FROM control_starts s
        JOIN control_ends e ON s.inspection_id = e.inspection_id AND s.rn = e.rn
    ),
    per_inspection AS (
        SELECT inspection_id, SUM(duration_days) AS total_control_days
        FROM pairs
        GROUP BY inspection_id
    )
    SELECT AVG(total_control_days)::NUMERIC INTO v_avg_days FROM per_inspection;

    RETURN COALESCE(ROUND(v_avg_days, 2), 0);
END;
$$;

COMMENT ON FUNCTION get_avg_quality_inspection_time() IS 'Ortalama kalite kontrol (muayene) süresi - sadece control_start→control_end, yeniden işlem süresi dahil değil. Sonuç gün cinsinden.';
