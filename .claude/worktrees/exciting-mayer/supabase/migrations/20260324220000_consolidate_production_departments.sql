-- =============================================================
-- Migration: Consolidate production_departments into cost_settings
-- Creates production_departments VIEW + departments VIEW
-- =============================================================

-- Step 1: Drop old FK constraints FIRST
ALTER TABLE public.quality_inspection_faults
  DROP CONSTRAINT IF EXISTS quality_inspection_faults_department_id_fkey;
ALTER TABLE public.fault_categories
  DROP CONSTRAINT IF EXISTS fault_categories_department_id_fkey;

-- Step 2: Build mapping table for PD -> CS ID translation
CREATE TEMP TABLE _pd_cs_map AS
SELECT pd.id AS old_id, cs.id AS new_id
FROM public.production_departments pd
JOIN public.cost_settings cs
  ON lower(trim(cs.unit_name)) = lower(trim(pd.name))
WHERE pd.id != cs.id
UNION
SELECT pd.id AS old_id, cs.id AS new_id
FROM public.production_departments pd
JOIN public.cost_settings cs
  ON lower(replace(trim(cs.unit_name), ' ', '')) = lower(replace(trim(pd.name), ' ', ''))
WHERE pd.id != cs.id
  AND NOT EXISTS (
    SELECT 1 FROM public.cost_settings cs2
    WHERE lower(trim(cs2.unit_name)) = lower(trim(pd.name)) AND cs2.id != pd.id
  );

-- Step 3: Insert PD entries that have NO match in CS (keep their UUIDs)
INSERT INTO public.cost_settings (id, unit_name, cost_per_minute, created_at, updated_at)
SELECT pd.id, pd.name, 0, pd.created_at, NOW()
FROM public.production_departments pd
WHERE NOT EXISTS (
  SELECT 1 FROM _pd_cs_map m WHERE m.old_id = pd.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.cost_settings cs WHERE cs.id = pd.id
);

-- Step 4: Remap department_id in quality_inspection_faults
UPDATE public.quality_inspection_faults qif
SET department_id = m.new_id
FROM _pd_cs_map m
WHERE qif.department_id = m.old_id;

-- Step 5: Remap department_id in fault_categories
UPDATE public.fault_categories fc
SET department_id = m.new_id
FROM _pd_cs_map m
WHERE fc.department_id = m.old_id;

-- Step 6: Verify integrity
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.quality_inspection_faults qif
  WHERE qif.department_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.cost_settings cs WHERE cs.id = qif.department_id);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned department_ids in quality_inspection_faults', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM public.fault_categories fc
  WHERE fc.department_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.cost_settings cs WHERE cs.id = fc.department_id);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned department_ids in fault_categories', orphan_count;
  END IF;
END $$;

-- Step 7: Add new FK constraints pointing to cost_settings
ALTER TABLE public.quality_inspection_faults
  ADD CONSTRAINT quality_inspection_faults_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.cost_settings(id) ON DELETE SET NULL;

ALTER TABLE public.fault_categories
  ADD CONSTRAINT fault_categories_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.cost_settings(id) ON DELETE SET NULL;

-- Step 8: Drop production_departments table
DROP TABLE IF EXISTS public.production_departments CASCADE;

-- Step 9: Create production_departments as VIEW (backward compatibility)
CREATE OR REPLACE VIEW public.production_departments AS
SELECT id, unit_name AS name, created_at
FROM public.cost_settings;

-- Step 10: Create departments VIEW (canonical alias)
CREATE OR REPLACE VIEW public.departments AS
SELECT id,
       unit_name AS name,
       unit_code AS code,
       cost_per_minute,
       created_at,
       updated_at
FROM public.cost_settings;

-- Step 11: Grant permissions
GRANT SELECT ON public.production_departments TO anon, authenticated;
GRANT SELECT ON public.departments TO anon, authenticated;

-- Cleanup
DROP TABLE IF EXISTS _pd_cs_map;
