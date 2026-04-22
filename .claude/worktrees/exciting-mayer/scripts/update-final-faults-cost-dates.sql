-- ============================================================================
-- Final Hataları Maliyet Kayıtlarının Tarihlerini Güncelleme
-- ============================================================================
-- Bu script, kaliteye verilen araçlar modülünde oluşturulan final hataları
-- maliyet kayıtlarının cost_date alanını araçların kontrole girdiği tarihe
-- göre günceller.

-- Önce mevcut kayıtları kontrol et
SELECT 
    qc.id,
    qc.cost_date as mevcut_tarih,
    qi.quality_entry_at,
    (SELECT event_timestamp 
     FROM vehicle_timeline_events 
     WHERE inspection_id = qc.source_record_id 
       AND event_type = 'quality_entry' 
     ORDER BY event_timestamp ASC 
     LIMIT 1) as quality_entry_event,
    (SELECT event_timestamp 
     FROM vehicle_timeline_events 
     WHERE inspection_id = qc.source_record_id 
       AND event_type = 'control_start' 
     ORDER BY event_timestamp ASC 
     LIMIT 1) as control_start_event
FROM quality_costs qc
LEFT JOIN quality_inspections qi ON qi.id = qc.source_record_id
WHERE qc.source_type = 'produced_vehicle_final_faults'
  AND qc.source_record_id IS NOT NULL
LIMIT 10;

-- Mevcut kayıtları güncelle
UPDATE quality_costs qc
SET cost_date = COALESCE(
    -- Önce quality_entry_at alanını kullan
    (SELECT DATE(qi.quality_entry_at) 
     FROM quality_inspections qi 
     WHERE qi.id = qc.source_record_id 
       AND qi.quality_entry_at IS NOT NULL),
    -- Sonra quality_entry event'ini kullan
    (SELECT DATE(vte.event_timestamp) 
     FROM vehicle_timeline_events vte 
     WHERE vte.inspection_id = qc.source_record_id 
       AND vte.event_type = 'quality_entry' 
     ORDER BY vte.event_timestamp ASC 
     LIMIT 1),
    -- Son olarak control_start event'ini kullan
    (SELECT DATE(vte.event_timestamp) 
     FROM vehicle_timeline_events vte 
     WHERE vte.inspection_id = qc.source_record_id 
       AND vte.event_type = 'control_start' 
     ORDER BY vte.event_timestamp ASC 
     LIMIT 1),
    -- Hiçbiri yoksa mevcut tarihi koru
    qc.cost_date
),
updated_at = NOW()
WHERE qc.source_type = 'produced_vehicle_final_faults'
  AND qc.source_record_id IS NOT NULL
  AND (
    -- Sadece tarihi değişecek kayıtları güncelle
    EXISTS (
      SELECT 1 FROM quality_inspections qi 
      WHERE qi.id = qc.source_record_id 
        AND qi.quality_entry_at IS NOT NULL
        AND DATE(qi.quality_entry_at) != qc.cost_date
    )
    OR EXISTS (
      SELECT 1 FROM vehicle_timeline_events vte 
      WHERE vte.inspection_id = qc.source_record_id 
        AND vte.event_type IN ('quality_entry', 'control_start')
        AND DATE(vte.event_timestamp) != qc.cost_date
    )
  );

-- Güncellenen kayıt sayısını göster
SELECT 
    COUNT(*) as guncellenen_kayit_sayisi,
    COUNT(DISTINCT source_record_id) as etkilenen_arac_sayisi
FROM quality_costs
WHERE source_type = 'produced_vehicle_final_faults'
  AND updated_at >= NOW() - INTERVAL '1 minute';

