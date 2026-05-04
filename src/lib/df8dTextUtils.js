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

/** Uygunsuzluk modülü "Grup Özeti Kategori : … Tespit Alanı : … Toplam Kayıt …" tek satır başlığı */
export function shortenGrupOzetiStyleTitle(title) {
  if (title == null || typeof title !== 'string') return title;
  let t = title.trim();
  t = stripSquareBullets(t).trim();
  const fold = t.replace(/\u0307/g, '').toLowerCase();
  if (!fold.includes('grup') || !fold.includes('özet')) return title;
  const m = t.match(/Kategori\s*:\s*(.+?)\s*Tespit\s*Alan[ıiİ]\s*:\s*(.+?)\s+Toplam\s*Kayıt/i);
  if (!m) return title;
  const cat = m[1].trim().replace(/\s+/g, ' ');
  const area = m[2].trim().replace(/\s+/g, ' ');
  return `Grup: ${cat} · ${area}`;
}

/** Kalite maliyetinden gelen "Maliyet Kaydı Detayları Maliyet Türü: … Parça Adı: …" başlığı */
export function shortenMaliyetKaydiDetailsTitle(title) {
  if (title == null || typeof title !== 'string') return title;
  let t = title.trim();
  t = stripSquareBullets(t).trim();
  t = unfoldGluedSectionHeaders(t);
  const fold = t.replace(/\u0307/g, '').toLowerCase();
  if (!fold.includes('maliyet') || !fold.includes('detay')) return title;
  const turM = t.match(/Maliyet\s*Türü\s*:\s*(.+?)\s*Tarih\s*:/i);
  const parcaM = t.match(/Parça\s*Adı\s*:\s*(.+?)\s*Parça\s*Kodu\s*:/i);
  const tur = turM ? turM[1].trim().replace(/\s+/g, ' ') : null;
  const parca = parcaM ? parcaM[1].trim().replace(/\s+/g, ' ') : null;
  if (tur && parca) return `Maliyet: ${tur} — ${parca}`;
  if (parca) return `Maliyet — ${parca}`;
  if (tur) return `Maliyet: ${tur}`;
  return title;
}

/** Kayıt kaydında başlık alanını depolamadan önce şablonları kısaltır */
export function condenseNonConformityTitleString(title) {
  if (title == null || typeof title !== 'string') return title;
  let s = title.trim();
  s = shortenGrupOzetiStyleTitle(s);
  s = shortenMaliyetKaydiDetailsTitle(s);
  s = stripRootCauseAnalysisPromptFromTitle(s);
  return s;
}

function normalizeNcTitleForList(rawTitle, { maxLen = 160 } = {}) {
  let pass = rawTitle.trim();
  pass = shortenGrupOzetiStyleTitle(pass);
  pass = shortenMaliyetKaydiDetailsTitle(pass);
  const shortened = stripRootCauseAnalysisPromptFromTitle(pass);
  let s = stripSquareBullets(shortened.trim());
  if (!s) return null;
  if (s.length > maxLen) return `${s.slice(0, maxLen - 1)}…`;
  return s;
}

/** «[UYG-26-0031] Kategori — parça» veya «UYG-26-0031: …» — liste özetinde asıl açıklama önce gelsin */
function isUyReferenceStyleTitle(t) {
  if (!t || typeof t !== 'string') return false;
  const s = t.trim();
  if (/^\[UYG-\d{2}-\d+]/i.test(s)) return true;
  if (/^UYG-\d{2}-\d+\s*[:\-–]/.test(s)) return true;
  return false;
}

/** Bozuk/birleşik başlık: «MALIYETKAYDIDETAYLARI» */
export function unfoldGluedSectionHeaders(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\bMALIYETKAYDIDETAYLARI\b/gi, 'Maliyet Kaydı Detayları');
}

/**
 * Kalite maliyetinden gelen uzun başlık / açıklama (pipe veya çoklu boşluk ile ayrılmış) için kısa özet.
 */
function extractCostDetailSummary(text) {
  if (!text || typeof text !== 'string') return null;
  const unfolded = unfoldGluedSectionHeaders(text);
  const flat = unfolded.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  if (flat.includes('|')) {
    const turM = flat.match(/Maliyet\s*Türü\s*:\s*([^|]+?)(?=\s*\||$)/i);
    const parcaM = flat.match(/Parça\s*Adı\s*:\s*([^|]+?)(?=\s*\||$)/i);
    const tur = turM ? turM[1].trim() : null;
    const parca = parcaM ? parcaM[1].trim() : null;
    if (tur && parca) return `${tur} — ${parca}`;
    if (tur) return tur;
    if (parca) return parca;
  }

  const turLoose = unfolded.match(/Maliyet\s*Türü\s*:\s*(.+?)(?=\s{2,}Tarih\s*:|\n\n|\s+MAL[Iİ]YET\s+|$)/i);
  const parcaLoose = unfolded.match(/Parça\s*Adı\s*:\s*(.+?)(?=\s{2,}Parça\s*Kodu\s*:|\s{2,}Araç\s*Tipi|\s+MAL[Iİ]YET\s|$)/i);
  const tur = turLoose ? turLoose[1].trim().replace(/\s+/g, ' ') : null;
  const parca = parcaLoose ? parcaLoose[1].trim().replace(/\s+/g, ' ') : null;
  if (tur && parca) return `${tur} — ${parca}`;
  if (tur) return tur;
  if (parca) return parca;
  return null;
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

  if (rawTitle && !isUyReferenceStyleTitle(rawTitle)) {
    const unfoldedTitle = unfoldGluedSectionHeaders(rawTitle);
    const costFromTitle = extractCostDetailSummary(unfoldedTitle);
    if (costFromTitle) {
      const s = normalizeNcTitleForList(costFromTitle);
      if (s) return s;
    }
    const cleaned = normalizeNcTitleForList(unfoldedTitle);
    if (cleaned) return cleaned;
  }

  const pd = record.problem_definition;
  if (typeof pd === 'string' && pd.trim() && !isVerboseGirdiKaliteNcTitle(pd)) {
    const costPd = extractCostDetailSummary(pd);
    if (costPd) {
      const s = normalizeNcTitleForList(costPd);
      if (s) return s;
    }
    const s = normalizeNcTitleForList(unfoldGluedSectionHeaders(pd));
    if (s) return s;
  }

  const desc = record.description;
  if (typeof desc === 'string' && desc.trim()) {
    const costSummary = extractCostDetailSummary(desc);
    if (costSummary) {
      const s = normalizeNcTitleForList(costSummary);
      if (s) return s;
    }
    let first = '';
    const afterAciklama = unfoldGluedSectionHeaders(desc).match(
      /(?:^|\n)\s*(?:Açıklama|Maliyet\s+Kaydı\s+Açıklaması)\s*:\s*\r?\n?\s*([\s\S]+)/i,
    );
    if (afterAciklama) {
      const chunk = afterAciklama[1];
      first =
        chunk
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l.length > 0 && !/^(KAYNAK|ÜRÜN|UYGUNSUZLUK)\s+BİLGİSİ$/i.test(l)) || '';
    }
    if (!first) {
      first = desc
        .split(/\n/)
        .map((l) => l.trim())
        .map((l) => unfoldGluedSectionHeaders(l))
        .find(Boolean) || '';
    }
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

const UYG_REF_PATTERN = /UYG-\d{2}-\d+/i;

/**
 * Tek satır: «UYG-26-0794 | 23.03.2026 | İSTAÇ/736 | x1 | Orta» veya sonda «| açıklama».
 * @returns {{ refNo: string, detectionDate: string, vehicleOrPart: string, quantity: string, severity: string, description?: string } | null}
 */
export function parseOneRelatedNonconformityRecordLine(line) {
  if (line == null || typeof line !== 'string') return null;
  const s = line.replace(/^[-•\s]+/, '').trim();
  if (!UYG_REF_PATTERN.test(s)) return null;
  const parts = s.split(/\s*\|\s*/).map((p) => p.trim());
  if (parts.length < 5) return null;
  if (!/^UYG-\d{2}-\d+$/i.test(parts[0])) return null;
  const row = {
    refNo: parts[0],
    detectionDate: parts[1],
    vehicleOrPart: parts[2],
    quantity: parts[3],
    severity: parts[4],
  };
  if (parts.length > 5) {
    row.description = parts.slice(5).join(' | ');
  }
  return row;
}

/**
 * GRUP → DF/8D dönüşümünde oluşan liste metni: satır sonları veya tek satırda bitişik « UYG-…» blokları.
 * @returns {{ rows: object[], tailNotes: string[] }}
 */
export function parseRelatedNonconformityRecordsBlob(text) {
  const rows = [];
  const tailNotes = [];
  if (text == null || typeof text !== 'string') return { rows, tailNotes };

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return { rows, tailNotes };

  const chunks = [];
  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sub = trimmed
      .split(/(?=\sUYG-\d{2}-\d+)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    chunks.push(...sub);
  }

  for (const chunk of chunks) {
    if (/^İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI$/i.test(chunk.trim())) continue;
    const parsed = parseOneRelatedNonconformityRecordLine(chunk);
    if (parsed) rows.push(parsed);
    else tailNotes.push(chunk);
  }

  return { rows, tailNotes };
}

/** PDF / HTML: ilgili uygunsuzluk listesi için basit kaçış */
export function escapeHtmlForPdfPlain(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Açıklama metninde «İlgili uygunsuzluk kayıtları» bloğunu keser (PDF tablo için).
 * @returns {{ before: string, recordsBlob: string, after: string } | null}
 */
export function triSplitDescriptionForPdfRelatedTable(desc) {
  const text = String(desc ?? '').replace(/\r\n/g, '\n');
  const re = /İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI/;
  const m = text.match(re);
  if (!m || m.index === undefined) return null;
  const before = text.slice(0, m.index).replace(/\s+$/u, '');
  let pos = m.index + m[0].length;
  while (pos < text.length && /[\s\uFEFF]/.test(text[pos])) pos += 1;
  const tail = text.slice(pos);
  const nextSectionM = tail.match(/^\s*(ALINAN\s+ACİL|KAYIT\s+DETAYLARI)/im);
  let recordsBlob;
  let after;
  if (nextSectionM && nextSectionM.index !== undefined) {
    recordsBlob = tail.slice(0, nextSectionM.index).trim();
    after = tail.slice(nextSectionM.index).trim();
  } else {
    recordsBlob = tail.trim();
    after = '';
  }
  return { before, recordsBlob, after };
}

/** İlgili kayıt listesi için PDF/HTML tablo (reportUtils ile uyumlu) */
export function buildPdfHtmlTableForRelatedNonconformityRecords(recordsBlob) {
  const { rows, tailNotes } = parseRelatedNonconformityRecordsBlob(recordsBlob);
  if (!rows.length && !tailNotes.length) return '';

  const esc = escapeHtmlForPdfPlain;
  const hasDesc = rows.some((r) => r.description && String(r.description).trim());

  const head = `
<div style="margin: 14px 0 10px 0;">
  <div style="font-weight: 600; font-size: 13px; color: #1f2937; margin-bottom: 8px;">İlgili uygunsuzluk kayıtları</div>
  <table style="width:100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d1d5db;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left; white-space:nowrap;">Kayıt no</th>
        <th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left; white-space:nowrap;">Tarih</th>
        <th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left;">Araç / parça</th>
        <th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left; white-space:nowrap;">Adet</th>
        <th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left; white-space:nowrap;">Ciddiyet</th>
        ${hasDesc ? '<th style="border:1px solid #d1d5db; padding:6px 8px; text-align:left;">Tespit / açıklama</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td style="border:1px solid #e5e7eb; padding:6px 8px; font-family:ui-monospace,monospace; vertical-align:top;">${esc(r.refNo)}</td>
        <td style="border:1px solid #e5e7eb; padding:6px 8px; white-space:nowrap; vertical-align:top;">${esc(r.detectionDate)}</td>
        <td style="border:1px solid #e5e7eb; padding:6px 8px; vertical-align:top;">${esc(r.vehicleOrPart)}</td>
        <td style="border:1px solid #e5e7eb; padding:6px 8px; white-space:nowrap; vertical-align:top;">${esc(r.quantity)}</td>
        <td style="border:1px solid #e5e7eb; padding:6px 8px; white-space:nowrap; vertical-align:top;">${esc(r.severity)}</td>
        ${hasDesc ? `<td style="border:1px solid #e5e7eb; padding:6px 8px; vertical-align:top;">${esc(r.description || '')}</td>` : ''}
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</div>`;

  if (!tailNotes.length) return head;

  const notes = tailNotes.map((n) => `<li style="margin:2px 0; color:#4b5563;">${esc(n)}</li>`).join('');
  return `${head}<ul style="margin:6px 0 0 18px; padding:0; font-size:11px;">${notes}</ul>`;
}

/** 5N1K «Ne» alanına yanlışlıkla yapışan grup özetini tespit eder (Word/import şişesi). */
export function shouldReplaceGrupOzetiBlobIn5n1kNe(text) {
  if (text == null || typeof text !== 'string') return false;
  const t = stripSquareBullets(text)
    .normalize('NFC')
    .replace(/\u2122/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
  const hasGrup = t.includes('grup') && (t.includes('özet') || t.includes('ozet'));
  const hasKategori = t.includes('kategori');
  const hasToplam =
    t.includes('toplam kayıt') ||
    t.includes('toplam kayit') ||
    t.includes('toplam adet');
  return (hasGrup && hasKategori) || (hasGrup && hasToplam) || (hasKategori && hasToplam && t.length > 40);
}

/**
 * Anlamlı «Ne» metni: 5 neden problemi, sonra açıklamanın ilk anlamlı paragrafı (İlgili UYG listesinden önce).
 */
export function inferMeaningful5n1kNe(record) {
  if (!record || typeof record !== 'object') return '';
  const fw = record.five_why_analysis;
  if (fw && typeof fw === 'object') {
    const prob = fw.problem != null ? String(fw.problem).trim() : '';
    if (prob.length > 3) return prob;
    const w1 = fw.why1 != null ? String(fw.why1).trim() : '';
    if (w1.length > 3) return w1;
  }
  const desc = record.description;
  if (typeof desc !== 'string' || !desc.trim()) return '';
  let d = hasStructuredRootCauseData(record) ? stripDuplicateRootCauseFromProblemDescription(desc) : desc;
  d = stripSquareBullets(d);
  const uyIdx = d.search(/İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI/);
  let head = (uyIdx >= 0 ? d.slice(0, uyIdx) : d).trim();

  const catM = head.match(/Kategori\s*:\s*([^|\n]+)/i);
  const areaM = head.match(/Tespit\s*Alan[ıiİ]\s*:\s*([^|\n]+)/i);
  if (catM || areaM) {
    const cat = catM ? catM[1].trim().replace(/\s+/g, ' ') : '';
    const area = areaM ? areaM[1].trim().replace(/\s+/g, ' ') : '';
    const merged = [cat, area].filter(Boolean).join(' · ');
    if (merged.length > 5) return merged;
  }

  const blocks = head
    .split(/\n\s*\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const firstPara = blocks.find(
    (x) =>
      x.length > 12 &&
      !shouldReplaceGrupOzetiBlobIn5n1kNe(x) &&
      !/^([A-ZÇĞİÖŞÜ][^:\n]{0,48}):\s*$/i.test(x)
  );
  if (firstPara) return firstPara.length > 900 ? `${firstPara.slice(0, 897)}…` : firstPara;

  const line = head
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 12 && !shouldReplaceGrupOzetiBlobIn5n1kNe(l));
  return line && line.length > 900 ? `${line.slice(0, 897)}…` : line || '';
}

/** DF-2026-048 / 8D-2025-001 sonundan Yıl + sıra no ayıklar (tüm rakamları birleştirmek yerine). */
export function parseDf8dNcSortKey(record) {
  const raw = String(record?.nc_number || record?.mdi_no || '').trim();
  if (!raw) return null;
  const m = raw.match(/(\d{4})[-\s/]+(\d+)\s*$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const serial = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(serial)) return null;
  return { year, serial, raw };
}

function recordPrimaryOpenedMs(record) {
  const raw = record?.df_opened_at || record?.created_at;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Liste / PDF: önce tip (DF → 8D → MDI), farklı yıllarda en yeni yıl önce.
 * 8D: aynı yıl içinde sıra no küçükten büyüğe (001 … 048).
 * DF ve MDI: aynı yıl içinde sıra no büyükten küçüğe (en yeni kayıt üstte).
 */
export function compareDf8dRecordsForModuleList(a, b) {
  const rank = (t) => (t === 'DF' ? 0 : t === '8D' ? 1 : t === 'MDI' ? 2 : 3);
  const ra = rank(a?.type);
  const rb = rank(b?.type);
  if (ra !== rb) return ra - rb;

  const type = a?.type;
  const serialNewestFirst = type === 'DF' || type === 'MDI';

  const pa = parseDf8dNcSortKey(a);
  const pb = parseDf8dNcSortKey(b);
  if (pa && pb) {
    if (pa.year !== pb.year) return pb.year - pa.year;
    if (pa.serial !== pb.serial) {
      return serialNewestFirst ? pb.serial - pa.serial : pa.serial - pb.serial;
    }
    const c = pa.raw.localeCompare(pb.raw, 'tr', { numeric: true, sensitivity: 'base' });
    if (c !== 0) return serialNewestFirst ? -c : c;
  } else {
    const sa = String(a?.nc_number || a?.mdi_no || '');
    const sb = String(b?.nc_number || b?.mdi_no || '');
    const c = sa.localeCompare(sb, 'tr', { numeric: true, sensitivity: 'base' });
    if (c !== 0) return serialNewestFirst ? -c : c;
  }

  const tb = recordPrimaryOpenedMs(b);
  const ta = recordPrimaryOpenedMs(a);
  if (tb !== ta) return tb - ta;

  const ia = String(a?.id || '');
  const ib = String(b?.id || '');
  return ia.localeCompare(ib);
}
