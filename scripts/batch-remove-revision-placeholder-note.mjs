#!/usr/bin/env node
/**
 * Revizyon tablosundaki "placeholder/sahte kodlar temizlendi" ifadesini kaldırır.
 *
 * Önizleme: node scripts/batch-remove-revision-placeholder-note.mjs --dry-run
 * Uygula:   node scripts/batch-remove-revision-placeholder-note.mjs
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import {
    buildEditableSourceFileName,
    resolveEditableSourceMimeType,
} from '../src/lib/documentRevisionAttachments.js';
import { sanitizeFileName } from '../src/lib/utils.js';
import { isDocxAttachment } from '../src/lib/docxDocumentCodeReplace.js';

const DRY_RUN = process.argv.includes('--dry-run');
const LOCAL_ONLY = process.argv.includes('--local-only');
const BUCKET = 'documents';
const CERT_TYPES = ['Kalite Sertifikaları', 'Personel Sertifikaları'];
const FINAL_DIR = '/Users/atakanbattal/Desktop/KademeQMS Revizyon/_KYS Revizyon Calismasi/KADEME KYS (Final)';
const REMOVE_TEXT = '; placeholder/sahte kodlar temizlendi';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function patchDocxBuffer(input) {
    const zip = await JSZip.loadAsync(input);
    let patched = false;

    const tasks = [];
    zip.forEach((relativePath, file) => {
        if (file.dir || !/^word\/.+\.xml$/i.test(relativePath)) return;
        tasks.push(
            file.async('string').then((content) => {
                if (!content.includes(REMOVE_TEXT)) return;
                zip.file(relativePath, content.split(REMOVE_TEXT).join(''));
                patched = true;
            })
        );
    });
    await Promise.all(tasks);

    if (!patched) {
        return { buffer: input, patched: false };
    }

    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return { buffer: out, patched: true };
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

function getDocxSources(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.filter((a) => a.role === 'source' && isDocxAttachment(a?.name, a?.type));
}

async function fetchTargetDocuments() {
    const pageSize = 200;
    let from = 0;
    const rows = [];

    while (true) {
        const { data, error } = await supabase
            .from('documents')
            .select('id, title, document_number, document_type, is_archived, current_revision_id, document_revisions!documents_current_revision_id_fkey(id, revision_number, attachments)')
            .not('document_type', 'in', `(${CERT_TYPES.map((t) => `"${t}"`).join(',')})`)
            .eq('is_archived', false)
            .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data?.length) break;

        for (const doc of data) {
            const rev = doc.document_revisions;
            const sources = getDocxSources(rev?.attachments);
            if (!sources.length) continue;
            rows.push({
                id: doc.id,
                title: doc.title,
                document_number: doc.document_number,
                document_type: doc.document_type,
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
    let attachmentsChanged = false;
    let nextAttachments = [...(doc.attachments || [])];
    const oldPathsToRemove = [];

    for (let sourceIndex = 0; sourceIndex < doc.sources.length; sourceIndex += 1) {
        const source = doc.sources[sourceIndex];
        const { data } = await downloadSourceFile(source.path);
        const originalBuf = Buffer.from(await data.arrayBuffer());
        const { buffer: patchedBuf, patched } = await patchDocxBuffer(originalBuf);
        if (!patched) continue;

        const displayName = buildEditableSourceFileName(
            doc.document_number,
            doc.title,
            source.name,
            sourceIndex
        );
        const sanitizedSourceName = sanitizeFileName(displayName);
        const shortId = randomUUID().slice(0, 8);
        const newPath = `documents/${doc.id}-src-${shortId}-${sanitizedSourceName}`;
        const contentType = resolveEditableSourceMimeType(displayName, source.type);

        if (!DRY_RUN) {
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, patchedBuf, {
                upsert: true,
                contentType,
            });
            if (upErr) throw new Error(`Yükleme hatası: ${upErr.message}`);

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

async function patchLocalFiles() {
    if (!fs.existsSync(FINAL_DIR)) {
        console.log('Yerel KYS Final klasörü bulunamadı, atlanıyor.');
        return { patched: 0, skipped: 0 };
    }

    let patched = 0;
    let skipped = 0;

    for (const dept of fs.readdirSync(FINAL_DIR)) {
        const deptPath = path.join(FINAL_DIR, dept);
        if (!fs.statSync(deptPath).isDirectory()) continue;
        for (const typeFolder of fs.readdirSync(deptPath)) {
            const typePath = path.join(deptPath, typeFolder);
            if (!fs.statSync(typePath).isDirectory()) continue;
            for (const file of fs.readdirSync(typePath)) {
                if (!file.toLowerCase().endsWith('.docx')) continue;
                const abs = path.join(typePath, file);
                const original = fs.readFileSync(abs);
                const { buffer, patched: changed } = await patchDocxBuffer(original);
                if (!changed) {
                    skipped += 1;
                    continue;
                }
                if (!DRY_RUN) {
                    fs.writeFileSync(abs, buffer);
                }
                patched += 1;
                console.log(`${DRY_RUN ? '[DRY] ' : ''}✓ yerel: ${dept}/${typeFolder}/${file}`);
            }
        }
    }

    return { patched, skipped };
}

async function main() {
    console.log(`Revizyon tablosu placeholder notu temizliği${DRY_RUN ? ' (dry-run)' : ''}`);

    if (LOCAL_ONLY) {
        const local = await patchLocalFiles();
        console.log('\n--- Yerel Özet ---');
        console.log(`Güncellendi: ${local.patched}`);
        console.log(`Değişiklik yok: ${local.skipped}`);
        return;
    }

    const docs = await fetchTargetDocuments();
    console.log(`Hedef doküman: ${docs.length} (.docx kaynak)`);

    let patched = 0;
    let skipped = 0;
    let failed = 0;

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
            console.error(`✗ ${label}: ${err.message}`);
        }
    }

    const local = await patchLocalFiles();

    console.log('\n--- Özet ---');
    console.log(`Storage güncellendi: ${patched}`);
    console.log(`Storage değişiklik yok: ${skipped}`);
    console.log(`Yerel güncellendi: ${local.patched}`);
    console.log(`Hata: ${failed}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
