import { supabase } from '@/lib/customSupabaseClient';
import {
    getAttachmentExtensionLower,
    getFileExtension,
    isDocxSourceAttachment,
    isLegacyDocSourceAttachment,
} from '@/lib/documentRevisionAttachments';

export const INTERNAL_DOCUMENTS_BUCKET = 'documents';

export function buildOfficeOnlineEmbedUrl(fileUrl) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function buildGoogleDocsEmbedUrl(fileUrl) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
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
    const useOfficeOnline = ext === '.doc' || (isLegacyDocSourceAttachment(attachment) && !isDocxSourceAttachment(attachment));

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
        const { data, error } = await supabase.storage.from(INTERNAL_DOCUMENTS_BUCKET).download(filePath);
        if (error) {
            return { error: error.message };
        }
        const blob = new Blob([data], {
            type: attachment.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        return { mode: 'docx', blob };
    }

    return { error: 'Desteklenmeyen Word formatı.' };
}
