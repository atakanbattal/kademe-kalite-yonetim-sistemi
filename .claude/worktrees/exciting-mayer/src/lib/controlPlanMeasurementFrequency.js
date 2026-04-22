/**
 * Karakteristik tipine göre kontrol planı / muayene ölçüm sıklığı etiketi.
 * Girdi kalite (IncomingInspectionFormModal) ve proses (processInspectionUtils) ile aynı kurallar.
 *
 * @param {string|null|undefined} characteristicType
 * @returns {string} Örn. 1/parça, 1/3, 1/5, 1/parti
 */
export function getMeasurementFrequencyLabel(characteristicType) {
    const type = String(characteristicType ?? '').toLowerCase();

    if (type.includes('emniyet')) return '1/parça';
    if (type.includes('kritik')) return '1/3';
    if (type.includes('fonksiyonel')) return '1/5';
    if (type.includes('minör') || type.includes('minor') || type.includes('minoer')) return '1/parti';

    return '1/parti';
}
