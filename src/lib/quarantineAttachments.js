/** Karantina kaydı attachments JSONB normalizasyonu */
export function normalizeQuarantineAttachments(raw) {
    if (!raw) return [];
    let arr = raw;
    if (typeof raw === 'string') {
        try {
            arr = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(arr)) return [];
    return arr
        .map((item) => {
            if (typeof item === 'string') {
                return {
                    name: item.split('/').pop() || 'Dosya',
                    path: item,
                    mime_type: null,
                    public_url: null,
                };
            }
            return {
                name: item.name || 'Dosya',
                path: item.path || '',
                mime_type: item.mime_type || null,
                public_url: item.public_url || null,
                kind: item.kind || null,
                decision: item.decision || null,
            };
        })
        .filter((x) => x.path);
}
