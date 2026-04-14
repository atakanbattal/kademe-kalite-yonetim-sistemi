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
