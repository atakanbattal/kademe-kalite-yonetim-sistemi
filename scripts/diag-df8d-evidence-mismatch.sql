-- DF/8D kanıt yolu / kayıt id eşleşmesi teşhis sorgusu (READ-ONLY).
-- Hiçbir veriyi DEĞİŞTİRMEZ. Yalnızca uyumsuzlukları listeler.
--
-- Kullanım:
--   Supabase SQL editöründe çalıştırın. Çıktı 3 bölüm hâlinde gelir:
--     1) eight_d_progress[*].evidenceFiles içinde başka bir kayda ait yollar
--     2) eight_d_steps[*].evidenceFiles içinde başka bir kayda ait yollar
--     3) attachments / closing_attachments içinde başka bir kayda ait yollar
--
-- Beklenen yol formatları:
--   evidence:   nc-evidence/{non_conformities.id}/{D1..D8}/...
--   attachment: {non_conformities.id}/...
--   closing:    nc_closing_attachments/{non_conformities.id}/... (veya {id}/...)
--
-- "Yabancı id" satırı = path içindeki UUID, kayıt id'si ile eşleşmiyor.

-- 1) eight_d_progress içindeki uyumsuz kanıt yolları
WITH evidence_paths AS (
  SELECT
    nc.id                 AS record_id,
    nc.nc_number,
    nc.title,
    step.key              AS step_key,
    ef.value->>'path'     AS file_path,
    ef.value->>'name'     AS file_name
  FROM public.non_conformities nc
  CROSS JOIN LATERAL jsonb_each(COALESCE(nc.eight_d_progress, '{}'::jsonb)) AS step(key, value)
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(step.value->'evidenceFiles', '[]'::jsonb)
  ) AS ef(value)
  WHERE nc.eight_d_progress IS NOT NULL
)
SELECT
  '1_progress_evidence' AS section,
  record_id,
  nc_number,
  step_key,
  file_path,
  file_name,
  -- Yoldan UUID'yi çıkar (varsa)
  (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] AS path_uuid
FROM evidence_paths
WHERE file_path IS NOT NULL
  AND file_path LIKE 'nc-evidence/%'
  -- "unknown" klasörü yeni kayıt akışında oluşur, yabancı sayma
  AND file_path NOT LIKE 'nc-evidence/unknown/%'
  -- Yol UUID içeriyor ve bu UUID kayıt id'si DEĞİL
  AND (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] IS NOT NULL
  AND (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] <> record_id::text
ORDER BY nc_number, step_key;

-- 2) eight_d_steps içindeki uyumsuz kanıt yolları
WITH evidence_paths AS (
  SELECT
    nc.id                 AS record_id,
    nc.nc_number,
    step.key              AS step_key,
    ef.value->>'path'     AS file_path,
    ef.value->>'name'     AS file_name
  FROM public.non_conformities nc
  CROSS JOIN LATERAL jsonb_each(COALESCE(nc.eight_d_steps, '{}'::jsonb)) AS step(key, value)
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(step.value->'evidenceFiles', '[]'::jsonb)
  ) AS ef(value)
  WHERE nc.eight_d_steps IS NOT NULL
)
SELECT
  '2_steps_evidence' AS section,
  record_id,
  nc_number,
  step_key,
  file_path,
  file_name,
  (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] AS path_uuid
FROM evidence_paths
WHERE file_path IS NOT NULL
  AND file_path LIKE 'nc-evidence/%'
  AND file_path NOT LIKE 'nc-evidence/unknown/%'
  AND (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] IS NOT NULL
  AND (regexp_match(file_path, 'nc-evidence/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1] <> record_id::text
ORDER BY nc_number, step_key;

-- 3) attachments / closing_attachments uyumsuz yolları
-- attachments kolonu hem text[] hem jsonb olarak modellenmiş olabilir; to_jsonb ile
-- her iki durumu da güvenli şekilde diziye çevirip eleman eleman gezeriz.
WITH att AS (
  SELECT nc.id AS record_id, nc.nc_number, 'attachments' AS bucket,
         elem AS file_path
  FROM public.non_conformities nc,
       LATERAL jsonb_array_elements_text(
         CASE
           WHEN nc.attachments IS NULL THEN '[]'::jsonb
           ELSE to_jsonb(nc.attachments)
         END
       ) AS elem
  UNION ALL
  SELECT nc.id, nc.nc_number, 'closing_attachments',
         elem
  FROM public.non_conformities nc,
       LATERAL jsonb_array_elements_text(
         CASE
           WHEN nc.closing_attachments IS NULL THEN '[]'::jsonb
           ELSE to_jsonb(nc.closing_attachments)
         END
       ) AS elem
)
SELECT
  '3_attachments' AS section,
  record_id,
  nc_number,
  bucket,
  file_path,
  -- attachments için: ilk klasör UUID'si record_id ile eşleşmiyorsa yabancıdır
  -- closing için: 'nc_closing_attachments/{uuid}/...' veya '{uuid}/...' biçiminde olabilir
  COALESCE(
    (regexp_match(file_path, '^nc_closing_attachments/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1],
    (regexp_match(file_path, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1]
  ) AS path_uuid
FROM att
WHERE
  COALESCE(
    (regexp_match(file_path, '^nc_closing_attachments/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1],
    (regexp_match(file_path, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1]
  ) IS NOT NULL
  AND COALESCE(
    (regexp_match(file_path, '^nc_closing_attachments/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1],
    (regexp_match(file_path, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1]
  ) <> record_id::text
ORDER BY nc_number, bucket;
