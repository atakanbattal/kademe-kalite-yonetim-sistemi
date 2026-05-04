-- OCR / eksik Türkçe harf / eski şablon kalıntılarını prose alanlarında düzeltir.
-- Uygulama: src/lib/turkishTextFix.js ile aynı kuralları koruyun.

CREATE OR REPLACE FUNCTION public.fix_turkish_free_text(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  t text;
BEGIN
  IF p_input IS NULL THEN
    RETURN NULL;
  END IF;

  t := normalize(p_input);

  t := replace(t, 'MALIYET KAYDI DETAYLARI', 'Maliyet Kaydı Özeti');
  t := replace(t, 'MALİYET KAYDI DETAYLARI', 'Maliyet Kaydı Özeti');
  t := replace(t, 'Maliyet Kaydi Aciklamasi', 'Maliyet Kaydı Açıklaması');
  t := replace(t, 'Maliyet Kaydi Açıklaması', 'Maliyet Kaydı Açıklaması');
  t := replace(t, 'Maliyet Kaydi', 'Maliyet Kaydı');
  t := replace(t, 'kazan igi', 'kazan içi');
  t := replace(t, 'Kazan igi', 'Kazan içi');
  t := replace(t, ' içi elegin ', ' içi eleğin ');
  t := replace(t, 'Analize Giren Arac', 'Analize Giren Araç');
  t := replace(t, 'Otomatik Baslatildi', 'Otomatik Başlatıldı');
  t := replace(t, 'Otomatik Baslatıldı', 'Otomatik Başlatıldı');
  t := replace(t, 'Arac Bazli', 'Araç Bazlı');
  t := replace(t, 'Gerceklesen', 'Gerçekleşen');
  t := replace(t, 'Toplam Katki', 'Toplam Katkı');
  t := replace(t, 'Donem:', 'Dönem:');
  t := replace(t, 'Donem :', 'Dönem :');
  t := replace(t, 'aciıklaması', 'açıklaması');
  t := replace(t, 'aciıklama', 'açıklama');
  t := replace(t, 'aciıklik', 'açıklık');
  t := replace(t, 'aciık', 'açık');
  t := replace(t, 'késelerindeki', 'köşelerindeki');
  t := replace(t, 'Késelerindeki', 'Köşelerindeki');
  t := replace(t, 'késeler', 'köşeler');
  t := replace(t, 'Késeler', 'Köşeler');
  t := replace(t, ' elegin ', ' eleğin ');
  t := replace(t, 'aracimizdaki', 'aracımızdaki');
  t := replace(t, 'Aracimizdaki', 'Aracımızdaki');
  t := replace(t, ' aracimiz ', ' aracımız ');
  t := replace(t, 'Tum Zamanlar', 'Tüm Zamanlar');
  t := replace(t, 'Arac Tipi', 'Araç Tipi');
  t := replace(t, ' poset vb', ' poşet vb');
  t := replace(t, ' poset ', ' poşet ');
  t := replace(t, ' poset.', ' poşet.');
  t := replace(t, ' poset,', ' poşet,');
  t := replace(t, ' sebebi ile ', ' sebebiyle ');
  t := replace(t, chr(10) || 'sebebi ile ', chr(10) || 'sebebiyle ');
  t := replace(t, chr(9) || 'sebebi ile ', chr(9) || 'sebebiyle ');
  t := replace(t, '(sebebi ile)', '(sebebiyle)');

  t := regexp_replace(t, '(^|[[:space:]])sebebi ile([[:space:]]|[,.;:!?]|$)', '\1sebebiyle\2', 'g');

  RETURN t;
END;
$$;

COMMENT ON FUNCTION public.fix_turkish_free_text(text) IS
  'OCR ve ASCII Türkçe kalıntılarını düzeltir (NC, maliyet, UYG metinleri). JS: src/lib/turkishTextFix.js';

-- non_conformities
UPDATE public.non_conformities SET title = public.fix_turkish_free_text(title)
WHERE title IS NOT NULL AND title IS DISTINCT FROM public.fix_turkish_free_text(title);

UPDATE public.non_conformities SET description = public.fix_turkish_free_text(description)
WHERE description IS NOT NULL AND description IS DISTINCT FROM public.fix_turkish_free_text(description);

UPDATE public.non_conformities SET problem_definition = public.fix_turkish_free_text(problem_definition)
WHERE problem_definition IS NOT NULL AND problem_definition IS DISTINCT FROM public.fix_turkish_free_text(problem_definition);

UPDATE public.non_conformities SET closing_notes = public.fix_turkish_free_text(closing_notes)
WHERE closing_notes IS NOT NULL AND closing_notes IS DISTINCT FROM public.fix_turkish_free_text(closing_notes);

UPDATE public.non_conformities SET audit_title = public.fix_turkish_free_text(audit_title)
WHERE audit_title IS NOT NULL AND audit_title IS DISTINCT FROM public.fix_turkish_free_text(audit_title);

UPDATE public.non_conformities SET rejection_reason = public.fix_turkish_free_text(rejection_reason)
WHERE rejection_reason IS NOT NULL AND rejection_reason IS DISTINCT FROM public.fix_turkish_free_text(rejection_reason);

UPDATE public.non_conformities SET rejection_notes = public.fix_turkish_free_text(rejection_notes)
WHERE rejection_notes IS NOT NULL AND rejection_notes IS DISTINCT FROM public.fix_turkish_free_text(rejection_notes);

UPDATE public.non_conformities SET part_name = public.fix_turkish_free_text(part_name)
WHERE part_name IS NOT NULL AND part_name IS DISTINCT FROM public.fix_turkish_free_text(part_name);

UPDATE public.non_conformities SET vehicle_type = public.fix_turkish_free_text(vehicle_type)
WHERE vehicle_type IS NOT NULL AND vehicle_type IS DISTINCT FROM public.fix_turkish_free_text(vehicle_type);

UPDATE public.non_conformities SET cost_type = public.fix_turkish_free_text(cost_type)
WHERE cost_type IS NOT NULL AND cost_type IS DISTINCT FROM public.fix_turkish_free_text(cost_type);

UPDATE public.non_conformities SET material_type = public.fix_turkish_free_text(material_type)
WHERE material_type IS NOT NULL AND material_type IS DISTINCT FROM public.fix_turkish_free_text(material_type);

UPDATE public.non_conformities SET part_location = public.fix_turkish_free_text(part_location)
WHERE part_location IS NOT NULL AND part_location IS DISTINCT FROM public.fix_turkish_free_text(part_location);

UPDATE public.non_conformities SET production_batch = public.fix_turkish_free_text(production_batch::text)
WHERE production_batch IS NOT NULL AND production_batch::text IS DISTINCT FROM public.fix_turkish_free_text(production_batch::text);

-- quality_costs
UPDATE public.quality_costs SET description = public.fix_turkish_free_text(description)
WHERE description IS NOT NULL AND description IS DISTINCT FROM public.fix_turkish_free_text(description);

UPDATE public.quality_costs SET part_name = public.fix_turkish_free_text(part_name)
WHERE part_name IS NOT NULL AND part_name IS DISTINCT FROM public.fix_turkish_free_text(part_name);

UPDATE public.quality_costs SET vehicle_type = public.fix_turkish_free_text(vehicle_type)
WHERE vehicle_type IS NOT NULL AND vehicle_type IS DISTINCT FROM public.fix_turkish_free_text(vehicle_type);

UPDATE public.quality_costs SET model_info = public.fix_turkish_free_text(model_info)
WHERE model_info IS NOT NULL AND model_info IS DISTINCT FROM public.fix_turkish_free_text(model_info);

UPDATE public.quality_costs SET indirect_cost_description = public.fix_turkish_free_text(indirect_cost_description)
WHERE indirect_cost_description IS NOT NULL AND indirect_cost_description IS DISTINCT FROM public.fix_turkish_free_text(indirect_cost_description);

UPDATE public.quality_costs SET primary_defect_type = public.fix_turkish_free_text(primary_defect_type)
WHERE primary_defect_type IS NOT NULL AND primary_defect_type IS DISTINCT FROM public.fix_turkish_free_text(primary_defect_type);

-- nonconformity_records (UYG)
UPDATE public.nonconformity_records SET description = public.fix_turkish_free_text(description)
WHERE description IS NOT NULL AND description IS DISTINCT FROM public.fix_turkish_free_text(description);

UPDATE public.nonconformity_records SET notes = public.fix_turkish_free_text(notes)
WHERE notes IS NOT NULL AND notes IS DISTINCT FROM public.fix_turkish_free_text(notes);

UPDATE public.nonconformity_records SET action_taken = public.fix_turkish_free_text(action_taken)
WHERE action_taken IS NOT NULL AND action_taken IS DISTINCT FROM public.fix_turkish_free_text(action_taken);

UPDATE public.nonconformity_records SET part_name = public.fix_turkish_free_text(part_name)
WHERE part_name IS NOT NULL AND part_name IS DISTINCT FROM public.fix_turkish_free_text(part_name);

UPDATE public.nonconformity_records SET detection_area = public.fix_turkish_free_text(detection_area)
WHERE detection_area IS NOT NULL AND detection_area IS DISTINCT FROM public.fix_turkish_free_text(detection_area);

UPDATE public.nonconformity_records SET vehicle_identifier = public.fix_turkish_free_text(vehicle_identifier)
WHERE vehicle_identifier IS NOT NULL AND vehicle_identifier IS DISTINCT FROM public.fix_turkish_free_text(vehicle_identifier);

UPDATE public.nonconformity_records SET vehicle_type = public.fix_turkish_free_text(vehicle_type)
WHERE vehicle_type IS NOT NULL AND vehicle_type IS DISTINCT FROM public.fix_turkish_free_text(vehicle_type);
