import { computeBenchmarkItemScores, syncAutoBenchmarkCriteria } from '@/lib/benchmarkScoring';
import { buildAutoProsConsInserts } from '@/lib/benchmarkAutoProsCons';

function mergeSyntheticProsCons(prosConsData, inserts) {
    if (!inserts?.length) return;
    for (const ins of inserts) {
        if (!prosConsData[ins.benchmark_item_id]) {
            prosConsData[ins.benchmark_item_id] = { pros: [], cons: [] };
        }
        const bucket = prosConsData[ins.benchmark_item_id];
        const list = ins.type === 'Avantaj' ? bucket.pros : bucket.cons;
        const dup = list.some((p) => p.description === ins.description);
        if (dup) continue;
        list.push({
            id: `report-auto-${ins.benchmark_item_id}-${list.length}-${ins.type}`,
            benchmark_item_id: ins.benchmark_item_id,
            type: ins.type,
            description: ins.description,
            source: 'auto',
        });
    }
}

/**
 * Karşılaştırma raporu HTML’i için tek veri kaynağı (modal, detay, karşılaştır aynı çıktı).
 */
export async function fetchBenchmarkComparisonReportPayload(supabase, benchmarkId) {
    const [itemsRes, criteriaRes] = await Promise.all([
        supabase.from('benchmark_items').select('*').eq('benchmark_id', benchmarkId).order('rank_order'),
        supabase.from('benchmark_criteria').select('*').eq('benchmark_id', benchmarkId).order('order_index'),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (criteriaRes.error) throw criteriaRes.error;

    let items = itemsRes.data || [];
    let criteria = (criteriaRes.data || []).map((row) => ({
        ...row,
        include_in_matrix: row.include_in_matrix !== false,
    }));

    const matrixCount = criteria.filter((c) => c.include_in_matrix !== false).length;
    if (items.length >= 2 && matrixCount < 2) {
        try {
            await syncAutoBenchmarkCriteria(supabase, benchmarkId);
            const { data: critAfter, error: critErr } = await supabase
                .from('benchmark_criteria')
                .select('*')
                .eq('benchmark_id', benchmarkId)
                .order('order_index');
            if (!critErr && critAfter?.length) {
                criteria = critAfter.map((row) => ({
                    ...row,
                    include_in_matrix: row.include_in_matrix !== false,
                }));
            }
        } catch (e) {
            console.warn('Rapor: otomatik kriter senkronu atlandı', e);
        }
    }

    const itemIds = items.map((i) => i.id);

    let scoresData = [];
    let prosConsRows = [];

    if (itemIds.length > 0) {
        const [scoresRes, prosRes] = await Promise.all([
            supabase.from('benchmark_scores').select('*').in('benchmark_item_id', itemIds),
            supabase.from('benchmark_pros_cons').select('*').in('benchmark_item_id', itemIds),
        ]);

        if (!scoresRes.error) scoresData = scoresRes.data || [];
        if (!prosRes.error) prosConsRows = prosRes.data || [];
    }

    const scores = {};
    scoresData.forEach((score) => {
        scores[`${score.benchmark_item_id}_${score.criterion_id}`] = score;
    });

    const itemScores = computeBenchmarkItemScores(items, criteria, scores);

    const prosConsData = {};
    prosConsRows.forEach((pc) => {
        if (!prosConsData[pc.benchmark_item_id]) {
            prosConsData[pc.benchmark_item_id] = { pros: [], cons: [] };
        }
        if (pc.type === 'Avantaj') {
            prosConsData[pc.benchmark_item_id].pros.push(pc);
        } else {
            prosConsData[pc.benchmark_item_id].cons.push(pc);
        }
    });

    const syntheticInserts = buildAutoProsConsInserts({ items, criteria, scores });
    mergeSyntheticProsCons(prosConsData, syntheticInserts);

    return { items, criteria, scores, itemScores, prosConsData };
}
