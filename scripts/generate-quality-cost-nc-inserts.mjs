#!/usr/bin/env node
/**
 * MCP'den alınan maliyet JSON'u → INSERT SQL üretir (service role MCP ile çalıştırılır).
 * Kullanım: node scripts/generate-quality-cost-nc-inserts.mjs /path/to/costs.json
 */
import fs from 'fs';
import { buildQualityCostNcRecord } from '../src/lib/qualityCostNcRecordBuilder.js';

const COST_TYPE_METRIC = {
    'Hurda Maliyeti': 'Hurda Maliyeti',
    'Yeniden İşlem Maliyeti': 'Yeniden İşlem Maliyeti',
    'Fire Maliyeti': 'Fire Ağırlığı',
};

const esc = (v) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return `'${String(v).replace(/'/g, "''")}'`;
};

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('JSON dosya yolu gerekli');
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.result || raw.data || [];

console.log('BEGIN;');

for (const cost of rows) {
    const ncType = cost.suggestion;
    if (!ncType || ncType === 'MDI') continue;

    const ctx = {
        vehicleType: cost.vehicle_type || '',
        metricLabel: COST_TYPE_METRIC[cost.cost_type] || cost.cost_type,
        dateRangeLabel: 'Tüm Zamanlar',
    };

    const payload = buildQualityCostNcRecord(cost, {
        ncType,
        analysisContext: ctx,
        allCosts: rows,
        autoComplete: true,
    });
    if (!payload) continue;

    const ncNumberExpr = `(SELECT generate_nc_number('${ncType}'::text))`;

    const cols = [
        'nc_number', 'type', 'title', 'description', 'status', 'priority',
        'department', 'requesting_unit', 'requesting_person', 'responsible_person',
        'opening_date', 'df_opened_at', 'due_date', 'due_at',
        'source_cost_id', 'part_name', 'part_code', 'vehicle_type',
        'amount', 'cost_date', 'cost_type', 'material_type', 'measurement_unit',
        'quantity', 'scrap_weight', 'rework_duration', 'quality_control_duration',
        'responsible_personnel_id', 'supplier_id', 'is_supplier_nc',
        'problem_definition', 'root_cause',
        'five_why_analysis', 'five_n1k_analysis', 'ishikawa_analysis',
        'eight_d_steps', 'eight_d_progress', 'closing_notes', 'closed_at',
        'attachments', 'closing_attachments',
    ];

    const vals = [
        ncNumberExpr,
        esc(payload.type),
        esc(payload.title),
        esc(payload.description),
        esc(payload.status),
        esc(payload.priority),
        esc(payload.department),
        esc(payload.requesting_unit),
        esc(payload.requesting_person),
        esc(payload.responsible_person),
        esc(payload.opening_date),
        esc(payload.df_opened_at),
        esc(payload.due_date),
        esc(payload.due_at),
        esc(payload.source_cost_id),
        esc(payload.part_name),
        esc(payload.part_code),
        esc(payload.vehicle_type),
        payload.amount ?? 'NULL',
        payload.cost_date ? esc(payload.cost_date) : 'NULL',
        esc(payload.cost_type),
        esc(payload.material_type),
        esc(payload.measurement_unit),
        payload.quantity ?? 'NULL',
        payload.scrap_weight ?? 'NULL',
        payload.rework_duration ?? 'NULL',
        payload.quality_control_duration ?? 'NULL',
        payload.responsible_personnel_id ? esc(payload.responsible_personnel_id) : 'NULL',
        payload.supplier_id ? esc(payload.supplier_id) : 'NULL',
        payload.is_supplier_nc ? 'true' : 'false',
        esc(payload.problem_definition),
        esc(payload.root_cause),
        esc(payload.five_why_analysis),
        esc(payload.five_n1k_analysis),
        esc(payload.ishikawa_analysis),
        payload.eight_d_steps ? esc(payload.eight_d_steps) : 'NULL',
        payload.eight_d_progress ? esc(payload.eight_d_progress) : 'NULL',
        esc(payload.closing_notes),
        esc(payload.closed_at),
        `'[]'::jsonb`,
        `'[]'::jsonb`,
    ];

    console.log(`INSERT INTO non_conformities (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
}

console.log('COMMIT;');
