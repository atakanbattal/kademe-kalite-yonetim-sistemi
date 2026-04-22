/**
 * Kalite maliyeti kayıtları için DF / 8D / MDI önerisi (Performans & DF sekmesi).
 * Uygunsuzluk modülündeki eşik mantığına paralel: önce tek kayıt tutarı, sonra aynı parça kodunda tekrar sayısı.
 */

export const DEFAULT_QUALITY_COST_SUGGESTION_SETTINGS = {
    id: null,
    df_cost_threshold_try: 50000,
    eight_d_cost_threshold_try: 150000,
    mdi_cost_threshold_try: 25000,
    df_recurrence_threshold: 3,
    eight_d_recurrence_threshold: 5,
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

/**
 * @param {object} cost — kalite maliyeti satırı
 * @param {object[]} allCosts — aynı bağlamdaki tüm satırlar (ör. aynı araç + dönem)
 * @param {object} settings — quality_cost_suggestion_settings satırı veya normalize edilmiş obje
 * @returns {'DF'|'8D'|'MDI'|null}
 */
export function getCostNcSuggestion(cost, allCosts, settings) {
    const s = normalizeQualityCostSuggestionSettings(settings);
    if (!s.auto_suggest) return null;

    const list = Array.isArray(allCosts) ? allCosts : [];
    const amt = parseFloat(cost?.amount) || 0;
    const key = (cost?.part_code || cost?.part_name || '').trim();
    const sameCount = key
        ? list.filter((c) => (c.part_code || c.part_name || '').trim() === key).length
        : 0;

    // 1) Tek kayıt tutarı (önce 8D, sonra DF)
    if (amt >= s.eight_d_cost_threshold_try) return '8D';
    if (amt >= s.df_cost_threshold_try) return 'DF';

    // 2) Aynı parça kodunda tekrar (seçili kayıt kümesinde)
    if (sameCount >= s.eight_d_recurrence_threshold) return '8D';
    if (sameCount >= s.df_recurrence_threshold) return 'DF';

    // 3) MDI (düşük maliyetli tekrar / izleme)
    if (amt >= s.mdi_cost_threshold_try) return 'MDI';

    return null;
}

/** Aynı parça kodu / adı ile seçili dönemdeki kayıt sayısı (tekrar). */
export function getPartRecurrenceCount(cost, allCosts) {
    const key = (cost?.part_code || cost?.part_name || '').trim();
    if (!key) return 0;
    const list = Array.isArray(allCosts) ? allCosts : [];
    return list.filter((c) => (c.part_code || c.part_name || '').trim() === key).length;
}
