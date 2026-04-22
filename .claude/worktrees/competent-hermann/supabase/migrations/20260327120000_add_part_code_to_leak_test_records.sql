ALTER TABLE public.leak_test_records
    ADD COLUMN IF NOT EXISTS part_code TEXT;

COMMENT ON COLUMN public.leak_test_records.part_code IS
    'Ürün parça kodu; uygunsuzluk yönetiminde nonconformity_records.part_code alanına aktarılır.';

CREATE INDEX IF NOT EXISTS idx_leak_test_records_part_code
    ON public.leak_test_records (part_code)
    WHERE part_code IS NOT NULL AND btrim(part_code) <> '';
