#!/usr/bin/env node
/**
 * Eşik altında açılmış DF/8D kayıtlarını düzeltir:
 * - Öneri null → sil
 * - 8D ama öneri DF → DF'ye dönüştür
 * - 8D ama öneri 8D / DF ama öneri DF → koru
 *
 * Önizleme: DRY_RUN=1 node scripts/fix-quality-cost-nc-thresholds.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { getCostNcSuggestion, normalizeQualityCostSuggestionSettings } from '../src/lib/qualityCostSuggestion.js';
import { buildQualityCostNcAnalysisPatch } from '../src/lib/qualityCostNcRecordBuilder.js';

const METRIC_LABELS = {
    scrap_cost_per_vehicle: 'Hurda Maliyeti',
    rework_cost_per_vehicle: 'Yeniden İşlem Maliyeti',
    waste_kg_per_vehicle: 'Fire Ağırlığı',
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

async function fetchAll(supabase, table, select = '*') {
    const all = [];
    let from = 0;
    const page = 500;
    for (;;) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + page - 1);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...data);
        if (data.length < page) break;
        from += page;
    }
    return all;
}

async function main() {
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: settingsRow } = await supabase
        .from('quality_cost_suggestion_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    const settings = normalizeQualityCostSuggestionSettings(settingsRow);

    const costs = await fetchAll(
        supabase,
        'quality_costs',
        '*',
        (c) => ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti'].includes(c?.cost_type)
    );
    const costPool = costs.filter((c) =>
        ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti'].includes(c.cost_type)
    );

    const ncs = await fetchAll(
        supabase,
        'non_conformities',
        'id, nc_number, type, status, source_cost_id, department'
    );
    const linkedNcs = ncs.filter((nc) => nc.source_cost_id);

    const costById = new Map(costPool.map((c) => [c.id, c]));

    let deleted = 0;
    let converted = 0;
    let kept = 0;
    let failed = 0;

    console.log('Eşikler:', {
        df: settings.df_cost_threshold_try,
        eightD: settings.eight_d_cost_threshold_try,
        dfRecurrence: settings.df_recurrence_threshold,
        eightDRecurrence: settings.eight_d_recurrence_threshold,
    });
    console.log(dryRun ? '*** DRY RUN ***\n' : '*** GERÇEK ÇALIŞTIRMA ***\n');

    for (const nc of linkedNcs) {
        const cost = costById.get(nc.source_cost_id);
        if (!cost) {
            console.warn(`Maliyet yok, atlanıyor: ${nc.nc_number}`);
            continue;
        }

        const suggestion = getCostNcSuggestion(cost, costPool, settings);
        const amt = parseFloat(cost.amount) || 0;

        // Öneri yok veya MDI → gereksiz kayıt, sil
        if (!suggestion || suggestion === 'MDI') {
            console.log(
                `${dryRun ? '[DRY] ' : ''}DELETE ${nc.nc_number} (${nc.type}, ₺${amt}) — eşik altı`
            );
            if (!dryRun) {
                const { error } = await supabase.from('non_conformities').delete().eq('id', nc.id);
                if (error) {
                    console.error(`  Hata: ${error.message}`);
                    failed += 1;
                } else {
                    deleted += 1;
                }
            } else {
                deleted += 1;
            }
            continue;
        }

        // 8D açılmış ama öneri DF → dönüştür
        if (nc.type === '8D' && suggestion === 'DF') {
            console.log(
                `${dryRun ? '[DRY] ' : ''}CONVERT ${nc.nc_number} → DF (₺${amt})`
            );

            if (dryRun) {
                converted += 1;
                continue;
            }

            const { data: newNumber, error: rpcError } = await supabase.rpc('generate_nc_number', {
                nc_type: 'DF',
            });
            if (rpcError) {
                console.error(`  RPC hata: ${rpcError.message}`);
                failed += 1;
                continue;
            }

            const metricKey = resolveMetricKey(cost);
            const ctx = {
                vehicleType: cost.vehicle_type || '',
                metricKey,
                metricLabel: METRIC_LABELS[metricKey] || cost.cost_type,
                dateRangeLabel: 'Tüm Zamanlar',
            };

            const patch = buildQualityCostNcAnalysisPatch(
                cost,
                { ...nc, type: 'DF' },
                ctx,
                { autoComplete: true }
            );

            const { error: updateError } = await supabase
                .from('non_conformities')
                .update({
                    ...patch,
                    type: 'DF',
                    nc_number: newNumber,
                    eight_d_steps: null,
                    eight_d_progress: null,
                })
                .eq('id', nc.id);

            if (updateError) {
                console.error(`  Update hata: ${updateError.message}`);
                failed += 1;
            } else {
                console.log(`  → ${newNumber}`);
                converted += 1;
            }
            continue;
        }

        kept += 1;
    }

    console.log('\n--- Özet ---');
    console.log(`Bağlı NC: ${linkedNcs.length}`);
    console.log(`Silinen: ${deleted}`);
    console.log(`Dönüştürülen: ${converted}`);
    console.log(`Uygun (korunan): ${kept}`);
    console.log(`Hata: ${failed}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
