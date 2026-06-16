#!/usr/bin/env node
/**
 * Tek bir iç dokümanın .docx kaynağındaki kodları hedef numaraya günceller.
 * Kullanım: node scripts/patch-docx-document-code.mjs <document_id>
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
    buildDocumentCodeReplacementsForTarget,
    replaceDocumentCodeInDocx,
} from '../src/lib/docxDocumentCodeReplace.js';

const documentId = process.argv[2] || '7b68387c-1aae-4978-9629-d3b522a123ea';

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

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
if (!url || !key) {
    console.error('VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local)');
    process.exit(1);
}

const supabase = createClient(url, key);
const BUCKET = 'documents';

const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('id, title, document_number, current_revision_id')
    .eq('id', documentId)
    .single();
if (docErr) throw docErr;

const { data: rev, error: revErr } = await supabase
    .from('document_revisions')
    .select('id, attachments')
    .eq('id', doc.current_revision_id)
    .single();
if (revErr) throw revErr;

const attachments = rev.attachments || [];
const source = attachments.find((a) => a.role === 'source' && String(a.name || '').toLowerCase().endsWith('.docx'));
if (!source?.path) {
    console.error('docx kaynak bulunamadı');
    process.exit(1);
}

console.log('Doküman:', doc.title, doc.document_number);
console.log('Kaynak:', source.name, source.path);

const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(source.path);
if (dlErr) throw dlErr;

const buf = await fileData.arrayBuffer();
const replacements = await buildDocumentCodeReplacementsForTarget(doc.document_number, {
    oldNumber: doc.document_number,
    extraTextSources: [source.name, source.path],
    docxBlob: buf,
});

console.log('Değiştirme çiftleri:', replacements.length);
replacements.slice(0, 12).forEach(([from, to]) => console.log(`  ${from} → ${to}`));

const patched = await replaceDocumentCodeInDocx(buf, replacements);
const patchedBuf = patched instanceof Blob ? await patched.arrayBuffer() : patched;

const newPath = source.path.replace(/[^/]+$/, `${doc.id}-rev1-src-patched-${Date.now()}-${path.basename(source.path).split('/').pop()}`);
const displayName = `${doc.document_number} - ${doc.title}.docx`;

const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, patchedBuf, {
    upsert: true,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
if (upErr) throw upErr;

const nextAttachments = attachments.map((a) => (
    a.path === source.path
        ? {
            ...a,
            path: newPath,
            name: displayName,
            size: patchedBuf.byteLength,
        }
        : a
));

const { error: updErr } = await supabase
    .from('document_revisions')
    .update({ attachments: nextAttachments })
    .eq('id', rev.id);
if (updErr) throw updErr;

console.log('Güncellendi:', displayName);
console.log('Yeni path:', newPath);
