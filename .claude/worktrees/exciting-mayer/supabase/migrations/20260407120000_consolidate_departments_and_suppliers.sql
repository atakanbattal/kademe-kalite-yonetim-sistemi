-- Birim isimleri ve tedarikçi birleştirme (raporlarda tekilleştirme)
-- Kalite Güvence + Kalite Kontrol -> Kalite Müdürlüğü (FK: Kalite Kontrol id)
-- Lojistik -> Depo -> Depo Şefliği (FK: Depo id)
-- Genel Müdürlük -> Kademe Genel Müdürlüğü
-- İnsan Kaynakları -> İnsan Kaynakları Müdürlüğü
-- Uzçelik mükerrer tedarikçi -> tek kayıt

BEGIN;

CREATE TEMP TABLE _cs_merge (old_id uuid PRIMARY KEY, new_id uuid NOT NULL);
INSERT INTO _cs_merge (old_id, new_id) VALUES
  ('526a2846-2a9a-4ede-a960-eac99b89679d', '71a5bccd-c764-45c5-9802-73199e3923a1'),
  ('79fbea37-d218-4b45-98b8-fcf0819efe1f', '2ccad30e-be6a-47ae-9ba5-04364391dc6d');

UPDATE public.cost_settings c
SET
  cost_per_minute = GREATEST(c.cost_per_minute, s.mx),
  updated_at = now()
FROM (
  SELECT m.new_id AS nid, MAX(o.cost_per_minute) AS mx
  FROM _cs_merge m
  JOIN public.cost_settings o ON o.id = m.old_id
  GROUP BY m.new_id
) s
WHERE c.id = s.nid;

UPDATE public.audit_question_bank q SET department_id = m.new_id FROM _cs_merge m WHERE q.department_id = m.old_id;
UPDATE public.audits a SET department_id = m.new_id FROM _cs_merge m WHERE a.department_id = m.old_id;
UPDATE public.documents d SET department_id = m.new_id FROM _cs_merge m WHERE d.department_id = m.old_id;
UPDATE public.personnel p SET unit_id = m.new_id, updated_at = now() FROM _cs_merge m WHERE p.unit_id = m.old_id;
UPDATE public.kaizen_entries k SET department_id = m.new_id FROM _cs_merge m WHERE k.department_id = m.old_id;
UPDATE public.customer_complaints cc SET assigned_department_id = m.new_id FROM _cs_merge m WHERE cc.assigned_department_id = m.old_id;
UPDATE public.customer_complaints cc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE cc.responsible_department_id = m.old_id;
UPDATE public.org_chart_revisions ocr SET unit_id = m.new_id FROM _cs_merge m WHERE ocr.unit_id = m.old_id;
UPDATE public.complaint_actions ca SET responsible_department_id = m.new_id FROM _cs_merge m WHERE ca.responsible_department_id = m.old_id;
UPDATE public.benchmarks b SET department_id = m.new_id FROM _cs_merge m WHERE b.department_id = m.old_id;
UPDATE public.spc_characteristics sc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE sc.responsible_department_id = m.old_id;
UPDATE public.apqp_projects ap SET responsible_department_id = m.new_id FROM _cs_merge m WHERE ap.responsible_department_id = m.old_id;
UPDATE public.fmea_projects fp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE fp.responsible_department_id = m.old_id;
UPDATE public.fmea_action_plans fap SET responsible_department_id = m.new_id FROM _cs_merge m WHERE fap.responsible_department_id = m.old_id;
UPDATE public.critical_characteristics cc SET responsible_department_id = m.new_id FROM _cs_merge m WHERE cc.responsible_department_id = m.old_id;
UPDATE public.validation_plans vp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE vp.responsible_department_id = m.old_id;
UPDATE public.supplier_development_plans sdp SET responsible_department_id = m.new_id FROM _cs_merge m WHERE sdp.responsible_department_id = m.old_id;
UPDATE public.document_folders df SET department_id = m.new_id FROM _cs_merge m WHERE df.department_id = m.old_id;
UPDATE public.quality_inspection_faults qif SET department_id = m.new_id FROM _cs_merge m WHERE qif.department_id = m.old_id;
UPDATE public.fault_categories fc SET department_id = m.new_id FROM _cs_merge m WHERE fc.department_id = m.old_id;

DELETE FROM public.cost_settings c USING _cs_merge m WHERE c.id = m.old_id;

UPDATE public.cost_settings SET unit_name = 'Kalite Müdürlüğü', updated_at = now()
WHERE id = '71a5bccd-c764-45c5-9802-73199e3923a1';

UPDATE public.cost_settings SET unit_name = 'Depo Şefliği', updated_at = now()
WHERE id = '2ccad30e-be6a-47ae-9ba5-04364391dc6d';

UPDATE public.cost_settings SET unit_name = 'Kademe Genel Müdürlüğü', updated_at = now()
WHERE id = '6108bea4-4e56-4f36-aee8-f41cda4336ae';

UPDATE public.cost_settings SET unit_name = 'İnsan Kaynakları Müdürlüğü', updated_at = now()
WHERE id = '7dd3e06e-3904-4842-b86a-05cf1decd7c4';

UPDATE public.personnel p
SET department = cs.unit_name, updated_at = now()
FROM public.cost_settings cs
WHERE p.unit_id = cs.id
  AND cs.id IN (
    '71a5bccd-c764-45c5-9802-73199e3923a1',
    '2ccad30e-be6a-47ae-9ba5-04364391dc6d',
    '6108bea4-4e56-4f36-aee8-f41cda4336ae',
    '7dd3e06e-3904-4842-b86a-05cf1decd7c4'
  );

UPDATE public.non_conformities SET requesting_unit = 'Kalite Müdürlüğü' WHERE requesting_unit = 'Kalite Kontrol Ve Güvence';
UPDATE public.non_conformities SET requesting_unit = 'Kademe Genel Müdürlüğü' WHERE requesting_unit = 'Genel Müdürlük';
UPDATE public.non_conformities SET department = 'Depo Şefliği' WHERE department = 'Depo';
UPDATE public.non_conformities SET department = 'Depo Şefliği'
WHERE department IS NOT NULL AND normalize(department, NFC) = normalize('Depo Şefliği', NFC) AND department IS DISTINCT FROM 'Depo Şefliği';
UPDATE public.non_conformities SET department = 'Kalite Müdürlüğü' WHERE department IN ('Kalite Kontrol', 'Kalite Güvence');
UPDATE public.non_conformities SET department = 'İnsan Kaynakları Müdürlüğü' WHERE department = 'İnsan Kaynakları';
UPDATE public.non_conformities SET forwarded_unit = 'Kalite Müdürlüğü' WHERE forwarded_unit = 'Kalite Kontrol Ve Güvence';
UPDATE public.non_conformities SET forwarded_unit = 'Kademe Genel Müdürlüğü' WHERE forwarded_unit = 'Genel Müdürlük';

UPDATE public.incoming_inspections SET supplier_id = 'a30021fa-363c-4f2f-b734-16ea2e983021'
WHERE supplier_id = '3856dd27-0fa5-461e-a8be-fea7286f46d2';

UPDATE public.non_conformities SET supplier_id = 'a30021fa-363c-4f2f-b734-16ea2e983021'
WHERE supplier_id = '3856dd27-0fa5-461e-a8be-fea7286f46d2';

UPDATE public.inkr_reports SET supplier_id = 'a30021fa-363c-4f2f-b734-16ea2e983021'
WHERE supplier_id = '3856dd27-0fa5-461e-a8be-fea7286f46d2';

UPDATE public.supplier_non_conformities SET supplier_id = 'a30021fa-363c-4f2f-b734-16ea2e983021'
WHERE supplier_id = '3856dd27-0fa5-461e-a8be-fea7286f46d2';

UPDATE public.suppliers SET name = 'Uzçelik Makine Ltd. Şti.', updated_at = now()
WHERE id = 'a30021fa-363c-4f2f-b734-16ea2e983021';

DELETE FROM public.suppliers WHERE id = '3856dd27-0fa5-461e-a8be-fea7286f46d2';

UPDATE public.incoming_inspections SET decision = 'Ret' WHERE decision = 'Red';

COMMIT;
