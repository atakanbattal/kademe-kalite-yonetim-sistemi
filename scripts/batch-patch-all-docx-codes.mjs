#!/usr/bin/env node
/**
 * Tüm iç doküman .docx kaynaklarında antet/gövde kodlarını güncel document_number ile eşitler.
 * Kullanım: node scripts/batch-patch-all-docx-codes.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
    buildDocumentCodeReplacementsForTarget,
    extractDocumentCodesFromDocx,
    isDocxAttachment,
    replaceDocumentCodeInDocx,
} from '../src/lib/docxDocumentCodeReplace.js';
import { buildEditableSourceFileName } from '../src/lib/documentRevisionAttachments.js';
import { sanitizeFileName } from '../src/lib/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY veya SUPABASE_SERVICE_KEY gerekli');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function buffersEqual(a, b) {
    const aa = new Uint8Array(a);
    const bb = new Uint8Array(b);
    if (aa.byteLength !== bb.byteLength) return false;
    for (let i = 0; i < aa.byteLength; i += 1) {
        if (aa[i] !== bb[i]) return false;
    }
    return true;
}

function getDocxSources(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.filter((a) => isDocxAttachment(a?.name, a?.type));
}

async function fetchAllDocuments() {
    const pageSize = 200;
    let from = 0;
    const rows = [];

    while (true) {
        const { data, error } = await supabase
            .from('documents')
            .select('id, title, document_number, current_revision_id, document_revisions!documents_current_revision_id_fkey(id, revision_number, attachments)')
            .not('document_number', 'is', null)
            .not('current_revision_id', 'is', null)
            .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data?.length) break;

        for (const doc of data) {
            const rev = doc.document_revisions;
            const sources = getDocxSources(rev?.attachments);
            if (!sources.length || !doc.document_number) continue;
            rows.push({
                id: doc.id,
                title: doc.title,
                document_number: doc.document_number,
                revision_id: rev.id,
                revision_number: rev.revision_number || 1,
                attachments: rev.attachments,
                sources,
            });
        }

        if (data.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

async function patchOneDoc(doc) {
    const extraTextSources = (doc.attachments || []).flatMap((a) => [a.name, a.path].filter(Boolean));
    let attachmentsChanged = false;
    let nextAttachments = [...(doc.attachments || [])];

    for (let sourceIndex = 0; sourceIndex < doc.sources.length; sourceIndex += 1) {
        const source = doc.sources[sourceIndex];
        const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(source.path);
        if (dlErr) throw new Error(`İndirme hatası (${source.path}): ${dlErr.message}`);

        const originalBuf = await data.arrayBuffer();
        const replacements = await buildDocumentCodeReplacementsForTarget(doc.document_number, {
            oldNumber: doc.document_number,
            extraTextSources,
            docxBlob: originalBuf,
        });

        if (!replacements.length) continue;

        const patchedBlob = await replaceDocumentCodeInDocx(originalBuf, replacements);
        const patchedBuf = patchedBlob instanceof Blob
            ? await patchedBlob.arrayBuffer()
            : patchedBlob;

        if (buffersEqual(originalBuf, patchedBuf)) continue;

        const displayName = buildEditableSourceFileName(
            doc.document_number,
            doc.title,
            source.name,
            sourceIndex
        );
        const sanitizedSourceName = sanitizeFileName(displayName);
        const folderPrefix = String(source.path).includes('/')
            ? String(source.path).slice(0, String(source.path).lastIndexOf('/') + 1)
            : `${BUCKET}/`;
        const shortId = randomUUID().slice(0, 8);
        const newPath = `${folderPrefix}${doc.id}-rev${doc.revision_number}-src-${shortId}-${sanitizedSourceName}`;

        if (!DRY_RUN) {
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, patchedBuf, {
                upsert: true,
                contentType: source.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            if (upErr) throw new Error(`Yükleme hatası: ${upErr.message}`);
        }

        nextAttachments = nextAttachments.map((a) => (
            a.path === source.path
                ? {
                    ...a,
                    path: newPath,
                    name: displayName,
                    size: patchedBuf.byteLength,
                }
                : a
        ));
        attachmentsChanged = true;
    }

    if (attachmentsChanged && !DRY_RUN) {
        const { error: updErr } = await supabase
            .from('document_revisions')
            .update({ attachments: nextAttachments })
            .eq('id', doc.revision_id);
        if (updErr) throw updErr;
    }

    return attachmentsChanged;
}

const docs = await fetchAllDocuments();
console.log(`Toplam docx kaynaklı doküman: ${docs.length}${DRY_RUN ? ' (dry-run)' : ''}`);

let patched = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    const label = `[${i + 1}/${docs.length}] ${doc.document_number} — ${doc.title}`;
    try {
        const changed = await patchOneDoc(doc);
        if (changed) {
            patched += 1;
            console.log(`✓ ${label}`);
        } else {
            skipped += 1;
        }
    } catch (err) {
        failed += 1;
        failures.push({ doc: label, error: err.message });
        console.error(`✗ ${label}: ${err.message}`);
    }
}

console.log('\n--- Özet ---');
console.log(`Güncellendi: ${patched}`);
console.log(`Değişiklik yok / atlandı: ${skipped}`);
console.log(`Hata: ${failed}`);
if (failures.length) {
    console.log('\nHatalar:');
    failures.forEach((f) => console.log(`  ${f.doc}: ${f.error}`));
}
