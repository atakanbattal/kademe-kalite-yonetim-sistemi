/**
 * Hurda ve benzeri nihai durumlar, aktif zimmet kaydından önce gelir.
 * Aksi halde “Hurdaya Ayrıldı” filtresi, zimmeti kapatılmamış hurda satırlarını listeden düşürürdü.
 */
export function getEquipmentDisplayStatus(eq) {
    if (!eq) return '';
    if (eq.status === 'Hurdaya Ayrıldı') return 'Hurdaya Ayrıldı';
    const activeAssignment = eq.equipment_assignments?.find((a) => a.is_active);
    if (activeAssignment) return 'Zimmetli';
    return eq.status || '';
}
