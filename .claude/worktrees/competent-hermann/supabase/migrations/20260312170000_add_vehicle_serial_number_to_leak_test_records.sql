ALTER TABLE public.leak_test_records
ADD COLUMN IF NOT EXISTS vehicle_serial_number TEXT;

COMMENT ON COLUMN public.leak_test_records.vehicle_serial_number IS 'Teste giren arac veya urun seri numarasi';

CREATE INDEX IF NOT EXISTS idx_leak_test_records_vehicle_serial_number
    ON public.leak_test_records(vehicle_serial_number);
