-- Sızdırmazlık: kaynak tedarikçide yapılabilir; tedarikçi seçimi ve anlık ad
ALTER TABLE public.leak_test_records
    ADD COLUMN IF NOT EXISTS welding_at_supplier boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supplier_name text;

COMMENT ON COLUMN public.leak_test_records.welding_at_supplier IS 'true ise kaynak tedarikçide yapılmıştır; supplier_id zorunlu, dahili kaynakçı opsiyonel';
COMMENT ON COLUMN public.leak_test_records.supplier_id IS 'Kaynağı yapan tedarikçi';
COMMENT ON COLUMN public.leak_test_records.supplier_name IS 'Kayıt anındaki tedarikçi görünen adı';

-- Dahili kaynak: eski kayıtlar için welded_by_name dolu kalmalı
ALTER TABLE public.leak_test_records
    ALTER COLUMN welded_by_name DROP NOT NULL;

ALTER TABLE public.leak_test_records
    DROP CONSTRAINT IF EXISTS leak_test_records_welder_or_supplier_ck;

ALTER TABLE public.leak_test_records
    ADD CONSTRAINT leak_test_records_welder_or_supplier_ck CHECK (
        (
            COALESCE(welding_at_supplier, false) = false
            AND welded_by_name IS NOT NULL
            AND length(trim(welded_by_name)) > 0
        )
        OR
        (
            COALESCE(welding_at_supplier, false) = true
            AND supplier_id IS NOT NULL
            AND supplier_name IS NOT NULL
            AND length(trim(supplier_name)) > 0
        )
    );

CREATE INDEX IF NOT EXISTS idx_leak_test_records_supplier_id
    ON public.leak_test_records(supplier_id);

CREATE INDEX IF NOT EXISTS idx_leak_test_records_welding_at_supplier
    ON public.leak_test_records(welding_at_supplier)
    WHERE welding_at_supplier = true;
