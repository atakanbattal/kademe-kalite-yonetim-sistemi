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

/** Varsayılan: mevcut davranış (yalnızca proses) */
export const DEFAULT_SUGGESTION_DETECTION_AREAS = ['Proses İçi Kontrol'];

const VALID_AREAS = new Set(NC_SUGGESTION_SOURCE_OPTIONS.map((o) => o.detection_area));

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
