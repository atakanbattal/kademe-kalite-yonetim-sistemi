#!/usr/bin/env node
/**
 * Tüm iç doküman Word/Excel kaynaklarında (.doc, .docx, .xls, .xlsx) kodları günceller.
 * Kullanım: node scripts/batch-patch-all-docx-codes.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { isDocxAttachment } from '../src/lib/docxDocumentCodeReplace.js';
import { isLegacyDocAttachment } from '../src/lib/docDocumentCodeReplace.js';
import { isXlsxAttachment } from '../src/lib/xlsxDocumentCodeReplace.js';
import { isXlsAttachment } from '../src/lib/xlsDocumentCodeReplace.js';
import { patchEditableSourceBlob, isEditableOfficeSource } from '../src/lib/editableSourceCodePatch.js';
import {
    buildEditableSourceFileName,
    resolveEditableSourceMimeType,
} from '../src/lib/documentRevisionAttachments.js';
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
    process.env.VITE_SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function buildPatchedSourcePath(originalPath, doc, sanitizedSourceName) {
    const shortId = randomUUID().slice(0, 8);
    const filePart = `${doc.id}-rev${doc.revision_number}-src-${shortId}-${sanitizedSourceName}`;
    const normalized = String(originalPath || '').replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '');
    const slash = normalized.lastIndexOf('/');
    if (slash >= 0) {
        return `${normalized.slice(0, slash + 1)}${filePart}`;
    }
    return filePart;
}

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

async function downloadSourceFile(attachmentPath) {
    let lastError = null;
    for (const candidate of storageDownloadPaths(attachmentPath)) {
        const { data, error } = await supabase.storage.from(BUCKET).download(candidate);
        if (!error && data) return { data, resolvedPath: candidate };
        lastError = error;
    }
    throw new Error(`İndirme hatası (${attachmentPath}): ${lastError?.message || 'bulunamadı'}`);
}

function getEditableSources(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.filter((a) => a.role === 'source' && isEditableOfficeSource(a?.name, a?.type));
}

async function fetchAllDocuments() {
    const pageSize = 200;
    let from = 0;
    const rows = [];

    while (true) {
        const { data, error } = await supabase
            .from('documents')
            .select('id, title, document_number, is_archived, current_revision_id, document_revisions!documents_current_revision_id_fkey(id, revision_number, attachments)')
            .not('document_number', 'is', null)
            .not('current_revision_id', 'is', null)
            .eq('is_archived', false)
            .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data?.length) break;

        for (const doc of data) {
            const rev = doc.document_revisions;
            const sources = getEditableSources(rev?.attachments);
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
    const oldPathsToRemove = [];

    for (let sourceIndex = 0; sourceIndex < doc.sources.length; sourceIndex += 1) {
        const source = doc.sources[sourceIndex];
        const mimeType = resolveEditableSourceMimeType(source.name, source.type);
        const { data } = await downloadSourceFile(source.path);

        const originalBuf = await data.arrayBuffer();
        const { blob: patchedBlob, patched } = await patchEditableSourceBlob(originalBuf, doc.document_number, {
            oldNumber: doc.document_number,
            extraTextSources,
            fileName: source.name,
            mimeType,
        });

        const patchedBuf = patchedBlob instanceof Blob
            ? await patchedBlob.arrayBuffer()
            : patchedBlob;

        const displayName = buildEditableSourceFileName(
            doc.document_number,
            doc.title,
            source.name,
            sourceIndex
        );
        const sanitizedSourceName = sanitizeFileName(displayName);
        const newPath = buildPatchedSourcePath(source.path, doc, sanitizedSourceName);
        const contentType = resolveEditableSourceMimeType(displayName, mimeType);

        const contentChanged = patched || !buffersEqual(originalBuf, patchedBuf);
        const nameChanged = displayName !== source.name;
        const pathNeedsUpdate = source.path !== newPath;

        if (!contentChanged && !nameChanged && !pathNeedsUpdate) continue;

        if (!DRY_RUN) {
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, patchedBuf, {
                upsert: true,
                contentType,
            });
            if (upErr) throw new Error(`Yükleme hatası: ${upErr.message}`);
        }

        if (!DRY_RUN && source.path && source.path !== newPath) {
            for (const oldKey of storageDownloadPaths(source.path)) {
                oldPathsToRemove.push(oldKey.replace(new RegExp(`^${BUCKET}/`), ''));
            }
        }

        nextAttachments = nextAttachments.map((a) => (
            a.path === source.path
                ? {
                    ...a,
                    path: newPath,
                    name: displayName,
                    size: patchedBuf.byteLength,
                    type: contentType,
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

        if (oldPathsToRemove.length) {
            await supabase.storage.from(BUCKET).remove([...new Set(oldPathsToRemove)]);
        }
    }

    return attachmentsChanged;
}

function buffersEqual(a, b) {
    const aa = new Uint8Array(a);
    const bb = new Uint8Array(b);
    if (aa.byteLength !== bb.byteLength) return false;
    for (let i = 0; i < aa.byteLength; i += 1) {
        if (aa[i] !== bb[i]) return false;
    }
    return true;
}

const docs = await fetchAllDocuments();
const formatCounts = docs.reduce((acc, doc) => {
    for (const source of doc.sources) {
        if (isDocxAttachment(source.name, source.type)) acc.docx += 1;
        else if (isLegacyDocAttachment(source.name, source.type)) acc.doc += 1;
        else if (isXlsxAttachment(source.name, source.type)) acc.xlsx += 1;
        else if (isXlsAttachment(source.name, source.type)) acc.xls += 1;
    }
    return acc;
}, { docx: 0, docx_legacy: 0, doc: 0, xlsx: 0, xls: 0 });

console.log(`Toplam düzenlenebilir kaynak: ${docs.length} doküman${DRY_RUN ? ' (dry-run)' : ''}`);
console.log(`  .docx: ${formatCounts.docx}, .doc: ${formatCounts.doc}, .xlsx: ${formatCounts.xlsx}, .xls: ${formatCounts.xls}`);

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
