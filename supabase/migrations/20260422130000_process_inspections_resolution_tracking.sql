-- Ret kararı verilmiş proses muayene kayıtlarının çözüm (resolution) takibi için kolonlar
ALTER TABLE public.process_inspections
    ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(60),
    ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
    ADD COLUMN IF NOT EXISTS resolution_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_by_personnel_id UUID,
    ADD COLUMN IF NOT EXISTS resolved_by_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_by UUID;

COMMENT ON COLUMN public.process_inspections.resolution_status IS 'Açık / Çözümleniyor / Çözüldü - sadece Ret kayıtları için anlamlıdır';
COMMENT ON COLUMN public.process_inspections.resolution_type IS 'Yeniden İşleme, Değiştirme, Sapma ile Kabul, Hurda, Tedarikçiye İade, Diğer';
COMMENT ON COLUMN public.process_inspections.resolution_notes IS 'Çözüm açıklaması, yapılan aksiyon detayları';

CREATE INDEX IF NOT EXISTS idx_process_inspections_resolution_status
    ON public.process_inspections (resolution_status);

-- Çözüm geçmişi / audit tablosu (her çözüm aksiyonu bir kayıt)
CREATE TABLE IF NOT EXISTS public.process_inspection_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID NOT NULL REFERENCES public.process_inspections(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL DEFAULT 'update',
    resolution_status VARCHAR(30),
    resolution_type VARCHAR(60),
    resolution_notes TEXT,
    actioned_by_personnel_id UUID,
    actioned_by_name VARCHAR(200),
    actioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_process_inspection_resolutions_inspection_id
    ON public.process_inspection_resolutions (inspection_id);

CREATE INDEX IF NOT EXISTS idx_process_inspection_resolutions_actioned_at
    ON public.process_inspection_resolutions (actioned_at DESC);

ALTER TABLE public.process_inspection_resolutions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'process_inspection_resolutions'
          AND policyname = 'process_inspection_resolutions_select'
    ) THEN
        CREATE POLICY process_inspection_resolutions_select
            ON public.process_inspection_resolutions FOR SELECT
            USING (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'process_inspection_resolutions'
          AND policyname = 'process_inspection_resolutions_insert'
    ) THEN
        CREATE POLICY process_inspection_resolutions_insert
            ON public.process_inspection_resolutions FOR INSERT
            WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'process_inspection_resolutions'
          AND policyname = 'process_inspection_resolutions_update'
    ) THEN
        CREATE POLICY process_inspection_resolutions_update
            ON public.process_inspection_resolutions FOR UPDATE
            USING (auth.uid() IS NOT NULL)
            WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'process_inspection_resolutions'
          AND policyname = 'process_inspection_resolutions_delete'
    ) THEN
        CREATE POLICY process_inspection_resolutions_delete
            ON public.process_inspection_resolutions FOR DELETE
            USING (auth.uid() IS NOT NULL);
    END IF;
END $$;
