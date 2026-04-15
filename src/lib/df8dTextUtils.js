/**
 * Kare / madde işaretlerini (■ ▪ ◼ vb.) metinden kaldırır; satır başındaki fazla boşlukları sadeleştirir.
 */
export function stripSquareBullets(text) {
  if (text == null || typeof text !== 'string') return text;
  return text
    .replace(/^[\s\uFEFF]*■[\s\uFEFF]*/gm, '')
    .replace(/[\u25A0\u25AA\u25FE\u25AB\u2588■]/g, '');
}

/** Proses kontrol planı: vehicle_type virgülle ayrılmış araç modelleri */
export function parseProcessControlVehicleTypes(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * DF/8D problem tanımı içinde numaralı bölüm başlıkları (İlerleme, Kök neden vb.) varsa
 * yapılandırılmış kart görünümü metni yanlış böler; düz metin göster.
 */
export function shouldRenderDf8dProblemDescriptionAsPlain(text) {
  if (!text || typeof text !== 'string') return false;
  if (/\d+\.\s*(İLERLEME|KÖK\s*NEDEN|5\s*N1K|5\s*NEDEN|PROBLEM\s*TANIM)/i.test(text)) return true;
  if (/\d+\.\s*[A-ZÇĞİÖŞÜ][^\n]{0,120}(İLERLEME|KÖK\s*NEDEN|ANALİZ)/i.test(text)) return true;
  if (/\n[^\n]{0,40}5\s*N1K\s+Analizi/i.test(text) && text.length > 350) return true;
  return false;
}

const nzVal = (v) => v != null && String(v).trim() !== '';

/** JSON alanlarında kök neden analizi var mı? (Problem tanımından mükerrer metin sürmek için) */
export function hasStructuredRootCauseData(record) {
  if (!record || typeof record !== 'object') return false;
  const f5 = record.five_n1k_analysis;
  const w5 = record.five_why_analysis;
  const ish = record.ishikawa_analysis;
  const fta = record.fta_analysis;

  if (f5 && typeof f5 === 'object' && Object.values(f5).some(nzVal)) return true;
  if (w5 && typeof w5 === 'object' && Object.values(w5).some(nzVal)) return true;
  if (ish && typeof ish === 'object') {
    const anyIsh = Object.values(ish).some((v) => {
      if (Array.isArray(v)) return v.some(nzVal);
      return nzVal(v);
    });
    if (anyIsh) return true;
  }
  if (fta && typeof fta === 'object') {
    const anyFta = Object.values(fta).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      return nzVal(v);
    });
    if (anyFta) return true;
  }
  return false;
}

/**
 * Açıklama metnine yapışmış "3. KÖK NEDEN...", "5N1K Analizi", "5 Neden Analizi" bloklarını keser.
 * Bu içerik zaten Kök Neden Analizleri bölümünde gösterildiğinde Problem Tanımı'nda tekrar etmesin.
 */
export function stripDuplicateRootCauseFromProblemDescription(text) {
  if (!text || typeof text !== 'string') return '';
  const patterns = [
    /\d+\.\s*KÖK\s*NEDEN(?:\s*ANALİZİ?)?/i,
    /5\s*N1K\s+ANALİZİ/i,
    /5\s*N1K\s+Analizi/i,
    /5\s*Neden\s+Analizi/i,
    /5\s*NEDEN\s+ANALİZİ/i,
  ];
  let cut = text.length;
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  if (cut >= text.length) return text.trim();
  return text.slice(0, cut).trim();
}
