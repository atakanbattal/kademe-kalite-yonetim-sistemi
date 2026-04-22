-- ============================================================================
-- ARGE Özellikleri: Üretilen Araçlar Modülü
-- ============================================================================
-- Bu script ARGE incelemesi ve onay özelliklerini ekler

-- 1. quality_inspection_faults tablosuna arge_approved field'ı ekle
ALTER TABLE quality_inspection_faults 
ADD COLUMN IF NOT EXISTS arge_approved BOOLEAN DEFAULT false;

ALTER TABLE quality_inspection_faults 
ADD COLUMN IF NOT EXISTS arge_approved_at TIMESTAMPTZ;

ALTER TABLE quality_inspection_faults 
ADD COLUMN IF NOT EXISTS arge_approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN quality_inspection_faults.arge_approved IS 'ARGE onayı verildi mi?';
COMMENT ON COLUMN quality_inspection_faults.arge_approved_at IS 'ARGE onay tarihi';
COMMENT ON COLUMN quality_inspection_faults.arge_approved_by IS 'ARGE onayını veren kullanıcı';

-- 2. Trigger fonksiyonunu güncelle - ARGE event'lerini ekle
CREATE OR REPLACE FUNCTION update_vehicle_status_on_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Event type'a göre status güncelle
    CASE NEW.event_type
        WHEN 'quality_entry' THEN
            UPDATE quality_inspections 
            SET status = 'Kaliteye Girdi', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'control_start' THEN
            UPDATE quality_inspections 
            SET status = 'Kontrol Başladı', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'control_end' THEN
            UPDATE quality_inspections 
            SET status = 'Kontrol Bitti', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'rework_start' THEN
            UPDATE quality_inspections 
            SET status = 'Yeniden İşlemde', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'rework_end' THEN
            UPDATE quality_inspections 
            SET status = 'Yeniden İşlem Bitti', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'waiting_for_shipping_info' THEN
            UPDATE quality_inspections 
            SET status = 'Sevk Bilgisi Bekleniyor', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'ready_to_ship' THEN
            UPDATE quality_inspections 
            SET status = 'Sevk Hazır', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'shipped' THEN
            UPDATE quality_inspections 
            SET status = 'Sevk Edildi', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'arge_sent' THEN
            UPDATE quality_inspections 
            SET status = 'Ar-Ge''de', 
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        WHEN 'arge_returned' THEN
            -- Ar-Ge'den döndüğünde önceki duruma göre belirle
            -- Eğer kontrol bitmişse "Kontrol Bitti", yeniden işlem bitmişse "Yeniden İşlem Bitti" olarak ayarla
            UPDATE quality_inspections 
            SET status = CASE 
                WHEN status = 'Ar-Ge''de' THEN 'Kontrol Bitti'
                ELSE status
            END,
                status_entered_at = NEW.event_timestamp,
                updated_at = NOW()
            WHERE id = NEW.inspection_id;
            
        ELSE
            -- Diğer event type'lar için status güncelleme yapma
            NULL;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur veya güncelle
DROP TRIGGER IF EXISTS trigger_update_vehicle_status_on_timeline_event ON vehicle_timeline_events;
CREATE TRIGGER trigger_update_vehicle_status_on_timeline_event
    AFTER INSERT ON vehicle_timeline_events
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_status_on_timeline_event();

COMMENT ON FUNCTION update_vehicle_status_on_timeline_event() IS 'vehicle_timeline_events tablosuna event eklendiğinde quality_inspections tablosundaki status ve status_entered_at alanlarını otomatik günceller. ARGE event''leri dahil.';
