import { supabase } from '@/lib/customSupabaseClient';
import {
    getPdfAttachment,
    getOfficePreviewAttachments,
    resolveEditableSourceDownloadName,
    resolveEditableSourceMimeType,
} from '@/lib/documentRevisionAttachments';
import { fetchInternalDocumentBlob, prepareWordSourcePreview } from '@/lib/internalDocumentSourcePreview';

const BUCKET_NAME = 'documents';

function getDocumentFolder(documentType) {
    const folderMap = {
        'Kalite Sertifikaları': 'Kalite-Sertifikalari',
        'Personel Sertifikaları': 'Personel-Sertifikalari',
        'Prosedürler': 'documents',
        'Talimatlar': 'documents',
        'Formlar': 'documents',
        'El Kitapları': 'documents',
        'Şemalar': 'documents',
        'Görev Tanımları': 'documents',
        'Süreçler': 'documents',
        'Planlar': 'documents',
        'Listeler': 'documents',
        'Şartnameler': 'documents',
        'Politikalar': 'documents',
        'Tablolar': 'documents',
        'Antetler': 'documents',
        'Sözleşmeler': 'documents',
        'Yönetmelikler': 'documents',
        'Kontrol Planları': 'documents',
        'FMEA Planları': 'documents',
        'Proses Kontrol Kartları': 'documents',
        'Görsel Yardımcılar': 'documents',
        'Diğer': 'documents',
    };
    return folderMap[documentType] || 'documents';
}

export function normalizeDocumentStoragePath(path, documentType) {
    if (!path) return null;
    if (path.includes('/') && !path.startsWith('documents/') && !path.includes('Kalite') && !path.includes('Personel')) {
        const folderName = getDocumentFolder(documentType);
        const parts = path.split('/');
        if (parts.length >= 2) {
            return `${folderName}/${parts.slice(1).join('/')}`;
        }
    }
    return path;
}

async function resolveDocumentId(documentId, documentCode) {
    if (documentId) return documentId;
    const code = String(documentCode || '').trim().split(/\s+/)[0];
    if (!code) return null;
    const { data } = await supabase
        .from('documents')
        .select('id')
        .eq('document_number', code)
        .maybeSingle();
    return data?.id || null;
}

async function fetchLatestRevision(documentId, currentRevisionId) {
    if (currentRevisionId) {
        const { data, error } = await supabase
            .from('document_revisions')
            .select('attachments, revision_number')
            .eq('id', currentRevisionId)
            .maybeSingle();
        if (error) throw error;
        if (data) return data;
    }

    const { data, error } = await supabase
        .from('document_revisions')
        .select('attachments, revision_number')
        .eq('document_id', documentId)
        .order('revision_number', { ascending: false })
        .limit(1);
    if (error) throw error;
    return data?.[0] || null;
}

export async function downloadDocumentAttachment(attachment, documentType, downloadName) {
    const filePath = normalizeDocumentStoragePath(attachment?.path, documentType);
    if (!filePath) throw new Error('Dosya yolu bulunamadı.');

    const mimeType = resolveEditableSourceMimeType(attachment?.name || filePath, attachment?.type);
    const blob = await fetchInternalDocumentBlob(filePath, mimeType);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName || attachment?.name || 'dokuman';
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
}

/**
 * PDF varsa PDF, yoksa Word/Excel kaynak dosyasını önizler.
 * @returns {{ kind: 'pdf', url: string, title: string } | { kind: 'source', title: string, previewMode: string, blob?: Blob, previewUrl?: string, fallbackPreviewUrl?: string, attachment: object, documentType: string, downloadName: string }}
 */
export async function openDocumentPreview({ documentId, documentCode, title }) {
    const resolvedId = await resolveDocumentId(documentId, documentCode);
    if (!resolvedId) {
        throw new Error('Bu kod için sistemde kayıtlı doküman bulunamadı.');
    }

    const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('id, title, document_number, document_type, current_revision_id')
        .eq('id', resolvedId)
        .maybeSingle();
    if (docError) throw docError;
    if (!doc) throw new Error('Doküman bulunamadı.');

    const revision = await fetchLatestRevision(doc.id, doc.current_revision_id);
    if (!revision) throw new Error('Yayınlanmış revizyon bulunamadı.');

    const displayTitle = title || doc.document_number || doc.title || 'Doküman';
    const normalizePath = (path) => normalizeDocumentStoragePath(path, doc.document_type);

    const pdfAttachment = getPdfAttachment(revision.attachments);
    if (pdfAttachment?.path) {
        const filePath = normalizePath(pdfAttachment.path);
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
        if (error) throw error;

        const blob = new Blob([data], { type: pdfAttachment.type || 'application/pdf' });
        return {
            kind: 'pdf',
            url: window.URL.createObjectURL(blob),
            title: displayTitle,
        };
    }

    const officeAttachments = getOfficePreviewAttachments(revision.attachments);
    const sourceAttachment = officeAttachments[0];
    if (!sourceAttachment) {
        throw new Error('Görüntülenecek PDF veya Word/Excel dosyası bulunamadı.');
    }

    const preview = await prepareWordSourcePreview(sourceAttachment, normalizePath);
    if (preview.error) throw new Error(preview.error);

    const downloadName = resolveEditableSourceDownloadName(sourceAttachment, doc.document_number, doc.title);

    return {
        kind: 'source',
        title: downloadName || displayTitle,
        previewMode: preview.mode,
        blob: preview.blob || null,
        previewUrl: preview.previewUrl || null,
        fallbackPreviewUrl: preview.fallbackPreviewUrl || null,
        attachment: sourceAttachment,
        documentType: doc.document_type,
        downloadName,
    };
}

/** @deprecated use openDocumentPreview */
export async function openDocumentPdfPreview(options) {
    const result = await openDocumentPreview(options);
    if (result.kind !== 'pdf') {
        throw new Error('PDF dosyası bulunamadı.');
    }
    return { url: result.url, title: result.title };
}
