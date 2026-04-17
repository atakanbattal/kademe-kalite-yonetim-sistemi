-- Birim adları: personel senkronu en sık yazımı seçerken ALL CAPS kalabiliyordu.
-- dept_norm_key ile eşleşen sabit Title Case etiketleri kullanılır (UI ile uyumlu).

CREATE OR REPLACE FUNCTION public.canonical_unit_display_name(raw text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE public.dept_norm_key(trim(COALESCE(raw, '')))
    WHEN 'argedirektorlugu' THEN 'Ar-Ge Direktörlüğü'
    WHEN 'deposefligi' THEN 'Depo Şefliği'
    WHEN 'idariislermudurlugu' THEN 'İdari İşler Müdürlüğü'
    WHEN 'insankaynaklarimudurlugu' THEN 'İnsan Kaynakları Müdürlüğü'
    WHEN 'kademegenelmudurlugu' THEN 'Kademe Genel Müdürlüğü'
    WHEN 'kalitemudurlugu' THEN 'Kalite Müdürlüğü'
    WHEN 'kurumsaliletisimvedijitalpazarlama' THEN 'Kurumsal İletişim ve Dijital Pazarlama'
    WHEN 'lojistikyoneticiligi' THEN 'Lojistik Yöneticiliği'
    WHEN 'maliisler' THEN 'Mali İşler'
    WHEN 'satinalmamudurlugu' THEN 'Satınalma Müdürlüğü'
    WHEN 'satissonrasihizmetlermudurlugu' THEN 'Satış Sonrası Hizmetler Müdürlüğü'
    WHEN 'tedarikci' THEN 'Tedarikçi'
    WHEN 'uretimmudurlugu(kabinhatti)' THEN 'Üretim Müdürlüğü (Kabin Hattı)'
    WHEN 'uretimmudurlugu(ustyapi)' THEN 'Üretim Müdürlüğü (Üst Yapı)'
    WHEN 'uretimplanlamamudurlugu' THEN 'Üretim Planlama Müdürlüğü'
    WHEN 'yurtdisisatismudurlugu' THEN 'Yurt Dışı Satış Müdürlüğü'
    WHEN 'yurticisatismudurlugu' THEN 'Yurt İçi Satış Müdürlüğü'
    ELSE trim(COALESCE(raw, ''))
  END;
$$;

COMMENT ON FUNCTION public.canonical_unit_display_name(text) IS
  'cost_settings / production_departments birim adı için tutarlı Title Case etiketi; personel senkronunda kullanılır.';

CREATE OR REPLACE FUNCTION public.sync_cost_settings_from_personnel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cost_settings (unit_name, cost_per_minute)
  SELECT DISTINCT ON (public.dept_norm_key(trim(p.management_department)))
    public.canonical_unit_display_name(trim(p.management_department)),
    0::numeric
  FROM public.personnel p
  WHERE trim(p.management_department) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.cost_settings cs
      WHERE public.dept_norm_key(cs.unit_name) = public.dept_norm_key(trim(p.management_department))
    )
  ORDER BY public.dept_norm_key(trim(p.management_department)), length(trim(p.management_department)) DESC;

  WITH ranked AS (
    SELECT
      trim(p.management_department) AS md,
      public.dept_norm_key(trim(p.management_department)) AS nk,
      count(*)::bigint AS c
    FROM public.personnel p
    WHERE trim(p.management_department) <> ''
    GROUP BY trim(p.management_department), public.dept_norm_key(trim(p.management_department))
  ),
  best AS (
    SELECT DISTINCT ON (nk)
      nk,
      md
    FROM ranked
    ORDER BY nk, c DESC, length(md) DESC, md
  )
  UPDATE public.cost_settings cs
  SET
    unit_name = public.canonical_unit_display_name(b.md),
    updated_at = now()
  FROM best b
  WHERE public.dept_norm_key(cs.unit_name) = b.nk
    AND cs.unit_name IS DISTINCT FROM public.canonical_unit_display_name(b.md);

  UPDATE public.personnel p
  SET
    management_department = cs.unit_name,
    updated_at = now()
  FROM public.cost_settings cs
  WHERE p.unit_id = cs.id
    AND trim(p.management_department) IS NOT NULL
    AND public.dept_norm_key(trim(p.management_department)) = public.dept_norm_key(cs.unit_name)
    AND trim(p.management_department) IS DISTINCT FROM cs.unit_name;
END;
$$;

-- Mevcut satırları bir kez hizala
UPDATE public.cost_settings cs
SET unit_name = public.canonical_unit_display_name(cs.unit_name),
    updated_at = now()
WHERE cs.unit_name IS DISTINCT FROM public.canonical_unit_display_name(cs.unit_name);

SELECT public.sync_cost_settings_from_personnel();
