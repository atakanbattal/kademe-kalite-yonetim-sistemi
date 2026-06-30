#!/usr/bin/env node
/**
 * Tek birim klasöründeki iç kaynaklı dokümanları yükler veya revize eder.
 *
 * Örnek:
 *   node scripts/upload-department-internal-docs.mjs --dir "/path/Ar-Ge Direktörlüğü" --department "Ar-Ge Direktörlüğü"
 *   node scripts/upload-department-internal-docs.mjs --dir "..." --department "Ar-Ge Direktörlüğü" --apply
 */
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'documents';
const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const PUBLISH_DATE = new Date().toISOString().slice(0, 10);

const DEPARTMENT_ID = {
    'Ar-Ge Direktörlüğü': 'b5060575-e360-4414-875e-bd44802d95d6',
    'Depo Şefliği': '2ccad30e-be6a-47ae-9ba5-04364391dc6d',
    'İdari İşler Müdürlüğü': '4b12e28c-3dda-4eca-bcc2-68991618eebd',
    'İnsan Kaynakları Müdürlüğü': '7dd3e06e-3904-4842-b86a-05cf1decd7c4',
    'Kalite Müdürlüğü': '71a5bccd-c764-45c5-9802-73199e3923a1',
    'Mali İşler': '74aa6e3e-709b-4a90-9639-38d43a6aa631',
    'Satınalma Müdürlüğü': '7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b',
    'Satış Sonrası Hizmetler Müdürlüğü': 'd46d5acc-4bdb-4cb2-9aee-af54220f052b',
    'Üretim Müdürlüğü (Üst Yapı)': 'e86e0de8-b2bf-4044-b87c-13bb2b5e2471',
    'Üretim Planlama Müdürlüğü': 'bcf6529f-c7e3-40e6-bfd6-bfb848afa197',
    'Yurt Dışı Satış Müdürlüğü': '89ea3a0d-81a6-4d34-92bf-3bdbd550608d',
    'Yurt İçi Satış Müdürlüğü': '00981550-11e0-4d29-9d1d-7b09a50777cf',
};

const TYPE_MAP = {
    Prosedürler: 'Prosedürler',
    Talimatlar: 'Talimatlar',
    Formlar: 'Formlar',
    'Görev Tanımları': 'Görev Tanımları',
    'El Kitapları': 'El Kitapları',
    Şemalar: 'Şemalar',
    Listeler: 'Listeler',
    Planlar: 'Planlar',
    Politikalar: 'Politikalar',
    Şartnameler: 'Şartnameler',
    Sözleşmeler: 'Sözleşmeler',
    Tablolar: 'Tablolar',
    Kılavuzlar: 'Kılavuzlar',
    Süreçler: 'Süreçler',
};

const EXT_MIME = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
};

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag) => {
        const i = args.indexOf(flag);
        return i >= 0 ? args[i + 1] : null;
    };
    return {
        dir: get('--dir'),
        department: get('--department'),
        apply: args.includes('--apply'),
        reason: get('--reason') || 'Revizyon Talebi — Tek Tip dönüşüm (2026)',
    };
}

const nfc = (s) => s.normalize('NFC');

function sanitizeFileName(fileName) {
    if (!fileName) return '';
    return fileName
        .normalize('NFD').replace(/\p{M}/gu, '')
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .replace(/__+/g, '_');
}

function getFileExtension(fileName) {
    const m = String(fileName || '').match(/(\.[^./\\]+)$/i);
    return m ? m[1] : '';
}

function buildEditableSourceFileName(documentNumber, title, originalFileName) {
    const ext = getFileExtension(originalFileName);
    const base = [documentNumber, title].map((v) => (v || '').trim()).filter(Boolean).join(' - ') || 'kaynak';
    return `${base}${ext}`;
}

function buildManifest(rootDir, departmentName, departmentId) {
    const items = [];
    const errors = [];
    for (const typeRaw of fs.readdirSync(rootDir)) {
        const typeFolder = nfc(typeRaw);
        const typePath = path.join(rootDir, typeRaw);
        if (!fs.statSync(typePath).isDirectory()) continue;
        const documentType = TYPE_MAP[typeFolder];
        if (!documentType) {
            errors.push(`Bilinmeyen tip klasörü: ${typeFolder}`);
            continue;
        }
        for (const fileRaw of fs.readdirSync(typePath)) {
            const fileName = nfc(fileRaw);
            if (fileName.startsWith('.')) continue;
            const ext = getFileExtension(fileName).toLowerCase();
            if (!EXT_MIME[ext]) {
                errors.push(`Desteklenmeyen dosya: ${fileName}`);
                continue;
            }
            const m = fileName.match(/^([A-ZÇĞİÖŞÜ0-9]+-[A-ZÇĞİÖŞÜ]+-\d{4}-\d{4})\s*-\s*(.+)\.[^.]+$/);
            if (!m) {
                errors.push(`Kod/başlık ayrıştırılamadı: ${fileName}`);
                continue;
            }
            items.push({
                absPath: path.join(typePath, fileRaw),
                fileName,
                code: m[1],
                title: m[2].trim(),
                documentType,
                department: departmentName,
                departmentId,
                ext,
                mime: EXT_MIME[ext],
            });
        }
    }
    return { items, errors };
}

function collectAttachmentPaths(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.map((a) => a?.path).filter(Boolean);
}

async function upsertDocument(supabase, item, reason, apply) {
    const { data: existing, error: findError } = await supabase
        .from('documents')
        .select('id, current_revision_id, document_number')
        .eq('document_number', item.code)
        .maybeSingle();
    if (findError) throw findError;

    const displayName = buildEditableSourceFileName(item.code, item.title, item.fileName);
    const sanitized = sanitizeFileName(displayName);
    const buffer = fs.readFileSync(item.absPath);

    if (!existing) {
        if (!apply) return { action: 'create', code: item.code };
        const documentId = uuidv4();
        const storagePath = `documents/${documentId}-src-${uuidv4().slice(0, 8)}-${sanitized}`;
        const up = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { upsert: true, contentType: item.mime });
        if (up.error) throw up.error;

        const attachment = { path: storagePath, name: displayName, size: buffer.length, type: item.mime, role: 'source' };
        const docIns = await supabase.from('documents').insert({
            id: documentId,
            document_number: item.code,
            title: item.title,
            document_type: item.documentType,
            department_id: item.departmentId,
            status: 'Yayınlandı',
            is_active: true,
            is_archived: false,
            valid_until: null,
            organization_id: ORG_ID,
        }).select('id').single();
        if (docIns.error) throw docIns.error;

        const revIns = await supabase.from('document_revisions').insert({
            document_id: documentId,
            revision_number: 1,
            revision_reason: reason,
            publish_date: PUBLISH_DATE,
            revision_date: PUBLISH_DATE,
            attachments: [attachment],
        }).select('id').single();
        if (revIns.error) throw revIns.error;

        const upd = await supabase.from('documents').update({ current_revision_id: revIns.data.id }).eq('id', documentId);
        if (upd.error) throw upd.error;
        return { action: 'created', code: item.code };
    }

    if (!apply) return { action: 'revise', code: item.code };

    const documentId = existing.id;
    const { data: revs, error: revErr } = await supabase
        .from('document_revisions')
        .select('revision_number, attachments')
        .eq('document_id', documentId)
        .order('revision_number', { ascending: false })
        .limit(1);
    if (revErr) throw revErr;

    const nextRev = (revs?.[0]?.revision_number || 0) + 1;
    const oldPaths = collectAttachmentPaths(revs?.[0]?.attachments);

    const storagePath = `documents/${documentId}-rev${nextRev}-src-${uuidv4().slice(0, 8)}-${sanitized}`;
    const up = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { upsert: true, contentType: item.mime });
    if (up.error) throw up.error;

    const attachment = { path: storagePath, name: displayName, size: buffer.length, type: item.mime, role: 'source' };
    const revIns = await supabase.from('document_revisions').insert({
        document_id: documentId,
        revision_number: nextRev,
        revision_reason: reason,
        publish_date: PUBLISH_DATE,
        revision_date: PUBLISH_DATE,
        attachments: [attachment],
    }).select('id').single();
    if (revIns.error) throw revIns.error;

    const docUpd = await supabase.from('documents').update({
        title: item.title,
        document_type: item.documentType,
        department_id: item.departmentId,
        status: 'Yayınlandı',
        is_active: true,
        is_archived: false,
        current_revision_id: revIns.data.id,
    }).eq('id', documentId);
    if (docUpd.error) throw docUpd.error;

    if (oldPaths.length) {
        await supabase.storage.from(BUCKET).remove(oldPaths);
    }

    return { action: 'revised', code: item.code, revision: nextRev };
}

async function main() {
    const { dir, department, apply, reason } = parseArgs();
    if (!dir || !department) {
        console.error('Kullanım: --dir <klasör> --department "Ar-Ge Direktörlüğü" [--apply]');
        process.exit(1);
    }
    if (!SERVICE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY gerekli');
        process.exit(1);
    }
    const departmentId = DEPARTMENT_ID[department];
    if (!departmentId) {
        console.error(`Bilinmeyen birim: ${department}`);
        process.exit(1);
    }
    if (!fs.existsSync(dir)) {
        console.error(`Klasör bulunamadı: ${dir}`);
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { items, errors } = buildManifest(dir, department, departmentId);

    console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — ${department}: ${items.length} dosya`);
    if (errors.length) {
        console.error('Hatalar:');
        errors.forEach((e) => console.error(' -', e));
        process.exit(1);
    }

    const results = { created: 0, revised: 0, planned_create: 0, planned_revise: 0, failures: [] };
    for (const item of items) {
        try {
            const r = await upsertDocument(supabase, item, reason, apply);
            if (r.action === 'created') results.created += 1;
            else if (r.action === 'revised') results.revised += 1;
            else if (r.action === 'create') results.planned_create += 1;
            else if (r.action === 'revise') results.planned_revise += 1;
            console.log(`${apply ? '✓' : '○'} ${item.code} — ${r.action}${r.revision ? ` (rev ${r.revision})` : ''}`);
        } catch (err) {
            results.failures.push({ code: item.code, error: err.message });
            console.error(`✗ ${item.code}: ${err.message}`);
        }
    }

    console.log('\nÖzet:', results);
    if (results.failures.length) process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
