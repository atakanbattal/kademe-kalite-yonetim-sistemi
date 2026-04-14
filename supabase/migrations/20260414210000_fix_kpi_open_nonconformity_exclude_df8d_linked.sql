-- KPI: "Açık Uygunsuzluk Sayısı" — DF/8D'ye bağlanmış (DF Açıldı / 8D Açıldı + source_nc_id) kayıtlar
-- modülde "Dönüştürülen" sayılır ve aktif iş listesinde yok; eski RPC bunları da açık sayıyordu.

CREATE OR REPLACE FUNCTION get_open_nonconformity_count()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::numeric
  FROM nonconformity_records
  WHERE status != 'Kapatıldı'
    AND NOT (
      status IN ('DF Açıldı', '8D Açıldı')
      AND source_nc_id IS NOT NULL
    );
$$;

COMMENT ON FUNCTION get_open_nonconformity_count() IS
  'Uygunsuzluk modülü ile uyumlu: Kapatıldı değil ve DF/8D''ye fiilen bağlanmış kayıtlar açık sayılmaz.';

CREATE OR REPLACE FUNCTION get_critical_nonconformity_count()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::numeric
  FROM nonconformity_records
  WHERE severity = 'Kritik'
    AND status != 'Kapatıldı'
    AND NOT (
      status IN ('DF Açıldı', '8D Açıldı')
      AND source_nc_id IS NOT NULL
    );
$$;
