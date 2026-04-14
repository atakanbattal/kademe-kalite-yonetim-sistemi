-- DF/8D öneri kaynakları (tespit alanları) + tekrar RPC filtresi

ALTER TABLE public.nonconformity_settings
  ADD COLUMN IF NOT EXISTS suggestion_include_detection_areas jsonb
  DEFAULT '["Proses İçi Kontrol"]'::jsonb;

UPDATE public.nonconformity_settings
SET suggestion_include_detection_areas = COALESCE(
  suggestion_include_detection_areas,
  '["Proses İçi Kontrol"]'::jsonb
);

CREATE OR REPLACE FUNCTION public.check_part_code_recurrence(
  p_part_code text,
  p_period_days integer DEFAULT 30,
  p_detection_areas text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  total_count integer;
  period_count integer;
  result json;
BEGIN
  IF p_part_code IS NULL OR btrim(p_part_code) = '' THEN
    RETURN json_build_object(
      'total_count', 0,
      'period_count', 0,
      'part_code', p_part_code
    );
  END IF;

  SELECT COUNT(*) INTO total_count
  FROM public.nonconformity_records
  WHERE part_code = p_part_code
    AND status IS DISTINCT FROM 'Kapatıldı'
    AND (
      p_detection_areas IS NULL
      OR detection_area = ANY (p_detection_areas)
    );

  SELECT COUNT(*) INTO period_count
  FROM public.nonconformity_records
  WHERE part_code = p_part_code
    AND detection_date >= (now() - (p_period_days || ' days')::interval)
    AND status IS DISTINCT FROM 'Kapatıldı'
    AND (
      p_detection_areas IS NULL
      OR detection_area = ANY (p_detection_areas)
    );

  result := json_build_object(
    'total_count', total_count,
    'period_count', period_count,
    'part_code', p_part_code
  );

  RETURN result;
END;
$function$;

COMMENT ON COLUMN public.nonconformity_settings.suggestion_include_detection_areas IS
  'DF/8D öneri eşiklerinde hangi detection_area (kaynak modül) kayıtları dikkate alınsın.';
