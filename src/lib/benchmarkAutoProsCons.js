/**
 * Kriter skorlarına göre ortalamaya göre otomatik avantaj/dezavantaj metinleri üretir.
 * Kriter tablosu boş veya skor girilmemişse alternatif alanlarından (metrik) türetilir.
 */

import {
    BENCHMARK_METRIC_FIELDS,
    calculateAutoScoreFromItems,
    computeFieldNormalizedScore,
} from './benchmarkScoring';

const DIFF_THRESHOLD = 5;
const RANKING_GAP = 2;

/**
 * @param {object} params
 * @param {Array} params.items
 * @param {Array} params.criteria
 * @param {Record<string, object>} params.scores key: `${itemId}_${criterionId}`
 * @returns {Array<{ benchmark_item_id: string, type: 'Avantaj'|'Dezavantaj', description: string, category: string|null, source: 'auto' }>}
 */
export function buildAutoProsConsInserts({ items, criteria, scores }) {
    if (!items?.length) return [];

    const inserts = [];
    const activeCriteria = (criteria || []).filter((c) => c.include_in_matrix !== false);

    if (activeCriteria?.length) {
        for (const criterion of activeCriteria) {
            const vals = [];
            for (const item of items) {
                const key = `${item.id}_${criterion.id}`;
                const sc = scores[key];
                const n = sc?.normalized_score != null ? Number(sc.normalized_score) : null;
                if (n != null && !Number.isNaN(n)) vals.push(n);
            }
            if (vals.length < 2) continue;

            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            const name = criterion.criterion_name || 'Kriter';
            const cat = criterion.category?.trim() || null;

            for (const item of items) {
                const key = `${item.id}_${criterion.id}`;
                const sc = scores[key];
                const n = sc?.normalized_score != null ? Number(sc.normalized_score) : null;
                if (n == null || Number.isNaN(n)) continue;

                const diff = n - avg;
                if (diff >= DIFF_THRESHOLD) {
                    inserts.push({
                        benchmark_item_id: item.id,
                        type: 'Avantaj',
                        description: `"${name}" kriterinde ortalamanın üzerinde (${n.toFixed(1)} / ort. ${avg.toFixed(1)}).`,
                        category: cat,
                        source: 'auto',
                    });
                } else if (diff <= -DIFF_THRESHOLD) {
                    inserts.push({
                        benchmark_item_id: item.id,
                        type: 'Dezavantaj',
                        description: `"${name}" kriterinde ortalamanın altında (${n.toFixed(1)} / ort. ${avg.toFixed(1)}).`,
                        category: cat,
                        source: 'auto',
                    });
                }
            }
        }
    }

    if (inserts.length === 0 && items.length >= 2) {
        inserts.push(...buildMetricFieldProsConsInserts(items));
    }

    appendRankingProsCons(inserts, items, activeCriteria, scores || {});

    return inserts;
}

/**
 * Veri tabanında kriter yokken veya skor boşken alternatif alanlarından (normalize metrik) avantaj/dezavantaj.
 */
export function buildMetricFieldProsConsInserts(items) {
    const inserts = [];
    if (!items?.length || items.length < 2) return inserts;

    for (const def of BENCHMARK_METRIC_FIELDS) {
        const vals = [];
        for (const item of items) {
            const n = computeFieldNormalizedScore(item, def, items);
            if (n != null && !Number.isNaN(n)) vals.push(n);
        }
        if (vals.length < 2) continue;

        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const name = def.label || 'Metrik';
        const cat = def.category?.trim() || null;

        for (const item of items) {
            const n = computeFieldNormalizedScore(item, def, items);
            if (n == null || Number.isNaN(n)) continue;

            const diff = n - avg;
            if (diff >= DIFF_THRESHOLD) {
                inserts.push({
                    benchmark_item_id: item.id,
                    type: 'Avantaj',
                    description: `"${name}" alanında alternatiflere göre üstün (${n.toFixed(1)} / ort. ${avg.toFixed(1)}).`,
                    category: cat,
                    source: 'auto',
                });
            } else if (diff <= -DIFF_THRESHOLD) {
                inserts.push({
                    benchmark_item_id: item.id,
                    type: 'Dezavantaj',
                    description: `"${name}" alanında alternatiflere göre zayıf (${n.toFixed(1)} / ort. ${avg.toFixed(1)}).`,
                    category: cat,
                    source: 'auto',
                });
            }
        }
    }

    return inserts;
}

function appendRankingProsCons(inserts, items, criteria, scores) {
    if (items.length < 2) return;

    const sorted = [...items].sort((a, b) => {
        const sa = averageFromScoresOrAuto(a.id, items, criteria, scores);
        const sb = averageFromScoresOrAuto(b.id, items, criteria, scores);
        return sb - sa;
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestAvg = averageFromScoresOrAuto(best.id, items, criteria, scores);
    const worstAvg = averageFromScoresOrAuto(worst.id, items, criteria, scores);

    if (best.id === worst.id) return;
    if (bestAvg <= worstAvg + RANKING_GAP) return;

    const hasBest = inserts.some(
        (r) => r.benchmark_item_id === best.id && r.description.includes('en yüksek sıralamada')
    );
    const hasWorst = inserts.some(
        (r) => r.benchmark_item_id === worst.id && r.description.includes('en düşük sıralamada')
    );

    if (!hasBest) {
        inserts.push({
            benchmark_item_id: best.id,
            type: 'Avantaj',
            description: `Genel skorda en yüksek sıralamada (${bestAvg.toFixed(1)}).`,
            category: 'Genel',
            source: 'auto',
        });
    }
    if (!hasWorst) {
        inserts.push({
            benchmark_item_id: worst.id,
            type: 'Dezavantaj',
            description: `Genel skorda en düşük sıralamada (${worstAvg.toFixed(1)}).`,
            category: 'Genel',
            source: 'auto',
        });
    }
}

function averageFromScoresOrAuto(itemId, items, criteria, scores) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return 0;

    let t = 0;
    let w = 0;
    for (const c of criteria || []) {
        const key = `${itemId}_${c.id}`;
        const sc = scores[key];
        const n = sc?.normalized_score != null ? Number(sc.normalized_score) : null;
        const wt = Number(c.weight) || 1;
        if (n != null && !Number.isNaN(n)) {
            t += n * wt;
            w += wt;
        }
    }
    if (w > 0) return t / w;
    return calculateAutoScoreFromItems(item, items);
}

/**
 * Eski otomatik satırları siler ve yenilerini yazar.
 */
export async function replaceAutoProsConsInSupabase(supabase, { itemIds, inserts }) {
    if (!itemIds?.length) return { error: null };
    const { error: delErr } = await supabase
        .from('benchmark_pros_cons')
        .delete()
        .eq('source', 'auto')
        .in('benchmark_item_id', itemIds);
    if (delErr) {
        console.warn('benchmark_pros_cons auto silinemedi:', delErr);
        return { error: delErr };
    }
    if (!inserts?.length) return { error: null };
    const { error: insErr } = await supabase.from('benchmark_pros_cons').insert(inserts);
    if (insErr) console.warn('benchmark_pros_cons auto eklenemedi:', insErr);
    return { error: insErr };
}
