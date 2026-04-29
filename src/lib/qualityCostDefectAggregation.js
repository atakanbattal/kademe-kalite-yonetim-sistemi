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
 * @returns {{ amount: number, defect_type: string|null, group_key: string|null, group_label: string, unit_label: string, classified: boolean, maliyetGrubu: 'hurda'|'yeniden' }[]}
 */
export function getScrapReworkMonetaryRows(cost, canonicalUnitCtx = {}) {
  const ctype = cost?.cost_type;
  if (!SCRAP_TYPES.includes(ctype || '')) return [];

  const maliyetGrubu = ctype === 'Hurda Maliyeti' ? 'hurda' : 'yeniden';

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
          maliyetGrubu,
        });
      } else {
        out.push({
          amount: amt,
          defect_type: null,
          group_key: null,
          group_label: UNCLASS_LABEL,
          unit_label: ul,
          classified: false,
          maliyetGrubu,
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
        maliyetGrubu,
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
      maliyetGrubu,
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
 *   totalHurda: number,
 *   totalYeniden: number,
 *   parsedAmt: number,
 *   classifiedAmt: number,
 *   classifiedAmtHurda: number,
 *   classifiedAmtYeniden: number,
 *   unclassifiedAmt: number,
 *   unclassifiedAmtHurda: number,
 *   unclassifiedAmtYeniden: number,
 *   reconciliationGap: number,
 *   reconciliationGapHurda: number,
 *   reconciliationGapYeniden: number,
 *   defectGroupsSorted: { name: string, amountHurda: number, amountYeniden: number, amount: number, pctOfHurda: number, pctOfYeniden: number }[],
 *   defectTypesSorted: { name: string, amountHurda: number, amountYeniden: number, amount: number, pctOfHurda: number, pctOfYeniden: number }[],
 *   hrUnitsPivot: object[],
 * }}
 */
export function computeHurdaReworkDefectAnalysis(costs, opts = {}) {
  const totalCopq = opts.totalCopq ?? 0;
  const canonicalUnitCtx = opts.canonicalUnitCtx || {};
  const includeMonetaryRow = opts.includeMonetaryRow;

  const allScrapReworkMonetaryRows = [];
  let recordSumHurda = 0;
  let recordSumYeniden = 0;

  for (const cost of costs || []) {
    const ctype = cost?.cost_type;
    if (!SCRAP_COST_TYPES_FOR_TOTAL.includes(ctype || '')) continue;

    const recAmt = amountForCopqRecord(cost);
    if (ctype === 'Hurda Maliyeti') recordSumHurda += recAmt;
    else if (ctype === 'Yeniden İşlem Maliyeti') recordSumYeniden += recAmt;

    const rows = getScrapReworkMonetaryRows(cost, canonicalUnitCtx);
    for (const row of rows) {
      if (includeMonetaryRow && !includeMonetaryRow(row)) continue;
      allScrapReworkMonetaryRows.push(row);
    }
  }

  const sumAmt = (r) => parseFloat(r.amount) || 0;
  let sumHurda = 0;
  let sumYeniden = 0;
  for (const r of allScrapReworkMonetaryRows) {
    if (r.maliyetGrubu === 'yeniden') sumYeniden += sumAmt(r);
    else sumHurda += sumAmt(r);
  }

  const rowParsedSum = sumHurda + sumYeniden;

  let hurdaReworkTotalAmount;
  if (includeMonetaryRow) {
    hurdaReworkTotalAmount = rowParsedSum;
  } else {
    hurdaReworkTotalAmount = recordSumHurda + recordSumYeniden;
  }

  if (hurdaReworkTotalAmount <= 0 || allScrapReworkMonetaryRows.length === 0) return null;

  let classifiedAmt = 0;
  let classifiedAmtHurda = 0;
  let classifiedAmtYeniden = 0;
  let unclassifiedAmt = 0;
  let unclassifiedAmtHurda = 0;
  let unclassifiedAmtYeniden = 0;
  for (const r of allScrapReworkMonetaryRows) {
    const a = sumAmt(r);
    const isY = r.maliyetGrubu === 'yeniden';
    if (r.classified) {
      classifiedAmt += a;
      if (isY) classifiedAmtYeniden += a;
      else classifiedAmtHurda += a;
    } else {
      unclassifiedAmt += a;
      if (isY) unclassifiedAmtYeniden += a;
      else unclassifiedAmtHurda += a;
    }
  }

  let reconciliationGap = 0;
  let reconciliationGapHurda = 0;
  let reconciliationGapYeniden = 0;
  if (!includeMonetaryRow) {
    const parsedHurda = sumHurda;
    const parsedYeniden = sumYeniden;
    reconciliationGapHurda = Math.max(0, recordSumHurda - parsedHurda);
    reconciliationGapYeniden = Math.max(0, recordSumYeniden - parsedYeniden);
    reconciliationGap = reconciliationGapHurda + reconciliationGapYeniden;
  }

  const bump = (agg, label, amt, grp) => {
    if (!agg[label]) agg[label] = { hurda: 0, yeniden: 0 };
    agg[label][grp] += amt;
  };

  const globalHrGroupMap = {};
  const globalHrTypeMap = {};
  const unitPivotScratch = {};

  for (const r of allScrapReworkMonetaryRows) {
    const a = sumAmt(r);
    const grp = r.maliyetGrubu === 'yeniden' ? 'yeniden' : 'hurda';
    const gl = r.group_label || 'Diğer';
    bump(globalHrGroupMap, gl, a, grp);

    const dtype = r.defect_type || 'Hata tipi atanmamış';
    bump(globalHrTypeMap, dtype, a, grp);

    const uk = r.unit_label || 'Belirtilmemiş';
    if (!unitPivotScratch[uk]) {
      unitPivotScratch[uk] = {
        unitLabel: uk,
        totalHurda: 0,
        totalYeniden: 0,
        classifiedHurda: 0,
        classifiedYeniden: 0,
        unclassifiedHurda: 0,
        unclassifiedYeniden: 0,
        groups: {},
        types: {},
      };
    }
    const uw = unitPivotScratch[uk];
    uw.totalHurda += grp === 'hurda' ? a : 0;
    uw.totalYeniden += grp === 'yeniden' ? a : 0;
    if (r.classified) {
      uw.classifiedHurda += grp === 'hurda' ? a : 0;
      uw.classifiedYeniden += grp === 'yeniden' ? a : 0;
    } else {
      uw.unclassifiedHurda += grp === 'hurda' ? a : 0;
      uw.unclassifiedYeniden += grp === 'yeniden' ? a : 0;
    }
    bump(uw.groups, gl, a, grp);
    bump(uw.types, dtype, a, grp);
  }

  const mapSplitToSorted = (
    agg,
    denomH,
    denomY,
  ) =>
    Object.entries(agg)
      .map(([name, hv]) => {
        const ah = hv.hurda || 0;
        const ay = hv.yeniden || 0;
        const at = ah + ay;
        return {
          name,
          amountHurda: ah,
          amountYeniden: ay,
          amount: at,
          pctOfHurda: denomH > 0 ? (ah / denomH) * 100 : 0,
          pctOfYeniden: denomY > 0 ? (ay / denomY) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 14);

  const denomHParsed = sumHurda;
  const denomYParsed = sumYeniden;

  const defectGroupsSorted = mapSplitToSorted(globalHrGroupMap, denomHParsed, denomYParsed);
  const defectTypesSorted = mapSplitToSorted(globalHrTypeMap, denomHParsed, denomYParsed);

  const hrUnitsPivot = Object.values(unitPivotScratch)
    .map((u) => {
      const total = u.totalHurda + u.totalYeniden;
      const row = {
        ...u,
        total,
        unclassified: u.unclassifiedHurda + u.unclassifiedYeniden,
        pctHurdaOfPool: denomHParsed > 0 ? (u.totalHurda / denomHParsed) * 100 : 0,
        pctYenidenOfPool: denomYParsed > 0 ? (u.totalYeniden / denomYParsed) * 100 : 0,
        pctOfHrTotal: hurdaReworkTotalAmount > 0 ? (total / hurdaReworkTotalAmount) * 100 : 0,
        pctOfCopq: totalCopq > 0 ? (total / totalCopq) * 100 : 0,
        pctClassifiedWithinUnit:
          total > 0 ? ((u.classifiedHurda + u.classifiedYeniden) / total) * 100 : 0,
        groupsSorted: Object.entries(u.groups || {})
          .map(([key, hv]) => {
            const ah = hv.hurda || 0;
            const ay = hv.yeniden || 0;
            const at = ah + ay;
            return {
              key,
              amountHurda: ah,
              amountYeniden: ay,
              amount: at,
              pctWithinUnit: total > 0 ? (at / total) * 100 : 0,
            };
          })
          .sort((a, b) => b.amount - a.amount),
        typesSorted: Object.entries(u.types || {})
          .map(([key, hv]) => {
            const ah = hv.hurda || 0;
            const ay = hv.yeniden || 0;
            const at = ah + ay;
            return {
              key,
              amountHurda: ah,
              amountYeniden: ay,
              amount: at,
              pctWithinUnit: total > 0 ? (at / total) * 100 : 0,
            };
          })
          .sort((a, b) => b.amount - a.amount),
      };
      delete row.groups;
      delete row.types;
      return row;
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 40);

  return {
    totalHr: hurdaReworkTotalAmount,
    totalHurda: denomHParsed,
    totalYeniden: denomYParsed,
    parsedAmt: rowParsedSum,
    classifiedAmt,
    classifiedAmtHurda,
    classifiedAmtYeniden,
    unclassifiedAmt,
    unclassifiedAmtHurda,
    unclassifiedAmtYeniden,
    reconciliationGap,
    reconciliationGapHurda,
    reconciliationGapYeniden,
    defectGroupsSorted,
    defectTypesSorted,
    hrUnitsPivot,
  };
}

/**
 * COPQ hurda/yeniden pivot satırından ilgili kalite maliyeti kayıtlarını döner.
 * @param {unknown[]} costs
 * @param {Record<string, unknown>} canonicalUnitCtx
 * @param {{ scope?: 'global'|'unit', unitLabel?: string, dimension: 'group'|'type', key: string }} spec
 * @returns {unknown[]}
 */
export function filterCostsForHurdaReworkPivotDrill(costs, canonicalUnitCtx = {}, spec) {
  const { scope = 'unit', unitLabel, dimension, key } = spec || {};
  if (!dimension || key == null || key === '') return [];

  /** @type {unknown[]} */
  const out = [];
  const seen = new Set();

  for (const cost of costs || []) {
    const ctype = cost?.cost_type;
    if (!SCRAP_COST_TYPES_FOR_TOTAL.includes(ctype || '')) continue;

    const rows = getScrapReworkMonetaryRows(cost, canonicalUnitCtx);

    for (const r of rows) {
      const ul = r.unit_label || 'Belirtilmemiş';
      if (scope === 'unit' && ul !== unitLabel) continue;

      const ok =
        dimension === 'group'
          ? (r.group_label || 'Diğer') === key
          : (r.defect_type || 'Hata tipi atanmamış') === key;

      if (ok && !seen.has(cost.id)) {
        seen.add(cost.id);
        out.push(cost);
        break;
      }
    }
  }

  return out;
}
