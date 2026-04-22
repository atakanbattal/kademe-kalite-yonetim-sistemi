-- DF/8D kaydı (non_conformities) silindiğinde uygunsuzluk yönetimi kaydını tekrar "Açık" yap ve bağlantıyı kaldır.

CREATE OR REPLACE FUNCTION public.reset_nonconformity_record_on_nc_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.nonconformity_records
  SET
    source_nc_id = NULL,
    status = CASE
      WHEN status IN ('DF Açıldı', '8D Açıldı') THEN 'Açık'::character varying
      ELSE status
    END
  WHERE source_nc_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_reset_nonconformity_record_on_nc_delete ON public.non_conformities;

CREATE TRIGGER tr_reset_nonconformity_record_on_nc_delete
  AFTER DELETE ON public.non_conformities
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_nonconformity_record_on_nc_delete();

COMMENT ON FUNCTION public.reset_nonconformity_record_on_nc_delete() IS 'non_conformities silinince nonconformity_records.source_nc_id temizlenir ve DF/8D Açıldı -> Açık yapılır.';

-- Mevcut yetim bağlantıları düzelt (silinmiş DF/8D id''leri)
UPDATE public.nonconformity_records nr
SET
  source_nc_id = NULL,
  status = CASE
    WHEN nr.status IN ('DF Açıldı', '8D Açıldı') THEN 'Açık'::character varying
    ELSE nr.status
  END
WHERE nr.source_nc_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.non_conformities nc WHERE nc.id = nr.source_nc_id
  );
