/**
 * Kalite hata kayıtlarında adet (quantity) ile tutarlı sayım.
 * VehicleFaultAnalytics ile aynı string/numeric normalizasyonu.
 */

export function parseFaultQuantity(fault) {
    if (!fault) return 0;
    let quantity = fault.quantity;
    if (quantity === null || quantity === undefined || quantity === '') {
        return 1;
    }
    if (typeof quantity === 'string') {
        const parsed = parseFloat(String(quantity).replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    const n = Number(quantity);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

export function sumFaultQuantityWhere(faults, predicate) {
    if (!faults?.length) return 0;
    return faults.reduce((sum, f) => {
        if (!predicate(f)) return sum;
        return sum + parseFaultQuantity(f);
    }, 0);
}
