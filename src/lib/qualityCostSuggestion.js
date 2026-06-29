/**
 * Kalite maliyeti kayıtları için DF / 8D / MDI önerisi (Performans & DF sekmesi).
 * Uygunsuzluk modülündeki eşik mantığına paralel: önce tek kayıt tutarı, sonra aynı parça kodunda tekrar sayısı.
 */

export const DEFAULT_QUALITY_COST_SUGGESTION_SETTINGS = {
    id: null,
    df_cost_threshold_try: 23321.22,
    eight_d_cost_threshold_try: 46642.44,
    mdi_cost_threshold_try: 10000,
    df_recurrence_threshold: 5,
    eight_d_recurrence_threshold: 10,
    threshold_period_days: 30,
    auto_suggest: true,
};

const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const int = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

/** Geçersiz parça kodu/adı (-, boş vb.) tekrar sayımında kullanılmaz */
const INVALID_PART_KEYS = new Set(['-', '—', '–', 'yok', 'n/a', 'na', 'null', 'undefined']);

export function resolveQualityCostPartKey(cost) {
    const code = (cost?.part_code || '').trim();
    const name = (cost?.part_name || '').trim();
    if (code && !INVALID_PART_KEYS.has(code.toLowerCase())) return code;
    if (name && !INVALID_PART_KEYS.has(name.toLowerCase())) return name;
    return '';
}

export function normalizeQualityCostSuggestionSettings(row) {
    if (!row || typeof row !== 'object') {
        return { ...DEFAULT_QUALITY_COST_SUGGESTION_SETTINGS };
    }
    const d = DEFAULT_QUALITY_COST_SUGGESTION_SETTINGS;
    return {
        ...d,
        ...row,
        df_cost_threshold_try: num(row.df_cost_threshold_try, d.df_cost_threshold_try),
        eight_d_cost_threshold_try: num(row.eight_d_cost_threshold_try, d.eight_d_cost_threshold_try),
        mdi_cost_threshold_try: num(row.mdi_cost_threshold_try, d.mdi_cost_threshold_try),
        df_recurrence_threshold: int(row.df_recurrence_threshold, d.df_recurrence_threshold),
        eight_d_recurrence_threshold: int(row.eight_d_recurrence_threshold, d.eight_d_recurrence_threshold),
        threshold_period_days: int(row.threshold_period_days, d.threshold_period_days),
        auto_suggest: row.auto_suggest !== false,
    };
}

/** Tek geçişte parça tekrar sayıları — O(n²) filter yerine O(n) */
export function buildQualityCostPartRecurrenceIndex(allCosts) {
    const index = new Map();
    const list = Array.isArray(allCosts) ? allCosts : [];
    for (const c of list) {
        const key = resolveQualityCostPartKey(c);
        if (!key) continue;
        index.set(key, (index.get(key) || 0) + 1);
    }
    return index;
}

const resolveSameCount = (cost, allCosts, recurrenceIndex) => {
    const key = resolveQualityCostPartKey(cost);
    if (!key) return 0;
    if (recurrenceIndex instanceof Map) return recurrenceIndex.get(key) || 0;
    const list = Array.isArray(allCosts) ? allCosts : [];
    return list.filter((c) => resolveQualityCostPartKey(c) === key).length;
};

/**
 * @param {object} cost — kalite maliyeti satırı
 * @param {object[]} allCosts — aynı bağlamdaki tüm satırlar (ör. aynı araç + dönem)
 * @param {object} settings — quality_cost_suggestion_settings satırı veya normalize edilmiş obje
 * @param {Map<string, number>} [recurrenceIndex] — buildQualityCostPartRecurrenceIndex çıktısı (performans)
 * @returns {'DF'|'8D'|'MDI'|null}
 */
export function getCostNcSuggestion(cost, allCosts, settings, recurrenceIndex = null) {
    const s = normalizeQualityCostSuggestionSettings(settings);
    if (!s.auto_suggest) return null;

    const amt = parseFloat(cost?.amount) || 0;
    const sameCount = resolveSameCount(cost, allCosts, recurrenceIndex);

    // 1) Tek kayıt tutarı — 8D
    if (amt >= s.eight_d_cost_threshold_try) return '8D';

    // 2) Tekrar + minimum tutar — 8D (düşük tutarlı tekrarlar yalnızca DF önerir)
    if (sameCount >= s.eight_d_recurrence_threshold && amt >= s.df_cost_threshold_try) return '8D';

    // 3) Tek kayıt tutarı — DF
    if (amt >= s.df_cost_threshold_try) return 'DF';

    // 4) Tekrar — DF
    if (sameCount >= s.df_recurrence_threshold) return 'DF';

    // 3) MDI (düşük maliyetli tekrar / izleme)
    if (amt >= s.mdi_cost_threshold_try) return 'MDI';

    return null;
}

/** Aynı parça kodu / adı ile seçili dönemdeki kayıt sayısı (tekrar). */
export function getPartRecurrenceCount(cost, allCosts, recurrenceIndex = null) {
    return resolveSameCount(cost, allCosts, recurrenceIndex);
}
