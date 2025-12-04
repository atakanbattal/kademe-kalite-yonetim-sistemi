-- Müşteri Şikayetleri SLA ve Sınıflandırma Geliştirmeleri
-- ISO 10002 gereklilikleri için

-- 1. Şikayet sınıflandırma sistemini genişletme
-- Veritabanında complaint_category kolonu zaten var, sadece değerleri güncelliyoruz

-- 2. SLA süreleri için yeni kolonlar ekleme
ALTER TABLE customer_complaints
ADD COLUMN IF NOT EXISTS complaint_classification VARCHAR(50) DEFAULT 'Ürün', -- 'Ürün', 'Servis', 'Montaj', 'Yanlış Kullanım', 'Diğer'
ADD COLUMN IF NOT EXISTS sla_first_response_hours INTEGER DEFAULT 72, -- İlk yanıt için SLA (saat)
ADD COLUMN IF NOT EXISTS sla_resolution_hours INTEGER DEFAULT 168, -- Çözüm için SLA (saat)
ADD COLUMN IF NOT EXISTS first_response_date TIMESTAMPTZ, -- İlk yanıt tarihi
ADD COLUMN IF NOT EXISTS first_response_hours INTEGER, -- İlk yanıt süresi (saat)
ADD COLUMN IF NOT EXISTS resolution_hours INTEGER, -- Çözüm süresi (saat)
ADD COLUMN IF NOT EXISTS sla_status VARCHAR(50) DEFAULT 'On Time', -- 'On Time', 'At Risk', 'Overdue'
ADD COLUMN IF NOT EXISTS sla_first_response_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'On Time', 'At Risk', 'Overdue'
ADD COLUMN IF NOT EXISTS sla_resolution_status VARCHAR(50) DEFAULT 'Pending'; -- 'Pending', 'On Time', 'At Risk', 'Overdue'

-- 3. SLA hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_complaint_sla(
    p_severity VARCHAR,
    p_complaint_date TIMESTAMPTZ,
    p_first_response_date TIMESTAMPTZ DEFAULT NULL,
    p_actual_close_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    first_response_sla_hours INTEGER,
    resolution_sla_hours INTEGER,
    first_response_hours INTEGER,
    resolution_hours INTEGER,
    first_response_status VARCHAR,
    resolution_status VARCHAR,
    overall_status VARCHAR
) AS $$
DECLARE
    v_first_response_sla INTEGER;
    v_resolution_sla INTEGER;
    v_first_response_hours INTEGER;
    v_resolution_hours INTEGER;
    v_first_response_status VARCHAR;
    v_resolution_status VARCHAR;
    v_overall_status VARCHAR;
BEGIN
    -- Severity'ye göre SLA sürelerini belirle
    CASE p_severity
        WHEN 'Kritik' THEN
            v_first_response_sla := 24;
            v_resolution_sla := 72;
        WHEN 'Yüksek' THEN
            v_first_response_sla := 48;
            v_resolution_sla := 120;
        WHEN 'Orta' THEN
            v_first_response_sla := 72;
            v_resolution_sla := 168;
        WHEN 'Düşük' THEN
            v_first_response_sla := 120; -- 5 iş günü = 120 saat
            v_resolution_sla := 240; -- 10 iş günü
        ELSE
            v_first_response_sla := 72;
            v_resolution_sla := 168;
    END CASE;

    -- İlk yanıt süresini hesapla
    IF p_first_response_date IS NOT NULL THEN
        v_first_response_hours := EXTRACT(EPOCH FROM (p_first_response_date - p_complaint_date)) / 3600;
        
        -- İlk yanıt durumunu belirle
        IF v_first_response_hours <= v_first_response_sla * 0.8 THEN
            v_first_response_status := 'On Time';
        ELSIF v_first_response_hours <= v_first_response_sla THEN
            v_first_response_status := 'At Risk';
        ELSE
            v_first_response_status := 'Overdue';
        END IF;
    ELSE
        -- Henüz yanıt verilmemişse
        v_first_response_hours := EXTRACT(EPOCH FROM (NOW() - p_complaint_date)) / 3600;
        IF v_first_response_hours <= v_first_response_sla * 0.8 THEN
            v_first_response_status := 'Pending';
        ELSIF v_first_response_hours <= v_first_response_sla THEN
            v_first_response_status := 'At Risk';
        ELSE
            v_first_response_status := 'Overdue';
        END IF;
    END IF;

    -- Çözüm süresini hesapla
    IF p_actual_close_date IS NOT NULL THEN
        v_resolution_hours := EXTRACT(EPOCH FROM (p_actual_close_date - p_complaint_date)) / 3600;
        
        -- Çözüm durumunu belirle
        IF v_resolution_hours <= v_resolution_sla * 0.8 THEN
            v_resolution_status := 'On Time';
        ELSIF v_resolution_hours <= v_resolution_sla THEN
            v_resolution_status := 'At Risk';
        ELSE
            v_resolution_status := 'Overdue';
        END IF;
    ELSE
        -- Henüz çözülmemişse
        v_resolution_hours := EXTRACT(EPOCH FROM (NOW() - p_complaint_date)) / 3600;
        IF v_resolution_hours <= v_resolution_sla * 0.8 THEN
            v_resolution_status := 'Pending';
        ELSIF v_resolution_hours <= v_resolution_sla THEN
            v_resolution_status := 'At Risk';
        ELSE
            v_resolution_status := 'Overdue';
        END IF;
    END IF;

    -- Genel durumu belirle (en kötü durum)
    IF v_first_response_status = 'Overdue' OR v_resolution_status = 'Overdue' THEN
        v_overall_status := 'Overdue';
    ELSIF v_first_response_status = 'At Risk' OR v_resolution_status = 'At Risk' THEN
        v_overall_status := 'At Risk';
    ELSIF v_first_response_status = 'On Time' AND v_resolution_status = 'On Time' THEN
        v_overall_status := 'On Time';
    ELSE
        v_overall_status := 'Pending';
    END IF;

    RETURN QUERY SELECT 
        v_first_response_sla,
        v_resolution_sla,
        v_first_response_hours::INTEGER,
        v_resolution_hours::INTEGER,
        v_first_response_status,
        v_resolution_status,
        v_overall_status;
END;
$$ LANGUAGE plpgsql;

-- 4. Otomatik SLA güncelleme trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_complaint_sla()
RETURNS TRIGGER AS $$
DECLARE
    v_sla_data RECORD;
BEGIN
    -- SLA hesaplamalarını yap
    SELECT * INTO v_sla_data
    FROM calculate_complaint_sla(
        NEW.severity,
        NEW.complaint_date,
        NEW.first_response_date,
        NEW.actual_close_date
    );

    -- SLA değerlerini güncelle
    NEW.sla_first_response_hours := v_sla_data.first_response_sla_hours;
    NEW.sla_resolution_hours := v_sla_data.resolution_sla_hours;
    NEW.first_response_hours := v_sla_data.first_response_hours;
    NEW.resolution_hours := v_sla_data.resolution_hours;
    NEW.sla_first_response_status := v_sla_data.first_response_status;
    NEW.sla_resolution_status := v_sla_data.resolution_status;
    NEW.sla_status := v_sla_data.overall_status;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger oluşturma
DROP TRIGGER IF EXISTS trigger_update_complaint_sla ON customer_complaints;
CREATE TRIGGER trigger_update_complaint_sla
    BEFORE INSERT OR UPDATE ON customer_complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_complaint_sla();

-- 6. İlk yanıt tarihini otomatik güncelleme fonksiyonu
-- (İletişim kaydı eklendiğinde veya durum değiştiğinde)
CREATE OR REPLACE FUNCTION set_first_response_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer şikayet durumu "Analiz Aşamasında" veya daha ileri bir aşamaya geçtiyse
    -- ve henüz first_response_date yoksa, şu anki tarihi kaydet
    IF NEW.status IN ('Analiz Aşamasında', 'Aksiyon Alınıyor', 'Doğrulama Bekleniyor', 'Kapalı')
       AND (OLD.status IS NULL OR OLD.status = 'Açık')
       AND NEW.first_response_date IS NULL THEN
        NEW.first_response_date := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. İlk yanıt tarihi trigger'ı
DROP TRIGGER IF EXISTS trigger_set_first_response_date ON customer_complaints;
CREATE TRIGGER trigger_set_first_response_date
    BEFORE UPDATE ON customer_complaints
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION set_first_response_date();

-- 8. RLS politikaları (gerekirse)
-- Mevcut RLS politikaları korunur

-- 9. İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_complaints_sla_status ON customer_complaints(sla_status);
CREATE INDEX IF NOT EXISTS idx_complaints_classification ON customer_complaints(complaint_classification);
CREATE INDEX IF NOT EXISTS idx_complaints_first_response_date ON customer_complaints(first_response_date);

-- 10. Mevcut kayıtları güncelleme (opsiyonel)
-- UPDATE customer_complaints
-- SET sla_first_response_hours = CASE severity
--     WHEN 'Kritik' THEN 24
--     WHEN 'Yüksek' THEN 48
--     WHEN 'Orta' THEN 72
--     WHEN 'Düşük' THEN 120
--     ELSE 72
-- END,
-- sla_resolution_hours = CASE severity
--     WHEN 'Kritik' THEN 72
--     WHEN 'Yüksek' THEN 120
--     WHEN 'Orta' THEN 168
--     WHEN 'Düşük' THEN 240
--     ELSE 168
-- END
-- WHERE sla_first_response_hours IS NULL;

