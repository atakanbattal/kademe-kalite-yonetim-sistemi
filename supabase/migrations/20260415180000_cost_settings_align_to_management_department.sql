-- Ayarlar > Birim (cost_settings): PL personeldeki "birim" yerine üst departman / müdürlük
-- (personnel.management_department) ile hizala; personel.unit_id ve tüm FK'ler birleştirilir.
-- Alt birim (Kabin Hattı, Kaynakhane vb.) personnel.department alanında kalır.

BEGIN;

-- Bozuk Unicode varyantlarını tek yazıma çek (i̇ / İ gibi)
UPDATE public.cost_settings
SET
  unit_name = 'SATIŞ SONRASI HİZMETLER',
  updated_at = now()
WHERE unit_name ILIKE 'satış sonrası%hizmetler%'
  AND unit_name IS DISTINCT FROM 'SATIŞ SONRASI HİZMETLER';

UPDATE public.cost_settings
SET
  unit_name = 'YURT İÇİ SATIŞ',
  updated_at = now()
WHERE unit_name ILIKE 'yurt içi%satış%'
  AND unit_name IS DISTINCT FROM 'YURT İÇİ SATIŞ';

-- Aynı unit_id üzerindeki personelden çoğunluk üst departmanı
WITH per_unit AS (
  SELECT
    p.unit_id,
    trim(p.management_department) AS md,
    count(*)::bigint AS cnt
  FROM public.personnel p
  WHERE p.management_department IS NOT NULL AND trim(p.management_department) <> ''
  GROUP BY p.unit_id, trim(p.management_department)
),
best AS (
  SELECT DISTINCT ON (unit_id)
    unit_id,
    md
  FROM per_unit
  ORDER BY unit_id, cnt DESC, length(md) DESC, md
)
UPDATE public.personnel p
SET
  management_department = b.md,
  updated_at = now()
FROM best b
WHERE p.unit_id = b.unit_id
  AND (p.management_department IS NULL OR trim(p.management_department) = '');

-- PL birim (norm anahtar) + hedef üst departman / müdürlük metni
CREATE TEMP TABLE _pl_birim_to_departman (
  birim_nk text PRIMARY KEY,
  departman text NOT NULL
);

INSERT INTO _pl_birim_to_departman (birim_nk, departman) VALUES
  (public.dept_norm_key('AR-GE'), 'AR-GE DİREKTÖRLÜĞÜ'),
  (public.dept_norm_key('BOYAHANE'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('DEPO'), 'DEPO ŞEFLİĞİ'),
  (public.dept_norm_key('ELEKTRİKHANE'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('GENEL MÜDÜRLÜK'), 'KADEME GENEL MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('KABİN HATTI'), 'ÜRETİM MÜDÜRLÜĞÜ (KABİN HATTI)'),
  (public.dept_norm_key('KALİTE GÜVENCE'), 'KALİTE MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('KALİTE KONTROL'), 'KALİTE MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('KAYNAKHANE'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('KURUMSAL İLETİŞİM'), 'KURUMSAL İLETİŞİM VE DİJİTAL PAZARLAMA'),
  (public.dept_norm_key('LOJİSTİK'), 'LOJİSTİK YÖNETİCİLİĞİ'),
  (public.dept_norm_key('MALİ İŞLER'), 'MALİ İŞLER'),
  (public.dept_norm_key('MONTAJHANE'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('PLANLAMA'), 'ÜRETİM PLANLAMA MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('SATINALMA'), 'SATINALMA MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('SATIŞ SONRASI HİZMETLER'), 'SATIŞ SONRASI HİZMETLER MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('YURT DIŞI SATIŞ'), 'YURT DIŞI SATIŞ MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('YURT İÇİ SATIŞ'), 'YURT İÇİ SATIŞ MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('ÜST YAPI'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('İDARİ İŞLER'), 'İDARİ İŞLER MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('İNSAN KAYNAKLARI'), 'İNSAN KAYNAKLARI MÜDÜRLÜĞÜ');

-- Ek elle birimler (PL listesinde olmayan cost_settings adları)
INSERT INTO _pl_birim_to_departman (birim_nk, departman) VALUES
  (public.dept_norm_key('Mekanik Montaj'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('Lazer Kesim'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('Abkant Pres'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('Bilgi İşlem'), 'İDARİ İŞLER MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('Mühendislik'), 'AR-GE DİREKTÖRLÜĞÜ'),
  (public.dept_norm_key('Üretim'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('İsg'), 'İDARİ İŞLER MÜDÜRLÜĞÜ'),
  (public.dept_norm_key('Elektrik Montaj'), 'ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)'),
  (public.dept_norm_key('Planma'), 'ÜRETİM PLANLAMA MÜDÜRLÜĞÜ')
ON CONFLICT (birim_nk) DO NOTHING;

UPDATE public.personnel p
SET
  management_department = pl.departman,
  updated_at = now()
FROM public.cost_settings cs
JOIN _pl_birim_to_departman pl ON pl.birim_nk = public.dept_norm_key(cs.unit_name)
WHERE p.unit_id = cs.id
  AND (p.management_department IS NULL OR trim(p.management_department) = '');

-- Kayıt adı zaten müdürlük / şeflik düzeyindeyse üst departman = kendi adı
UPDATE public.personnel p
SET
  management_department = cs.unit_name,
  updated_at = now()
FROM public.cost_settings cs
WHERE p.unit_id = cs.id
  AND (p.management_department IS NULL OR trim(p.management_department) = '')
  AND (
    lower(cs.unit_name) LIKE '%müdürlük%'
    OR lower(cs.unit_name) LIKE '%müdürlüğü%'
    OR lower(cs.unit_name) LIKE '%direktörlük%'
    OR lower(cs.unit_name) LIKE '%direktörlüğü%'
    OR lower(cs.unit_name) LIKE '%şefliği%'
    OR lower(cs.unit_name) LIKE '%şeflik%'
  );

-- Personeldeki tüm üst departman metinleri için cost_settings satırı
INSERT INTO public.cost_settings (unit_name, cost_per_minute)
SELECT DISTINCT ON (public.dept_norm_key(trim(p.management_department)))
  trim(p.management_department),
  0::numeric
FROM public.personnel p
WHERE p.management_department IS NOT NULL AND trim(p.management_department) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.cost_settings cs
    WHERE public.dept_norm_key(cs.unit_name) = public.dept_norm_key(trim(p.management_department))
  )
ORDER BY public.dept_norm_key(trim(p.management_department)), length(trim(p.management_department)) DESC;

-- Eski birim maliyetini yeni müdürlük satırına taşı (maksimum dakika maliyeti)
UPDATE public.cost_settings c
SET
  cost_per_minute = GREATEST(c.cost_per_minute, s.mx),
  updated_at = now()
FROM (
  SELECT
    public.dept_norm_key(trim(p.management_department)) AS nk,
    max(cs_old.cost_per_minute)::numeric AS mx
  FROM public.personnel p
  JOIN public.cost_settings cs_old ON cs_old.id = p.unit_id
  WHERE trim(p.management_department) <> ''
  GROUP BY public.dept_norm_key(trim(p.management_department))
) s
WHERE public.dept_norm_key(c.unit_name) = s.nk;

CREATE TEMP TABLE _cs_merge (old_id uuid PRIMARY KEY, new_id uuid NOT NULL);

WITH pairs AS (
  SELECT
    p.unit_id AS old_id,
    cs_new.id AS new_id,
    count(*)::bigint AS cnt
  FROM public.personnel p
  JOIN public.cost_settings cs_new
    ON public.dept_norm_key(cs_new.unit_name) = public.dept_norm_key(trim(p.management_department))
  WHERE trim(p.management_department) <> ''
  GROUP BY p.unit_id, cs_new.id
),
picked AS (
  SELECT DISTINCT ON (old_id)
    old_id,
    new_id
  FROM pairs
  ORDER BY old_id, cnt DESC, new_id
)
INSERT INTO _cs_merge (old_id, new_id)
SELECT old_id, new_id FROM picked;

-- Aynı unit_name metnine sahip mükerrer kayıtlar
INSERT INTO _cs_merge (old_id, new_id)
SELECT o_dup.id, m.new_id
FROM public.cost_settings o_canon
JOIN _cs_merge m ON m.old_id = o_canon.id
JOIN public.cost_settings o_dup
  ON o_dup.unit_name = o_canon.unit_name
  AND o_dup.id <> o_canon.id
WHERE NOT EXISTS (SELECT 1 FROM _cs_merge x WHERE x.old_id = o_dup.id);

-- Özel isimler: silinirse referans bozulmasın diye kimliğe birleştir
INSERT INTO _cs_merge (old_id, new_id)
SELECT cs.id, cs.id
FROM public.cost_settings cs
WHERE trim(cs.unit_name) IN ('Tedarikçi', 'Girdi Kalite')
  AND NOT EXISTS (SELECT 1 FROM _cs_merge x WHERE x.old_id = cs.id);

-- Varsayılan üst departman (yalnızca personel üst departman havuzunda olmayan eski birim satırları)
CREATE TEMP TABLE _top_md AS
SELECT cs.id AS top_id
FROM public.cost_settings cs
WHERE public.dept_norm_key(cs.unit_name) = (
  SELECT public.dept_norm_key(trim(p.management_department))
  FROM public.personnel p
  WHERE trim(p.management_department) <> ''
  GROUP BY trim(p.management_department)
  ORDER BY count(*) DESC, length(trim(p.management_department)) DESC
  LIMIT 1
)
LIMIT 1;

INSERT INTO _cs_merge (old_id, new_id)
SELECT cs.id, t.top_id
FROM public.cost_settings cs
CROSS JOIN _top_md t
WHERE cs.id NOT IN (SELECT old_id FROM _cs_merge)
  AND trim(coalesce(cs.unit_name, '')) NOT IN ('Tedarikçi', 'Girdi Kalite')
  AND EXISTS (SELECT 1 FROM _top_md)
  AND public.dept_norm_key(cs.unit_name) NOT IN (
    SELECT DISTINCT public.dept_norm_key(trim(p.management_department))
    FROM public.personnel p
    WHERE trim(p.management_department) <> ''
  );

UPDATE public.cost_settings c
SET
  cost_per_minute = GREATEST(c.cost_per_minute, s.mx),
  updated_at = now()
FROM (
  SELECT m.new_id AS nid, max(o.cost_per_minute)::numeric AS mx
  FROM _cs_merge m
  JOIN public.cost_settings o ON o.id = m.old_id
  WHERE m.old_id IS DISTINCT FROM m.new_id
  GROUP BY m.new_id
) s
WHERE c.id = s.nid;

UPDATE public.audit_question_bank q SET department_id = m.new_id FROM _cs_merge m WHERE q.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.audits a SET department_id = m.new_id FROM _cs_merge m WHERE a.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.documents d SET department_id = m.new_id FROM _cs_merge m WHERE d.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.personnel p SET unit_id = m.new_id, updated_at = now() FROM _cs_merge m WHERE p.unit_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.kaizen_entries k SET department_id = m.new_id FROM _cs_merge m WHERE k.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.customer_complaints cc SET assigned_department_id = m.new_id FROM _cs_merge m WHERE cc.assigned_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.customer_complaints cc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE cc.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.org_chart_revisions ocr SET unit_id = m.new_id FROM _cs_merge m WHERE ocr.unit_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.complaint_actions ca SET responsible_department_id = m.new_id FROM _cs_merge m WHERE ca.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.benchmarks b SET department_id = m.new_id FROM _cs_merge m WHERE b.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.spc_characteristics sc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE sc.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.apqp_projects ap SET responsible_department_id = m.new_id FROM _cs_merge m WHERE ap.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.fmea_projects fp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE fp.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.fmea_action_plans fap SET responsible_department_id = m.new_id FROM _cs_merge m WHERE fap.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.critical_characteristics cc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE cc.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.validation_plans vp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE vp.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.supplier_development_plans sdp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE sdp.responsible_department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.document_folders df SET department_id = m.new_id FROM _cs_merge m WHERE df.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.quality_inspection_faults qif SET department_id = m.new_id FROM _cs_merge m WHERE qif.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;
UPDATE public.fault_categories fc SET department_id = m.new_id FROM _cs_merge m WHERE fc.department_id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;

DELETE FROM public.cost_settings c USING _cs_merge m WHERE c.id = m.old_id AND m.old_id IS DISTINCT FROM m.new_id;

-- Çoğunlukla yapılan birleştirmeden sonra: her satır için unit_id = kendi üst departmanına ait cost_settings
UPDATE public.personnel p
SET
  unit_id = cs.id,
  updated_at = now()
FROM public.cost_settings cs
WHERE trim(p.management_department) <> ''
  AND public.dept_norm_key(cs.unit_name) = public.dept_norm_key(trim(p.management_department))
  AND p.unit_id IS DISTINCT FROM cs.id;

UPDATE public.personnel p
SET
  management_department = cs.unit_name,
  updated_at = now()
FROM public.cost_settings cs
WHERE p.unit_id = cs.id
  AND trim(p.management_department) IS NOT NULL
  AND public.dept_norm_key(trim(p.management_department)) = public.dept_norm_key(cs.unit_name)
  AND trim(p.management_department) IS DISTINCT FROM cs.unit_name;

COMMENT ON TABLE public.cost_settings IS 'Organizasyon birimi (maliyet); personel ve modüllerle uyumlu üst departman / müdürlük adları.';

COMMIT;
