/**
 * TS EN ISO 9013 — doğrusal boyutlar için sınır sapmalar (± mm).
 * Sınıf 1 ve Sınıf 2 tabloları: iş parçası kalınlığı (t) × anma boyutu (L).
 */

/** Anma boyutu L (mm): [min, max) */
const NOMINAL_RANGES_MM = [
    [0, 3],
    [3, 10],
    [10, 35],
    [35, 125],
    [125, 315],
    [315, 1000],
    [1000, 2000],
    [2000, 4000],
];

/**
 * Kalınlık t (mm): > lo ve ≤ hi (tablo satır başlıkları).
 * t > 300 için son bant kullanılır.
 */
const THICKNESS_BANDS_MM = [
    { lo: 0, hi: 1 },
    { lo: 1, hi: 3.15 },
    { lo: 3.15, hi: 6.3 },
    { lo: 6.3, hi: 10 },
    { lo: 10, hi: 50 },
    { lo: 50, hi: 100 },
    { lo: 100, hi: 150 },
    { lo: 150, hi: 200 },
    { lo: 200, hi: 250 },
    { lo: 250, hi: 300 },
];

const NUM_THICKNESS_ROWS = THICKNESS_BANDS_MM.length;

/** Sınıf 1 — [kalınlık satırı][anma sütunu], null: tanımsız (—) */
const LIMIT_DEVIATION_CLASS_1_MM = [
    [0.04, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.3],
    [0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.4],
    [0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.6],
    [null, 0.5, 0.6, 0.6, 0.7, 0.7, 0.7, 0.8],
    [null, 0.6, 0.7, 0.7, 0.8, 1, 1.6, 2.5],
    [null, null, 1.3, 1.3, 1.4, 1.7, 2.2, 3.1],
    [null, null, 1.9, 2, 2.1, 2.3, 2.9, 3.8],
    [null, null, 2.6, 2.7, 2.7, 3, 3.6, 4.5],
    [null, null, null, null, null, 3.7, 4.2, 5.2],
    [null, null, null, null, null, 4.4, 4.9, 5.9],
];

/** Sınıf 2 */
const LIMIT_DEVIATION_CLASS_2_MM = [
    [0.1, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 0.9],
    [0.2, 0.4, 0.5, 0.7, 0.8, 0.9, 1, 1.1],
    [0.5, 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 1.3],
    [null, 1, 1.1, 1.3, 1.4, 1.5, 1.6, 1.7],
    [null, 1.8, 1.8, 1.8, 1.9, 2.3, 3, 4.2],
    [null, null, 2.5, 2.5, 2.6, 3, 3.7, 4.9],
    [null, null, 3.2, 3.3, 3.4, 3.7, 4.4, 5.7],
    [null, null, 4, 4, 4.1, 4.5, 5.2, 6.4],
    [null, null, null, null, null, 5.2, 5.9, 7.2],
    [null, null, null, null, null, 6, 6.7, 7.9],
];

const MATRICES = {
    1: LIMIT_DEVIATION_CLASS_1_MM,
    2: LIMIT_DEVIATION_CLASS_2_MM,
};

/** Combobox / tolerance_class: S1 → 1, S2 → 2 */
export function ts9013QualityClassFromToleranceClass(toleranceClass) {
    const s = String(toleranceClass || '').trim();
    if (s === 'S1' || s === '1') return 1;
    if (s === 'S2' || s === '2') return 2;
    return null;
}

/** Eski UI: TS 9013 Range 1–4 */
export function normalizeLegacyTs9013StandardItem(item) {
    const sc = item?.standard_class;
    if (!sc || typeof sc !== 'string') return item;
    if (!/^TS 9013_[1-4]$/.test(sc)) return item;
    return {
        ...item,
        standard_class: 'TS 9013_S1',
        tolerance_class: 'S1',
    };
}

export function getTs9013NominalColumnIndex(nominalMm) {
    if (nominalMm === null || nominalMm === undefined || Number.isNaN(nominalMm)) return -1;
    for (let i = 0; i < NOMINAL_RANGES_MM.length; i++) {
        const [min, max] = NOMINAL_RANGES_MM[i];
        if (nominalMm >= min && nominalMm < max) return i;
    }
    return -1;
}

export function getTs9013ThicknessRowIndex(thicknessMm) {
    if (thicknessMm === null || thicknessMm === undefined || Number.isNaN(thicknessMm) || thicknessMm <= 0) {
        return -1;
    }
    if (thicknessMm > 300) {
        return NUM_THICKNESS_ROWS - 1;
    }
    for (let i = 0; i < THICKNESS_BANDS_MM.length; i++) {
        const { lo, hi } = THICKNESS_BANDS_MM[i];
        if (thicknessMm > lo && thicknessMm <= hi) return i;
    }
    return -1;
}

/**
 * @param {number} thicknessMm
 * @param {number} nominalMm
 * @param {1|2} qualityClass
 * @returns {number|null}
 */
export function lookupTs9013LimitDeviationMm(thicknessMm, nominalMm, qualityClass = 1) {
    const matrix = MATRICES[qualityClass];
    if (!matrix) return null;
    const col = getTs9013NominalColumnIndex(nominalMm);
    const row = getTs9013ThicknessRowIndex(thicknessMm);
    if (col < 0 || row < 0) return null;
    const v = matrix[row]?.[col];
    return v === null || v === undefined ? null : v;
}
