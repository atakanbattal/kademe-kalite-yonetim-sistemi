#!/usr/bin/env node
/**
 * Bağlı kalite maliyeti DF/8D kayıtlarının analiz alanlarını
 * güncel şablonlarla yeniden üretir (açıklama odaklı).
 *
 * Önizleme: DRY_RUN=1 node scripts/reconcile-quality-cost-nc-analyses.mjs
 * Tek kayıt: NC_NUMBER=DF-2026-141 node scripts/reconcile-quality-cost-nc-analyses.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { buildQualityCostNcAnalysisPatch } from '../src/lib/qualityCostNcRecordBuilder.js';

const METRIC_LABELS = {
    scrap_cost_per_vehicle: 'Hurda Maliyeti',
    rework_cost_per_vehicle: 'Yeniden İşlem Maliyeti',
    scrap_kg_per_vehicle: 'Hurda Ağırlığı',
    waste_kg_per_vehicle: 'Fire Ağırlığı',
    rejection_count_per_vehicle: 'Ret Adedi',
};

const COST_TYPE_METRIC = {
    'Hurda Maliyeti': 'scrap_cost_per_vehicle',
    'Yeniden İşlem Maliyeti': 'rework_cost_per_vehicle',
    'Fire Maliyeti': 'waste_kg_per_vehicle',
};

function resolveMetricKey(cost) {
    return COST_TYPE_METRIC[cost?.cost_type] || 'scrap_cost_per_vehicle';
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const defaultServiceKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';
const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    defaultServiceKey;

const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const filterNcNumber = process.env.NC_NUMBER || null;

async function main() {
    if (!url || !key) {
        console.error('VITE_SUPABASE_URL ve service key gerekli.');
        process.exit(1);
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    let ncQuery = supabase
        .from('non_conformities')
        .select('id, nc_number, type, status, source_cost_id, department, five_why_analysis')
        .not('source_cost_id', 'is', null);

    if (filterNcNumber) {
        ncQuery = ncQuery.eq('nc_number', filterNcNumber);
    }

    const { data: ncs, error: ncError } = await ncQuery;
    if (ncError) throw ncError;

    const costIds = [...new Set((ncs || []).map((nc) => nc.source_cost_id).filter(Boolean))];
    const { data: costs, error: costError } = await supabase
        .from('quality_costs')
        .select('*')
        .in('id', costIds);
    if (costError) throw costError;

    const costById = new Map((costs || []).map((c) => [c.id, c]));

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const nc of ncs || []) {
        if (nc.status === 'Reddedildi') {
            skipped += 1;
            continue;
        }

        const cost = costById.get(nc.source_cost_id);
        if (!cost) {
            console.warn(`Maliyet bulunamadı: ${nc.nc_number} → ${nc.source_cost_id}`);
            skipped += 1;
            continue;
        }

        const metricKey = resolveMetricKey(cost);
        const ctx = {
            vehicleType: cost.vehicle_type || '',
            metricKey,
            metricLabel: METRIC_LABELS[metricKey] || cost.cost_type,
            dateRangeLabel: 'Tüm Zamanlar',
        };

        const patch = buildQualityCostNcAnalysisPatch(cost, nc, ctx, { autoComplete: true });
        const problemPreview = patch.problem_definition?.slice(0, 80) || '';

        console.log(
            `${dryRun ? '[DRY] ' : ''}UPDATE ${nc.nc_number} ← ${problemPreview}${problemPreview.length >= 80 ? '…' : ''}`
        );

        if (dryRun) {
            updated += 1;
            continue;
        }

        const { error } = await supabase.from('non_conformities').update(patch).eq('id', nc.id);
        if (error) {
            console.error(`  Hata: ${error.message}`);
            failed += 1;
        } else {
            updated += 1;
        }
    }

    console.log('\n--- Özet ---');
    console.log(`Taranan NC: ${(ncs || []).length}`);
    console.log(`Güncellenen: ${updated}`);
    console.log(`Atlanan: ${skipped}`);
    console.log(`Hata: ${failed}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
