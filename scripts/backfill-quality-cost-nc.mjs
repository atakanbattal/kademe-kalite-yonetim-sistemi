#!/usr/bin/env node
/**
 * Öneri eşiklerine uyan kalite maliyeti kayıtları için DF/8D oluşturur,
 * 5 Neden / kök neden analizlerini doldurur ve kapatır.
 * Mevcut açık bağlı kayıtları da günceller.
 *
 * Önizleme: DRY_RUN=1 node scripts/backfill-quality-cost-nc.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { buildQualityCostNcRecord, buildQualityCostNcAnalysisPatch } from '../src/lib/qualityCostNcRecordBuilder.js';
import { getCostNcSuggestion, normalizeQualityCostSuggestionSettings } from '../src/lib/qualityCostSuggestion.js';

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

async function fetchAll(supabase, table, select = '*', filters = () => true) {
    const all = [];
    let from = 0;
    const page = 500;
    for (;;) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + page - 1);
        if (error) throw error;
        const rows = (data || []).filter(filters);
        all.push(...rows);
        if (!data?.length || data.length < page) break;
        from += page;
    }
    return all;
}

async function main() {
    if (!url || !key) {
        console.error('VITE_SUPABASE_URL ve service/anon key gerekli.');
        process.exit(1);
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: settingsRow } = await supabase
        .from('quality_cost_suggestion_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    const settings = normalizeQualityCostSuggestionSettings(settingsRow);

    console.log('Öneri eşikleri:', settings);
    console.log(dryRun ? '*** DRY RUN ***' : '*** GERÇEK ÇALIŞTIRMA ***');

    const costs = await fetchAll(
        supabase,
        'quality_costs',
        '*',
        (c) => ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti'].includes(c.cost_type)
    );

    const existingNcs = await fetchAll(
        supabase,
        'non_conformities',
        'id, source_cost_id, type, status, nc_number, five_why_analysis',
        (nc) => Boolean(nc.source_cost_id)
    );

    const ncByCostId = new Map();
    for (const nc of existingNcs) {
        if (!ncByCostId.has(nc.source_cost_id)) ncByCostId.set(nc.source_cost_id, []);
        ncByCostId.get(nc.source_cost_id).push(nc);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // 1) Yeni kayıt oluştur
    for (const cost of costs) {
        const suggestion = getCostNcSuggestion(cost, costs, settings);
        if (!suggestion || suggestion === 'MDI') {
            skipped += 1;
            continue;
        }

        const linked = ncByCostId.get(cost.id) || [];
        if (linked.length > 0) {
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

        const payload = buildQualityCostNcRecord(cost, {
            ncType: suggestion,
            analysisContext: ctx,
            suggestionSettings: settings,
            allCosts: costs,
            autoComplete: true,
        });

        if (!payload) {
            skipped += 1;
            continue;
        }

        console.log(
            `${dryRun ? '[DRY] ' : ''}CREATE ${suggestion} ← cost ${cost.id.slice(0, 8)}… ${cost.cost_type} ${cost.part_name || cost.part_code || ''} ${cost.amount}₺`
        );

        if (dryRun) {
            created += 1;
            continue;
        }

        const { data: ncNumber, error: rpcError } = await supabase.rpc('generate_nc_number', {
            nc_type: payload.type,
        });
        if (rpcError) {
            console.error('RPC hata:', rpcError.message);
            failed += 1;
            continue;
        }

        const { error: insertError } = await supabase.from('non_conformities').insert({
            ...payload,
            nc_number: ncNumber,
        });

        if (insertError) {
            console.error('Insert hata:', insertError.message, cost.id);
            failed += 1;
        } else {
            created += 1;
            console.log(`  → ${ncNumber} oluşturuldu ve kapatıldı`);
        }
    }

    // 2) Mevcut kayıtları güncelle (açık veya analizi eksik kapalı)
    for (const nc of existingNcs) {
        if (nc.status === 'Reddedildi') continue;

        const cost = costs.find((c) => c.id === nc.source_cost_id);
        if (!cost) continue;

        const hasFiveWhy =
            nc.five_why_analysis &&
            typeof nc.five_why_analysis === 'object' &&
            Object.values(nc.five_why_analysis).some((v) => v && String(v).trim());

        if (hasFiveWhy) continue;

        const metricKey = resolveMetricKey(cost);
        const ctx = {
            vehicleType: cost.vehicle_type || '',
            metricKey,
            metricLabel: METRIC_LABELS[metricKey] || cost.cost_type,
            dateRangeLabel: 'Tüm Zamanlar',
        };

        const patch = buildQualityCostNcAnalysisPatch(cost, nc, ctx, { autoComplete: true });

        console.log(
            `${dryRun ? '[DRY] ' : ''}UPDATE ${nc.nc_number || nc.id.slice(0, 8)} ← analiz + kapat`
        );

        if (dryRun) {
            updated += 1;
            continue;
        }

        const { error } = await supabase.from('non_conformities').update(patch).eq('id', nc.id);
        if (error) {
            console.error('Update hata:', error.message, nc.id);
            failed += 1;
        } else {
            updated += 1;
        }
    }

    console.log('\n--- Özet ---');
    console.log(`Taranan maliyet: ${costs.length}`);
    console.log(`Oluşturulan: ${created}`);
    console.log(`Güncellenen: ${updated}`);
    console.log(`Atlanan: ${skipped}`);
    console.log(`Hata: ${failed}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
