-- Muayene listesi araması: ILIKE Türkçe i/ı, ş, ü vb. için güvenilir eşleşme üretmez.
-- normalizeTurkishForSearch (frontend) ile uyumlu tek bir normalize kolonu üzerinden arama.

CREATE OR REPLACE FUNCTION public.tr_normalize_for_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN ''
    ELSE trim(regexp_replace(
      lower(
        translate(
          normalize(input, NFC),
          'ıİIğĞüÜşŞöÖçÇâÂîÎûÛ',
          'iiigguussoocccaaiiuu'
        )
      ),
      '\s+', ' ', 'g'
    ))
  END;
$$;

COMMENT ON FUNCTION public.tr_normalize_for_search(text) IS
  'Türkçe karakterleri arama için ASCII tabanına indirir (normalizeTurkishForSearch ile uyumlu).';

CREATE OR REPLACE VIEW public.incoming_inspections_with_supplier AS
SELECT
  ii.id,
  ii.record_no,
  ii.inspection_date,
  ii.supplier_id,
  ii.part_name,
  ii.part_code,
  ii.quantity_received,
  ii.unit,
  ii.control_plan_status,
  ii.is_first_sample,
  ii.decision,
  ii.quantity_accepted,
  ii.quantity_conditional,
  ii.quantity_rejected,
  ii.user_id,
  ii.created_at,
  ii.updated_at,
  ii.inkr_status,
  ii.deviation_approval_url,
  ii.notes,
  s.name AS supplier_name,
  nc.nc_number AS linked_nc_number,
  nc.type AS linked_nc_type,
  public.tr_normalize_for_search(
    COALESCE(ii.part_name, '') || ' ' ||
    COALESCE(ii.part_code, '') || ' ' ||
    COALESCE(ii.record_no, '') || ' ' ||
    COALESCE(s.name, '')
  ) AS search_text_normalized
FROM public.incoming_inspections ii
LEFT JOIN public.suppliers s ON ii.supplier_id = s.id
LEFT JOIN (
  SELECT DISTINCT ON (non_conformities.source_inspection_id)
    non_conformities.source_inspection_id,
    non_conformities.nc_number,
    non_conformities.type
  FROM public.non_conformities
  WHERE non_conformities.source_inspection_id IS NOT NULL
  ORDER BY non_conformities.source_inspection_id, non_conformities.created_at DESC
) nc ON ii.id = nc.source_inspection_id;
