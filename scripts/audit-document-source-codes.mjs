#!/usr/bin/env node
/**
 * Kaynak dosyalardaki doküman kodlarını DB numarasıyla karşılaştırır.
 * Kullanım: node scripts/audit-document-source-codes.mjs
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parseStandardDocumentCode, textMatchesTargetCode } from '../src/lib/documentCodeUtils.js';
import { extractDocumentCodesFromDocx } from '../src/lib/docxDocumentCodeReplace.js';
import { extractDocumentCodesFromDoc } from '../src/lib/docDocumentCodeReplace.js';
import { extractDocumentCodesFromXlsx } from '../src/lib/xlsxDocumentCodeReplace.js';
import { extractDocumentCodesFromXls } from '../src/lib/xlsDocumentCodeReplace.js';
import { isEditableOfficeSource } from '../src/lib/editableSourceCodePatch.js';
import {
    isDocxAttachment,
} from '../src/lib/docxDocumentCodeReplace.js';
import { isLegacyDocAttachment } from '../src/lib/docDocumentCodeReplace.js';
import { isXlsxAttachment } from '../src/lib/xlsxDocumentCodeReplace.js';
import { isXlsAttachment } from '../src/lib/xlsDocumentCodeReplace.js';
import { resolveEditableSourceMimeType } from '../src/lib/documentRevisionAttachments.js';

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
    process.env.VITE_SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4'
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

async function downloadSourceFile(attachmentPath) {
    for (const candidate of storageDownloadPaths(attachmentPath)) {
        const { data, error } = await supabase.storage.from(BUCKET).download(candidate);
        if (!error && data) return data;
    }
    return null;
}

async function extractCodes(blob, fileName, mimeType) {
    const buf = await blob.arrayBuffer();
    if (isDocxAttachment(fileName, mimeType)) return extractDocumentCodesFromDocx(buf);
    if (isLegacyDocAttachment(fileName, mimeType)) return extractDocumentCodesFromDoc(buf);
    if (isXlsxAttachment(fileName, mimeType)) return extractDocumentCodesFromXlsx(buf);
    if (isXlsAttachment(fileName, mimeType)) return extractDocumentCodesFromXls(buf);
    return [];
}

function sourceFormat(fileName, mimeType) {
    if (isDocxAttachment(fileName, mimeType)) return 'docx';
    if (isLegacyDocAttachment(fileName, mimeType)) return 'doc';
    if (isXlsxAttachment(fileName, mimeType)) return 'xlsx';
    if (isXlsAttachment(fileName, mimeType)) return 'xls';
    return '?';
}

const pageSize = 200;
let from = 0;
const mismatches = [];
let ok = 0;
let noSource = 0;
let unreadable = 0;

while (true) {
    const { data, error } = await supabase
        .from('documents')
        .select('id, title, document_number, is_archived, document_revisions!documents_current_revision_id_fkey(attachments)')
        .not('document_number', 'is', null)
        .not('current_revision_id', 'is', null)
        .eq('is_archived', false)
        .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const doc of data) {
        const targetParsed = parseStandardDocumentCode(doc.document_number);
        if (!targetParsed) continue;

        const sources = (doc.document_revisions?.attachments || [])
            .filter((a) => a.role === 'source' && isEditableOfficeSource(a?.name, a?.type));

        if (!sources.length) {
            noSource += 1;
            continue;
        }

        for (const source of sources) {
            const mime = resolveEditableSourceMimeType(source.name, source.type);
            const blob = await downloadSourceFile(source.path);
            if (!blob) {
                unreadable += 1;
                mismatches.push({
                    document_number: doc.document_number,
                    title: doc.title,
                    source: source.name,
                    issue: 'indirilemedi',
                });
                continue;
            }

            const codes = await extractCodes(blob, source.name, mime);
            const canonicals = codes
                .map((c) => parseStandardDocumentCode(c))
                .filter(Boolean);

            const matches = canonicals.some((parsed) => textMatchesTargetCode(parsed.canonical, targetParsed))
                || codes.some((c) => textMatchesTargetCode(c, targetParsed));

            if (matches) {
                ok += 1;
            } else {
                mismatches.push({
                    document_number: doc.document_number,
                    title: doc.title,
                    source: source.name,
                    format: sourceFormat(source.name, mime),
                    codes_found: codes.slice(0, 5),
                });
            }
        }
    }

    if (data.length < pageSize) break;
    from += pageSize;
}

console.log('--- Kaynak kod denetimi ---');
console.log(`Uyumlu: ${ok}`);
console.log(`Kaynak yok: ${noSource}`);
console.log(`Uyumsuz / sorunlu: ${mismatches.length}`);
if (mismatches.length) {
    console.log('\nUyumsuz dokümanlar:');
    mismatches.slice(0, 50).forEach((m) => {
        console.log(`• ${m.document_number} — ${m.title}`);
        console.log(`  ${m.source} [${m.format || m.issue}] kodlar: ${(m.codes_found || []).join(', ') || '-'}`);
    });
    if (mismatches.length > 50) {
        console.log(`... ve ${mismatches.length - 50} kayıt daha`);
    }
}
