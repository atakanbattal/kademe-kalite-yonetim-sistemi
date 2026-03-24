/**
 * Girdi kalite: muayene ↔ kontrol planı eşlemesi (trim + tutarlı karşılaştırma).
 */
export function normalizeIncomingPartCode(code) {
  if (code == null || code === '') return '';
  return String(code).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** PostgREST in / not.in listesi için metin tırnaklama (tire, özel karakter güvenli). */
export function quotePartCodeForPostgrestList(code) {
  const t = String(code ?? '').trim();
  if (!t) return null;
  return `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * part_code listesinden PostgREST in.(...) / not.in.(...) value kısmını üretir: ("a","b")
 * Supabase .in() tire içeren kodları tırnaklamadığı için filter() ile kullanın.
 */
export function formatPartCodesForPostgrestInFilter(codes) {
  const seen = new Set();
  const quoted = [];
  for (const c of codes || []) {
    const t = String(c ?? '').trim();
    if (!t) continue;
    const key = normalizeIncomingPartCode(t);
    if (seen.has(key)) continue;
    seen.add(key);
    const q = quotePartCodeForPostgrestList(t);
    if (q) quoted.push(q);
  }
  if (!quoted.length) return null;
  return `(${quoted.join(',')})`;
}

/** Kontrol planı satırlarından benzersiz trim'li parça kodları (SQL filtre için). */
export function uniqueTrimmedPartCodesFromPlans(plans) {
  const seen = new Set();
  const out = [];
  for (const p of plans || []) {
    const t = p?.part_code != null ? String(p.part_code).trim() : '';
    if (!t) continue;
    const key = normalizeIncomingPartCode(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Plan listesinden normalize anahtar Set'i (UI durumu: Mevcut / Mevcut Değil). */
export function buildControlPlanNormalizedKeySet(plans) {
  const set = new Set();
  for (const p of plans || []) {
    const key = normalizeIncomingPartCode(p?.part_code);
    if (key) set.add(key);
  }
  return set;
}
