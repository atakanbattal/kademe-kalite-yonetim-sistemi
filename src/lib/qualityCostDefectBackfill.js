import { getGroupMetaForCategory } from './defectCategoriesCore.js';
import { inferDefectCategoryFromText } from './qualityCostDefectAggregation.js';

const TARGET_TYPES = new Set(['Hurda Maliyeti', 'Yeniden İşlem Maliyeti']);

const substantiveLine = (li) =>
  (parseFloat(li?.amount) || 0) > 0 ||
  String(li?.part_code || '').trim() !== '' ||
  String(li?.part_name || '').trim() !== '' ||
  String(li?.description || '').trim() !== '';

function headerTextBlob(cost) {
  return [cost?.description, cost?.part_name, cost?.part_code, cost?.material_type, cost?.reporting_unit, cost?.invoice_number]
    .filter(Boolean)
    .join(' ');
}

function lineTextBlob(li, cost) {
  return [li?.description, li?.part_name, li?.part_code, cost?.description].filter(Boolean).join(' ');
}

/**
 * Mevcut DB satırı için: açıklamalardan hata tipi tahmini alanlarını üretir (yalnızca boş alanları doldurur).
 * @returns {{ changed: boolean, patch: Record<string, unknown> }}
 */
export function buildQualityCostDefectBackfillPatch(cost) {
  if (!cost?.id || !TARGET_TYPES.has(cost.cost_type || '')) {
    return { changed: false, patch: {} };
  }

  const lines = Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
  const subs = lines.filter(substantiveLine);

  const patch = {};

  if (subs.length > 0) {
    let any = false;
    const newLines = lines.map((li) => {
      if (!substantiveLine(li)) return li;
      const hasDef = li.defect_type && String(li.defect_type).trim();
      if (hasDef) return li;
      const inferred = inferDefectCategoryFromText(lineTextBlob(li, cost));
      if (!inferred) return li;
      any = true;
      const meta = getGroupMetaForCategory(inferred);
      return {
        ...li,
        defect_type: inferred,
        defect_group_key: meta.key || '',
      };
    });
    if (any) {
      patch.cost_line_items = newLines;
      patch.primary_defect_type = null;
      patch.primary_defect_group_key = null;
    }
  } else {
    const hasPrimary = cost.primary_defect_type && String(cost.primary_defect_type).trim();
    if (!hasPrimary) {
      const inferred = inferDefectCategoryFromText(headerTextBlob(cost));
      if (inferred) {
        const meta = getGroupMetaForCategory(inferred);
        patch.primary_defect_type = inferred;
        patch.primary_defect_group_key = meta.key || '';
      }
    }
  }

  return { changed: Object.keys(patch).length > 0, patch };
}
