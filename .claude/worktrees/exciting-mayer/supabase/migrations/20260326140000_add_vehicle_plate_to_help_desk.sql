-- Help Desk kayıtlarında plaka (şikayet formu ile aynı alan adı)
ALTER TABLE after_sales_help_desk ADD COLUMN IF NOT EXISTS vehicle_plate_number text;
