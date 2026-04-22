-- Eğitim kodu sırası: start_date takvim gününe göre (tür farkı timestamptz/date için ::date ile tekilleştirilir).
-- Tüm yılları tek seferde düzeltmek için: SELECT public.renumber_all_training_codes();

CREATE OR REPLACE FUNCTION public.renumber_training_codes_for_year(p_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(842002, p_year);

  WITH scoped AS (
    SELECT
      t.id,
      ROW_NUMBER() OVER (
        ORDER BY
          (t.start_date)::date ASC NULLS LAST,
          t.created_at ASC NULLS LAST,
          t.id ASC
      ) AS rn
    FROM public.trainings t
    WHERE EXTRACT(YEAR FROM COALESCE((t.start_date)::date, (t.created_at AT TIME ZONE 'UTC')::date))::integer = p_year
  )
  UPDATE public.trainings t
  SET training_code = 'EGT-' || p_year::text || '-' || lpad(s.rn::text, 4, '0')
  FROM scoped s
  WHERE t.id = s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_training_code(
  p_plan_date date,
  p_exclude_id uuid DEFAULT NULL,
  p_anchor_created_at timestamptz DEFAULT NULL,
  p_anchor_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_year int;
  v_next int;
BEGIN
  IF p_plan_date IS NULL THEN
    p_plan_date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  END IF;
  v_year := EXTRACT(YEAR FROM p_plan_date)::integer;

  IF p_exclude_id IS NOT NULL AND p_anchor_created_at IS NOT NULL AND p_anchor_id IS NOT NULL THEN
    SELECT COALESCE(
      (
        SELECT COUNT(*)::integer
        FROM public.trainings t
        WHERE t.id <> p_exclude_id
          AND EXTRACT(YEAR FROM COALESCE((t.start_date)::date, (t.created_at AT TIME ZONE 'UTC')::date))::integer = v_year
          AND t.start_date IS NOT NULL
          AND (
            (t.start_date)::date < p_plan_date
            OR (
              (t.start_date)::date = p_plan_date
              AND (
                t.created_at < p_anchor_created_at
                OR (t.created_at = p_anchor_created_at AND t.id < p_anchor_id)
              )
            )
          )
      ),
      0
    ) + 1 INTO v_next;
  ELSE
    SELECT COALESCE(
      (
        SELECT COUNT(*)::integer
        FROM public.trainings t
        WHERE EXTRACT(YEAR FROM COALESCE((t.start_date)::date, (t.created_at AT TIME ZONE 'UTC')::date))::integer = v_year
          AND t.start_date IS NOT NULL
          AND (
            (t.start_date)::date < p_plan_date
            OR (t.start_date)::date = p_plan_date
          )
      ),
      0
    ) + 1 INTO v_next;
  END IF;

  RETURN 'EGT-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.renumber_all_training_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT EXTRACT(YEAR FROM COALESCE((start_date)::date, (created_at AT TIME ZONE 'UTC')::date))::integer AS y
    FROM public.trainings
    WHERE EXTRACT(YEAR FROM COALESCE((start_date)::date, (created_at AT TIME ZONE 'UTC')::date))::integer BETWEEN 2000 AND 2100
  LOOP
    PERFORM public.renumber_training_codes_for_year(r.y);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.renumber_all_training_codes() IS
  'Tüm eğitimleri planlanan başlangıç tarihine göre yıl bazında yeniden numaralar (EGT-YYYY-NNNN).';

-- Tetikleyicide yıl hesabı ile renumber WHERE aynı olsun
CREATE OR REPLACE FUNCTION public.trainings_resequence_after_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  y_old int;
  y_new int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    y_old := EXTRACT(YEAR FROM COALESCE((OLD.start_date)::date, (OLD.created_at AT TIME ZONE 'UTC')::date))::integer;
    IF y_old BETWEEN 2000 AND 2100 THEN
      PERFORM public.renumber_training_codes_for_year(y_old);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    y_new := EXTRACT(YEAR FROM COALESCE((NEW.start_date)::date, (NEW.created_at AT TIME ZONE 'UTC')::date))::integer;
    IF y_new BETWEEN 2000 AND 2100 THEN
      PERFORM public.renumber_training_codes_for_year(y_new);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date THEN
      RETURN NEW;
    END IF;
    y_old := EXTRACT(YEAR FROM COALESCE((OLD.start_date)::date, (OLD.created_at AT TIME ZONE 'UTC')::date))::integer;
    y_new := EXTRACT(YEAR FROM COALESCE((NEW.start_date)::date, (NEW.created_at AT TIME ZONE 'UTC')::date))::integer;
    IF y_old BETWEEN 2000 AND 2100 THEN
      PERFORM public.renumber_training_codes_for_year(y_old);
    END IF;
    IF y_new BETWEEN 2000 AND 2100 AND y_new IS DISTINCT FROM y_old THEN
      PERFORM public.renumber_training_codes_for_year(y_new);
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trainings_resequence_codes_after_insert ON public.trainings;
DROP TRIGGER IF EXISTS trainings_resequence_codes_after_upd ON public.trainings;
DROP TRIGGER IF EXISTS trainings_resequence_codes_after_del ON public.trainings;

CREATE TRIGGER trainings_resequence_codes_after_insert
  AFTER INSERT ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.trainings_resequence_after_write();

CREATE TRIGGER trainings_resequence_codes_after_upd
  AFTER UPDATE OF start_date ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.trainings_resequence_after_write();

CREATE TRIGGER trainings_resequence_codes_after_del
  AFTER DELETE ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.trainings_resequence_after_write();

SELECT public.renumber_all_training_codes();

GRANT EXECUTE ON FUNCTION public.renumber_all_training_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.renumber_all_training_codes() TO service_role;

GRANT EXECUTE ON FUNCTION public.preview_training_code(date, uuid, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_training_code(date, uuid, timestamptz, uuid) TO service_role;
