-- =============================================================
-- Migration: Create parts_master table
-- Centralizes part_code + part_name data used across 18+ tables
-- =============================================================

CREATE TABLE IF NOT EXISTS public.parts_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_code TEXT NOT NULL,
  part_name TEXT NOT NULL,
  description TEXT,
  vehicle_type TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  unit_of_measure TEXT DEFAULT 'adet',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(part_code)
);

CREATE INDEX IF NOT EXISTS idx_parts_master_part_code ON public.parts_master(part_code);
CREATE INDEX IF NOT EXISTS idx_parts_master_part_name ON public.parts_master(part_name);

-- Seed from existing quality_costs
INSERT INTO public.parts_master (part_code, part_name, vehicle_type)
SELECT DISTINCT ON (lower(trim(part_code)))
  trim(part_code),
  trim(part_name),
  vehicle_type
FROM public.quality_costs
WHERE part_code IS NOT NULL
  AND trim(part_code) != ''
ON CONFLICT (part_code) DO NOTHING;

-- Seed from non_conformities
INSERT INTO public.parts_master (part_code, part_name, vehicle_type)
SELECT DISTINCT ON (lower(trim(part_code)))
  trim(part_code),
  COALESCE(trim(part_name), trim(part_code)),
  vehicle_type
FROM public.non_conformities
WHERE part_code IS NOT NULL
  AND trim(part_code) != ''
ON CONFLICT (part_code) DO NOTHING;

-- Seed from nonconformity_records
INSERT INTO public.parts_master (part_code, part_name)
SELECT DISTINCT ON (lower(trim(part_code)))
  trim(part_code),
  COALESCE(trim(part_name), trim(part_code))
FROM public.nonconformity_records
WHERE part_code IS NOT NULL
  AND trim(part_code) != ''
ON CONFLICT (part_code) DO NOTHING;

-- Seed from incoming_inspections
INSERT INTO public.parts_master (part_code, part_name)
SELECT DISTINCT ON (lower(trim(part_code)))
  trim(part_code),
  COALESCE(trim(part_name), trim(part_code))
FROM public.incoming_inspections
WHERE part_code IS NOT NULL
  AND trim(part_code) != ''
ON CONFLICT (part_code) DO NOTHING;

-- Seed from incoming_control_plans
INSERT INTO public.parts_master (part_code, part_name)
SELECT DISTINCT ON (lower(trim(part_code)))
  trim(part_code),
  COALESCE(trim(part_name), trim(part_code))
FROM public.incoming_control_plans
WHERE part_code IS NOT NULL
  AND trim(part_code) != ''
ON CONFLICT (part_code) DO NOTHING;

-- Enable RLS
ALTER TABLE public.parts_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parts_master"
  ON public.parts_master FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage parts_master"
  ON public.parts_master FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_parts_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parts_master_updated_at
  BEFORE UPDATE ON public.parts_master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_parts_master_updated_at();

GRANT ALL ON public.parts_master TO authenticated;
GRANT SELECT ON public.parts_master TO anon;
