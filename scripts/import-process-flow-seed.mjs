#!/usr/bin/env node
/**
 * HTML parse çıktısını (process-flow-seed.json) Supabase'e aktarır.
 * Önizleme: DRY_RUN=1 node scripts/import-process-flow-seed.mjs
 * Yeniden yükle: FORCE=1 node scripts/import-process-flow-seed.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, 'process-flow-seed.json');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY;

const dryRun = process.env.DRY_RUN === '1';
const force = process.env.FORCE === '1';

if (!key && !dryRun) {
    console.error('SUPABASE_SERVICE_ROLE_KEY gerekli');
    process.exit(1);
}

const supabase = key ? createClient(url, key) : null;

function splitDocumentCode(raw) {
    const t = String(raw || '').trim();
    const m = t.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü0-9-]+)(?:\s+(§.+))?$/u);
    if (!m) return { document_code: t, section_ref: null };
    return { document_code: m[1], section_ref: m[2]?.trim() || null };
}

async function loadDocumentMap() {
    const map = new Map();
    if (!supabase) return map;
    const { data, error } = await supabase
        .from('documents')
        .select('id, document_number')
        .not('document_number', 'is', null);
    if (error) throw error;
    for (const row of data || []) {
        if (row.document_number) map.set(row.document_number.trim(), row.id);
    }
    return map;
}

async function clearExisting() {
    if (!supabase) return;
    const tables = [
        'process_flow_step_documents',
        'process_flow_steps',
        'process_flows',
        'process_flow_units',
    ];
    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }
}

async function main() {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    const docMap = await loadDocumentMap();

    if (!force && supabase) {
        const { count, error } = await supabase.from('process_flow_units').select('*', { count: 'exact', head: true });
        if (error) throw error;
        if (count > 0) {
            console.log(`Zaten ${count} birim var. FORCE=1 ile yeniden yükle.`);
            return;
        }
    }

    if (dryRun) {
        console.log(`DRY RUN: ${seed.units.length} birim, ${seed.units.reduce((n, u) => n + u.flows.length, 0)} akış`);
        return;
    }

    if (force) await clearExisting();

    let stepDocCount = 0;
    for (const unit of seed.units) {
        const { data: unitRow, error: unitError } = await supabase
            .from('process_flow_units')
            .insert({
                code: unit.code,
                slug: unit.slug,
                name: unit.name,
                subtitle: unit.subtitle,
                owner_role: unit.owner_role,
                roles: unit.roles,
                purpose: unit.purpose,
                is_ideal_process: unit.is_ideal_process,
                key_document_codes: unit.key_document_codes || [],
                sort_order: unit.sort_order,
            })
            .select('id')
            .single();
        if (unitError) throw unitError;

        for (const flow of unit.flows) {
            const { data: flowRow, error: flowError } = await supabase
                .from('process_flows')
                .insert({
                    unit_id: unitRow.id,
                    title: flow.title,
                    intro: flow.intro,
                    header_document_codes: flow.header_document_codes || [],
                    sort_order: flow.sort_order,
                })
                .select('id')
                .single();
            if (flowError) throw flowError;

            for (const step of flow.steps) {
                const { data: stepRow, error: stepError } = await supabase
                    .from('process_flow_steps')
                    .insert({
                        flow_id: flowRow.id,
                        step_type: step.step_type,
                        text: step.text,
                        role: step.role || null,
                        decision_question: step.decision_question || null,
                        decision_yes_text: step.decision_yes_text || null,
                        decision_no_text: step.decision_no_text || null,
                        sort_order: step.sort_order,
                    })
                    .select('id')
                    .single();
                if (stepError) throw stepError;

                const docRows = (step.document_codes || []).map((raw, idx) => {
                    const { document_code, section_ref } = splitDocumentCode(raw);
                    return {
                        step_id: stepRow.id,
                        document_code,
                        section_ref,
                        document_id: docMap.get(document_code) || null,
                        sort_order: idx,
                    };
                });
                if (docRows.length) {
                    const { error: docError } = await supabase.from('process_flow_step_documents').insert(docRows);
                    if (docError) throw docError;
                    stepDocCount += docRows.length;
                }
            }
        }
        console.log(`✓ ${unit.code} — ${unit.name}`);
    }

    console.log(`\nTamamlandı: ${seed.units.length} birim, ${stepDocCount} adım-doküman bağlantısı`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
