import { differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Geciken kalibrasyon satırları — ekipman başına en fazla bir kayıt.
 * Ekipman modülü (EquipmentDashboard) ile aynı kurallar:
 * - "Hurdaya Ayrıldı" cihazlar hariç
 * - Yalnızca is_active !== false kalibrasyon satırları
 * - Son kalibrasyon tarihine göre en güncel kaydın next_calibration_date değeri
 */
export function getOverdueCalibrationsFromEquipments(equipments = []) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCalibrations = [];

    (equipments || []).forEach((eq) => {
        if (eq.status === 'Hurdaya Ayrıldı') {
            return;
        }

        const activeCalibrations = (eq.equipment_calibrations || []).filter((cal) => cal.is_active !== false);
        if (activeCalibrations.length === 0) return;

        const latestCalibration = [...activeCalibrations].sort(
            (a, b) => new Date(b.calibration_date || 0) - new Date(a.calibration_date || 0)
        )[0];

        if (!latestCalibration?.next_calibration_date || !isValid(parseISO(latestCalibration.next_calibration_date))) {
            return;
        }

        const nextDate = new Date(latestCalibration.next_calibration_date);
        nextDate.setHours(0, 0, 0, 0);

        if (nextDate < today) {
            overdueCalibrations.push({
                cihaz: eq.name,
                equipment_id: eq.id,
                tarih: latestCalibration.next_calibration_date,
                gecikme: differenceInDays(today, parseISO(latestCalibration.next_calibration_date)),
            });
        }
    });

    overdueCalibrations.sort((a, b) => b.gecikme - a.gecikme);
    return overdueCalibrations;
}
