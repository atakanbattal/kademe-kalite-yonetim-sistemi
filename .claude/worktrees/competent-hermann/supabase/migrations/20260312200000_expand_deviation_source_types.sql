ALTER TABLE deviations
DROP CONSTRAINT IF EXISTS check_valid_source_type;

UPDATE deviations
SET
    source_record_details = jsonb_strip_nulls(
        COALESCE(source_record_details, '{}'::jsonb) ||
        jsonb_build_object('legacy_source_type', source_type)
    ),
    source_type = 'manual'
WHERE source_type IS NOT NULL
  AND (
      btrim(source_type) = ''
      OR source_type NOT IN (
          'incoming_inspection',
          'quarantine',
          'quality_cost',
          'leak_test',
          'dynamic_balance',
          'produced_vehicle_fault',
          'customer_complaint',
          'fixture_nonconformity',
          'manual'
      )
  );

ALTER TABLE deviations
ADD CONSTRAINT check_valid_source_type
CHECK (
    source_type IN (
        'incoming_inspection',
        'quarantine',
        'quality_cost',
        'leak_test',
        'dynamic_balance',
        'produced_vehicle_fault',
        'customer_complaint',
        'fixture_nonconformity',
        'manual'
    )
    OR source_type IS NULL
);

COMMENT ON COLUMN deviations.source_type IS
'Kaynak kayıt tipi: incoming_inspection, quarantine, quality_cost, leak_test, dynamic_balance, produced_vehicle_fault, customer_complaint, fixture_nonconformity, manual';
