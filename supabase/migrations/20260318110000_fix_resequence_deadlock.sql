-- Deadlock önleme: pg_advisory_xact_lock -> pg_try_advisory_xact_lock
-- Eğer lock alınamazsa resequence atlanır (sonraki INSERT/DELETE tekrar dener)
-- Bu sayede 40P01 deadlock hatası önlenir

CREATE OR REPLACE FUNCTION public.resequence_nonconformity_record_numbers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Deadlock önleme: Lock alınamazsa sessizce çık (bloklama yok)
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
