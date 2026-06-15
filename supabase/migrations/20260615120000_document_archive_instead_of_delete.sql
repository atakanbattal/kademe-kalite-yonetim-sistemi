-- İç kaynaklı dokümanlarda silme yerine arşiv/iptal: numara kayması önlenir.
-- after_delete_document_resequence trigger'ı silinen kayıtların ardından tüm numaraları kaydırıyordu.

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS archive_reason TEXT;

COMMENT ON COLUMN public.documents.archive_reason IS 'Manuel iptal veya arşiv gerekçesi';

-- Silme sonrası numara yeniden sıralama — doküman numaralarının kaymasına neden oluyordu
DROP TRIGGER IF EXISTS after_delete_document_resequence ON public.documents;

CREATE OR REPLACE FUNCTION public.archive_internal_document(
    p_document_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_archived_by UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'İptal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.documents
    SET
        is_archived = true,
        is_active = false,
        archived_at = NOW(),
        archived_by = p_archived_by,
        status = COALESCE(NULLIF(TRIM(p_status), ''), 'İptal'),
        archive_reason = NULLIF(TRIM(p_reason), ''),
        updated_at = NOW()
    WHERE id = p_document_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doküman bulunamadı: %', p_document_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_internal_document(
    p_document_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.documents
    SET
        is_archived = false,
        is_active = true,
        archived_at = NULL,
        archived_by = NULL,
        archive_reason = NULL,
        status = 'Yayınlandı',
        updated_at = NOW()
    WHERE id = p_document_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doküman bulunamadı: %', p_document_id;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.archive_internal_document IS 'İç dokümanı silerken numara kaybını önlemek için arşive alır / iptal eder';
COMMENT ON FUNCTION public.restore_internal_document IS 'Arşivlenmiş iç dokümanı tekrar aktif listeye alır';
