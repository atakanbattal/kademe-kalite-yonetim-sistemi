import { getPublishedAttachment, getSourceAttachments } from '@/lib/documentRevisionAttachments';

/** KYS A010: revizyon bilgisi dosya adında olmamalı */
const REV_IN_FILENAME_RE = /(?:\(|\b)rev\.?\s*0*\d+|revizyon\s*0*\d+|\(r\.?\s*0*\d+\)/i;

export function hasRevisionInFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') return false;
    return REV_IN_FILENAME_RE.test(fileName);
}

/** BÖLÜM-TİP-YIL-SIRA veya eski KDM formatı */
export function isStandardDocumentNumber(documentNumber) {
    if (!documentNumber) return false;
    const t = String(documentNumber).trim();
    return /^[A-ZÇĞİÖŞÜ]{2,5}-[A-Z]{2}-\d{4}-\d{4}$/i.test(t)
        || /^KDM[.\-][A-Z]{2,4}[.\-]/i.test(t);
}

export function findDuplicateDocumentNumbers(documents) {
    const map = new Map();
    for (const doc of documents || []) {
        const num = (doc.document_number || '').trim();
        if (!num) continue;
        if (!map.has(num)) map.set(num, []);
        map.get(num).push(doc);
    }
    return [...map.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([documentNumber, docs]) => ({ documentNumber, docs, count: docs.length }));
}

export function analyzeDocumentCompliance(doc) {
    const revision = Array.isArray(doc.document_revisions)
        ? doc.document_revisions[0]
        : doc.document_revisions;
    const published = getPublishedAttachment(revision?.attachments);
    const sources = getSourceAttachments(revision?.attachments);
    const publishedName = published?.name || '';
    const hasPdf = !!published?.path;
    const hasSource = sources.length > 0;
    const revInFileName = hasRevisionInFileName(publishedName);
    const standardNumber = isStandardDocumentNumber(doc.document_number);

    const issues = [];
    if (!hasPdf) issues.push('PDF yok');
    if (!hasSource && !['Kalite Sertifikaları', 'Personel Sertifikaları', 'Antetler'].includes(doc.document_type)) {
        issues.push('Kaynak dosya yok');
    }
    if (revInFileName) issues.push('Dosya adında revizyon');
    if (doc.document_number && !standardNumber) issues.push('Standart dışı kod');

    return {
        hasPdf,
        hasSource,
        revInFileName,
        standardNumber,
        issues,
        isCompliant: issues.length === 0,
    };
}

export function summarizeCompliance(documents) {
    const prepared = (documents || []).map((doc) => ({
        doc,
        compliance: analyzeDocumentCompliance(doc),
    }));

    const duplicates = findDuplicateDocumentNumbers(documents);
    const missingPdf = prepared.filter((p) => !p.compliance.hasPdf).length;
    const missingSource = prepared.filter((p) => !p.compliance.hasSource && p.compliance.issues.includes('Kaynak dosya yok')).length;
    const revInName = prepared.filter((p) => p.compliance.revInFileName).length;
    const nonStandard = prepared.filter((p) => p.compliance.issues.includes('Standart dışı kod')).length;

    return {
        total: prepared.length,
        duplicateGroups: duplicates.length,
        duplicateDocuments: duplicates.reduce((s, g) => s + g.count, 0),
        missingPdf,
        missingSource,
        revInName,
        nonStandard,
        duplicates,
    };
}
