#!/usr/bin/env node
/**
 * SheetJS ile bozulmuş .xls dosyalarını yerel kaynak klasöründen geri yükler.
 * Kullanım: node scripts/restore-xls-from-local.mjs
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { read, utils } from 'xlsx';
import { replaceDocumentCodeInXls, extractDocumentCodesFromXls } from '../src/lib/xlsDocumentCodeReplace.js';
import { buildDocumentCodeReplacementsForTarget } from '../src/lib/docxDocumentCodeReplace.js';
import { resolveEditableSourceMimeType } from '../src/lib/documentRevisionAttachments.js';

const LOCAL_ROOT = '/Users/atakanbattal/Desktop/KademeQMS_Dokumanlar-2/Çalışma Sonrası/KademeQMS_Dokumanlar-3';
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
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4'
);

function findLocalXls(documentNumber, title) {
    const matches = [];
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.xls$/i.test(entry.name) && entry.name.startsWith(`${documentNumber} -`)) {
                matches.push(full);
            }
        }
    }
    walk(LOCAL_ROOT);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
        const byTitle = matches.find((p) => p.toLowerCase().includes(title.toLowerCase().slice(0, 20)));
        return byTitle || matches[0];
    }
    return null;
}

function mergeCount(buf) {
    const wb = read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return ws?.['!merges']?.length || 0;
}

async function fetchXlsDocs() {
    let from = 0;
    const rows = [];
    while (true) {
        const { data, error } = await supabase
            .from('documents')
            .select('id, title, document_number, current_revision_id, document_revisions!documents_current_revision_id_fkey(id, revision_number, attachments)')
            .eq('is_archived', false)
            .not('document_number', 'is', null)
            .range(from, from + 199);
        if (error) throw error;
        if (!data?.length) break;
        for (const doc of data) {
            const rev = doc.document_revisions;
            const source = (rev?.attachments || []).find((a) => a.role === 'source' && /\.xls$/i.test(a.name || ''));
            if (source) {
                rows.push({
                    id: doc.id,
                    title: doc.title,
                    document_number: doc.document_number,
                    revision_id: rev.id,
                    attachments: rev.attachments,
                    source,
                });
            }
        }
        if (data.length < 200) break;
        from += 200;
    }
    return rows;
}

const docs = await fetchXlsDocs();
console.log(`Bulunan .xls doküman: ${docs.length}`);

for (const doc of docs) {
    const localPath = findLocalXls(doc.document_number, doc.title);
    if (!localPath) {
        console.warn(`⚠ Yerel dosya yok: ${doc.document_number}`);
        continue;
    }

    const localBuf = fs.readFileSync(localPath);
    const remoteSize = doc.source.size || 0;
    const localMerges = mergeCount(localBuf);

    const reps = await buildDocumentCodeReplacementsForTarget(doc.document_number, {
        oldNumber: doc.document_number,
        extraTextSources: [doc.source.name, doc.source.path],
        xlsBlob: localBuf,
    });
    const patchedBlob = await replaceDocumentCodeInXls(localBuf, reps, doc.document_number);
    const patchedBuf = Buffer.from(await patchedBlob.arrayBuffer());
    const codes = await extractDocumentCodesFromXls(patchedBuf);
    const patchedMerges = mergeCount(patchedBuf);

    const newPath = `${doc.id}-rev${doc.attachments[0]?.revision_number || 1}-src-restored-${doc.document_number.replace(/[^A-Za-z0-9._-]+/g, '_')}.xls`;
    const displayName = `${doc.document_number} - ${doc.title}.xls`.replace(/\.xls\.xls$/i, '.xls');
    const contentType = resolveEditableSourceMimeType(displayName, doc.source.type);

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, patchedBuf, {
        upsert: true,
        contentType,
    });
    if (upErr) throw upErr;

    const oldPath = doc.source.path;
    const nextAttachments = doc.attachments.map((a) => (
        a.path === oldPath
            ? { ...a, path: newPath, name: displayName, size: patchedBuf.length, type: contentType }
            : a
    ));

    const { error: updErr } = await supabase
        .from('document_revisions')
        .update({ attachments: nextAttachments })
        .eq('id', doc.revision_id);
    if (updErr) throw updErr;

    if (oldPath !== newPath) {
        await supabase.storage.from(BUCKET).remove([oldPath.replace(/^documents\//, '')]);
    }

    console.log(`✓ ${doc.document_number}: remote=${remoteSize}B local=${localBuf.length}B patched=${patchedBuf.length}B merges=${patchedMerges} codes=${codes.join(',')}`);
}
