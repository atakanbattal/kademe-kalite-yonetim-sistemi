-- Plaka bilgisi araç sicil kaydında tutulur (Sicil ve Dosya formu ile uyumlu).
ALTER TABLE public.after_sales_vehicle_registry
    ADD COLUMN IF NOT EXISTS vehicle_plate_number VARCHAR(50);

COMMENT ON COLUMN public.after_sales_vehicle_registry.vehicle_plate_number IS 'Araç plaka numarası.';
