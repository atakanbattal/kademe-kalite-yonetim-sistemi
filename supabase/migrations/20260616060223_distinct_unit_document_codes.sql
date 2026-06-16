-- Birim bazlı doküman numarası öneklerini ayırt edici kodlara taşır.
-- İlk 3 harf fallback'i (ÜRE, SAT, YUR çakışmaları) kaldırılır.

CREATE OR REPLACE FUNCTION public.canonical_unit_code(raw text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE public.dept_norm_key(trim(COALESCE(raw, '')))
    WHEN 'argedirektorlugu' THEN 'ARG'
    WHEN 'deposefligi' THEN 'DEP'
    WHEN 'idariislermudurlugu' THEN 'IDI'
    WHEN 'insankaynaklarimudurlugu' THEN 'IK'
    WHEN 'kademegenelmudurlugu' THEN 'GEN'
    WHEN 'kalitemudurlugu' THEN 'KAL'
    WHEN 'kurumsaliletisimvedijitalpazarlama' THEN 'KID'
    WHEN 'lojistikyoneticiligi' THEN 'LOJ'
    WHEN 'maliisler' THEN 'MAL'
    WHEN 'satinalmamudurlugu' THEN 'SAA'
    WHEN 'satissonrasihizmetlermudurlugu' THEN 'SSH'
    WHEN 'tedarikci' THEN 'TED'
    WHEN 'uretimmudurlugu(kabinhatti)' THEN 'URK'
    WHEN 'uretimmudurlugu(ustyapi)' THEN 'URY'
    WHEN 'uretimplanlamamudurlugu' THEN 'URP'
    WHEN 'yurtdisisatismudurlugu' THEN 'YDS'
    WHEN 'yurticisatismudurlugu' THEN 'YIS'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.canonical_unit_code(text) IS
  'İç doküman numarası öneki için birim kodu; dept_norm_key ile eşlenir.';

CREATE OR REPLACE FUNCTION public.generate_unit_code_from_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_words text[];
  v_word text;
  v_code text := '';
  v_skip text[] := ARRAY[
    'mudurlugu', 'mudurluk', 'direktorlugu', 'sefligi', 'yoneticiligi',
    'hizmetler', 'mudur', 've', 'ile', 'icin', 'the', 'and'
  ];
  v_clean text;
BEGIN
  v_clean := lower(public.dept_norm_key(trim(COALESCE(p_name, ''))));
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  v_words := regexp_split_to_array(v_clean, '[^a-z0-9]+');
  FOREACH v_word IN ARRAY v_words LOOP
    CONTINUE WHEN v_word IS NULL OR v_word = '';
    CONTINUE WHEN v_word = ANY (v_skip);
    v_code := v_code || upper(substring(v_word, 1, 1));
    EXIT WHEN length(v_code) >= 4;
  END LOOP;

  IF length(v_code) < 2 THEN
    v_code := upper(substring(v_clean, 1, 3));
  END IF;

  RETURN v_code;
END;
$function$;

COMMENT ON FUNCTION public.generate_unit_code_from_name(text) IS
  'Bilinmeyen birim adları için otomatik kısa kod üretir (son çare).';

CREATE OR REPLACE FUNCTION public.resolve_unit_code(p_unit_name text, p_existing_code text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_code text;
BEGIN
  v_code := NULLIF(upper(trim(COALESCE(p_existing_code, ''))), '');
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.canonical_unit_code(p_unit_name);
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  RETURN public.generate_unit_code_from_name(p_unit_name);
END;
$function$;

-- Mevcut birimlere benzersiz kod ata
UPDATE public.cost_settings cs
SET
  unit_code = mapped.code,
  updated_at = now()
FROM (
  SELECT
    id,
    public.resolve_unit_code(unit_name, unit_code) AS code
  FROM public.cost_settings
) mapped
WHERE cs.id = mapped.id
  AND cs.unit_code IS DISTINCT FROM mapped.code;

-- Bilinmeyen birimlerde çakışmayı gider
DO $$
DECLARE
  r record;
  v_suffix int;
  v_candidate text;
BEGIN
  FOR r IN
    SELECT id, unit_name, unit_code
    FROM public.cost_settings
    WHERE unit_code IN (
      SELECT unit_code
      FROM public.cost_settings
      WHERE unit_code IS NOT NULL
      GROUP BY unit_code
      HAVING COUNT(*) > 1
    )
    ORDER BY unit_name
  LOOP
    v_suffix := 2;
    v_candidate := r.unit_code || v_suffix::text;
    WHILE EXISTS (
      SELECT 1 FROM public.cost_settings
      WHERE unit_code = v_candidate AND id <> r.id
    ) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := left(r.unit_code, 8) || v_suffix::text;
    END LOOP;

    UPDATE public.cost_settings
    SET unit_code = v_candidate, updated_at = now()
    WHERE id = r.id
      AND id <> (
        SELECT id FROM public.cost_settings
        WHERE unit_code = r.unit_code
        ORDER BY unit_name
        LIMIT 1
      );
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cost_settings_unit_code_unique_idx
  ON public.cost_settings (unit_code)
  WHERE unit_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cost_settings_assign_unit_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_code text;
  v_suffix int := 2;
BEGIN
  v_code := public.resolve_unit_code(NEW.unit_name, NEW.unit_code);
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Birim kodu üretilemedi: %', NEW.unit_name;
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.cost_settings
    WHERE unit_code = v_code AND id IS DISTINCT FROM NEW.id
  ) LOOP
    v_code := left(public.resolve_unit_code(NEW.unit_name, NEW.unit_code), 8) || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  NEW.unit_code := v_code;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cost_settings_assign_unit_code ON public.cost_settings;
CREATE TRIGGER trg_cost_settings_assign_unit_code
  BEFORE INSERT OR UPDATE OF unit_name, unit_code
  ON public.cost_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.cost_settings_assign_unit_code();

CREATE OR REPLACE FUNCTION public.sync_cost_settings_from_personnel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cost_settings (unit_name, cost_per_minute, unit_code)
  SELECT DISTINCT ON (public.dept_norm_key(trim(p.management_department)))
    public.canonical_unit_display_name(trim(p.management_department)),
    0::numeric,
    public.resolve_unit_code(public.canonical_unit_display_name(trim(p.management_department)), NULL)
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
    unit_code = public.resolve_unit_code(public.canonical_unit_display_name(b.md), cs.unit_code),
    updated_at = now()
  FROM best b
  WHERE public.dept_norm_key(cs.unit_name) = b.nk
    AND (
      cs.unit_name IS DISTINCT FROM public.canonical_unit_display_name(b.md)
      OR cs.unit_code IS DISTINCT FROM public.resolve_unit_code(public.canonical_unit_display_name(b.md), cs.unit_code)
    );

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

CREATE OR REPLACE FUNCTION public.generate_document_number(
    p_department_id uuid,
    p_document_type text,
    p_document_subcategory text DEFAULT NULL::text
)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_dept_code VARCHAR(10);
    v_type_code VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_doc_number VARCHAR(100);
    v_prefix_pattern VARCHAR(50);
    v_attempt INTEGER := 0;
BEGIN
    SELECT COALESCE(
        NULLIF(upper(trim(unit_code)), ''),
        public.canonical_unit_code(unit_name),
        public.generate_unit_code_from_name(unit_name)
    ) INTO v_dept_code
    FROM cost_settings
    WHERE id = p_department_id;

    IF v_dept_code IS NULL OR v_dept_code = '' THEN
        RAISE EXCEPTION 'Birim kodu bulunamadı (department_id=%)', p_department_id;
    END IF;

    CASE p_document_type
        WHEN 'Prosedürler' THEN v_type_code := 'PR';
        WHEN 'Talimatlar' THEN v_type_code := 'TL';
        WHEN 'Formlar' THEN v_type_code := 'FR';
        WHEN 'Kalite Sertifikaları' THEN v_type_code := 'KS';
        WHEN 'Personel Sertifikaları' THEN v_type_code := 'PS';
        WHEN 'El Kitapları' THEN v_type_code := 'EK';
        WHEN 'Şemalar' THEN v_type_code := 'SM';
        WHEN 'Görev Tanımları' THEN v_type_code := 'GT';
        WHEN 'Süreçler' THEN v_type_code := 'SC';
        WHEN 'Planlar' THEN v_type_code := 'PL';
        WHEN 'Listeler' THEN v_type_code := 'LS';
        WHEN 'Şartnameler' THEN v_type_code := 'ST';
        WHEN 'Politikalar' THEN v_type_code := 'PO';
        WHEN 'Tablolar' THEN v_type_code := 'TB';
        WHEN 'Antetler' THEN v_type_code := 'AT';
        WHEN 'Sözleşmeler' THEN v_type_code := 'SZ';
        WHEN 'Yönetmelikler' THEN v_type_code := 'YT';
        WHEN 'Kontrol Planları' THEN v_type_code := 'KP';
        WHEN 'FMEA Planları' THEN v_type_code := 'FP';
        WHEN 'Proses Kontrol Kartları' THEN v_type_code := 'PK';
        WHEN 'Görsel Yardımcılar' THEN v_type_code := 'GY';
        ELSE v_type_code := 'DG';
    END CASE;

    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_prefix_pattern := '^' || v_dept_code || '-' || v_type_code || '-[0-9]{4}-[0-9]{4}$';

    SELECT COALESCE(MAX(CAST(SUBSTRING(document_number FROM '([0-9]{4})$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM documents
    WHERE document_number ~ v_prefix_pattern;

    LOOP
        v_attempt := v_attempt + 1;
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
        IF NOT EXISTS (SELECT 1 FROM documents WHERE document_number = v_doc_number) THEN
            RETURN v_doc_number;
        END IF;
        v_sequence := v_sequence + 1;
        IF v_attempt > 500 THEN
            RAISE EXCEPTION 'Doküman numarası üretilemedi: %', v_doc_number;
        END IF;
    END LOOP;
END;
$function$;

-- Mevcut iç doküman numaralarını birim kodlarına hizala (department_id olan kayıtlar)
DO $$
DECLARE
  r record;
  v_new_number text;
  v_suffix int;
BEGIN
  FOR r IN
    SELECT
      d.id,
      d.document_number,
      cs.unit_code AS target_code
    FROM documents d
    JOIN cost_settings cs ON cs.id = d.department_id
    WHERE d.document_number IS NOT NULL
      AND btrim(d.document_number) <> ''
      AND d.document_number ~ '^[^-]+-[^-]+-[0-9]{4}-[0-9]{4}$'
      AND split_part(d.document_number, '-', 1) IS DISTINCT FROM cs.unit_code
    ORDER BY d.created_at
  LOOP
    v_new_number :=
      r.target_code || '-' ||
      split_part(r.document_number, '-', 2) || '-' ||
      split_part(r.document_number, '-', 3) || '-' ||
      split_part(r.document_number, '-', 4);

    IF EXISTS (SELECT 1 FROM documents WHERE document_number = v_new_number AND id <> r.id) THEN
      v_suffix := 1;
      LOOP
        v_suffix := v_suffix + 1;
        v_new_number :=
          r.target_code || '-' ||
          split_part(r.document_number, '-', 2) || '-' ||
          split_part(r.document_number, '-', 3) || '-' ||
          lpad(v_suffix::text, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM documents WHERE document_number = v_new_number AND id <> r.id);
        EXIT WHEN v_suffix > 9999;
      END LOOP;
    END IF;

    UPDATE documents
    SET document_number = v_new_number, updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;
