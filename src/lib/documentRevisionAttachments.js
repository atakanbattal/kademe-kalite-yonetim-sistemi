/**
 * Doküman revizyonu ekleri: yayın PDF'i + (isteğe bağlı) düzenlenebilir kaynak dosyalar.
 * attachments[] öğeleri: { path, name, size, type, role?: 'published' | 'source' }
 * Eski kayıtlarda role yok; tek dosya = yayın PDF'i kabul edilir.
 */

export const SOURCE_FILE_ACCEPT = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    'application/vnd.oasis.opendocument.presentation': ['.odp'],
    'text/csv': ['.csv'],
    'application/rtf': ['.rtf'],
    'text/plain': ['.txt'],
};

export function isPdfAttachment(att) {
    if (!att) return false;
    const t = (att.type || '').toLowerCase();
    const n = (att.name || '').toLowerCase();
    return t === 'application/pdf' || n.endsWith('.pdf');
}

export function getPublishedAttachment(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return null;
    const byRole = attachments.find((a) => a.role === 'published');
    if (byRole) return byRole;
    const pdf = attachments.find((a) => isPdfAttachment(a));
    if (pdf) return pdf;
    return attachments[0];
}

export function getSourceAttachments(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return [];
    const withRole = attachments.filter((a) => a.role === 'source');
    if (withRole.length > 0) return withRole;
    return [];
}

/** Silme / depolama temizliği için tüm path'ler */
export function collectAttachmentPaths(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.map((a) => a.path).filter(Boolean);
}

export function getFileExtension(fileName) {
    if (!fileName) return '';
    const match = String(fileName).match(/(\.[^./\\]+)$/i);
    return match ? match[1] : '';
}

/** Düzenlenebilir kaynak dosya adı: `{kod} - {ad}{uzantı}` */
export function buildEditableSourceFileName(documentNumber, title, originalFileName, index = 0) {
    const ext = getFileExtension(originalFileName);
    const parts = [documentNumber, title]
        .map((value) => (value || '').trim())
        .filter(Boolean);
    const base = parts.join(' - ') || 'kaynak';
    const suffix = index > 0 ? ` (${index + 1})` : '';
    return `${base}${suffix}${ext}`;
}

/** İndirme / listeleme: kayıtlı ad eski formatta ise doküman kodu + ad ile birleştir */
export function resolveEditableSourceDownloadName(attachment, documentNumber, title) {
    const num = (documentNumber || '').trim();
    const docTitle = (title || '').trim();
    const currentName = attachment?.name || '';

    if (!num || !docTitle) {
        return currentName || 'kaynak';
    }
    if (currentName.startsWith(`${num} - `)) {
        return currentName;
    }
    return buildEditableSourceFileName(num, docTitle, currentName || 'kaynak.docx', 0);
}
