-- Hurdaya ayrılmış ekipmanlarda kalmış aktif zimmetleri kapatır (filtre/liste ile özet kartları uyumu).
UPDATE equipment_assignments ea
SET is_active = false,
    return_date = COALESCE(ea.return_date, now())
FROM equipments e
WHERE ea.equipment_id = e.id
  AND e.status = 'Hurdaya Ayrıldı'
  AND ea.is_active = true;
