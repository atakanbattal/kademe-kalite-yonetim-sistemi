-- ============================================================================
-- CAMELCASE FORMATLAMA TRİGGER FONKSİYONLARI
-- ============================================================================
-- Bu script, tüm metin alanlarını otomatik olarak camelCase formatına çevirir
-- Türkçe karakter desteği ile çalışır
-- ============================================================================

-- CamelCase formatlama fonksiyonu (PostgreSQL PL/pgSQL)
-- Her kelimenin ilk harfini büyük, geri kalanını küçük yapar
CREATE OR REPLACE FUNCTION format_to_camelcase(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    words TEXT[];
    word TEXT;
    i INTEGER;
    first_char TEXT;
    rest_chars TEXT;
BEGIN
    -- Boş veya NULL kontrolü
    IF input_text IS NULL OR TRIM(input_text) = '' THEN
        RETURN input_text;
    END IF;
    
    -- Trim ve fazla boşlukları temizle
    result := TRIM(REGEXP_REPLACE(input_text, '\s+', ' ', 'g'));
    
    -- Özel durumlar (büyük harfle yazılan özel isimler vb.)
    -- Bu özel durumlar frontend'de de tanımlı, burada da tutarlılık için ekliyoruz
    
    -- Kelimelere ayır ve her kelimeyi formatla
    words := STRING_TO_ARRAY(result, ' ');
    result := '';
    
    FOR i IN 1..ARRAY_LENGTH(words, 1) LOOP
        word := words[i];
        
        IF word != '' THEN
            -- Tire (-) içeren kelimeler için özel işlem (örn: Ar-Ge)
            IF POSITION('-' IN word) > 0 THEN
                -- Tire ile ayrılmış kısımları ayrı ayrı formatla
                DECLARE
                    parts TEXT[];
                    part TEXT;
                    j INTEGER;
                    formatted_parts TEXT := '';
                BEGIN
                    parts := STRING_TO_ARRAY(word, '-');
                    FOR j IN 1..ARRAY_LENGTH(parts, 1) LOOP
                        part := parts[j];
                        IF part != '' THEN
                            first_char := UPPER(SUBSTRING(part FROM 1 FOR 1));
                            rest_chars := LOWER(SUBSTRING(part FROM 2));
                            IF j > 1 THEN
                                formatted_parts := formatted_parts || '-';
                            END IF;
                            formatted_parts := formatted_parts || first_char || rest_chars;
                        END IF;
                    END LOOP;
                    word := formatted_parts;
                END;
            ELSE
                -- Normal kelime formatlaması
                first_char := UPPER(SUBSTRING(word FROM 1 FOR 1));
                rest_chars := LOWER(SUBSTRING(word FROM 2));
                word := first_char || rest_chars;
            END IF;
            
            -- Sonuca ekle
            IF result != '' THEN
                result := result || ' ';
            END IF;
            result := result || word;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test fonksiyonu
COMMENT ON FUNCTION format_to_camelcase(TEXT) IS 'Metni camelCase formatına çevirir (her kelimenin ilk harfi büyük)';

-- ============================================================================
-- GENEL TRİGGER FONKSİYONU
-- ============================================================================
-- Bu fonksiyon, bir tablodaki belirtilen VARCHAR ve TEXT alanlarını otomatik formatlar
CREATE OR REPLACE FUNCTION apply_camelcase_formatting()
RETURNS TRIGGER AS $$
DECLARE
    col_name TEXT;
    col_value TEXT;
    formatted_value TEXT;
BEGIN
    -- NEW kaydındaki tüm alanları kontrol et
    -- Bu fonksiyon dinamik olarak çalışır, ancak her tablo için özel trigger gerekir
    
    -- Trigger'ın çalıştığı tabloya göre alanları formatla
    -- Bu kısım her tablo için özelleştirilmelidir
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ÖNEMLİ TABLOLAR İÇİN TRİGGER'LAR
-- ============================================================================

-- Non Conformities tablosu için trigger
CREATE OR REPLACE FUNCTION format_nc_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Metin alanlarını formatla (sadece VARCHAR ve TEXT alanları)
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    IF NEW.part_name IS NOT NULL THEN
        NEW.part_name := format_to_camelcase(NEW.part_name);
    END IF;
    
    IF NEW.part_code IS NOT NULL THEN
        NEW.part_code := format_to_camelcase(NEW.part_code);
    END IF;
    
    IF NEW.measurement_unit IS NOT NULL THEN
        NEW.measurement_unit := format_to_camelcase(NEW.measurement_unit);
    END IF;
    
    IF NEW.part_location IS NOT NULL THEN
        NEW.part_location := format_to_camelcase(NEW.part_location);
    END IF;
    
    IF NEW.rejection_reason IS NOT NULL THEN
        NEW.rejection_reason := format_to_camelcase(NEW.rejection_reason);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_nc_fields ON non_conformities;
CREATE TRIGGER trigger_format_nc_fields
    BEFORE INSERT OR UPDATE ON non_conformities
    FOR EACH ROW
    EXECUTE FUNCTION format_nc_fields();

-- Equipment tablosu için trigger
CREATE OR REPLACE FUNCTION format_equipment_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NOT NULL THEN
        NEW.name := format_to_camelcase(NEW.name);
    END IF;
    
    IF NEW.brand_model IS NOT NULL THEN
        NEW.brand_model := format_to_camelcase(NEW.brand_model);
    END IF;
    
    IF NEW.responsible_unit IS NOT NULL THEN
        NEW.responsible_unit := format_to_camelcase(NEW.responsible_unit);
    END IF;
    
    IF NEW.location IS NOT NULL THEN
        NEW.location := format_to_camelcase(NEW.location);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_equipment_fields ON equipments;
CREATE TRIGGER trigger_format_equipment_fields
    BEFORE INSERT OR UPDATE ON equipments
    FOR EACH ROW
    EXECUTE FUNCTION format_equipment_fields();

-- Personnel tablosu için trigger
CREATE OR REPLACE FUNCTION format_personnel_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name IS NOT NULL THEN
        NEW.full_name := format_to_camelcase(NEW.full_name);
    END IF;
    
    IF NEW.department IS NOT NULL THEN
        NEW.department := format_to_camelcase(NEW.department);
    END IF;
    
    IF NEW.job_title IS NOT NULL THEN
        NEW.job_title := format_to_camelcase(NEW.job_title);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_personnel_fields ON personnel;
CREATE TRIGGER trigger_format_personnel_fields
    BEFORE INSERT OR UPDATE ON personnel
    FOR EACH ROW
    EXECUTE FUNCTION format_personnel_fields();

-- Suppliers tablosu için trigger
CREATE OR REPLACE FUNCTION format_supplier_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NOT NULL THEN
        NEW.name := format_to_camelcase(NEW.name);
    END IF;
    
    IF NEW.contact_person IS NOT NULL THEN
        NEW.contact_person := format_to_camelcase(NEW.contact_person);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_supplier_fields ON suppliers;
CREATE TRIGGER trigger_format_supplier_fields
    BEFORE INSERT OR UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION format_supplier_fields();

-- Quarantine tablosu için trigger
CREATE OR REPLACE FUNCTION format_quarantine_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.part_name IS NOT NULL THEN
        NEW.part_name := format_to_camelcase(NEW.part_name);
    END IF;
    
    IF NEW.part_code IS NOT NULL THEN
        NEW.part_code := format_to_camelcase(NEW.part_code);
    END IF;
    
    IF NEW.lot_no IS NOT NULL THEN
        NEW.lot_no := format_to_camelcase(NEW.lot_no);
    END IF;
    
    IF NEW.unit IS NOT NULL THEN
        NEW.unit := format_to_camelcase(NEW.unit);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_quarantine_fields ON quarantine_records;
CREATE TRIGGER trigger_format_quarantine_fields
    BEFORE INSERT OR UPDATE ON quarantine_records
    FOR EACH ROW
    EXECUTE FUNCTION format_quarantine_fields();

-- Customer Complaints tablosu için trigger
CREATE OR REPLACE FUNCTION format_customer_complaint_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    IF NEW.product_name IS NOT NULL THEN
        NEW.product_name := format_to_camelcase(NEW.product_name);
    END IF;
    
    IF NEW.product_code IS NOT NULL THEN
        NEW.product_code := format_to_camelcase(NEW.product_code);
    END IF;
    
    IF NEW.batch_number IS NOT NULL THEN
        NEW.batch_number := format_to_camelcase(NEW.batch_number);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_customer_complaint_fields ON customer_complaints;
CREATE TRIGGER trigger_format_customer_complaint_fields
    BEFORE INSERT OR UPDATE ON customer_complaints
    FOR EACH ROW
    EXECUTE FUNCTION format_customer_complaint_fields();

-- Kaizen tablosu için trigger
CREATE OR REPLACE FUNCTION format_kaizen_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_kaizen_fields ON kaizen_entries;
CREATE TRIGGER trigger_format_kaizen_fields
    BEFORE INSERT OR UPDATE ON kaizen_entries
    FOR EACH ROW
    EXECUTE FUNCTION format_kaizen_fields();

-- Deviation tablosu için trigger
CREATE OR REPLACE FUNCTION format_deviation_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    IF NEW.part_name IS NOT NULL THEN
        NEW.part_name := format_to_camelcase(NEW.part_name);
    END IF;
    
    IF NEW.part_code IS NOT NULL THEN
        NEW.part_code := format_to_camelcase(NEW.part_code);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_deviation_fields ON deviations;
CREATE TRIGGER trigger_format_deviation_fields
    BEFORE INSERT OR UPDATE ON deviations
    FOR EACH ROW
    EXECUTE FUNCTION format_deviation_fields();

-- Incoming Inspections tablosu için trigger
CREATE OR REPLACE FUNCTION format_incoming_inspection_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivery_note_number IS NOT NULL THEN
        NEW.delivery_note_number := format_to_camelcase(NEW.delivery_note_number);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_incoming_inspection_fields ON incoming_inspections;
CREATE TRIGGER trigger_format_incoming_inspection_fields
    BEFORE INSERT OR UPDATE ON incoming_inspections
    FOR EACH ROW
    EXECUTE FUNCTION format_incoming_inspection_fields();

-- Documents tablosu için trigger
CREATE OR REPLACE FUNCTION format_document_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    IF NEW.description IS NOT NULL THEN
        NEW.description := format_to_camelcase(NEW.description);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_format_document_fields ON documents;
CREATE TRIGGER trigger_format_document_fields
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION format_document_fields();

-- ============================================================================
-- YORUM VE DOKÜMANTASYON
-- ============================================================================

COMMENT ON FUNCTION format_to_camelcase(TEXT) IS 
'Metni camelCase formatına çevirir. Her kelimenin ilk harfi büyük, geri kalanı küçük yapılır. Türkçe karakterler desteklenir.';

COMMENT ON FUNCTION format_nc_fields() IS 
'Non Conformities tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_equipment_fields() IS 
'Equipment tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_personnel_fields() IS 
'Personnel tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_supplier_fields() IS 
'Suppliers tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_quarantine_fields() IS 
'Quarantine Records tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_customer_complaint_fields() IS 
'Customer Complaints tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_kaizen_fields() IS 
'Kaizen tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_deviation_fields() IS 
'Deviations tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_incoming_inspection_fields() IS 
'Incoming Inspections tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

COMMENT ON FUNCTION format_document_fields() IS 
'Documents tablosundaki metin alanlarını otomatik olarak camelCase formatına çevirir.';

