/**
 * DF/8D öneri eşikleri hangi tespit alanlarından (kaynak modüllerden) beslensin?
 * nonconformity_records.detection_area ile eşleşir.
 */
export const NC_SUGGESTION_SOURCE_OPTIONS = [
    {
        id: 'process',
        detection_area: 'Proses İçi Kontrol',
        label: 'Proses Kontrol',
        description: 'Proses muayene / hat kontrolünden gelen kayıtlar',
    },
    {
        id: 'vehicles',
        detection_area: 'Üretilen Araçlar',
        label: 'Üretilen Araçlar',
        description: 'Üretilen araçlar modülünden otomatik oluşturulan kayıtlar',
    },
    {
        id: 'leak',
        detection_area: 'Sızdırmazlık Kontrol',
        label: 'Sızdırmazlık Kontrol',
        description: 'Sızdırmazlık test modülünden gelen kayıtlar',
    },
];

/** Varsayılan: üç ana modül (çoğu kurulumda veri bu alanlardan gelir) */
export const DEFAULT_SUGGESTION_DETECTION_AREAS = [
    'Proses İçi Kontrol',
    'Üretilen Araçlar',
    'Sızdırmazlık Kontrol',
];

const VALID_AREAS = new Set(NC_SUGGESTION_SOURCE_OPTIONS.map((o) => o.detection_area));

/** UI + RPC’de seçilebilen kanonik alan adları */
export function isCanonicalSuggestionDetectionArea(area) {
    const a = String(area ?? '').trim();
    return a.length > 0 && VALID_AREAS.has(a);
}

/** Kayıt: yalnızca geçerli alan adları (boş dizi dönebilir) */
export function parseSuggestionAreasForSave(raw) {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((a) => String(a).trim()).filter((a) => VALID_AREAS.has(a));
}

/**
 * @param {unknown} raw - DB jsonb veya dizi
 * @returns {string[]}
 */
export function normalizeSuggestionDetectionAreas(raw) {
    let arr = [];
    if (raw == null) {
        arr = [];
    } else if (Array.isArray(raw)) {
        arr = raw;
    } else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            arr = Array.isArray(parsed) ? parsed : [];
        } catch {
            arr = [];
        }
    }
    const filtered = arr.map((a) => String(a).trim()).filter((a) => VALID_AREAS.has(a));
    if (filtered.length === 0) {
        return [...DEFAULT_SUGGESTION_DETECTION_AREAS];
    }
    return filtered;
}

/** RPC `p_detection_areas` için dizi (en az bir alan) */
export function buildSuggestionAreasForRpc(areas) {
    const list = normalizeSuggestionDetectionAreas(areas);
    return list.length ? list : [...DEFAULT_SUGGESTION_DETECTION_AREAS];
}

/**
 * Çok kısa periyotta (ör. 1 gün) dönem içi tekrar hep 0 kalır; DF/8D önerisi oluşmaz.
 * En az 7 gün kullanılır (öneri ve Analiz ile tutarlı).
 */
export const MIN_THRESHOLD_PERIOD_DAYS = 7;

export function clampThresholdPeriodDays(raw) {
    const n = parseInt(String(raw ?? ''), 10);
    if (Number.isNaN(n) || n < 1) return 30;
    return Math.max(MIN_THRESHOLD_PERIOD_DAYS, n);
}
