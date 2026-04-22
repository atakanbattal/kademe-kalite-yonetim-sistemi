-- PostgREST embed: nonconformity_records.linked_nc -> non_conformities(nc_number, type)
DO $$
DECLARE
  fk_count int;
BEGIN
  SELECT COUNT(*)::int INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'nonconformity_records'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'source_nc_id';

  IF fk_count = 0 THEN
    ALTER TABLE public.nonconformity_records
      ADD CONSTRAINT nonconformity_records_source_nc_id_fkey
      FOREIGN KEY (source_nc_id) REFERENCES public.non_conformities(id)
      ON DELETE SET NULL;
  END IF;
END $$;
