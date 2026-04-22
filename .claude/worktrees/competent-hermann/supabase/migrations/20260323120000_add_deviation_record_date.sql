-- İş / kayıt tarihi (takvim); created_at sistem zaman damgası olarak kalır
ALTER TABLE deviations
ADD COLUMN IF NOT EXISTS record_date DATE;

COMMENT ON COLUMN deviations.record_date IS 'İş kayıt tarihi (formdan seçilen); created_at sisteme giriş zamanıdır';

UPDATE deviations
SET record_date = (created_at AT TIME ZONE 'UTC')::date
WHERE record_date IS NULL AND created_at IS NOT NULL;
