-- Ortalama Tedarikçi Skoru: supplier_scores yerine tamamlanan tedarikçi denetimlerinin (supplier_audit_plans) puanları
-- supplier_scores tablosu kullanılmıyorsa KPI sürekli 0 kalıyordu.

CREATE OR REPLACE FUNCTION public.get_avg_supplier_score()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(AVG(sap.score)::numeric, 2),
    0
  )
  FROM supplier_audit_plans sap
  INNER JOIN suppliers s ON s.id = sap.supplier_id AND s.status = 'Onaylı'
  WHERE sap.status = 'Tamamlandı'
    AND sap.score IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_avg_supplier_score() IS
  'Onaylı tedarikçiler için tamamlanan denetim planlarının (supplier_audit_plans) ortalama denetim skoru.';
