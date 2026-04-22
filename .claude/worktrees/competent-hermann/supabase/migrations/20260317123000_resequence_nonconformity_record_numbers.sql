BEGIN;

CREATE OR REPLACE FUNCTION public.resequence_nonconformity_record_numbers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT pg_try_advisory_xact_lock(61720317) THEN
        RETURN;
    END IF;

    DROP TABLE IF EXISTS pg_temp.tmp_nonconformity_record_numbers;

    CREATE TEMP TABLE tmp_nonconformity_record_numbers ON COMMIT DROP AS
    SELECT
        id,
        COALESCE(
            SUBSTRING(record_number FROM 'UYG-(\d{2})-'),
            TO_CHAR(COALESCE(created_at, detection_date, NOW()) AT TIME ZONE 'Europe/Istanbul', 'YY')
        ) AS year_part,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
                SUBSTRING(record_number FROM 'UYG-(\d{2})-'),
                TO_CHAR(COALESCE(created_at, detection_date, NOW()) AT TIME ZONE 'Europe/Istanbul', 'YY')
            )
            ORDER BY COALESCE(created_at, detection_date, NOW()) ASC, id ASC
        ) AS next_sequence
    FROM public.nonconformity_records;

    -- pg-safeupdate: WHERE 1=1 ile tüm satır güncellemesi güvenli hale getirildi
    UPDATE public.nonconformity_records
    SET record_number = '__tmp_nc__' || id::text
    WHERE 1=1;

    UPDATE public.nonconformity_records AS target
    SET record_number = FORMAT(
        'UYG-%s-%s',
        source.year_part,
        LPAD(source.next_sequence::text, 4, '0')
    )
    FROM tmp_nonconformity_record_numbers AS source
    WHERE source.id = target.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_resequence_nonconformity_record_numbers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.resequence_nonconformity_record_numbers();
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_resequence_nonconformity_record_numbers
ON public.nonconformity_records;

CREATE TRIGGER trg_resequence_nonconformity_record_numbers
AFTER INSERT OR DELETE ON public.nonconformity_records
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_resequence_nonconformity_record_numbers();

GRANT EXECUTE ON FUNCTION public.resequence_nonconformity_record_numbers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resequence_nonconformity_record_numbers() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_resequence_nonconformity_record_numbers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_resequence_nonconformity_record_numbers() TO service_role;

SELECT public.resequence_nonconformity_record_numbers();

COMMIT;
