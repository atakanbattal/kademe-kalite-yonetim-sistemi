import {
  ALL_CATEGORY_VALUES,
  getGroupMetaForCategory,
} from './defectCategoriesCore.js';
import { formatOrgUnitForAggregate } from './qualityCostUnitGroups.js';

/** Bilinen liste üzerinden açıklama/metinden hata tipi tahmini (geri uyumluluk + backfill) */
export function inferDefectCategoryFromText(blob) {
  if (!blob || typeof blob !== 'string') return null;
  const low = blob.toLocaleLowerCase('tr-TR');
  /** Uzun eşleşme önce (ör. "Kaynak Gözenek" vs "Kaynak") */
  const sorted = [...ALL_CATEGORY_VALUES].sort((a, b) => (b?.length || 0) - (a?.length || 0));
  for (const cat of sorted) {
    if (!cat) continue;
    const lc = cat.toLocaleLowerCase('tr-TR');
    if (low.includes(lc)) return cat;
  }
  return null;
}

const SCRAP_TYPES = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti'];

const UNCLASS_LABEL = 'Henüz sınıflanmamış';

/** @typedef {{ defect_type: string, amount: number, group_key: string|null, group_label: string, unit_label?: string }} DefectContribution */

/**
 * @param {unknown} li
 * @param {unknown} cost
 * @param {Record<string, unknown>} canonicalUnitCtx
 */
export function scrapReworkUnitLabelFromLine(li, cost, canonicalUnitCtx = {}) {
  if (li?.responsible_type === 'supplier') {
    const name =
      li?.responsible_supplier_name ||
      cost?.supplier?.name ||
      'Bilinmeyen';
    return `Tedarikçi: ${name}`;
  }
  const raw = li?.responsible_unit ?? cost?.unit ?? '';
  return formatOrgUnitForAggregate(raw, canonicalUnitCtx);
}

/**
 * Kalemsiz tek tutar için (hesaplayıcı / tek satır kaynak birimi).
 * @param {unknown} cost
 * @param {Record<string, unknown>} canonicalUnitCtx
 */
export function scrapReworkUnitLabelHeader(cost, canonicalUnitCtx = {}) {
  if (cost?.is_supplier_nc && cost?.supplier_id) {
    return `Tedarikçi: ${cost?.supplier?.name || 'Tedarikçi'}`;
  }
  return formatOrgUnitForAggregate(cost?.unit, canonicalUnitCtx);
}

/**
 * Hurda / yeniden işlem için hata tipine göre tutar satırları (yalnızca sınıflanabilen kalemler).
 * İkinci argüman COPQ/analizde birim etiketi için kullanılabilir (kanonik isim).
 * @param {unknown} cost
 * @param {Record<string, unknown>} [canonicalUnitCtx]
 * @returns {DefectContribution[]}
 */
export function getDefectContributionsFromCost(cost, canonicalUnitCtx = {}) {
  const rows = getScrapReworkMonetaryRows(cost, canonicalUnitCtx).filter((r) => r.classified);
  return rows.map(({ defect_type, amount, group_key, group_label, unit_label }) => ({
    defect_type,
    amount,
    group_key,
    group_label,
    unit_label,
  }));
}

/**
 * Hurda/Yeniden: tutarı olan her kalem/satır için bir kayıt — sınıflanmış / sınıflanmamış birlikte.
 * Birim kaynağı = kalem sorumlu birimi veya (kalemsiz) ana kayıt birimi.
 * @param {unknown} cost
 * @param {Record<string, unknown>} [canonicalUnitCtx]
 * @returns {{ amount: number, defect_type: string|null, group_key: string|null, group_label: string, unit_label: string, classified: boolean }[]}
 */
export function getScrapReworkMonetaryRows(cost, canonicalUnitCtx = {}) {
  const ctype = cost?.cost_type;
  if (!SCRAP_TYPES.includes(ctype || '')) return [];

  const substantive = (li) =>
    (parseFloat(li?.amount) || 0) > 0 ||
    String(li?.part_code || '').trim() ||
    String(li?.part_name || '').trim() ||
    String(li?.description || '').trim();

  const lines = Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
  const subLines = lines.filter(substantive);
  /** Parasal kırılım için COPQ ile aynı: yalnızca tutarı > 0 kalemler */
  const monetaryLines = subLines.filter((li) => (parseFloat(li.amount) || 0) > 0);

  if (monetaryLines.length > 0) {
    /** @type {{ amount: number, defect_type: string|null, group_key: string|null, group_label: string, unit_label: string, classified: boolean }[]} */
    const out = [];
    for (const li of monetaryLines) {
      let dt = li.defect_type && String(li.defect_type).trim() ? String(li.defect_type).trim() : null;
      if (!dt) {
        dt = inferDefectCategoryFromText(
          [li.description, li.part_name, li.part_code, cost?.description].filter(Boolean).join(' ')
        );
      }
      const amt = parseFloat(li.amount) || 0;
      const ul = scrapReworkUnitLabelFromLine(li, cost, canonicalUnitCtx);

      if (dt) {
        const meta = getGroupMetaForCategory(dt);
        const gk = (li.defect_group_key && String(li.defect_group_key)) || meta.key;
        out.push({
          amount: amt,
          defect_type: dt,
          group_key: gk,
          group_label: meta.groupLabel || 'Diğer / Eşlenmemiş',
          unit_label: ul,
          classified: true,
        });
      } else {
        out.push({
          amount: amt,
          defect_type: null,
          group_key: null,
          group_label: UNCLASS_LABEL,
          unit_label: ul,
          classified: false,
        });
      }
    }
    return out;
  }

  const amt = parseFloat(cost?.amount) || 0;
  if (amt <= 0) return [];

  let dt =
    cost?.primary_defect_type && String(cost.primary_defect_type).trim()
      ? String(cost.primary_defect_type).trim()
      : null;
  if (!dt) {
    dt = inferDefectCategoryFromText(
      [cost?.description, cost?.part_name, cost?.part_code, cost?.material_type].filter(Boolean).join(' ')
    );
  }
  const ul = scrapReworkUnitLabelHeader(cost, canonicalUnitCtx);

  if (dt) {
    const meta = getGroupMetaForCategory(dt);
    const gk = cost?.primary_defect_group_key || meta.key;
    return [
      {
        amount: amt,
        defect_type: dt,
        group_key: gk,
        group_label: meta.groupLabel || 'Diğer / Eşlenmemiş',
        unit_label: ul,
        classified: true,
      },
    ];
  }

  return [
    {
      amount: amt,
      defect_type: null,
      group_key: null,
      group_label: UNCLASS_LABEL,
      unit_label: ul,
      classified: false,
    },
  ];
}

const SCRAP_COST_TYPES_FOR_TOTAL = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti'];

function amountForCopqRecord(cost) {
  const lis = cost?.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
  if (lis.length > 0) {
    return lis.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
  }
  return parseFloat(cost?.amount) || 0;
}

/**
 * COPQ ekranı ve PDF raporları için Hurda / Yeniden işlem kırılımı (tek kaynak).
 * @param {unknown[]} costs
 * @param {{ totalCopq?: number, canonicalUnitCtx?: Record<string, unknown>, includeMonetaryRow?: (r: { amount: number, unit_label?: string, classified?: boolean }) => boolean }} [opts]
 * @returns {null | {
 *   totalHr: number,
 *   parsedAmt: number,
 *   classifiedAmt: number,
 *   unclassifiedAmt: number,
 *   reconciliationGap: number,
 *   defectGroupsSorted: { name: string, amount: number, pctOfHr: number }[],
 *   defectTypesSorted: { name: string, amount: number, pctOfHr: number }[],
 *   hrUnitsPivot: object[],
 * }}
 */
export function computeHurdaReworkDefectAnalysis(costs, opts = {}) {
  const totalCopq = opts.totalCopq ?? 0;
  const canonicalUnitCtx = opts.canonicalUnitCtx || {};
  const includeMonetaryRow = opts.includeMonetaryRow;

  const allScrapReworkMonetaryRows = [];
  let hurdaReworkGlobalRecordSum = 0;

  for (const cost of costs || []) {
    const ctype = cost?.cost_type;
    if (!SCRAP_COST_TYPES_FOR_TOTAL.includes(ctype || '')) continue;

    hurdaReworkGlobalRecordSum += amountForCopqRecord(cost);
    const rows = getScrapReworkMonetaryRows(cost, canonicalUnitCtx);
    for (const row of rows) {
      if (includeMonetaryRow && !includeMonetaryRow(row)) continue;
      allScrapReworkMonetaryRows.push(row);
    }
  }

  const rowParsedSum = allScrapReworkMonetaryRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  let hurdaReworkTotalAmount;
  if (includeMonetaryRow) {
    hurdaReworkTotalAmount = rowParsedSum;
  } else {
    hurdaReworkTotalAmount = hurdaReworkGlobalRecordSum;
  }

  if (hurdaReworkTotalAmount <= 0 || allScrapReworkMonetaryRows.length === 0) return null;

  let hrClassifiedAmt = 0;
  let hrUnclassifiedAmt = 0;
  for (const r of allScrapReworkMonetaryRows) {
    if (r.classified) hrClassifiedAmt += r.amount || 0;
    else hrUnclassifiedAmt += r.amount || 0;
  }

  let reconciliationGap = 0;
  if (!includeMonetaryRow) {
    reconciliationGap = hurdaReworkGlobalRecordSum > 0 ? Math.max(0, hurdaReworkGlobalRecordSum - rowParsedSum) : 0;
  }

  const globalHrGroupMap = {};
  const globalHrTypeMap = {};
  const unitPivotScratch = {};

  for (const r of allScrapReworkMonetaryRows) {
    const g = r.group_label || 'Diğer';
    globalHrGroupMap[g] = (globalHrGroupMap[g] || 0) + r.amount;
    const dtype = r.defect_type || 'Hata tipi atanmamış';
    globalHrTypeMap[dtype] = (globalHrTypeMap[dtype] || 0) + r.amount;

    const uk = r.unit_label || 'Belirtilmemiş';
    if (!unitPivotScratch[uk]) {
      unitPivotScratch[uk] = {
        unitLabel: uk,
        total: 0,
        classified: 0,
        unclassified: 0,
        groups: {},
        types: {},
      };
    }
    const uw = unitPivotScratch[uk];
    uw.total += r.amount || 0;
    if (r.classified) uw.classified += r.amount || 0;
    else uw.unclassified += r.amount || 0;
    uw.groups[g] = (uw.groups[g] || 0) + r.amount;
    uw.types[dtype] = (uw.types[dtype] || 0) + r.amount;
  }

  const defectGroupsSorted = Object.entries(globalHrGroupMap)
    .map(([name, amount]) => ({
      name,
      amount,
      pctOfHr: hurdaReworkTotalAmount > 0 ? (amount / hurdaReworkTotalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 14);

  const defectTypesSorted = Object.entries(globalHrTypeMap)
    .map(([name, amount]) => ({
      name,
      amount,
      pctOfHr: hurdaReworkTotalAmount > 0 ? (amount / hurdaReworkTotalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 14);

  const hrUnitsPivot = Object.values(unitPivotScratch)
    .sort((a, b) => b.total - a.total)
    .slice(0, 40)
    .map((u) => ({
      ...u,
      pctOfHrTotal: hurdaReworkTotalAmount > 0 ? (u.total / hurdaReworkTotalAmount) * 100 : 0,
      pctOfCopq: totalCopq > 0 ? (u.total / totalCopq) * 100 : 0,
      pctClassifiedWithinUnit: u.total > 0 ? (u.classified / u.total) * 100 : 0,
      groupsSorted: Object.entries(u.groups || {})
        .map(([key, amt]) => ({
          key,
          amount: amt,
          pctWithinUnit: u.total > 0 ? (amt / u.total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      typesSorted: Object.entries(u.types || {})
        .map(([key, amt]) => ({
          key,
          amount: amt,
          pctWithinUnit: u.total > 0 ? (amt / u.total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    }));

  return {
    totalHr: hurdaReworkTotalAmount,
    parsedAmt: rowParsedSum,
    classifiedAmt: hrClassifiedAmt,
    unclassifiedAmt: hrUnclassifiedAmt,
    reconciliationGap,
    defectGroupsSorted,
    defectTypesSorted,
    hrUnitsPivot,
  };
}
