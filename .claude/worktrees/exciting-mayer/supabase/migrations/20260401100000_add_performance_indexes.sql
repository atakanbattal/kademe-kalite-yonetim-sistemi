-- nonconformity_records: sik sorgulanan ve siralanan sutunlar
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_record_number ON nonconformity_records (record_number DESC);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_detection_area ON nonconformity_records (detection_area);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_status ON nonconformity_records (status);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_detection_date ON nonconformity_records (detection_date DESC);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_part_code ON nonconformity_records (part_code);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_category ON nonconformity_records (category);
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_source_nc_id ON nonconformity_records (source_nc_id) WHERE source_nc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nonconformity_records_created_at ON nonconformity_records (created_at DESC);

-- process_inspections: sik sorgulanan sutunlar
CREATE INDEX IF NOT EXISTS idx_process_inspections_inspection_date ON process_inspections (inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_inspections_part_code ON process_inspections (part_code);

-- process_inspection_results / defects: FK lookup
CREATE INDEX IF NOT EXISTS idx_process_inspection_results_inspection_id ON process_inspection_results (inspection_id);
CREATE INDEX IF NOT EXISTS idx_process_inspection_defects_inspection_id ON process_inspection_defects (inspection_id);

-- process_inkr_reports / control_plans: siralama sutunu
CREATE INDEX IF NOT EXISTS idx_process_inkr_reports_updated_at ON process_inkr_reports (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_control_plans_updated_at ON process_control_plans (updated_at DESC);

-- quality_inspection_faults: backfill sync taramasi
CREATE INDEX IF NOT EXISTS idx_quality_inspection_faults_inspection_id ON quality_inspection_faults (inspection_id);
