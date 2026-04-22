/**
 * Kare / madde işaretlerini (■ ▪ ◼ vb.) metinden kaldırır; satır başındaki fazla boşlukları sadeleştirir.
 */
export function stripSquareBullets(text) {
  if (text == null || typeof text !== 'string') return text;
  return text
    .replace(/^[\s\uFEFF]*■[\s\uFEFF]*/gm, '')
    .replace(/[\u25A0\u25AA\u25FE\u25AB\u2588■]/g, '');
}

/**
 * Girdi kalite modülünden gelen otomatik açıklama metninin yanlışlıkla başlık alanına
 * yapıştırıldığı durumlar (çok uzun, "Kayıt No:" içerir).
 */
export function isVerboseGirdiKaliteNcTitle(title) {
  if (title == null || typeof title !== 'string') return false;
  const t = title.trim();
  if (t.length < 80) return false;
  const collapsed = t.replace(/\u0307/g, '').toLowerCase();
  const hasRecordNo =
    t.includes('Kayıt No:') ||
    t.includes('Kayit No:') ||
    collapsed.includes('kayit no');
  const looksGkK =
    t.length >= 80 &&
    collapsed.includes('girdi') &&
    (collapsed.includes('kalite') || collapsed.includes('kontrol')) &&
    hasRecordNo;
  return looksGkK;
}

/** Liste / rapor için kısa GKK başlığı (tedarikçi + parça). */
export function buildShortGirdiKaliteNcTitle({ supplierName, partName, partCode } = {}) {
  const part = (partName && String(partName).trim()) || (partCode && String(partCode).trim()) || null;
  const sup = supplierName && String(supplierName).trim();
  if (sup && part) return `Girdi Kalite - ${sup} - ${part}`;
  if (part) return `Girdi Kalite - ${part}`;
  if (sup) return `Girdi Kalite - ${sup}`;
  return 'Girdi Kalite Uygunsuzluğu';
}

function parseGkKBlobForDisplay(blob) {
  if (!blob || typeof blob !== 'string') return { supplier: null, part: null };
  const tedarikci = blob.match(/Tedarikçi:\s*([\s\S]+?)(?=\s+Parça\s+Adı:|\s+Parça\s+Kodu:|$)/i);
  const parcaAdi = blob.match(/Parça\s+Adı:\s*([\s\S]+?)(?=\s+Parça\s+Kodu:|\s+Gelen|\s+Nihai|$)/i);
  return {
    supplier: tedarikci ? tedarikci[1].trim().replace(/\s+/g, ' ') : null,
    part: parcaAdi ? parcaAdi[1].trim().replace(/\s+/g, ' ') : null,
  };
}

/**
 * Başlığa yapışan "3. Kök Neden Analizi 5N1k … Ne: Nerede: …" şablonunu keser.
 * DB'de Analizi̇ gibi NFD birleşik noktalı i kullanıldığı için "Anali" sonrası her şey atılır.
 */
export function stripRootCauseAnalysisPromptFromTitle(title) {
  if (title == null || typeof title !== 'string') return title;
  let s = title;
  s = s.replace(/\s+3\.\s*Kök\s*Neden\s*Anali[\s\S]*/i, '').trim();
  s = s.replace(/\s+5\s*n1k\s+analiz[\s\S]*/i, '').trim();
  return s;
}

function normalizeNcTitleForList(rawTitle, { maxLen = 160 } = {}) {
  const shortened = stripRootCauseAnalysisPromptFromTitle(rawTitle.trim());
  let s = stripSquareBullets(shortened.trim());
  if (!s) return null;
  if (s.length > maxLen) return `${s.slice(0, maxLen - 1)}…`;
  return s;
}

/**
 * DF/8D tablo ve listelerinde gösterilecek başlık: gereksiz GKK şablonunu gizler.
 * @param {string} [emptyLabel='—'] Raporlarda '-' geçmek için kullanılabilir.
 */
export function getNonConformityListTitle(record, emptyLabel = '—') {
  if (!record) return emptyLabel;
  const rawTitle = typeof record.title === 'string' ? record.title.trim() : '';

  if (rawTitle && isVerboseGirdiKaliteNcTitle(rawTitle)) {
    const fromRow = buildShortGirdiKaliteNcTitle({
      supplierName: record.supplier?.name,
      partName: record.part_name,
      partCode: record.part_code,
    });
    if (fromRow !== 'Girdi Kalite Uygunsuzluğu') return fromRow;
    const parsed = parseGkKBlobForDisplay(rawTitle);
    const fromParsed = buildShortGirdiKaliteNcTitle({
      supplierName: parsed.supplier,
      partName: parsed.part,
      partCode: record.part_code,
    });
    if (fromParsed !== 'Girdi Kalite Uygunsuzluğu') return fromParsed;
  }

  if (rawTitle) {
    const cleaned = normalizeNcTitleForList(rawTitle);
    if (cleaned) return cleaned;
  }

  const pd = record.problem_definition;
  if (typeof pd === 'string' && pd.trim() && !isVerboseGirdiKaliteNcTitle(pd)) {
    const s = normalizeNcTitleForList(pd);
    if (s) return s;
  }

  const desc = record.description;
  if (typeof desc === 'string' && desc.trim()) {
    const first = desc.split(/\n/).map((l) => l.trim()).find(Boolean) || '';
    if (first && !isVerboseGirdiKaliteNcTitle(first)) {
      const s = normalizeNcTitleForList(first);
      if (s) return s;
    }
  }

  return emptyLabel;
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
