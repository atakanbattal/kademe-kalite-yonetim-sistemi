/**
 * Kalite maliyeti kayıtlarını iç/dış ve özet metrikler için sınıflandırır
 * (QualityCostModule yönetici özeti ile uyumlu).
 */

const INTERNAL_HINTS = [
    'Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti',
    'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti',
    'İç Hata Maliyeti', 'İç Hata Maliyetleri', 'İç Hata',
    'Hurda', 'Yeniden İşlem', 'Tedarikçi Hata Maliyeti',
];

const EXTERNAL_HINTS = [
    'Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti',
    'Dış Hata Maliyeti', 'Dış Hata Maliyetleri', 'Dış Hata',
    'Müşteri Şikayeti', 'Müşteri Reklaması',
];

export function classifyCostInternalExternal(cost) {
    const costType = cost?.cost_type || '';
    const isSupplierCost = cost?.is_supplier_nc && cost?.supplier_id;
    if (EXTERNAL_HINTS.some((t) => costType.includes(t))) return 'external';
    if (INTERNAL_HINTS.some((t) => costType.includes(t)) || isSupplierCost) return 'internal';
    return 'internal';
}

export function summarizeCostRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let total = 0;
    let internal = 0;
    let external = 0;
    const monthKeys = new Set();
    for (const c of list) {
        const amt = parseFloat(c?.amount) || 0;
        total += amt;
        const bucket = classifyCostInternalExternal(c);
        if (bucket === 'external') external += amt;
        else internal += amt;
        if (c?.cost_date) {
            const d = new Date(c.cost_date);
            if (!Number.isNaN(d.getTime())) {
                monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }
        }
    }
    const n = list.length;
    const months = monthKeys.size || 1;
    return {
        total,
        count: n,
        internal,
        external,
        internalShare: total > 0 ? (internal / total) * 100 : 0,
        externalShare: total > 0 ? (external / total) * 100 : 0,
        avgPerRecord: n > 0 ? total / n : 0,
        avgPerActiveMonth: months > 0 ? total / months : 0,
        distinctMonths: monthKeys.size,
    };
}

/** Belirli yıl için tüm maliyet satırlarını filtrele */
export function filterCostsByYear(allCosts, year) {
    if (!Array.isArray(allCosts) || year == null) return [];
    return allCosts.filter((c) => {
        if (!c?.cost_date) return false;
        const d = new Date(c.cost_date);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    });
}

/**
 * Yılın başından "bugüne" kadar (ay/gün dahil) aynı dönemi önceki yılda hesapla (COPQ karşılaştırması).
 */
export function filterCostsSamePeriodYearToDate(allCosts, year) {
    if (!Array.isArray(allCosts)) return [];
    const now = new Date();
    const end = year === now.getFullYear()
        ? now
        : new Date(year, 11, 31, 23, 59, 59, 999);
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    return allCosts.filter((c) => {
        if (!c?.cost_date) return false;
        const d = new Date(c.cost_date);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    });
}

/**
 * Yılın 1 Ocak — bugünün ay/gününe denk gelen tarihe kadar (aynı göreli dönem).
 * Örn. bugün 9 Nisan 2026 ise 2025 için 1 Oca – 9 Nisan 2025 arası kayıtlar.
 */
export function filterCostsAlignedYearToDate(allCosts, year) {
    if (!Array.isArray(allCosts) || year == null) return [];
    const now = new Date();
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const day = Math.min(now.getDate(), lastDayOfMonth);
    const end = new Date(year, now.getMonth(), day, 23, 59, 59, 999);
    return allCosts.filter((c) => {
        if (!c?.cost_date) return false;
        const d = new Date(c.cost_date);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    });
}

/** Tarih aralığını bir yıl geri alır (önceki yılın aynı takvim penceresi). */
export function getPreviousYearDateRangeInclusive(dateRange) {
    if (!dateRange?.startDate || !dateRange?.endDate) return null;
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const prevStart = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate());
    const prevEnd = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
    prevEnd.setHours(23, 59, 59, 999);
    return { start: prevStart, end: prevEnd };
}

/** [start,end] aralığının tek bir takvim yılının 1 Oca – 31 Ara kapsayıp kapsamadığı. */
export function isFullCalendarYearInclusiveRange(start, end) {
    if (!start || !end) return false;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
    return (
        s.getMonth() === 0 &&
        s.getDate() === 1 &&
        e.getMonth() === 11 &&
        e.getDate() === 31 &&
        s.getFullYear() === e.getFullYear()
    );
}

/** Maliyet satırlarını [start, end] kapanışına göre filtreler. */
export function filterCostsInDateRangeInclusive(rows, start, end) {
    if (!Array.isArray(rows) || !start || !end) return [];
    return rows.filter((c) => {
        if (!c?.cost_date) return false;
        const d = new Date(c.cost_date);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    });
}
