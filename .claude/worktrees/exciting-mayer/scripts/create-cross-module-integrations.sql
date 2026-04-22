-- ============================================================================
-- MODÜLLER ARASI ENTEGRASYON TRIGGER'LARI (GÜVENLİ VERSİYON)
-- ============================================================================
-- Bu script SADECE mevcut olmayan, çakışma riski bulunmayan trigger'ları oluşturur.
-- 
-- ÇIKARILAN (zaten mevcut olan trigger'lar):
--   ❌ Girdi KK Red → Tedarikçi NC (zaten: trigger_auto_create_supplier_nc_from_rejection)
--   ❌ Muayene → Tedarikçi PPM (zaten: trigger_update_supplier_performance)
--   ❌ Tedarikçi Skor → Status (frontend SupplierFormModal zaten yönetiyor)
--
-- EKLENEN (yeni, çakışma riski olmayan):
--   ✅ NC Kapatıldı → İlişkili müşteri şikayeti güncelleme
--   ✅ Kalitesizlik Maliyeti → KPI otomatik güncelleme  
--   ✅ Araç Hata-Maliyet özet view
-- ============================================================================


-- ============================================================================
-- 1. DF/8D Kapatıldığında → İlişkili Müşteri Şikayetini Güncelle
-- ============================================================================
-- Bu trigger mevcut kodda YOKTUR. customer_complaints tablosunda related_nc_id
-- alanı kullanılıyor ama NC kapatıldığında otomatik güncelleme yapılmıyor.
-- GÜVENLI: Sadece related_nc_id eşleşen ve hâlâ açık olan şikayetleri etkiler.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_nc_closure_update_complaint()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece durum 'Kapatıldı'ya GEÇTİĞİNDE (yeni kapatma)
    IF NEW.status = 'Kapatıldı' AND (OLD.status IS DISTINCT FROM 'Kapatıldı') THEN
        
        -- İlişkili müşteri şikayetini "Doğrulama Bekleniyor" durumuna geçir
        -- SADECE aktif şikayetleri etkiler, zaten kapalı/iptal olanları DOKUNMAZ
        UPDATE customer_complaints 
        SET 
            status = 'Doğrulama Bekleniyor',
            updated_at = NOW()
        WHERE related_nc_id = NEW.id
            AND status IN ('Açık', 'Analiz Aşamasında', 'Aksiyon Alınıyor');
            
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN undefined_column THEN
        -- related_nc_id kolonu yoksa sessizce geç
        RETURN NEW;
    WHEN undefined_table THEN
        -- customer_complaints tablosu yoksa sessizce geç
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (sadece yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_nc_closure_update_complaint'
    ) THEN
        CREATE TRIGGER trg_nc_closure_update_complaint
            AFTER UPDATE ON non_conformities
            FOR EACH ROW
            EXECUTE FUNCTION fn_nc_closure_update_complaint();
    END IF;
END $$;


-- ============================================================================
-- 2. Kalitesizlik Maliyeti → Otomatik KPI Güncelleme
-- ============================================================================
-- Bu trigger mevcut kodda YOKTUR. KPI'lar şu an sadece manuel RPC ile
-- güncelleniyor (refreshAutoKpis). Bu trigger anlık güncelleme sağlar.
-- GÜVENLI: Sadece kpis tablosundaki auto_kpi_id='non_quality_cost' kaydını günceller.
-- Eğer böyle bir KPI yoksa hiçbir şey yapmaz.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_quality_cost_update_kpi()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cost NUMERIC;
BEGIN
    -- Bu ayın toplam kalitesizlik maliyetini hesapla
    SELECT COALESCE(SUM(amount), 0) INTO v_total_cost
    FROM quality_costs
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW());
    
    -- İlgili KPI'ı güncelle (sadece varsa)
    UPDATE kpis 
    SET 
        current_value = v_total_cost,
        updated_at = NOW()
    WHERE auto_kpi_id = 'non_quality_cost';
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN undefined_column THEN
        RETURN COALESCE(NEW, OLD);
    WHEN undefined_table THEN
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (sadece yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_quality_cost_update_kpi'
    ) THEN
        CREATE TRIGGER trg_quality_cost_update_kpi
            AFTER INSERT OR UPDATE OR DELETE ON quality_costs
            FOR EACH ROW
            EXECUTE FUNCTION fn_quality_cost_update_kpi();
    END IF;
END $$;


-- ============================================================================
-- 3. Araç Hatası → Kalitesizlik Maliyeti Özet View
-- ============================================================================
-- Bu view mevcut kodda YOKTUR. Araç hatalarının maliyet analizini kolaylaştırır.
-- GÜVENLI: Sadece bir READ-ONLY view, hiçbir veriyi değiştirmez.
-- ============================================================================
CREATE OR REPLACE VIEW v_vehicle_fault_cost_summary AS
SELECT 
    qi.id AS vehicle_id,
    qi.chassis_no,
    qi.vehicle_type,
    qi.status AS vehicle_status,
    COUNT(DISTINCT qif.id) AS total_faults,
    COALESCE(SUM(qc.amount), 0) AS total_fault_cost,
    qi.created_at AS inspection_date
FROM quality_inspections qi
LEFT JOIN quality_inspection_faults qif ON qif.inspection_id = qi.id
LEFT JOIN quality_costs qc ON qc.fault_id = qif.id
GROUP BY qi.id, qi.chassis_no, qi.vehicle_type, qi.status, qi.created_at;


-- ============================================================================
-- SONUÇ
-- ============================================================================
-- Eklenen (yeni, güvenli):
--   ✅ trg_nc_closure_update_complaint  - NC kapatıldığında ilişkili şikayeti güncelle
--   ✅ trg_quality_cost_update_kpi      - Maliyet değiştiğinde KPI'ı güncelle
--   ✅ v_vehicle_fault_cost_summary     - Araç hata-maliyet özet view (read-only)
--
-- Çıkarılan (zaten mevcut, çakışma riski):
--   ❌ Girdi KK → Tedarikçi NC    (mevcut: trigger_auto_create_supplier_nc_from_rejection)
--   ❌ Muayene → PPM güncelleme    (mevcut: trigger_update_supplier_performance)  
--   ❌ Skor → Tedarikçi status     (frontend zaten yönetiyor)
-- ============================================================================
