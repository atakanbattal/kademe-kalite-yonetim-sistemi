#!/usr/bin/env node
/**
 * HTML süreç akış dosyasından birim süreçlerini senkronize eder (şema/özellik değiştirmez).
 * Yalnızca process_flow_units meta + flows/steps/doc linkleri güncellenir.
 *
 *   PROCESS_FLOW_HTML=/path/to.html UNIT_CODES=ARG node scripts/sync-process-flow-from-html.mjs
 *   PROCESS_FLOW_HTML=... UNIT_CODES=ARG node scripts/sync-process-flow-from-html.mjs --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const htmlPath = process.env.PROCESS_FLOW_HTML;
const unitCodes = (process.env.UNIT_CODES || '').split(',').map((s) => s.trim()).filter(Boolean);
const apply = process.argv.includes('--apply');

function splitDocumentCode(raw) {
    const t = String(raw || '').trim();
    const m = t.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü0-9-]+)(?:\s+(§.+))?$/u);
    if (!m) return { document_code: t, section_ref: null };
    return { document_code: m[1], section_ref: m[2]?.trim() || null };
}

async function loadDocumentMap(supabase) {
    const map = new Map();
    const { data, error } = await supabase.from('documents').select('id, document_number').not('document_number', 'is', null);
    if (error) throw error;
    for (const row of data || []) map.set(row.document_number.trim(), row.id);
    return map;
}

async function deleteUnitFlows(supabase, unitId) {
    const { data: flows, error } = await supabase.from('process_flows').select('id').eq('unit_id', unitId);
    if (error) throw error;
    const flowIds = (flows || []).map((f) => f.id);
    if (!flowIds.length) return;

    const { data: steps, error: stepErr } = await supabase.from('process_flow_steps').select('id').in('flow_id', flowIds);
    if (stepErr) throw stepErr;
    const stepIds = (steps || []).map((s) => s.id);

    if (stepIds.length) {
        const { error: docDelErr } = await supabase.from('process_flow_step_documents').delete().in('step_id', stepIds);
        if (docDelErr) throw docDelErr;
        const { error: stepDelErr } = await supabase.from('process_flow_steps').delete().in('id', stepIds);
        if (stepDelErr) throw stepDelErr;
    }
    const { error: flowDelErr } = await supabase.from('process_flows').delete().in('id', flowIds);
    if (flowDelErr) throw flowDelErr;
}

async function insertUnitFlows(supabase, unitId, flows, docMap) {
    for (const flow of flows) {
        const { data: flowRow, error: flowError } = await supabase
            .from('process_flows')
            .insert({
                unit_id: unitId,
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
            }
        }
    }
}

async function main() {
    if (!htmlPath || !fs.existsSync(htmlPath)) {
        console.error('PROCESS_FLOW_HTML geçerli bir dosya olmalı');
        process.exit(1);
    }
    if (!key) {
        console.error('SUPABASE_SERVICE_ROLE_KEY gerekli');
        process.exit(1);
    }

    const parseScript = path.join(__dirname, 'parse-process-flow-html.mjs');
    const tempSeed = path.join(__dirname, '.process-flow-sync-seed.json');

    process.env.PROCESS_FLOW_HTML_PATH = htmlPath;
    process.env.PROCESS_FLOW_SEED_OUT = tempSeed;

    await import(`${pathToFileURL(parseScript).href}?sync=${Date.now()}`);

    const seed = JSON.parse(fs.readFileSync(tempSeed, 'utf8'));
    const units = unitCodes.length
        ? seed.units.filter((u) => unitCodes.includes(u.code))
        : seed.units;

    if (!units.length) {
        console.error('Eşleşen birim bulunamadı. UNIT_CODES=', unitCodes.join(','));
        process.exit(1);
    }

    const supabase = createClient(url, key);
    const docMap = await loadDocumentMap(supabase);

    console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — ${units.length} birim senkronize edilecek`);

    for (const unit of units) {
        const { data: existing, error: findErr } = await supabase
            .from('process_flow_units')
            .select('id, code')
            .eq('code', unit.code)
            .maybeSingle();
        if (findErr) throw findErr;

        const flowCount = unit.flows.length;
        const stepCount = unit.flows.reduce((n, f) => n + f.steps.length, 0);
        console.log(`\n${unit.code} — ${flowCount} akış, ${stepCount} adım`);

        if (!apply) continue;

        let unitId = existing?.id;
        if (!unitId) {
            const { data: inserted, error: insErr } = await supabase
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
            if (insErr) throw insErr;
            unitId = inserted.id;
        } else {
            const { error: updErr } = await supabase
                .from('process_flow_units')
                .update({
                    name: unit.name,
                    subtitle: unit.subtitle,
                    owner_role: unit.owner_role,
                    roles: unit.roles,
                    purpose: unit.purpose,
                    is_ideal_process: unit.is_ideal_process,
                    key_document_codes: unit.key_document_codes || [],
                })
                .eq('id', unitId);
            if (updErr) throw updErr;
            await deleteUnitFlows(supabase, unitId);
        }

        await insertUnitFlows(supabase, unitId, unit.flows, docMap);
        console.log(`✓ ${unit.code} senkronize edildi`);
    }

    try { fs.unlinkSync(tempSeed); } catch { /* ignore */ }
    console.log('\nBitti.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
