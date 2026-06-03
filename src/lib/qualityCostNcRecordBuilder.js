/**
 * Kalite maliyeti kaynağından non_conformities insert payload üretir.
 * UI (VehiclePerformancePanel) ve backfill script tarafından paylaşılır.
 */

import { addMonths } from 'date-fns';
import { buildQualityCostDraftAnalyses } from './qualityCostNcDraftAnalysis.js';
import { getCostNcSuggestion } from './qualityCostSuggestion.js';

const toIsoDate = (date) => {
    if (!date) return new Date().toISOString().split('T')[0];
    try {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
};

const fmtCurrency = (amount) =>
    typeof amount === 'number' && Number.isFinite(amount)
        ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
        : '';

export function buildQualityCostNcTitle(cost, analysisContext = {}) {
    const parts = [`Kalite Maliyeti: ${cost?.cost_type || 'Maliyet'}`];
    if (cost?.part_name) parts.push(cost.part_name);
    else if (cost?.part_code) parts.push(cost.part_code);
    if (cost?.vehicle_type || analysisContext?.vehicleType) {
        parts.push(cost?.vehicle_type || analysisContext.vehicleType);
    }
    return parts.join(' - ');
}

export function buildQualityCostNcDescription(cost, analysisContext = {}) {
    const lines = ['Araç Bazlı Hedef Analizinden Otomatik Başlatıldı'];

    if (analysisContext?.dateRangeLabel) lines.push(`Dönem: ${analysisContext.dateRangeLabel}`);
    if (analysisContext?.vehicleType || cost?.vehicle_type) {
        lines.push(`Araç Tipi: ${analysisContext?.vehicleType || cost?.vehicle_type}`);
    }
    if (analysisContext?.metricLabel) lines.push(`Metrik: ${analysisContext.metricLabel}`);
    if (typeof analysisContext?.totalVehicles === 'number') {
        lines.push(`Analize Giren Araç: ${analysisContext.totalVehicles}`);
    }
    if (typeof analysisContext?.actualValue === 'number') {
        lines.push(`Gerçekleşen: ${analysisContext.actualValue}`);
    }
    if (typeof analysisContext?.targetValue === 'number' && analysisContext.targetValue > 0) {
        lines.push(`Hedef: ${analysisContext.targetValue}`);
    }

    lines.push('', 'Maliyet Kaydı Özeti');
    if (cost?.cost_type) lines.push(`Maliyet Türü: ${cost.cost_type}`);
    if (cost?.cost_date) {
        lines.push(`Tarih: ${new Date(cost.cost_date).toLocaleDateString('tr-TR')}`);
    }
    if (cost?.unit) lines.push(`Birim: ${cost.unit}`);
    if (cost?.part_name) lines.push(`Parça Adı: ${cost.part_name}`);
    if (cost?.part_code) lines.push(`Parça Kodu: ${cost.part_code}`);
    if (cost?.vehicle_type) lines.push(`Araç Tipi: ${cost.vehicle_type}`);
    if (cost?.amount) lines.push(`Tutar: ${fmtCurrency(parseFloat(cost.amount))}`);
    if (cost?.quantity) {
        lines.push(`Miktar: ${cost.quantity}${cost.measurement_unit ? ` ${cost.measurement_unit}` : ''}`);
    }
    if (cost?.scrap_weight) lines.push(`Hurda Ağırlığı: ${cost.scrap_weight} kg`);
    if (cost?.rework_duration) lines.push(`Yeniden İşlem Süresi: ${cost.rework_duration} dk`);
    if (cost?.description) {
        lines.push('', 'Açıklama', cost.description);
    }

    return lines.join('\n');
}

/**
 * @param {object} cost — quality_costs satırı
 * @param {object} options
 * @param {'DF'|'8D'|'MDI'|null} [options.ncType] — null ise eşikten hesaplanır
 * @param {object} [options.analysisContext] — VehiclePerformancePanel bağlamı
 * @param {object} [options.suggestionSettings]
 * @param {object[]} [options.allCosts] — tekrar sayımı için
 * @param {boolean} [options.autoComplete=false] — Kapatıldı + closing_notes
 * @param {string} [options.requestingPerson]
 */
export function buildQualityCostNcRecord(cost, options = {}) {
    const {
        ncType: explicitType = null,
        analysisContext = {},
        suggestionSettings = null,
        allCosts = [],
        autoComplete = false,
        requestingPerson = 'Kalite Maliyetleri',
    } = options;

    const ncType =
        explicitType ||
        getCostNcSuggestion(cost, allCosts.length ? allCosts : [cost], suggestionSettings);

    if (!ncType || ncType === 'MDI') return null;

    const openingDate = cost?.cost_date ? new Date(cost.cost_date) : new Date();
    const dueDate = addMonths(openingDate, 1);
    const draft = buildQualityCostDraftAnalyses(cost, analysisContext, {
        ncType,
        autoComplete,
        responsible: cost?.unit || 'Kalite',
    });

    const isSupplier = Boolean(cost?.is_supplier_nc || cost?.supplier_id);

    return {
        type: ncType,
        title: buildQualityCostNcTitle(cost, analysisContext),
        description: buildQualityCostNcDescription(cost, analysisContext),
        status: autoComplete ? 'Kapatıldı' : 'Açık',
        priority: ncType === '8D' ? 'Yüksek' : 'Orta',
        department: cost?.unit || '',
        requesting_unit: 'Kalite Maliyetleri',
        requesting_person: requestingPerson,
        responsible_person: cost?.unit || '',
        opening_date: toIsoDate(openingDate),
        df_opened_at: openingDate.toISOString(),
        due_date: toIsoDate(dueDate),
        due_at: dueDate.toISOString(),
        source_cost_id: cost.id,
        part_name: cost.part_name || '',
        part_code: cost.part_code || '',
        vehicle_type: cost.vehicle_type || analysisContext?.vehicleType || '',
        amount: cost.amount ?? null,
        cost_date: cost.cost_date || null,
        cost_type: cost.cost_type || '',
        material_type: cost.material_type || '',
        measurement_unit: cost.measurement_unit || '',
        quantity: cost.quantity ?? null,
        scrap_weight: cost.scrap_weight ?? null,
        rework_duration: cost.rework_duration ?? null,
        quality_control_duration: cost.quality_control_duration ?? null,
        responsible_personnel_id: cost.responsible_personnel_id ?? null,
        supplier_id: cost.supplier_id ?? null,
        is_supplier_nc: isSupplier,
        organization_id: cost.organization_id ?? null,
        problem_definition: draft.problem_definition,
        root_cause: draft.root_cause,
        five_why_analysis: draft.five_why_analysis,
        five_n1k_analysis: draft.five_n1k_analysis,
        ishikawa_analysis: draft.ishikawa_analysis,
        eight_d_steps: draft.eight_d_steps ?? null,
        eight_d_progress: draft.eight_d_progress ?? null,
        closing_notes: draft.closing_notes ?? null,
        closed_at: draft.closed_at ?? null,
        attachments: [],
        closing_attachments: [],
    };
}

/** Mevcut açık kayıt için analiz patch (5 neden, kök neden, kapatma) */
export function buildQualityCostNcAnalysisPatch(cost, ncRecord, analysisContext = {}, { autoComplete = true } = {}) {
    const ncType = ncRecord?.type || 'DF';
    const draft = buildQualityCostDraftAnalyses(cost, analysisContext, {
        ncType,
        autoComplete,
        responsible: ncRecord?.department || cost?.unit || 'Kalite',
    });

    const patch = {
        problem_definition: draft.problem_definition,
        root_cause: draft.root_cause,
        five_why_analysis: draft.five_why_analysis,
        five_n1k_analysis: draft.five_n1k_analysis,
        ishikawa_analysis: draft.ishikawa_analysis,
        updated_at: new Date().toISOString(),
    };

    if (ncType === '8D') {
        patch.eight_d_steps = draft.eight_d_steps;
        patch.eight_d_progress = draft.eight_d_progress;
    }

    if (autoComplete) {
        patch.status = 'Kapatıldı';
        patch.closing_notes = draft.closing_notes;
        patch.closed_at = draft.closed_at;
    }

    return patch;
}
