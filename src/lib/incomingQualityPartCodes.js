/**
 * Girdi kalite: muayene ↔ kontrol planı eşlemesi (trim + tutarlı karşılaştırma).
 */
export function normalizeIncomingPartCode(code) {
  if (code == null || code === '') return '';
  return String(code).trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
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

/**
 * PostgREST URL uzunluğu / 400 Bad Request sınırını aşmamak için in / not.in listelerini parçalar.
 * not.in için: her parça üzerinde ayrı filter AND ile birleşir → birleşik kümenin dışı.
 * in için: parçalar .or() ile birleşir → birleşik küme içinde.
 */
const POSTGREST_PART_CODE_IN_CHUNK_SIZE = 40;

function chunkTrimmedPartCodes(trimmedCodes) {
  const chunks = [];
  for (let i = 0; i < trimmedCodes.length; i += POSTGREST_PART_CODE_IN_CHUNK_SIZE) {
    chunks.push(trimmedCodes.slice(i, i + POSTGREST_PART_CODE_IN_CHUNK_SIZE));
  }
  return chunks;
}

/** Supabase sorgu zincirine part_code IN (çok değer, OR parçaları). */
export function applyPartCodeInFilterChunks(query, trimmedPartCodes) {
  const chunks = chunkTrimmedPartCodes(trimmedPartCodes);
  if (chunks.length === 0) {
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  if (chunks.length === 1) {
    const inList = formatPartCodesForPostgrestInFilter(chunks[0]);
    return inList ? query.filter('part_code', 'in', inList) : query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  const orParts = chunks
    .map((chunk) => {
      const inList = formatPartCodesForPostgrestInFilter(chunk);
      return inList ? `part_code.in.${inList}` : null;
    })
    .filter(Boolean);
  return orParts.length ? query.or(orParts.join(',')) : query.eq('id', '00000000-0000-0000-0000-000000000000');
}

/** Supabase sorgu zincirine part_code NOT IN (çok değer, AND parçaları). */
export function applyPartCodeNotInFilterChunks(query, trimmedPartCodes) {
  const chunks = chunkTrimmedPartCodes(trimmedPartCodes);
  let q = query;
  for (const chunk of chunks) {
    const inList = formatPartCodesForPostgrestInFilter(chunk);
    if (inList) q = q.filter('part_code', 'not.in', inList);
  }
  return q;
}
