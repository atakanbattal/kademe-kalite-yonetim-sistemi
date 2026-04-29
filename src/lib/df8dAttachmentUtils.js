/**
 * non_conformities.attachments / closing_attachments için depolama yolu yardımcıları.
 */

/**
 * Açılış/kapanış ek depo yolu → Supabase Storage bucket adı.
 * Eski kayıtlar `documents` bucket'ında çeşitli prefix'ler altında.
 */
export function getBucketForNcAttachmentPath(storagePath) {
  const p = String(storagePath || '').trim();
  if (!p) return 'df_attachments';
  if (p.startsWith('nc_attachments/')) return 'documents';
  if (p.startsWith('closing_attachments/')) return 'documents';
  if (p.startsWith('nc_closing_attachments/')) return 'documents';
  return 'df_attachments';
}

/** JSONB içinde saklanmış { path } veya düz string yolu üretir */
export function normalizeNcAttachmentPath(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const s = entry.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof entry === 'object' && typeof entry.path === 'string') {
    const s = entry.path.trim();
    return s.length > 0 ? s : null;
  }
  return null;
}

/** Görünüm / form için string yol listesine çevirir */
export function normalizeNcAttachmentPathsList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seen = new Set();
  for (const item of rawList) {
    const p = normalizeNcAttachmentPath(item);
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
