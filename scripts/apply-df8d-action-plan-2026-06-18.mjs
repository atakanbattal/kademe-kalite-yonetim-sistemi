#!/usr/bin/env node
/**
 * DF_8D_Aksiyon_Plani Excel kararlarını uygular:
 * - SİL → non_conformities kaydını sil (bağlantıları temizle)
 * - YENİDEN SINIFLANDIR (DF) → 8D kaydını DF'ye çevir
 *
 * Önizleme: DRY_RUN=1 node scripts/apply-df8d-action-plan-2026-06-18.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { buildQualityCostNcAnalysisPatch } from '../src/lib/qualityCostNcRecordBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXCEL_DEFAULT =
    '/Users/atakanbattal/Desktop/KademeQMS_DF8D_Klasor_2026-06-18_0957/DF_8D_Aksiyon_Plani_2026-06-18.xlsx';

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

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const excelPath = process.argv.find((a) => a.endsWith('.xlsx')) || EXCEL_DEFAULT;

async function loadActionPlan() {
    const { spawnSync } = await import('child_process');
    const py = spawnSync(
        'python3',
        [
            '-c',
            `
import json, pandas as pd
df = pd.read_excel(${JSON.stringify(excelPath)}, sheet_name='Aksiyon Listesi')
out = {
  'delete': df[df['KARAR']=='SİL']['No'].dropna().astype(str).tolist(),
  'reclassify': df[df['KARAR'].astype(str).str.contains('SINIFLANDIR', na=False)]['No'].dropna().astype(str).tolist(),
  'keep_open': df[df['KARAR']=='Değişiklik Yapma']['No'].dropna().astype(str).tolist(),
}
print(json.dumps(out, ensure_ascii=False))
`,
        ],
        { encoding: 'utf8' }
    );
    if (py.status !== 0) throw new Error(py.stderr || py.stdout);
    return JSON.parse(py.stdout.trim());
}

async function unlinkNcReferences(supabase, ncId) {
    const tables = [
        { table: 'customer_complaints', column: 'related_nc_id' },
        { table: 'benchmarks', column: 'related_nc_id' },
        { table: 'lot_traceability', column: 'related_nc_id' },
        { table: 'supplier_documents', column: 'related_nc_id' },
        { table: 'process_control_notes', column: 'related_nc_id' },
        { table: 'tasks', column: 'related_df_id' },
    ];
    for (const { table, column } of tables) {
        const { error } = await supabase.from(table).update({ [column]: null }).eq(column, ncId);
        if (error) throw new Error(`${table}.${column}: ${error.message}`);
    }
}

async function deleteNc(supabase, nc) {
    if (dryRun) {
        console.log(`[DRY] DELETE ${nc.nc_number} (${nc.status})`);
        return;
    }
    await unlinkNcReferences(supabase, nc.id);
    const { error } = await supabase.from('non_conformities').delete().eq('id', nc.id);
    if (error) throw new Error(`delete ${nc.nc_number}: ${error.message}`);
    console.log(`DELETE ${nc.nc_number}`);
}

async function convert8dToDf(supabase, nc, costById) {
    if (dryRun) {
        console.log(`[DRY] CONVERT ${nc.nc_number} → DF (${nc.status})`);
        return null;
    }

    const { data: newNumber, error: rpcError } = await supabase.rpc('generate_nc_number', { nc_type: 'DF' });
    if (rpcError) throw new Error(`generate_nc_number ${nc.nc_number}: ${rpcError.message}`);

    const cost = nc.source_cost_id ? costById.get(nc.source_cost_id) : null;
    let patch = {
        type: 'DF',
        nc_number: newNumber,
        eight_d_steps: null,
        eight_d_progress: null,
    };

    if (cost) {
        const metricKey = resolveMetricKey(cost);
        const ctx = {
            vehicleType: cost.vehicle_type || nc.vehicle_type || '',
            metricKey,
            metricLabel: METRIC_LABELS[metricKey] || cost.cost_type,
            dateRangeLabel: 'Tüm Zamanlar',
        };
        patch = {
            ...patch,
            ...buildQualityCostNcAnalysisPatch(cost, { ...nc, type: 'DF' }, ctx, { autoComplete: true }),
        };
    }

    const { error: updateError } = await supabase.from('non_conformities').update(patch).eq('id', nc.id);
    if (updateError) throw new Error(`convert ${nc.nc_number}: ${updateError.message}`);

    console.log(`CONVERT ${nc.nc_number} → ${newNumber}`);
    return newNumber;
}

async function main() {
    const plan = await loadActionPlan();
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    console.log(`Excel: ${excelPath}`);
    console.log(dryRun ? '*** DRY RUN ***\n' : '*** GERÇEK ÇALIŞTIRMA ***\n');
    console.log('Plan:', {
        delete: plan.delete.length,
        reclassify: plan.reclassify.length,
        keep_open: plan.keep_open.length,
    });

    const allNumbers = [...new Set([...plan.delete, ...plan.reclassify])];
    const { data: rows, error } = await supabase
        .from('non_conformities')
        .select('id, nc_number, type, status, source_cost_id, department, vehicle_type')
        .in('nc_number', allNumbers);
    if (error) throw error;

    const byNumber = new Map((rows || []).map((r) => [r.nc_number, r]));
    const missingDelete = plan.delete.filter((n) => !byNumber.has(n));
    const missingReclass = plan.reclassify.filter((n) => !byNumber.has(n));

    if (missingDelete.length) {
        console.warn('Silinecek ama DB\'de bulunamayan:', missingDelete.join(', '));
    }
    if (missingReclass.length) {
        console.warn('Dönüştürülecek ama DB\'de bulunamayan:', missingReclass.join(', '));
    }

    const costIds = [...new Set((rows || []).map((r) => r.source_cost_id).filter(Boolean))];
    let costById = new Map();
    if (costIds.length) {
        const { data: costs, error: costErr } = await supabase.from('quality_costs').select('*').in('id', costIds);
        if (costErr) throw costErr;
        costById = new Map((costs || []).map((c) => [c.id, c]));
    }

    let deleted = 0;
    let converted = 0;
    let failed = 0;

    for (const ncNumber of plan.reclassify) {
        const nc = byNumber.get(ncNumber);
        if (!nc) continue;
        if (nc.type !== '8D') {
            console.warn(`Atlandı (8D değil): ${ncNumber} type=${nc.type}`);
            continue;
        }
        try {
            await convert8dToDf(supabase, nc, costById);
            converted += 1;
        } catch (e) {
            console.error(e.message);
            failed += 1;
        }
    }

    for (const ncNumber of plan.delete) {
        const nc = byNumber.get(ncNumber);
        if (!nc) continue;
        try {
            await deleteNc(supabase, nc);
            deleted += 1;
        } catch (e) {
            console.error(e.message);
            failed += 1;
        }
    }

    console.log('\n--- Özet ---');
    console.log(`Silinen: ${deleted}${missingDelete.length ? ` (${missingDelete.length} zaten yoktu)` : ''}`);
    console.log(`Dönüştürülen: ${converted}${missingReclass.length ? ` (${missingReclass.length} zaten yoktu)` : ''}`);
    console.log(`Açık kayıt (Değişiklik Yapma, dokunulmadı): ${plan.keep_open.length}`);
    console.log(`KAPALI — UYGUN (dokunulmadı): Excel'de ayrı satır`);
    console.log(`Hata: ${failed}`);

    if (plan.keep_open.length) {
        console.log('\nAçık DF kayıtları (manuel tamamlanacak):');
        plan.keep_open.forEach((n) => console.log(`  - ${n}`));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
