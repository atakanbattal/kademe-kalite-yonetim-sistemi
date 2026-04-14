-- Tedarikçi Uygunsuzluk Oranı KPI: girdi kalite (incoming_inspections) ile hizala — get_incoming_rejection_rate ile aynı hesap
CREATE OR REPLACE FUNCTION public.get_supplier_nc_rate()
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT get_incoming_rejection_rate();
$$;
