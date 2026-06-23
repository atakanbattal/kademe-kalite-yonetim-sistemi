import { supabase } from '@/lib/customSupabaseClient';
import {
    getAttachmentExtensionLower,
    getFileExtension,
    isDocxSourceAttachment,
    isExcelSourceAttachment,
    isLegacyDocSourceAttachment,
    resolveEditableSourceMimeType,
} from '@/lib/documentRevisionAttachments';

export const INTERNAL_DOCUMENTS_BUCKET = 'documents';

export function buildOfficeOnlineEmbedUrl(fileUrl) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function buildGoogleDocsEmbedUrl(fileUrl) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}

export async function fetchInternalDocumentBlob(filePath, mimeType = 'application/octet-stream') {
    const { data: signed, error } = await supabase.storage
        .from(INTERNAL_DOCUMENTS_BUCKET)
        .createSignedUrl(filePath, 3600);
    if (error) {
        throw error;
    }

    const response = await fetch(signed.signedUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Dosya indirilemedi (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Blob([arrayBuffer], { type: mimeType });
}

export async function prepareWordSourcePreview(attachment, normalizePath) {
    let filePath = attachment?.path;
    if (!filePath) {
        return { error: 'Dosya yolu bulunamadı.' };
    }

    filePath = normalizePath(filePath);
    if (!filePath) {
        return { error: 'Dosya yolu bulunamadı.' };
    }

    const ext = (getAttachmentExtensionLower(attachment) || getFileExtension(filePath).toLowerCase());
    const contentType = resolveEditableSourceMimeType(attachment?.name || filePath, attachment?.type);
    const useOfficeOnline = ext === '.doc'
        || ext === '.xls'
        || ext === '.xlsx'
        || isExcelSourceAttachment(attachment)
        || (isLegacyDocSourceAttachment(attachment) && !isDocxSourceAttachment(attachment));

    if (useOfficeOnline) {
        const { data, error } = await supabase.storage
            .from(INTERNAL_DOCUMENTS_BUCKET)
            .createSignedUrl(filePath, 3600);
        if (error) {
            return { error: error.message };
        }
        return {
            mode: 'office-online',
            previewUrl: buildOfficeOnlineEmbedUrl(data.signedUrl),
            fallbackPreviewUrl: buildGoogleDocsEmbedUrl(data.signedUrl),
        };
    }

    if (ext === '.docx' || isDocxSourceAttachment(attachment)) {
        try {
            const blob = await fetchInternalDocumentBlob(filePath, contentType);
            return { mode: 'docx', blob };
        } catch (error) {
            return { error: error.message || 'Word dosyası alınamadı.' };
        }
    }

    return { error: 'Desteklenmeyen Office formatı.' };
}
