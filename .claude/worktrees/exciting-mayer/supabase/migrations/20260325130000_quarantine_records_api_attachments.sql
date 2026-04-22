-- API görünümüne ekler (liste/detayda attachments)
DROP VIEW IF EXISTS public.quarantine_records_api;

CREATE VIEW public.quarantine_records_api AS
SELECT
  qr.id,
  qr.lot_no,
  qr.part_code,
  qr.part_name,
  qr.quantity,
  qr.initial_quantity,
  qr.unit,
  qr.description,
  qr.quarantine_date,
  qr.status,
  qr.decision,
  qr.decision_date,
  qr.deviation_approval_url,
  qr.created_at,
  qr.updated_at,
  qr.user_id,
  qr.requesting_person_name,
  qr.source_department,
  qr.requesting_department,
  qr.supplier_id,
  qr.attachments,
  s.name AS supplier_name,
  nc.id AS non_conformity_id,
  nc.nc_number,
  nc.type AS non_conformity_type
FROM public.quarantine_records qr
LEFT JOIN public.suppliers s ON s.id = qr.supplier_id
LEFT JOIN public.non_conformities nc ON qr.id = nc.source_quarantine_id;
