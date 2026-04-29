/**
 * non_conformities.attachments / closing_attachments için depolama yolu yardımcıları.
 * (Eski sürümde yol–kayıt id eşleştirmesi çok agresifti: klasördeki uuid satır id'siyle
 * farklı olduğunda tüm ekler gizleniyordu; bu dosyada yalnızca normalizasyon tutulur.)
 */

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
  for (const item of rawList) {
    const p = normalizeNcAttachmentPath(item);
    if (p) out.push(p);
  }
  return out;
}
