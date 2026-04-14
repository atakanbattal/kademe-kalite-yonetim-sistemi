-- Personeldeki her üst departman / müdürlük için cost_settings satırı olsun.
-- Tetikleyici: personelde management_department değişince eksik satır eklenir.
-- RPC: toplu senkron + personelde en çok kullanılan yazımı cost_settings.unit_name olarak günceller.

CREATE OR REPLACE FUNCTION public.sync_cost_settings_from_personnel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cost_settings (unit_name, cost_per_minute)
  SELECT DISTINCT ON (public.dept_norm_key(trim(p.management_department)))
    trim(p.management_department),
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
    unit_name = b.md,
    updated_at = now()
  FROM best b
  WHERE public.dept_norm_key(cs.unit_name) = b.nk
    AND cs.unit_name IS DISTINCT FROM b.md;

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

COMMENT ON FUNCTION public.sync_cost_settings_from_personnel() IS
  'Personel üst departman havuzunu cost_settings ile hizalar; eksik satır ekler, en sık yazımı birim adı yapar.';

CREATE OR REPLACE FUNCTION public.personnel_trg_ensure_cost_settings_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.management_department IS DISTINCT FROM OLD.management_department) THEN
    IF NEW.management_department IS NOT NULL AND btrim(NEW.management_department) <> '' THEN
      INSERT INTO public.cost_settings (unit_name, cost_per_minute)
      SELECT btrim(NEW.management_department), 0::numeric
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.cost_settings cs
        WHERE public.dept_norm_key(cs.unit_name) = public.dept_norm_key(btrim(NEW.management_department))
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_personnel_ensure_cost_settings ON public.personnel;
CREATE TRIGGER tr_personnel_ensure_cost_settings
  AFTER INSERT OR UPDATE OF management_department ON public.personnel
  FOR EACH ROW
  EXECUTE FUNCTION public.personnel_trg_ensure_cost_settings_row();

GRANT EXECUTE ON FUNCTION public.sync_cost_settings_from_personnel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cost_settings_from_personnel() TO service_role;

SELECT public.sync_cost_settings_from_personnel();
