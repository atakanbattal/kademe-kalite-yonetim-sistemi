-- PL ile eklenen canonical birim adlarına eski mükerrer birimleri birleştir (cost_settings).
-- Eşleştirme tam unit_name ile yapılır (Türkçe lower() tutarsızlığından kaçınmak için).
-- İç tetkik: audits, audit_question_bank, audit_results.question_id korunur; bankada metin bazlı dedupe.

CREATE TEMP TABLE _cost_settings_unit_merge (old_id uuid PRIMARY KEY, new_id uuid NOT NULL);

INSERT INTO _cost_settings_unit_merge (old_id, new_id)
SELECT o.id, n.id
FROM (
  VALUES
    ('Elektrik Montaj'::text, 'ELEKTRİKHANE'::text),
    ('İdari İşler', 'İDARİ İŞLER'),
    ('İnsan Kaynakları', 'İNSAN KAYNAKLARI'),
    ('Kabin Hattı', 'KABİN HATTI'),
    ('Lojistik', 'LOJİSTİK'),
    ('Mali İşler', 'MALİ İŞLER'),
    ('Satın Alma', 'SATINALMA'),
    ('Yurtdışı Satış', 'YURT DIŞI SATIŞ'),
    ('Yurtiçi Satış', 'YURT İÇİ SATIŞ'),
    ('Ssh', 'SATIŞ SONRASI HİZMETLER'),
    ('Üretim Planlama', 'PLANLAMA')
) AS p(old_name, new_name)
JOIN public.cost_settings o ON o.unit_name = p.old_name
JOIN public.cost_settings n ON n.unit_name = p.new_name
WHERE o.id IS DISTINCT FROM n.id;

-- Canonical satırda dakika maliyetini eski kayıtların maksimumu ile güncelle
UPDATE public.cost_settings c
SET
  cost_per_minute = GREATEST(c.cost_per_minute, s.mx),
  updated_at = now()
FROM (
  SELECT m.new_id AS nid, MAX(o.cost_per_minute) AS mx
  FROM _cost_settings_unit_merge m
  JOIN public.cost_settings o ON o.id = m.old_id
  GROUP BY m.new_id
) s
WHERE c.id = s.nid;

UPDATE public.audit_question_bank q
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE q.department_id = m.old_id;

UPDATE public.audits a
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE a.department_id = m.old_id;

UPDATE public.documents d
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE d.department_id = m.old_id;

UPDATE public.personnel p
SET
  unit_id = m.new_id,
  department = cn.unit_name,
  updated_at = now()
FROM _cost_settings_unit_merge m
JOIN public.cost_settings cn ON cn.id = m.new_id
WHERE p.unit_id = m.old_id;

UPDATE public.kaizen_entries k
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE k.department_id = m.old_id;

UPDATE public.customer_complaints cc
SET assigned_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE cc.assigned_department_id = m.old_id;

UPDATE public.customer_complaints cc
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE cc.responsible_department_id = m.old_id;

UPDATE public.org_chart_revisions ocr
SET unit_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE ocr.unit_id = m.old_id;

UPDATE public.complaint_actions ca
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE ca.responsible_department_id = m.old_id;

UPDATE public.benchmarks b
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE b.department_id = m.old_id;

UPDATE public.spc_characteristics sc
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE sc.responsible_department_id = m.old_id;

UPDATE public.apqp_projects ap
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE ap.responsible_department_id = m.old_id;

UPDATE public.fmea_projects fp
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE fp.responsible_department_id = m.old_id;

UPDATE public.fmea_action_plans fap
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE fap.responsible_department_id = m.old_id;

UPDATE public.critical_characteristics cc
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE cc.responsible_department_id = m.old_id;

UPDATE public.validation_plans vp
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE vp.responsible_department_id = m.old_id;

UPDATE public.supplier_development_plans sdp
SET responsible_department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE sdp.responsible_department_id = m.old_id;

UPDATE public.document_folders df
SET department_id = m.new_id
FROM _cost_settings_unit_merge m
WHERE df.department_id = m.old_id;

-- Aynı birim + standart + soru metni için mükerrer banka satırlarını tekilleştir
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY
        department_id,
        audit_standard_id,
        lower(trim(regexp_replace(question_text, '\s+', ' ', 'g')))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keeper_id
  FROM public.audit_question_bank
),
dupes AS (
  SELECT id AS dupe_id, keeper_id
  FROM ranked
  WHERE id <> keeper_id
)
UPDATE public.audit_results ar
SET question_id = d.keeper_id
FROM dupes d
WHERE ar.question_id = d.dupe_id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY
        department_id,
        audit_standard_id,
        lower(trim(regexp_replace(question_text, '\s+', ' ', 'g')))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keeper_id
  FROM public.audit_question_bank
)
DELETE FROM public.audit_question_bank q
WHERE q.id IN (SELECT id FROM ranked WHERE id <> keeper_id);

DELETE FROM public.cost_settings c
USING _cost_settings_unit_merge m
WHERE c.id = m.old_id;
