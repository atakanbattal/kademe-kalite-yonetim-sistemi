-- Uygunsuzluk kayıtlarında uzun metin alanları için formatlamayı kaldır
-- description, problem_definition, rejection_reason, rejection_notes, closing_notes alanları formatlanmayacak

CREATE OR REPLACE FUNCTION format_nc_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Metin alanlarını formatla (sadece kısa alanlar için)
    IF NEW.title IS NOT NULL THEN
        NEW.title := format_to_camelcase(NEW.title);
    END IF;
    
    -- description, problem_definition, rejection_reason, rejection_notes, closing_notes formatlanmayacak
    -- Kullanıcı bu alanları istediği gibi yazabilir
    
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
    
    -- rejection_reason, rejection_notes, closing_notes formatlanmayacak
    
    IF NEW.requesting_person IS NOT NULL THEN
        NEW.requesting_person := format_to_camelcase(NEW.requesting_person);
    END IF;
    
    IF NEW.requesting_unit IS NOT NULL THEN
        NEW.requesting_unit := format_to_camelcase(NEW.requesting_unit);
    END IF;
    
    IF NEW.responsible_person IS NOT NULL THEN
        NEW.responsible_person := format_to_camelcase(NEW.responsible_person);
    END IF;
    
    IF NEW.department IS NOT NULL THEN
        NEW.department := format_to_camelcase(NEW.department);
    END IF;
    
    IF NEW.category IS NOT NULL THEN
        NEW.category := format_to_camelcase(NEW.category);
    END IF;
    
    IF NEW.status IS NOT NULL THEN
        NEW.status := format_to_camelcase(NEW.status);
    END IF;
    
    IF NEW.priority IS NOT NULL THEN
        NEW.priority := format_to_camelcase(NEW.priority);
    END IF;
    
    IF NEW.vehicle_type IS NOT NULL THEN
        NEW.vehicle_type := format_to_camelcase(NEW.vehicle_type);
    END IF;
    
    IF NEW.cost_type IS NOT NULL THEN
        NEW.cost_type := format_to_camelcase(NEW.cost_type);
    END IF;
    
    IF NEW.material_type IS NOT NULL THEN
        NEW.material_type := format_to_camelcase(NEW.material_type);
    END IF;
    
    IF NEW.forwarded_to IS NOT NULL THEN
        NEW.forwarded_to := format_to_camelcase(NEW.forwarded_to);
    END IF;
    
    IF NEW.forwarded_unit IS NOT NULL THEN
        NEW.forwarded_unit := format_to_camelcase(NEW.forwarded_unit);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION format_nc_fields() IS 'Uygunsuzluk kayıtlarında kısa metin alanlarını formatlar. description, problem_definition, rejection_reason, rejection_notes, closing_notes gibi uzun metin alanları formatlanmaz.';

