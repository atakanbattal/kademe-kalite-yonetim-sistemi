-- Doküman numarası verme mantığını düzeltme scripti
-- Tarih: 2025-12-09

-- 1. generate_document_number fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION generate_document_number(
    p_department_id UUID,
    p_document_type VARCHAR,
    p_document_subcategory VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_dept_code VARCHAR(10);
    v_type_code VARCHAR(10);
    v_subcat_code VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_doc_number VARCHAR(100);
    v_pattern VARCHAR(200);
BEGIN
    -- Departman kodunu al (unit_code yok, unit_name'den ilk 3 karakteri al)
    SELECT UPPER(SUBSTRING(unit_name, 1, 3)) INTO v_dept_code
    FROM cost_settings
    WHERE id = p_department_id;
    
    IF v_dept_code IS NULL OR v_dept_code = '' THEN
        v_dept_code := 'GEN';
    END IF;
    
    -- Tip kodunu belirle (tüm kategoriler için)
    CASE p_document_type
        WHEN 'Prosedürler' THEN v_type_code := 'PR';
        WHEN 'Talimatlar' THEN v_type_code := 'TL';
        WHEN 'Formlar' THEN v_type_code := 'FR';
        WHEN 'Kalite Sertifikaları' THEN v_type_code := 'KS';
        WHEN 'Personel Sertifikaları' THEN v_type_code := 'PS';
        WHEN 'El Kitapları' THEN v_type_code := 'EK';
        WHEN 'Şemalar' THEN v_type_code := 'SM';
        WHEN 'Görev Tanımları' THEN v_type_code := 'GT';
        WHEN 'Süreçler' THEN v_type_code := 'SC';
        WHEN 'Planlar' THEN v_type_code := 'PL';
        WHEN 'Listeler' THEN v_type_code := 'LS';
        WHEN 'Şartnameler' THEN v_type_code := 'ST';
        WHEN 'Politikalar' THEN v_type_code := 'PK';
        WHEN 'Tablolar' THEN v_type_code := 'TB';
        WHEN 'Antetler' THEN v_type_code := 'AT';
        WHEN 'Sözleşmeler' THEN v_type_code := 'SZ';
        WHEN 'Yönetmelikler' THEN v_type_code := 'YT';
        WHEN 'Kontrol Planları' THEN v_type_code := 'KP';
        WHEN 'FMEA Planları' THEN v_type_code := 'FP';
        WHEN 'Proses Kontrol Kartları' THEN v_type_code := 'PK';
        WHEN 'Görsel Yardımcılar' THEN v_type_code := 'GY';
        ELSE v_type_code := 'DG';
    END CASE;
    
    -- Alt kategori kodunu belirle
    IF p_document_subcategory IS NOT NULL AND p_document_subcategory != '' THEN
        v_subcat_code := UPPER(SUBSTRING(p_document_subcategory, 1, 2));
    ELSE
        v_subcat_code := '';
    END IF;
    
    -- Yıl
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Pattern oluştur
    IF v_subcat_code != '' THEN
        v_pattern := v_dept_code || '-' || v_type_code || '-' || v_subcat_code || '-' || v_year || '-%';
    ELSE
        v_pattern := v_dept_code || '-' || v_type_code || '-' || v_year || '-%';
    END IF;
    
    -- Sıra numarasını al - daha güvenilir yöntemle
    SELECT COALESCE(
        MAX(
            CAST(
                SUBSTRING(
                    document_number 
                    FROM '([0-9]{4})$'
                ) AS INTEGER
            )
        ), 
        0
    ) + 1
    INTO v_sequence
    FROM documents
    WHERE document_number LIKE v_pattern;
    
    -- Doküman numarasını oluştur
    IF v_subcat_code != '' THEN
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_subcat_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    ELSE
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    END IF;
    
    RETURN v_doc_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Mevcut kayıtları düzeltme fonksiyonu
CREATE OR REPLACE FUNCTION fix_all_document_numbers()
RETURNS void AS $$
DECLARE
    doc_record RECORD;
    dept_code VARCHAR(10);
    type_code VARCHAR(10);
    year_part VARCHAR(4);
    new_number VARCHAR(100);
    doc_type_map JSONB := '{
        "Prosedürler": "PR",
        "Talimatlar": "TL",
        "Formlar": "FR",
        "Kalite Sertifikaları": "KS",
        "Personel Sertifikaları": "PS",
        "El Kitapları": "EK",
        "Şemalar": "SM",
        "Görev Tanımları": "GT",
        "Süreçler": "SC",
        "Planlar": "PL",
        "Listeler": "LS",
        "Şartnameler": "ST",
        "Politikalar": "PK",
        "Tablolar": "TB",
        "Antetler": "AT",
        "Sözleşmeler": "SZ",
        "Yönetmelikler": "YT",
        "Kontrol Planları": "KP",
        "FMEA Planları": "FP",
        "Proses Kontrol Kartları": "PK",
        "Görsel Yardımcılar": "GY"
    }'::JSONB;
BEGIN
    -- Her doküman tipi ve departman kombinasyonu için sıralı numara ver
    FOR doc_record IN 
        SELECT 
            d.id,
            d.document_type,
            d.department_id,
            EXTRACT(YEAR FROM d.created_at)::INTEGER as doc_year,
            d.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY d.document_type, COALESCE(d.department_id, '00000000-0000-0000-0000-000000000000'::UUID), EXTRACT(YEAR FROM d.created_at)
                ORDER BY d.created_at ASC
            ) as seq_num
        FROM documents d
        ORDER BY d.document_type, d.department_id, d.created_at
    LOOP
        -- Departman kodu
        IF doc_record.department_id IS NOT NULL THEN
            SELECT UPPER(SUBSTRING(unit_name, 1, 3)) INTO dept_code
            FROM cost_settings
            WHERE id = doc_record.department_id;
        END IF;
        
        IF dept_code IS NULL OR dept_code = '' THEN
            dept_code := 'GEN';
        END IF;
        
        -- Tip kodu
        type_code := COALESCE(doc_type_map->>doc_record.document_type, 'DG');
        
        -- Yıl
        year_part := doc_record.doc_year::TEXT;
        
        -- Yeni numara oluştur
        new_number := dept_code || '-' || type_code || '-' || year_part || '-' || LPAD(doc_record.seq_num::TEXT, 4, '0');
        
        -- Güncelle
        UPDATE documents
        SET document_number = new_number
        WHERE id = doc_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS trigger_auto_generate_document_number ON documents;

CREATE TRIGGER trigger_auto_generate_document_number
    BEFORE INSERT ON documents
    FOR EACH ROW
    WHEN (NEW.document_number IS NULL OR NEW.document_number = '')
    EXECUTE FUNCTION auto_generate_document_number();

-- 4. Mevcut kayıtları düzelt (zaten çalıştırıldı, tekrar çalıştırmaya gerek yok)
-- SELECT fix_all_document_numbers();

