-- ============================================================================
-- Sapma Kayıtlarının Açıklamalarını Güncelleme Scripti
-- Girdi kontrol formatına uygun hale getirme
-- ============================================================================

-- Bu script mevcut sapma kayıtlarının description alanlarını
-- girdi kontrol formatına uygun şekilde günceller

-- ÖNEMLİ: Bu script'i çalıştırmadan önce veritabanınızı yedekleyin!

-- Fonksiyon: Girdi kontrol kaydından detaylı açıklama oluştur
CREATE OR REPLACE FUNCTION update_deviation_description_from_inspection()
RETURNS void AS $$
DECLARE
    dev_record RECORD;
    inspection_record RECORD;
    defect_record RECORD;
    result_record RECORD;
    new_description TEXT;
    failed_results_count INT;
    ok_count INT;
    nok_count INT;
    total_results INT;
    defect_count INT;
    result_idx INT;
BEGIN
    -- Tüm sapma kayıtlarını dolaş
    FOR dev_record IN 
        SELECT id, source_type, source_record_id, description
        FROM deviations
        WHERE source_type = 'incoming_inspection' 
        AND source_record_id IS NOT NULL
    LOOP
        -- Girdi kontrol kaydını çek
        SELECT 
            i.*,
            s.name as supplier_name
        INTO inspection_record
        FROM incoming_inspections i
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE i.id = dev_record.source_record_id;
        
        -- Eğer kayıt bulunamadıysa atla
        IF inspection_record IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Yeni açıklama oluştur
        new_description := 'Girdi Kalite Kontrol Kaydı (' || COALESCE(inspection_record.record_no, 'N/A') || E')\n\n';
        new_description := new_description || 'Parça Kodu: ' || COALESCE(inspection_record.part_code, 'Belirtilmemiş') || E'\n';
        
        IF inspection_record.part_name IS NOT NULL THEN
            new_description := new_description || 'Parça Adı: ' || inspection_record.part_name || E'\n';
        END IF;
        
        new_description := new_description || 'Red Edilen Miktar: ' || COALESCE(inspection_record.quantity_rejected::TEXT, 'N/A') || ' adet' || E'\n';
        
        IF inspection_record.quantity_conditional > 0 THEN
            new_description := new_description || 'Şartlı Kabul Miktarı: ' || inspection_record.quantity_conditional::TEXT || ' adet' || E'\n';
        END IF;
        
        new_description := new_description || 'Tedarikçi: ' || COALESCE(inspection_record.supplier_name, 'Belirtilmemiş') || E'\n';
        new_description := new_description || 'Karar: ' || COALESCE(inspection_record.decision, 'N/A') || E'\n';
        
        IF inspection_record.delivery_note_number IS NOT NULL THEN
            new_description := new_description || 'Teslimat No: ' || inspection_record.delivery_note_number || E'\n';
        END IF;
        
        -- Ölçüm sonuçlarını ekle
        SELECT COUNT(*) INTO total_results
        FROM incoming_inspection_results
        WHERE inspection_id = inspection_record.id;
        
        IF total_results > 0 THEN
            new_description := new_description || E'\nÖLÇÜM SONUÇLARI VE TESPİTLER:\n\n';
            
            -- Uygunsuz ölçümleri say
            SELECT COUNT(*) INTO failed_results_count
            FROM incoming_inspection_results
            WHERE inspection_id = inspection_record.id
            AND (result IS NULL OR result::TEXT NOT IN ('OK', 'Kabul', 'true'));
            
            IF failed_results_count > 0 THEN
                new_description := new_description || 'UYGUNSUZ BULUNAN ÖLÇÜMLER:\n';
                
                result_idx := 0;
                -- Her uygunsuz ölçümü ekle
                FOR result_record IN 
                    SELECT *
                    FROM incoming_inspection_results
                    WHERE inspection_id = inspection_record.id
                    AND (result IS NULL OR result::TEXT NOT IN ('OK', 'Kabul', 'true'))
                    ORDER BY id
                LOOP
                    result_idx := result_idx + 1;
                    new_description := new_description || E'\n' || result_idx::TEXT || '. ' || 
                        COALESCE(result_record.characteristic_name, result_record.feature, 'Özellik');
                    
                    IF result_record.measurement_number IS NOT NULL AND result_record.total_measurements IS NOT NULL THEN
                        new_description := new_description || ' (Ölçüm ' || result_record.measurement_number || '/' || result_record.total_measurements || ')';
                    END IF;
                    
                    new_description := new_description || ':\n';
                    
                    IF result_record.nominal_value IS NOT NULL OR result_record.min_value IS NOT NULL OR result_record.max_value IS NOT NULL THEN
                        new_description := new_description || '   Beklenen Değer (Nominal): ' || 
                            COALESCE(result_record.nominal_value::TEXT, '-') || ' mm' || E'\n';
                        new_description := new_description || '   Tolerans Aralığı: ' || 
                            COALESCE(result_record.min_value::TEXT, '-') || ' mm ~ ' || 
                            COALESCE(result_record.max_value::TEXT, '-') || ' mm' || E'\n';
                    END IF;
                    
                    IF result_record.actual_value IS NOT NULL AND result_record.actual_value::TEXT != '' THEN
                        new_description := new_description || '   Gerçek Ölçülen Değer: ' || result_record.actual_value::TEXT || ' mm' || E'\n';
                        
                        -- Tolerans kontrolü (basitleştirilmiş)
                        IF result_record.min_value IS NOT NULL AND result_record.max_value IS NOT NULL THEN
                            IF result_record.actual_value::NUMERIC < result_record.min_value::NUMERIC OR 
                               result_record.actual_value::NUMERIC > result_record.max_value::NUMERIC THEN
                                new_description := new_description || '   ⚠ HATALI DEĞER: Tolerans dışında!' || E'\n';
                            END IF;
                        END IF;
                    ELSE
                        new_description := new_description || '   Gerçek Ölçülen Değer: Ölçülmemiş' || E'\n';
                    END IF;
                    
                    new_description := new_description || '   Sonuç: ' || COALESCE(result_record.result::TEXT, 'NOK') || E'\n';
                END LOOP;
            END IF;
            
            -- Ölçüm özeti
            SELECT COUNT(*) INTO ok_count
            FROM incoming_inspection_results
            WHERE inspection_id = inspection_record.id
            AND result::TEXT IN ('OK', 'Kabul', 'true');
            
            nok_count := total_results - ok_count;
            
            new_description := new_description || E'\n\nÖLÇÜM ÖZETİ:\n';
            new_description := new_description || 'Toplam Ölçüm Sayısı: ' || total_results::TEXT || E'\n';
            new_description := new_description || 'Uygun Ölçümler: ' || ok_count::TEXT || E'\n';
            new_description := new_description || 'Uygunsuz Ölçümler: ' || nok_count::TEXT || E'\n';
            
            IF total_results > 0 THEN
                new_description := new_description || 'Ret Oranı: ' || 
                    ROUND((nok_count::NUMERIC / total_results::NUMERIC * 100)::NUMERIC, 1)::TEXT || '%' || E'\n';
            END IF;
        END IF;
        
        -- Hata detaylarını ekle
        SELECT COUNT(*) INTO defect_count
        FROM incoming_inspection_defects
        WHERE inspection_id = inspection_record.id;
        
        IF defect_count > 0 THEN
            new_description := new_description || E'\n\nTESPİT EDİLEN HATALAR:\n';
            
            result_idx := 0;
            FOR defect_record IN 
                SELECT *
                FROM incoming_inspection_defects
                WHERE inspection_id = inspection_record.id
                ORDER BY id
            LOOP
                result_idx := result_idx + 1;
                new_description := new_description || result_idx::TEXT || '. ' || 
                    COALESCE(defect_record.defect_description, 'Belirtilmemiş') || 
                    ' (Miktar: ' || COALESCE(defect_record.quantity::TEXT, '-') || ' adet)' || E'\n';
            END LOOP;
        END IF;
        
        -- Açıklama ve notlar
        IF inspection_record.description IS NOT NULL THEN
            new_description := new_description || E'\n\nAçıklama: ' || inspection_record.description || E'\n';
        END IF;
        
        IF inspection_record.notes IS NOT NULL THEN
            new_description := new_description || 'Notlar: ' || inspection_record.notes || E'\n';
        END IF;
        
        new_description := new_description || E'\n\nBu parça için sapma onayı talep edilmektedir.';
        
        -- Sapma kaydını güncelle
        UPDATE deviations
        SET description = new_description,
            updated_at = NOW()
        WHERE id = dev_record.id;
        
        RAISE NOTICE 'Sapma kaydı güncellendi: %', dev_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyonu çalıştır
SELECT update_deviation_description_from_inspection();

-- Fonksiyonu temizle
DROP FUNCTION update_deviation_description_from_inspection();

