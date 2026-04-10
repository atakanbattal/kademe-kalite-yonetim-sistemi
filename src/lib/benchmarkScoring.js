/**
 * Benchmark karşılaştırma: alternatifler arası normalize skorlar ve toplam ağırlıklı puan.
 * BenchmarkComparison ile BenchmarkForm senkron kalır.
 */

/** @typedef {'lower_better'|'direct'|'roi'|'warranty'|'refs'|'risk'|'delivery'|'implementation'|'training'} MetricMode */

/**
 * @type {Array<{
 *   key: string,
 *   label: string,
 *   category: string,
 *   weight: number,
 *   mode: MetricMode,
 *   valueGetter?: (item: object) => unknown
 * }>}
 */
export const BENCHMARK_METRIC_FIELDS = [
    { key: 'unit_price', label: 'Birim fiyat', category: 'Maliyet', weight: 15, mode: 'lower_better' },
    { key: 'total_cost_of_ownership', label: 'Toplam sahip olma maliyeti (TCO)', category: 'Maliyet', weight: 20, mode: 'lower_better' },
    { key: 'roi_percentage', label: 'ROI (%)', category: 'Maliyet', weight: 15, mode: 'roi' },
    { key: 'maintenance_cost', label: 'Bakım maliyeti', category: 'Maliyet', weight: 10, mode: 'lower_better' },
    { key: 'quality_score', label: 'Kalite', category: 'Kalite', weight: 25, mode: 'direct' },
    { key: 'performance_score', label: 'Performans', category: 'Kalite', weight: 20, mode: 'direct' },
    { key: 'reliability_score', label: 'Güvenilirlik', category: 'Kalite', weight: 20, mode: 'direct' },
    { key: 'after_sales_service_score', label: 'Satış sonrası hizmet', category: 'Hizmet', weight: 15, mode: 'direct' },
    { key: 'technical_support_score', label: 'Teknik destek', category: 'Hizmet', weight: 15, mode: 'direct' },
    { key: 'documentation_quality_score', label: 'Dokümantasyon kalitesi', category: 'Hizmet', weight: 10, mode: 'direct' },
    { key: 'warranty_period_months', label: 'Garanti süresi (ay)', category: 'Hizmet', weight: 10, mode: 'warranty' },
    { key: 'delivery_time_days', label: 'Teslimat süresi (gün)', category: 'Operasyon', weight: 15, mode: 'delivery' },
    { key: 'implementation_time_days', label: 'Uygulama süresi (gün)', category: 'Operasyon', weight: 10, mode: 'implementation' },
    { key: 'training_required_hours', label: 'Eğitim ihtiyacı (saat)', category: 'Operasyon', weight: 10, mode: 'training' },
    { key: 'energy_efficiency_score', label: 'Enerji verimliliği', category: 'Çevre', weight: 10, mode: 'direct' },
    { key: 'environmental_impact_score', label: 'Çevresel etki', category: 'Çevre', weight: 10, mode: 'direct' },
    { key: 'ease_of_use_score', label: 'Kullanım kolaylığı', category: 'Kullanılabilirlik', weight: 15, mode: 'direct' },
    { key: 'scalability_score', label: 'Ölçeklenebilirlik', category: 'Teknik', weight: 15, mode: 'direct' },
    { key: 'compatibility_score', label: 'Uyumluluk', category: 'Teknik', weight: 15, mode: 'direct' },
    { key: 'innovation_score', label: 'İnovasyon', category: 'Pazar', weight: 10, mode: 'direct' },
    { key: 'market_reputation_score', label: 'Pazar itibarı', category: 'Pazar', weight: 15, mode: 'direct' },
    { key: 'customer_references_count', label: 'Referans sayısı', category: 'Pazar', weight: 10, mode: 'refs' },
    { key: 'risk_level', label: 'Risk (düşük = iyi)', category: 'Risk', weight: 10, mode: 'risk' },
];

const RISK_SCORES = { Düşük: 100, Orta: 70, Yüksek: 40, Kritik: 10 };

/**
 * Tek bir metrik için 0–100 normalize skor (null = bu alan için veri yok).
 */
export function computeFieldNormalizedScore(item, fieldDef, items) {
    const mode = fieldDef.mode;
    const key = fieldDef.key;

    if (mode === 'delivery') {
        const d = item.delivery_time_days ?? item.lead_time_days;
        if (d == null || d === '') return null;
        const nums = items
            .map((i) => i.delivery_time_days ?? i.lead_time_days)
            .filter((x) => x != null && x !== '');
        if (nums.length === 0) return null;
        const maxD = Math.max(...nums);
        const minD = Math.min(...nums);
        if (maxD === minD) return 100;
        return 100 - ((Number(d) - minD) / (maxD - minD)) * 100;
    }

    const v = item[key];
    if (v == null || v === '') return null;

    if (mode === 'lower_better') {
        const nums = items.map((i) => i[key]).filter((x) => x != null && x !== '');
        if (nums.length === 0) return null;
        const maxV = Math.max(...nums.map(Number));
        const minV = Math.min(...nums.map(Number));
        if (maxV === minV) return 100;
        return 100 - ((Number(v) - minV) / (maxV - minV)) * 100;
    }

    if (mode === 'direct') {
        return Math.min(Math.max(Number(v), 0), 100);
    }

    if (mode === 'roi') {
        return Math.min(Number(v), 100);
    }

    if (mode === 'warranty') {
        return Math.min((Number(v) / 60) * 100, 100);
    }

    if (mode === 'refs') {
        return Math.min((Number(v) / 50) * 100, 100);
    }

    if (mode === 'risk') {
        return RISK_SCORES[v] ?? 50;
    }

    if (mode === 'implementation' || mode === 'training') {
        const nums = items.map((i) => i[key]).filter((x) => x != null && x !== '');
        if (nums.length === 0) return null;
        const maxV = Math.max(...nums.map(Number));
        const minV = Math.min(...nums.map(Number));
        if (maxV === minV) return 100;
        return 100 - ((Number(v) - minV) / (maxV - minV)) * 100;
    }

    return null;
}

/**
 * Mevcut BenchmarkComparison ile uyumlu toplam otomatik skor (0–100).
 */
export function calculateAutoScoreFromItems(item, items) {
    if (!item || !items?.length) return 0;

    let totalScore = 0;
    let maxScore = 0;

    for (const def of BENCHMARK_METRIC_FIELDS) {
        const n = computeFieldNormalizedScore(item, def, items);
        if (n == null || Number.isNaN(n)) continue;
        totalScore += (n * def.weight) / 100;
        maxScore += def.weight;
    }

    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
}

/**
 * Kriter skorlarından alternatif bazında ağırlıklı ortalama (BenchmarkComparison state ile aynı).
 * @param {Record<string, object>} scoresByKey — `${itemId}_${criterionId}` -> benchmark_scores satırı
 */
export function computeBenchmarkItemScores(items, criteria, scoresByKey) {
    const result = {};
    if (!items?.length) return result;

    const activeCriteria = (criteria || []).filter((c) => c.include_in_matrix !== false);

    items.forEach((item) => {
        let totalScore = 0;
        let totalWeight = 0;

        activeCriteria.forEach((criterion) => {
            const key = `${item.id}_${criterion.id}`;
            const score = scoresByKey[key];
            if (score && score.weighted_score) {
                totalScore += score.weighted_score;
                totalWeight += criterion.weight || 0;
            }
        });

        if (totalWeight === 0 || activeCriteria.length === 0) {
            const autoScore = calculateAutoScoreFromItems(item, items);
            result[item.id] = {
                total: autoScore,
                average: autoScore,
                isAutoCalculated: true,
            };
        } else {
            result[item.id] = {
                total: totalScore,
                average: totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0,
                isAutoCalculated: false,
            };
        }
    });

    return result;
}

/**
 * En az iki alternatifte doldurulmuş alanlar için kriter + skor üretimi.
 */
export function buildAutoCriteriaPlan(items) {
    if (!items?.length) return { criteria: [], scores: [] };

    const criteria = [];
    const scores = [];

    for (let i = 0; i < BENCHMARK_METRIC_FIELDS.length; i++) {
        const def = BENCHMARK_METRIC_FIELDS[i];
        const normalizedByItemId = {};
        let filled = 0;

        for (const item of items) {
            const n = computeFieldNormalizedScore(item, def, items);
            if (n != null && !Number.isNaN(n)) {
                normalizedByItemId[item.id] = Math.min(Math.max(n, 0), 100);
                filled++;
            }
        }

        if (filled < 2) continue;

        criteria.push({
            tempKey: def.key,
            criterion_name: def.label,
            description: `${def.category} — alternatif verilerinden otomatik hesaplandı`,
            category: def.category,
            weight: def.weight,
            measurement_unit: 'Puan',
            scoring_method: 'Rating',
            order_index: i,
            source: 'auto',
        });

        for (const item of items) {
            const norm = normalizedByItemId[item.id];
            if (norm == null) continue;
            const w = def.weight;
            scores.push({
                tempCriterionKey: def.key,
                benchmark_item_id: item.id,
                raw_value: Math.round(norm * 100) / 100,
                normalized_score: Math.round(norm * 100) / 100,
                weighted_score: (norm * w) / 100,
            });
        }
    }

    return { criteria, scores };
}

/**
 * Veritabanında otomatik kriterleri yeniler; manuel kriterlere dokunmaz.
 */
export async function syncAutoBenchmarkCriteria(supabase, benchmarkId) {
    const { data: items, error: itemsError } = await supabase
        .from('benchmark_items')
        .select('*')
        .eq('benchmark_id', benchmarkId);

    if (itemsError) throw itemsError;
    if (!items?.length) return { criteriaInserted: 0, scoresInserted: 0 };

    const { error: delError } = await supabase
        .from('benchmark_criteria')
        .delete()
        .eq('benchmark_id', benchmarkId)
        .eq('source', 'auto');

    if (delError) throw delError;

    const { criteria, scores: scoreRows } = buildAutoCriteriaPlan(items);
    if (criteria.length === 0) return { criteriaInserted: 0, scoresInserted: 0 };

    const { data: insertedCriteria, error: critErr } = await supabase
        .from('benchmark_criteria')
        .insert(
            criteria.map((c) => ({
                benchmark_id: benchmarkId,
                criterion_name: c.criterion_name,
                description: c.description,
                category: c.category,
                weight: c.weight,
                measurement_unit: c.measurement_unit,
                scoring_method: c.scoring_method,
                order_index: c.order_index,
                source: 'auto',
                include_in_matrix: true,
            }))
        )
        .select('id, criterion_name');

    if (critErr) throw critErr;

    const nameToId = {};
    for (const row of insertedCriteria || []) {
        nameToId[row.criterion_name] = row.id;
    }

    const keyToId = {};
    for (const c of criteria) {
        const id = nameToId[c.criterion_name];
        if (id) keyToId[c.tempKey] = id;
    }

    const toInsert = [];
    for (const s of scoreRows) {
        const criterionId = keyToId[s.tempCriterionKey];
        if (!criterionId) continue;
        toInsert.push({
            benchmark_item_id: s.benchmark_item_id,
            criterion_id: criterionId,
            raw_value: s.raw_value,
            normalized_score: s.normalized_score,
            weighted_score: s.weighted_score,
        });
    }

    if (toInsert.length === 0) return { criteriaInserted: insertedCriteria?.length ?? 0, scoresInserted: 0 };

    const { error: scErr } = await supabase.from('benchmark_scores').insert(toInsert);
    if (scErr) throw scErr;

    return { criteriaInserted: insertedCriteria?.length ?? 0, scoresInserted: toInsert.length };
}

/**
 * Formdaki henüz ID’si olmayan alternatifler için önizleme (sıralama).
 */
export function previewRankingFromDraftAlternatives(alternatives) {
    if (!alternatives?.length) return [];
    const mockItems = alternatives.map((a, idx) => ({
        id: `draft_${idx}`,
        ...a,
        unit_price: a.unit_price === '' ? null : Number(a.unit_price),
        total_cost_of_ownership: a.total_cost_of_ownership === '' ? null : Number(a.total_cost_of_ownership),
        roi_percentage: a.roi_percentage === '' ? null : Number(a.roi_percentage),
        maintenance_cost: a.maintenance_cost === '' ? null : Number(a.maintenance_cost),
        quality_score: a.quality_score === '' ? null : Number(a.quality_score),
        performance_score: a.performance_score === '' ? null : Number(a.performance_score),
        reliability_score: a.reliability_score === '' ? null : Number(a.reliability_score),
        after_sales_service_score: a.after_sales_service_score === '' ? null : Number(a.after_sales_service_score),
        warranty_period_months: a.warranty_period_months === '' ? null : Number(a.warranty_period_months),
        technical_support_score: a.technical_support_score === '' ? null : Number(a.technical_support_score),
        delivery_time_days: a.delivery_time_days === '' ? null : Number(a.delivery_time_days),
        lead_time_days: a.lead_time_days === '' ? null : Number(a.lead_time_days),
        implementation_time_days: a.implementation_time_days === '' ? null : Number(a.implementation_time_days),
        training_required_hours: a.training_required_hours === '' ? null : Number(a.training_required_hours),
        energy_efficiency_score: a.energy_efficiency_score === '' ? null : Number(a.energy_efficiency_score),
        environmental_impact_score: a.environmental_impact_score === '' ? null : Number(a.environmental_impact_score),
        ease_of_use_score: a.ease_of_use_score === '' ? null : Number(a.ease_of_use_score),
        documentation_quality_score: a.documentation_quality_score === '' ? null : Number(a.documentation_quality_score),
        scalability_score: a.scalability_score === '' ? null : Number(a.scalability_score),
        compatibility_score: a.compatibility_score === '' ? null : Number(a.compatibility_score),
        innovation_score: a.innovation_score === '' ? null : Number(a.innovation_score),
        market_reputation_score: a.market_reputation_score === '' ? null : Number(a.market_reputation_score),
        customer_references_count: a.customer_references_count === '' ? null : Number(a.customer_references_count),
        risk_level: a.risk_level || null,
    }));

    const ranked = mockItems
        .map((item) => ({
            item_name: item.item_name,
            total: calculateAutoScoreFromItems(item, mockItems),
        }))
        .sort((a, b) => b.total - a.total);

    return ranked;
}

/**
 * Doldurulmuş alanlara göre hangi metriklerin karşılaştırmaya dahil olacağını listeler.
 */
export function listActiveComparisonsFromDraft(alternatives) {
    if (!alternatives?.length || alternatives.length < 2) return [];
    const mockItems = alternatives.map((a, idx) => ({
        id: `draft_${idx}`,
        ...a,
        unit_price: a.unit_price === '' ? null : Number(a.unit_price),
        total_cost_of_ownership: a.total_cost_of_ownership === '' ? null : Number(a.total_cost_of_ownership),
        roi_percentage: a.roi_percentage === '' ? null : Number(a.roi_percentage),
        maintenance_cost: a.maintenance_cost === '' ? null : Number(a.maintenance_cost),
        quality_score: a.quality_score === '' ? null : Number(a.quality_score),
        performance_score: a.performance_score === '' ? null : Number(a.performance_score),
        reliability_score: a.reliability_score === '' ? null : Number(a.reliability_score),
        after_sales_service_score: a.after_sales_service_score === '' ? null : Number(a.after_sales_service_score),
        warranty_period_months: a.warranty_period_months === '' ? null : Number(a.warranty_period_months),
        technical_support_score: a.technical_support_score === '' ? null : Number(a.technical_support_score),
        delivery_time_days: a.delivery_time_days === '' ? null : Number(a.delivery_time_days),
        lead_time_days: a.lead_time_days === '' ? null : Number(a.lead_time_days),
        implementation_time_days: a.implementation_time_days === '' ? null : Number(a.implementation_time_days),
        training_required_hours: a.training_required_hours === '' ? null : Number(a.training_required_hours),
        energy_efficiency_score: a.energy_efficiency_score === '' ? null : Number(a.energy_efficiency_score),
        environmental_impact_score: a.environmental_impact_score === '' ? null : Number(a.environmental_impact_score),
        ease_of_use_score: a.ease_of_use_score === '' ? null : Number(a.ease_of_use_score),
        documentation_quality_score: a.documentation_quality_score === '' ? null : Number(a.documentation_quality_score),
        scalability_score: a.scalability_score === '' ? null : Number(a.scalability_score),
        compatibility_score: a.compatibility_score === '' ? null : Number(a.compatibility_score),
        innovation_score: a.innovation_score === '' ? null : Number(a.innovation_score),
        market_reputation_score: a.market_reputation_score === '' ? null : Number(a.market_reputation_score),
        customer_references_count: a.customer_references_count === '' ? null : Number(a.customer_references_count),
        risk_level: a.risk_level || null,
    }));

    const active = [];
    for (const def of BENCHMARK_METRIC_FIELDS) {
        let filled = 0;
        for (const item of mockItems) {
            const n = computeFieldNormalizedScore(item, def, mockItems);
            if (n != null && !Number.isNaN(n)) filled++;
        }
        if (filled >= 2) active.push(def.label);
    }
    return active;
}
