-- Demo/seed girdi kalite kayıtları yanlış organization_id ile oluşturulmuştu;
-- RLS (organization_id = get_user_org_id()) ana org kullanıcılarının silmesini engelliyordu.
-- Idempotent: kalmadıysa 0 satır siler.

DELETE FROM public.incoming_inspections
WHERE organization_id = 'a0000000-0000-0000-0000-000000000002'::uuid;
