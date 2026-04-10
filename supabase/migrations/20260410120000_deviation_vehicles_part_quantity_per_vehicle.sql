-- Sapma: her araç satırında ilgili sapmalı parçadan kaç adet takılabileceği (izlenebilirlik)
ALTER TABLE public.deviation_vehicles
  ADD COLUMN IF NOT EXISTS part_quantity_per_vehicle integer NULL;

COMMENT ON COLUMN public.deviation_vehicles.part_quantity_per_vehicle IS 'Bu araca ilgili sapma parçasından takılabilecek adet (araç başına)';

ALTER TABLE public.deviation_vehicles
  DROP CONSTRAINT IF EXISTS deviation_vehicles_part_quantity_per_vehicle_check;

ALTER TABLE public.deviation_vehicles
  ADD CONSTRAINT deviation_vehicles_part_quantity_per_vehicle_check
  CHECK (part_quantity_per_vehicle IS NULL OR part_quantity_per_vehicle >= 1);
