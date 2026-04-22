-- ============================================================================
-- MEVCUT VERİLERİ CAMELCASE FORMATINA MİGRATE ETME
-- ============================================================================
-- Bu script, veritabanındaki mevcut tüm verileri camelCase formatına çevirir
-- Trigger'lar yeni veriler için otomatik çalışacak, bu script mevcut verileri günceller
-- ============================================================================

-- Non Conformities tablosu
UPDATE non_conformities
SET 
    title = CASE WHEN title IS NOT NULL AND title != '' THEN format_to_camelcase(title) ELSE title END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    part_name = CASE WHEN part_name IS NOT NULL AND part_name != '' THEN format_to_camelcase(part_name) ELSE part_name END,
    part_code = CASE WHEN part_code IS NOT NULL AND part_code != '' THEN format_to_camelcase(part_code) ELSE part_code END,
    measurement_unit = CASE WHEN measurement_unit IS NOT NULL AND measurement_unit != '' THEN format_to_camelcase(measurement_unit) ELSE measurement_unit END,
    part_location = CASE WHEN part_location IS NOT NULL AND part_location != '' THEN format_to_camelcase(part_location) ELSE part_location END,
    rejection_reason = CASE WHEN rejection_reason IS NOT NULL AND rejection_reason != '' THEN format_to_camelcase(rejection_reason) ELSE rejection_reason END,
    requesting_person = CASE WHEN requesting_person IS NOT NULL AND requesting_person != '' THEN format_to_camelcase(requesting_person) ELSE requesting_person END,
    requesting_unit = CASE WHEN requesting_unit IS NOT NULL AND requesting_unit != '' THEN format_to_camelcase(requesting_unit) ELSE requesting_unit END,
    responsible_person = CASE WHEN responsible_person IS NOT NULL AND responsible_person != '' THEN format_to_camelcase(responsible_person) ELSE responsible_person END,
    department = CASE WHEN department IS NOT NULL AND department != '' THEN format_to_camelcase(department) ELSE department END,
    category = CASE WHEN category IS NOT NULL AND category != '' THEN format_to_camelcase(category) ELSE category END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    priority = CASE WHEN priority IS NOT NULL AND priority != '' THEN format_to_camelcase(priority) ELSE priority END,
    problem_definition = CASE WHEN problem_definition IS NOT NULL AND problem_definition != '' THEN format_to_camelcase(problem_definition) ELSE problem_definition END,
    rejection_notes = CASE WHEN rejection_notes IS NOT NULL AND rejection_notes != '' THEN format_to_camelcase(rejection_notes) ELSE rejection_notes END,
    closing_notes = CASE WHEN closing_notes IS NOT NULL AND closing_notes != '' THEN format_to_camelcase(closing_notes) ELSE closing_notes END,
    vehicle_type = CASE WHEN vehicle_type IS NOT NULL AND vehicle_type != '' THEN format_to_camelcase(vehicle_type) ELSE vehicle_type END,
    cost_type = CASE WHEN cost_type IS NOT NULL AND cost_type != '' THEN format_to_camelcase(cost_type) ELSE cost_type END,
    material_type = CASE WHEN material_type IS NOT NULL AND material_type != '' THEN format_to_camelcase(material_type) ELSE material_type END,
    forwarded_to = CASE WHEN forwarded_to IS NOT NULL AND forwarded_to != '' THEN format_to_camelcase(forwarded_to) ELSE forwarded_to END,
    forwarded_unit = CASE WHEN forwarded_unit IS NOT NULL AND forwarded_unit != '' THEN format_to_camelcase(forwarded_unit) ELSE forwarded_unit END
WHERE 
    (title IS NOT NULL AND title != '') OR 
    (description IS NOT NULL AND description != '') OR 
    (part_name IS NOT NULL AND part_name != '') OR 
    (part_code IS NOT NULL AND part_code != '') OR
    (measurement_unit IS NOT NULL AND measurement_unit != '') OR 
    (part_location IS NOT NULL AND part_location != '') OR 
    (rejection_reason IS NOT NULL AND rejection_reason != '') OR
    (requesting_person IS NOT NULL AND requesting_person != '') OR
    (requesting_unit IS NOT NULL AND requesting_unit != '') OR
    (responsible_person IS NOT NULL AND responsible_person != '') OR
    (department IS NOT NULL AND department != '') OR
    (category IS NOT NULL AND category != '') OR
    (status IS NOT NULL AND status != '') OR
    (priority IS NOT NULL AND priority != '') OR
    (problem_definition IS NOT NULL AND problem_definition != '') OR
    (rejection_notes IS NOT NULL AND rejection_notes != '') OR
    (closing_notes IS NOT NULL AND closing_notes != '') OR
    (vehicle_type IS NOT NULL AND vehicle_type != '') OR
    (cost_type IS NOT NULL AND cost_type != '') OR
    (material_type IS NOT NULL AND material_type != '') OR
    (forwarded_to IS NOT NULL AND forwarded_to != '') OR
    (forwarded_unit IS NOT NULL AND forwarded_unit != '');

-- Equipment tablosu
UPDATE equipments
SET 
    name = CASE WHEN name IS NOT NULL AND name != '' THEN format_to_camelcase(name) ELSE name END,
    brand_model = CASE WHEN brand_model IS NOT NULL AND brand_model != '' THEN format_to_camelcase(brand_model) ELSE brand_model END,
    responsible_unit = CASE WHEN responsible_unit IS NOT NULL AND responsible_unit != '' THEN format_to_camelcase(responsible_unit) ELSE responsible_unit END,
    location = CASE WHEN location IS NOT NULL AND location != '' THEN format_to_camelcase(location) ELSE location END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    category = CASE WHEN category IS NOT NULL AND category != '' THEN format_to_camelcase(category) ELSE category END,
    criticality = CASE WHEN criticality IS NOT NULL AND criticality != '' THEN format_to_camelcase(criticality) ELSE criticality END,
    scrap_reason = CASE WHEN scrap_reason IS NOT NULL AND scrap_reason != '' THEN format_to_camelcase(scrap_reason) ELSE scrap_reason END
WHERE 
    (name IS NOT NULL AND name != '') OR 
    (brand_model IS NOT NULL AND brand_model != '') OR 
    (responsible_unit IS NOT NULL AND responsible_unit != '') OR 
    (location IS NOT NULL AND location != '') OR 
    (description IS NOT NULL AND description != '') OR
    (status IS NOT NULL AND status != '') OR
    (category IS NOT NULL AND category != '') OR
    (criticality IS NOT NULL AND criticality != '') OR
    (scrap_reason IS NOT NULL AND scrap_reason != '');

-- Personnel tablosu
UPDATE personnel
SET 
    full_name = CASE WHEN full_name IS NOT NULL AND full_name != '' THEN format_to_camelcase(full_name) ELSE full_name END,
    department = CASE WHEN department IS NOT NULL AND department != '' THEN format_to_camelcase(department) ELSE department END,
    job_title = CASE WHEN job_title IS NOT NULL AND job_title != '' THEN format_to_camelcase(job_title) ELSE job_title END
WHERE 
    (full_name IS NOT NULL AND full_name != '') OR 
    (department IS NOT NULL AND department != '') OR 
    (job_title IS NOT NULL AND job_title != '');

-- Suppliers tablosu
UPDATE suppliers
SET 
    name = CASE WHEN name IS NOT NULL AND name != '' THEN format_to_camelcase(name) ELSE name END,
    product_group = CASE WHEN product_group IS NOT NULL AND product_group != '' THEN format_to_camelcase(product_group) ELSE product_group END,
    risk_class = CASE WHEN risk_class IS NOT NULL AND risk_class != '' THEN format_to_camelcase(risk_class) ELSE risk_class END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END
WHERE 
    (name IS NOT NULL AND name != '') OR
    (product_group IS NOT NULL AND product_group != '') OR
    (risk_class IS NOT NULL AND risk_class != '') OR
    (status IS NOT NULL AND status != '');

-- Quarantine Records tablosu
UPDATE quarantine_records
SET 
    part_name = CASE WHEN part_name IS NOT NULL AND part_name != '' THEN format_to_camelcase(part_name) ELSE part_name END,
    part_code = CASE WHEN part_code IS NOT NULL AND part_code != '' THEN format_to_camelcase(part_code) ELSE part_code END,
    lot_no = CASE WHEN lot_no IS NOT NULL AND lot_no != '' THEN format_to_camelcase(lot_no) ELSE lot_no END,
    unit = CASE WHEN unit IS NOT NULL AND unit != '' THEN format_to_camelcase(unit) ELSE unit END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    decision = CASE WHEN decision IS NOT NULL AND decision != '' THEN format_to_camelcase(decision) ELSE decision END,
    requesting_person_name = CASE WHEN requesting_person_name IS NOT NULL AND requesting_person_name != '' THEN format_to_camelcase(requesting_person_name) ELSE requesting_person_name END,
    source_department = CASE WHEN source_department IS NOT NULL AND source_department != '' THEN format_to_camelcase(source_department) ELSE source_department END,
    requesting_department = CASE WHEN requesting_department IS NOT NULL AND requesting_department != '' THEN format_to_camelcase(requesting_department) ELSE requesting_department END
WHERE 
    (part_name IS NOT NULL AND part_name != '') OR 
    (part_code IS NOT NULL AND part_code != '') OR 
    (lot_no IS NOT NULL AND lot_no != '') OR 
    (unit IS NOT NULL AND unit != '') OR
    (description IS NOT NULL AND description != '') OR
    (status IS NOT NULL AND status != '') OR
    (decision IS NOT NULL AND decision != '') OR
    (requesting_person_name IS NOT NULL AND requesting_person_name != '') OR
    (source_department IS NOT NULL AND source_department != '') OR
    (requesting_department IS NOT NULL AND requesting_department != '');

-- Customer Complaints tablosu
UPDATE customer_complaints
SET 
    title = CASE WHEN title IS NOT NULL AND title != '' THEN format_to_camelcase(title) ELSE title END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    product_name = CASE WHEN product_name IS NOT NULL AND product_name != '' THEN format_to_camelcase(product_name) ELSE product_name END,
    product_code = CASE WHEN product_code IS NOT NULL AND product_code != '' THEN format_to_camelcase(product_code) ELSE product_code END,
    batch_number = CASE WHEN batch_number IS NOT NULL AND batch_number != '' THEN format_to_camelcase(batch_number) ELSE batch_number END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    priority = CASE WHEN priority IS NOT NULL AND priority != '' THEN format_to_camelcase(priority) ELSE priority END,
    severity = CASE WHEN severity IS NOT NULL AND severity != '' THEN format_to_camelcase(severity) ELSE severity END,
    complaint_category = CASE WHEN complaint_category IS NOT NULL AND complaint_category != '' THEN format_to_camelcase(complaint_category) ELSE complaint_category END,
    complaint_source = CASE WHEN complaint_source IS NOT NULL AND complaint_source != '' THEN format_to_camelcase(complaint_source) ELSE complaint_source END,
    customer_impact = CASE WHEN customer_impact IS NOT NULL AND customer_impact != '' THEN format_to_camelcase(customer_impact) ELSE customer_impact END
WHERE 
    (title IS NOT NULL AND title != '') OR 
    (description IS NOT NULL AND description != '') OR 
    (product_name IS NOT NULL AND product_name != '') OR 
    (product_code IS NOT NULL AND product_code != '') OR 
    (batch_number IS NOT NULL AND batch_number != '') OR
    (status IS NOT NULL AND status != '') OR
    (priority IS NOT NULL AND priority != '') OR
    (severity IS NOT NULL AND severity != '') OR
    (complaint_category IS NOT NULL AND complaint_category != '') OR
    (complaint_source IS NOT NULL AND complaint_source != '') OR
    (customer_impact IS NOT NULL AND customer_impact != '');

-- Kaizen tablosu
UPDATE kaizen_entries
SET 
    title = CASE WHEN title IS NOT NULL AND title != '' THEN format_to_camelcase(title) ELSE title END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    problem_description = CASE WHEN problem_description IS NOT NULL AND problem_description != '' THEN format_to_camelcase(problem_description) ELSE problem_description END,
    solution_description = CASE WHEN solution_description IS NOT NULL AND solution_description != '' THEN format_to_camelcase(solution_description) ELSE solution_description END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    priority = CASE WHEN priority IS NOT NULL AND priority != '' THEN format_to_camelcase(priority) ELSE priority END,
    vehicle_type = CASE WHEN vehicle_type IS NOT NULL AND vehicle_type != '' THEN format_to_camelcase(vehicle_type) ELSE vehicle_type END,
    affected_area = CASE WHEN affected_area IS NOT NULL AND affected_area != '' THEN format_to_camelcase(affected_area) ELSE affected_area END,
    fault_type = CASE WHEN fault_type IS NOT NULL AND fault_type != '' THEN format_to_camelcase(fault_type) ELSE fault_type END,
    state_before = CASE WHEN state_before IS NOT NULL AND state_before != '' THEN format_to_camelcase(state_before) ELSE state_before END,
    state_after = CASE WHEN state_after IS NOT NULL AND state_after != '' THEN format_to_camelcase(state_after) ELSE state_after END,
    quality_level_before = CASE WHEN quality_level_before IS NOT NULL AND quality_level_before != '' THEN format_to_camelcase(quality_level_before) ELSE quality_level_before END,
    quality_level_after = CASE WHEN quality_level_after IS NOT NULL AND quality_level_after != '' THEN format_to_camelcase(quality_level_after) ELSE quality_level_after END,
    standardization_info = CASE WHEN standardization_info IS NOT NULL AND standardization_info != '' THEN format_to_camelcase(standardization_info) ELSE standardization_info END
WHERE 
    (title IS NOT NULL AND title != '') OR 
    (description IS NOT NULL AND description != '') OR
    (problem_description IS NOT NULL AND problem_description != '') OR
    (solution_description IS NOT NULL AND solution_description != '') OR
    (status IS NOT NULL AND status != '') OR
    (priority IS NOT NULL AND priority != '') OR
    (vehicle_type IS NOT NULL AND vehicle_type != '') OR
    (affected_area IS NOT NULL AND affected_area != '') OR
    (fault_type IS NOT NULL AND fault_type != '') OR
    (state_before IS NOT NULL AND state_before != '') OR
    (state_after IS NOT NULL AND state_after != '') OR
    (quality_level_before IS NOT NULL AND quality_level_before != '') OR
    (quality_level_after IS NOT NULL AND quality_level_after != '') OR
    (standardization_info IS NOT NULL AND standardization_info != '');

-- Deviation tablosu
UPDATE deviations
SET 
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    source = CASE WHEN source IS NOT NULL AND source != '' THEN format_to_camelcase(source) ELSE source END,
    requesting_unit = CASE WHEN requesting_unit IS NOT NULL AND requesting_unit != '' THEN format_to_camelcase(requesting_unit) ELSE requesting_unit END,
    requesting_person = CASE WHEN requesting_person IS NOT NULL AND requesting_person != '' THEN format_to_camelcase(requesting_person) ELSE requesting_person END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    vehicle_type = CASE WHEN vehicle_type IS NOT NULL AND vehicle_type != '' THEN format_to_camelcase(vehicle_type) ELSE vehicle_type END,
    part_code = CASE WHEN part_code IS NOT NULL AND part_code != '' THEN format_to_camelcase(part_code) ELSE part_code END,
    deviation_type = CASE WHEN deviation_type IS NOT NULL AND deviation_type != '' THEN format_to_camelcase(deviation_type) ELSE deviation_type END,
    source_type = CASE WHEN source_type IS NOT NULL AND source_type != '' THEN format_to_camelcase(source_type) ELSE source_type END
WHERE 
    (description IS NOT NULL AND description != '') OR
    (source IS NOT NULL AND source != '') OR
    (requesting_unit IS NOT NULL AND requesting_unit != '') OR
    (requesting_person IS NOT NULL AND requesting_person != '') OR
    (status IS NOT NULL AND status != '') OR
    (vehicle_type IS NOT NULL AND vehicle_type != '') OR
    (part_code IS NOT NULL AND part_code != '') OR
    (deviation_type IS NOT NULL AND deviation_type != '') OR
    (source_type IS NOT NULL AND source_type != '');

-- Incoming Inspections tablosu
UPDATE incoming_inspections
SET 
    part_name = CASE WHEN part_name IS NOT NULL AND part_name != '' THEN format_to_camelcase(part_name) ELSE part_name END,
    part_code = CASE WHEN part_code IS NOT NULL AND part_code != '' THEN format_to_camelcase(part_code) ELSE part_code END,
    delivery_note_number = CASE WHEN delivery_note_number IS NOT NULL AND delivery_note_number != '' THEN format_to_camelcase(delivery_note_number) ELSE delivery_note_number END,
    unit = CASE WHEN unit IS NOT NULL AND unit != '' THEN format_to_camelcase(unit) ELSE unit END,
    decision = CASE WHEN decision IS NOT NULL AND decision != '' THEN format_to_camelcase(decision) ELSE decision END,
    control_plan_status = CASE WHEN control_plan_status IS NOT NULL AND control_plan_status != '' THEN format_to_camelcase(control_plan_status) ELSE control_plan_status END,
    inkr_status = CASE WHEN inkr_status IS NOT NULL AND inkr_status != '' THEN format_to_camelcase(inkr_status) ELSE inkr_status END,
    notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN format_to_camelcase(notes) ELSE notes END
WHERE 
    (part_name IS NOT NULL AND part_name != '') OR 
    (part_code IS NOT NULL AND part_code != '') OR 
    (delivery_note_number IS NOT NULL AND delivery_note_number != '') OR
    (unit IS NOT NULL AND unit != '') OR
    (decision IS NOT NULL AND decision != '') OR
    (control_plan_status IS NOT NULL AND control_plan_status != '') OR
    (inkr_status IS NOT NULL AND inkr_status != '') OR
    (notes IS NOT NULL AND notes != '');

-- Documents tablosu
UPDATE documents
SET 
    title = CASE WHEN title IS NOT NULL AND title != '' THEN format_to_camelcase(title) ELSE title END,
    description = CASE WHEN description IS NOT NULL AND description != '' THEN format_to_camelcase(description) ELSE description END,
    document_type = CASE WHEN document_type IS NOT NULL AND document_type != '' THEN format_to_camelcase(document_type) ELSE document_type END,
    department = CASE WHEN department IS NOT NULL AND department != '' THEN format_to_camelcase(department) ELSE department END,
    status = CASE WHEN status IS NOT NULL AND status != '' THEN format_to_camelcase(status) ELSE status END,
    document_category = CASE WHEN document_category IS NOT NULL AND document_category != '' THEN format_to_camelcase(document_category) ELSE document_category END,
    document_subcategory = CASE WHEN document_subcategory IS NOT NULL AND document_subcategory != '' THEN format_to_camelcase(document_subcategory) ELSE document_subcategory END,
    classification = CASE WHEN classification IS NOT NULL AND classification != '' THEN format_to_camelcase(classification) ELSE classification END,
    access_level = CASE WHEN access_level IS NOT NULL AND access_level != '' THEN format_to_camelcase(access_level) ELSE access_level END,
    approval_status = CASE WHEN approval_status IS NOT NULL AND approval_status != '' THEN format_to_camelcase(approval_status) ELSE approval_status END,
    notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN format_to_camelcase(notes) ELSE notes END
WHERE 
    (title IS NOT NULL AND title != '') OR 
    (description IS NOT NULL AND description != '') OR
    (document_type IS NOT NULL AND document_type != '') OR
    (department IS NOT NULL AND department != '') OR
    (status IS NOT NULL AND status != '') OR
    (document_category IS NOT NULL AND document_category != '') OR
    (document_subcategory IS NOT NULL AND document_subcategory != '') OR
    (classification IS NOT NULL AND classification != '') OR
    (access_level IS NOT NULL AND access_level != '') OR
    (approval_status IS NOT NULL AND approval_status != '') OR
    (notes IS NOT NULL AND notes != '');

-- İşlem tamamlandı mesajı
DO $$
BEGIN
    RAISE NOTICE 'Mevcut veriler camelCase formatına başarıyla migrate edildi!';
END $$;
