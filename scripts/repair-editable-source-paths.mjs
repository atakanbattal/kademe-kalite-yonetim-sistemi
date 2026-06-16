#!/usr/bin/env node
/**
 * Yanlış storage konumuna yüklenmiş kaynak dosyalarını DB path'ine taşır.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { isEditableOfficeSource } from '../src/lib/editableSourceCodePatch.js';

const BUCKET = 'documents';

function loadEnvLocal() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        const val = m[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

loadEnvLocal();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY
);

function storageDownloadPaths(attachmentPath) {
    const normalized = String(attachmentPath || '').replace(/^\/+/, '');
    const variants = [normalized];
    if (normalized.startsWith(`${BUCKET}/`)) {
        variants.push(normalized.slice(BUCKET.length + 1));
    } else {
        variants.push(`${BUCKET}/${normalized}`);
    }
    return [...new Set(variants)];
}

async function downloadAt(pathCandidates) {
    for (const candidate of pathCandidates) {
        const { data, error } = await supabase.storage.from(BUCKET).download(candidate);
        if (!error && data) return { data, from: candidate };
    }
    return null;
}

let from = 0;
let fixed = 0;
let ok = 0;
let failed = 0;

while (true) {
    const { data, error } = await supabase
        .from('documents')
        .select('id, document_number, document_revisions!documents_current_revision_id_fkey(id, attachments)')
        .not('document_number', 'is', null)
        .not('current_revision_id', 'is', null)
        .eq('is_archived', false)
        .range(from, from + 99);

    if (error) throw error;
    if (!data?.length) break;

    for (const doc of data) {
        const rev = doc.document_revisions;
        const sources = (rev?.attachments || []).filter((a) => a.role === 'source' && isEditableOfficeSource(a.name, a.type));
        for (const source of sources) {
            const dbPath = source.path;
            const direct = await downloadAt([dbPath]);
            if (direct) {
                ok += 1;
                continue;
            }

            const fallback = await downloadAt(storageDownloadPaths(dbPath).filter((p) => p !== dbPath));
            if (!fallback) {
                failed += 1;
                console.error('✗', doc.document_number, dbPath);
                continue;
            }

            const buf = await fallback.data.arrayBuffer();
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(dbPath, buf, {
                upsert: true,
                contentType: source.type || 'application/octet-stream',
            });
            if (upErr) {
                failed += 1;
                console.error('✗ upload', doc.document_number, upErr.message);
                continue;
            }

            await supabase.storage.from(BUCKET).remove([fallback.from]);
            fixed += 1;
            console.log('✓', doc.document_number, fallback.from, '→', dbPath);
        }
    }

    if (data.length < 100) break;
    from += 100;
}

console.log('\n--- Özet ---');
console.log('Zaten doğru:', ok);
console.log('Taşındı:', fixed);
console.log('Hata:', failed);
