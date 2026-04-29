-- Alt birim (Boyahane, Kaynakhane, …) → ayarlardaki üst yapı müdürlüğü.
-- 1) personel kayıtlarında department → management_department çoğunluğu
-- 2) personelde kalmayan eski serbest yazımlar için sabit dept_norm anahtarı
-- dept_canonical_from_org_pool: önce rollup, sonra mevcut havuz eşlemesi.

CREATE OR REPLACE FUNCTION public.dept_roll_subunit_to_management(src text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_trim text;
  v_rk text;
  v_md text;
BEGIN
  IF src IS NULL OR trim(src) = '' THEN
    RETURN NULL;
  END IF;
  v_trim := trim(src);
  IF v_trim IN ('Tedarikçi', 'Girdi Kalite') THEN
    RETURN NULL;
  END IF;
  v_rk := public.dept_norm_key(v_trim);
  IF v_rk IS NULL OR length(v_rk) < 1 THEN
    RETURN NULL;
  END IF;

  -- Personel: alt birim (department) → üst departman (çoğunluk)
  SELECT trim(p.management_department)
  INTO v_md
  FROM public.personnel p
  WHERE p.department IS NOT NULL
    AND trim(p.department) <> ''
    AND p.management_department IS NOT NULL
    AND trim(p.management_department) <> ''
    AND public.dept_norm_key(trim(p.department)) = v_rk
    AND public.dept_norm_key(trim(p.management_department)) <> v_rk
  GROUP BY trim(p.management_department)
  ORDER BY count(*) DESC, length(trim(p.management_department)) DESC, trim(p.management_department)
  LIMIT 1;

  IF v_md IS NOT NULL THEN
    RETURN public.canonical_unit_display_name(v_md);
  END IF;

  -- Eski PL / işyeri alt birim adları (20260415180000_cost_settings_align_to_management_department ile uyumlu)
  v_md := CASE
    WHEN v_rk = public.dept_norm_key('AR-GE') THEN public.canonical_unit_display_name('AR-GE DİREKTÖRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Boyahane') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Depo') THEN public.canonical_unit_display_name('DEPO ŞEFLİĞİ')
    WHEN v_rk = public.dept_norm_key('Elektrikhane') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Genel Müdürlük') THEN public.canonical_unit_display_name('KADEME GENEL MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Kabin Hattı') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (KABİN HATTI)')
    WHEN v_rk = public.dept_norm_key('Kalite Güvence') THEN public.canonical_unit_display_name('KALİTE MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Kalite Kontrol') THEN public.canonical_unit_display_name('KALİTE MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Kaynakhane') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Kurumsal İletişim') THEN public.canonical_unit_display_name('KURUMSAL İLETİŞİM VE DİJİTAL PAZARLAMA')
    WHEN v_rk = public.dept_norm_key('Lojistik') THEN public.canonical_unit_display_name('LOJİSTİK YÖNETİCİLİĞİ')
    WHEN v_rk = public.dept_norm_key('Mali İşler') THEN public.canonical_unit_display_name('MALI İŞLER')
    WHEN v_rk = public.dept_norm_key('Montajhane') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Planlama') THEN public.canonical_unit_display_name('ÜRETİM PLANLAMA MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Satınalma') THEN public.canonical_unit_display_name('SATINALMA MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Satış Sonrası Hizmetler') THEN public.canonical_unit_display_name('SATIŞ SONRASI HİZMETLER MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Yurt Dışı Satış') THEN public.canonical_unit_display_name('YURT DIŞI SATIŞ MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Yurt İçi Satış') THEN public.canonical_unit_display_name('YURT İÇİ SATIŞ MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Üst Yapı') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('İdari İşler') THEN public.canonical_unit_display_name('İDARİ İŞLER MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('İnsan Kaynakları') THEN public.canonical_unit_display_name('İNSAN KAYNAKLARI MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Mekanik Montaj') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Lazer Kesim') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Abkant Pres') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Bilgi İşlem') THEN public.canonical_unit_display_name('İDARİ İŞLER MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Mühendislik') THEN public.canonical_unit_display_name('AR-GE DİREKTÖRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Üretim') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('İsg') THEN public.canonical_unit_display_name('İDARİ İŞLER MÜDÜRLÜĞÜ')
    WHEN v_rk = public.dept_norm_key('Elektrik Montaj') THEN public.canonical_unit_display_name('ÜRETİM MÜDÜRLÜĞÜ (ÜST YAPI)')
    WHEN v_rk = public.dept_norm_key('Planma') THEN public.canonical_unit_display_name('ÜRETİM PLANLAMA MÜDÜRLÜĞÜ')
    ELSE NULL
  END;

  RETURN v_md;
END;
$$;

COMMENT ON FUNCTION public.dept_roll_subunit_to_management(text) IS
  'Personel departmanından üst yapı müdürlüğü + bilinen PL alt birimleri (Boyahane → Üretim Müdürlüğü Üst Yapı). Tek atlama; cost_settings yazımına canonical_unit_display_name ile yaklaştırılır.';

CREATE OR REPLACE FUNCTION public.dept_canonical_from_org_pool(src text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  rk text;
  v_pick text;
  v_trim text;
  v_roll text;
  v_eff text;
BEGIN
  IF src IS NULL THEN
    RETURN src;
  END IF;
  IF trim(src) = '' THEN
    RETURN src;
  END IF;
  IF trim(src) IN ('Tedarikçi', 'Girdi Kalite') THEN
    RETURN trim(src);
  END IF;

  v_trim := trim(src);

  v_roll := public.dept_roll_subunit_to_management(v_trim);
  v_eff := COALESCE(v_roll, v_trim);

  rk := public.dept_norm_key(v_eff);
  IF rk IS NULL OR length(rk) < 1 THEN
    RETURN normalize(v_trim, NFC);
  END IF;

  SELECT normalize(e.name, NFC) INTO v_pick
  FROM (
    WITH pool AS (
      SELECT DISTINCT trim(cs.unit_name) AS name
      FROM public.cost_settings cs
      WHERE cs.unit_name IS NOT NULL AND trim(cs.unit_name) <> ''
      UNION
      SELECT DISTINCT trim(p.department) AS name
      FROM public.personnel p
      WHERE p.department IS NOT NULL AND trim(p.department) <> ''
      UNION
      SELECT DISTINCT trim(p.management_department) AS name
      FROM public.personnel p
      WHERE p.management_department IS NOT NULL AND trim(p.management_department) <> ''
    ),
    enriched AS (
      SELECT
        p.name,
        public.dept_norm_key(p.name) AS nk,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.personnel pe
            WHERE trim(pe.department) = p.name OR trim(pe.management_department) = p.name
          ) THEN 0
          ELSE 1
        END AS pers_pri,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.cost_settings cs WHERE trim(cs.unit_name) = p.name
          ) THEN 0
          ELSE 1
        END AS cost_pri
      FROM pool p
    )
    SELECT * FROM enriched
  ) e
  WHERE
    e.nk = rk
    OR (length(rk) >= 4 AND e.nk LIKE rk || '%' AND length(e.nk) > length(rk))
    OR (
      length(rk) >= 6
      AND length(e.nk) >= 4
      AND rk LIKE e.nk || '%'
      AND length(e.nk) < length(rk)
    )
  ORDER BY length(e.nk) DESC, e.pers_pri ASC, e.cost_pri ASC, length(e.name) DESC
  LIMIT 1;

  RETURN COALESCE(v_pick, normalize(v_eff, NFC));
END;
$$;

-- Güncellenmiş işlevle metinleri hizala
UPDATE public.non_conformities nc
SET
  department = public.dept_canonical_from_org_pool(nc.department),
  updated_at = now()
WHERE nc.department IS NOT NULL
  AND trim(nc.department) <> ''
  AND nc.department IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.department);

UPDATE public.non_conformities nc
SET
  requesting_unit = public.dept_canonical_from_org_pool(nc.requesting_unit),
  updated_at = now()
WHERE nc.requesting_unit IS NOT NULL
  AND trim(nc.requesting_unit) <> ''
  AND nc.requesting_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.requesting_unit);

UPDATE public.non_conformities nc
SET
  forwarded_unit = public.dept_canonical_from_org_pool(nc.forwarded_unit),
  updated_at = now()
WHERE nc.forwarded_unit IS NOT NULL
  AND trim(nc.forwarded_unit) <> ''
  AND nc.forwarded_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(nc.forwarded_unit);

UPDATE public.quality_costs qc
SET
  unit = public.dept_canonical_from_org_pool(qc.unit),
  updated_at = now()
WHERE qc.unit IS NOT NULL
  AND trim(qc.unit) <> ''
  AND qc.unit NOT IN ('Tedarikçi', 'Girdi Kalite')
  AND qc.unit IS DISTINCT FROM public.dept_canonical_from_org_pool(qc.unit);

UPDATE public.quality_costs qc
SET
  reporting_unit = public.dept_canonical_from_org_pool(qc.reporting_unit),
  updated_at = now()
WHERE qc.reporting_unit IS NOT NULL
  AND trim(qc.reporting_unit) <> ''
  AND qc.reporting_unit NOT IN ('Tedarikçi', 'Girdi Kalite')
  AND qc.reporting_unit IS DISTINCT FROM public.dept_canonical_from_org_pool(qc.reporting_unit);
