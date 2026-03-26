-- Sicil listesinde garanti durumu ve bitiş tarihi için alanlar (vaka kayıtlarıyla uyumlu terimler).
ALTER TABLE public.after_sales_vehicle_registry
    ADD COLUMN IF NOT EXISTS warranty_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
    ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

COMMENT ON COLUMN public.after_sales_vehicle_registry.warranty_status IS 'Garanti içinde / dışı / iyi niyet / belirsiz.';
COMMENT ON COLUMN public.after_sales_vehicle_registry.warranty_start_date IS 'Garanti başlangıç tarihi.';
COMMENT ON COLUMN public.after_sales_vehicle_registry.warranty_end_date IS 'Garanti bitiş tarihi.';
