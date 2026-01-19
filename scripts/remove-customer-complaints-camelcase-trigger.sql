-- Customer Complaints tablosundan camel case trigger'ını kaldır
-- Bu script, customer_complaints tablosunda format_to_camelcase kullanımını kaldırır

-- Trigger'ı kaldır
DROP TRIGGER IF EXISTS trigger_format_customer_complaint_fields ON customer_complaints;

-- Fonksiyonu kaldır (eğer başka yerde kullanılmıyorsa)
DROP FUNCTION IF EXISTS format_customer_complaint_fields();

-- Başarı mesajı
SELECT 'Customer complaints camel case trigger başarıyla kaldırıldı!' AS message;
