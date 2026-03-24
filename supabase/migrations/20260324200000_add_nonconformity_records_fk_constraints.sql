-- =============================================================
-- Migration: Add FK constraints to nonconformity_records
-- =============================================================

-- 1. source_nc_id -> non_conformities(id) ON DELETE SET NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'nonconformity_records'::regclass
      AND contype = 'f'
      AND conname = 'nonconformity_records_source_nc_id_fkey'
  ) THEN
    ALTER TABLE public.nonconformity_records
      ADD CONSTRAINT nonconformity_records_source_nc_id_fkey
      FOREIGN KEY (source_nc_id)
      REFERENCES public.non_conformities(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2. created_by -> auth.users(id) ON DELETE SET NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'nonconformity_records'::regclass
      AND contype = 'f'
      AND conname = 'nonconformity_records_created_by_fkey'
  ) THEN
    ALTER TABLE public.nonconformity_records
      ADD CONSTRAINT nonconformity_records_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
