-- GKK DF toplu import şablonundaki «eleneememektedir» yazım hatası ve anlamsız 5 Neden metni.
-- Uygulama: src/lib/df8dTextUtils.js sanitizeDf8dAnalysisText ile senkron tutun.

CREATE OR REPLACE FUNCTION public.fix_df8d_analysis_text(p_input text)
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

  t := replace(t, 'Muayenede uygunsuz parçalar, sevkiyattan önce tedarikçi tarafından eleneememektedir.',
    'Uygunsuz parçalar, tedarikçi tarafında sevkiyattan önce elenememektedir.');
  t := replace(t, 'Muayenede uygunsuz parçalar, sevkiyattan önce tedarikçi tarafından elenememektedir.',
    'Uygunsuz parçalar, tedarikçi tarafında sevkiyattan önce elenememektedir.');
  t := replace(t, 'eleneememektedir', 'elenememektedir');
  t := replace(t, 'Tedarikgi', 'Tedarikçi');

  RETURN t;
END;
$$;

COMMENT ON FUNCTION public.fix_df8d_analysis_text(text) IS
  'DF/8D kök neden analizi metinlerindeki GKK import şablon hatalarını düzeltir. JS: sanitizeDf8dAnalysisText';

-- five_why_analysis JSON string alanları
UPDATE public.non_conformities n
SET five_why_analysis = sub.fixed,
    updated_at = now()
FROM (
  SELECT
    id,
    jsonb_object_agg(e.key, to_jsonb(public.fix_df8d_analysis_text(e.value))) AS fixed
  FROM public.non_conformities,
       LATERAL jsonb_each_text(five_why_analysis) AS e(key, value)
  WHERE five_why_analysis IS NOT NULL
    AND five_why_analysis::text ~* 'eleneem|Muayenede uygunsuz parçalar|Tedarikgi'
  GROUP BY id
) sub
WHERE n.id = sub.id
  AND n.five_why_analysis IS DISTINCT FROM sub.fixed;

-- five_n1k_analysis JSON string alanları
UPDATE public.non_conformities n
SET five_n1k_analysis = sub.fixed,
    updated_at = now()
FROM (
  SELECT
    id,
    jsonb_object_agg(e.key, to_jsonb(public.fix_df8d_analysis_text(e.value))) AS fixed
  FROM public.non_conformities,
       LATERAL jsonb_each_text(five_n1k_analysis) AS e(key, value)
  WHERE five_n1k_analysis IS NOT NULL
    AND five_n1k_analysis::text ~* 'eleneem|Muayenede uygunsuz parçalar|Tedarikgi'
  GROUP BY id
) sub
WHERE n.id = sub.id
  AND n.five_n1k_analysis IS DISTINCT FROM sub.fixed;

-- 8D D4 özet metni (5 Neden satırları)
UPDATE public.non_conformities
SET eight_d_steps = jsonb_set(
      eight_d_steps,
      '{D4,description}',
      to_jsonb(public.fix_df8d_analysis_text(eight_d_steps->'D4'->>'description')),
      true
    ),
    updated_at = now()
WHERE type = '8D'
  AND eight_d_steps->'D4'->>'description' IS NOT NULL
  AND eight_d_steps->'D4'->>'description' ~* 'eleneem|Muayenede uygunsuz parçalar';
