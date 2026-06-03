import {
    getVehicleMetricContribution,
    getVehicleMetricDefinition,
} from '@/components/quality-cost/vehicleMetricConfig';

const parsePartLabel = (cost, lineItem) => {
    if (lineItem) {
        return lineItem.part_code || lineItem.part_name || cost.part_code || cost.part_name || '—';
    }
    return cost.part_code || cost.part_name || '—';
};

/** Tabloda gösterilecek metrik ham değeri (katkı ile aynı birim) */
export const getVehicleMetricRecordRawValue = (record, metricKey) => {
    if (!record) return 0;
    if (record.metricRawValue != null && Number.isFinite(record.metricRawValue)) {
        return record.metricRawValue;
    }
    return getVehicleMetricContribution(record, metricKey);
};

export const getVehicleMetricRecordValueLabel = (metricKey) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition) return 'Değer';
    if (definition.isCurrency) return 'Tutar (TRY)';
    if (metricKey === 'rejection_count_per_vehicle') return 'Ret (adet)';
    if (metricKey === 'waste_kg_per_vehicle') return 'Fire (kg)';
    if (metricKey === 'scrap_kg_per_vehicle') return 'Hurda (kg)';
    return definition.contributionUnit;
};

const metricSpecificTieBreak = (record, metricKey) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition) return 0;
    if (definition.isCurrency) {
        return parseFloat(record.displayAmount ?? record.amount) || 0;
    }
    if (metricKey === 'scrap_kg_per_vehicle' || metricKey === 'waste_kg_per_vehicle') {
        return parseFloat(record.scrap_weight) || parseFloat(record.quantity) || 0;
    }
    if (metricKey === 'rejection_count_per_vehicle') {
        return parseFloat(record.quantity) || 0;
    }
    return getVehicleMetricRecordRawValue(record, metricKey);
};

/**
 * Metrik bazlı kaynak satırları: para metriklerinde çoklu kalem varsa satır bazında katkı;
 * ardından katkı payı ve akıllı top sıralama.
 */
export const buildVehicleMetricRecordRows = (costs = [], metricKey, { relatedNCMap = {} } = {}) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition) return [];

    const rows = [];

    for (const cost of costs) {
        if (!definition.costTypes.includes(cost.cost_type)) continue;

        const lineItems = Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
        const splittableLines =
            definition.isCurrency
                ? lineItems.filter((li) => (parseFloat(li.amount) || 0) > 0)
                : [];

        if (splittableLines.length > 1) {
            splittableLines.forEach((li, index) => {
                const contrib = parseFloat(li.amount) || 0;
                if (contrib <= 0) return;
                rows.push({
                    ...cost,
                    _rowKey: `${cost.id}-li-${li.id ?? li.part_code ?? index}`,
                    _lineItem: li,
                    contribution: contrib,
                    metricRawValue: contrib,
                    displayAmount: contrib,
                    displayPart: parsePartLabel(cost, li),
                    linkedNCs: relatedNCMap[cost.id] || [],
                });
            });
            continue;
        }

        const contrib = getVehicleMetricContribution(cost, metricKey);
        if (contrib <= 0) continue;

        rows.push({
            ...cost,
            _rowKey: String(cost.id),
            contribution: contrib,
            metricRawValue: contrib,
            displayAmount: parseFloat(cost.amount) || 0,
            displayPart: parsePartLabel(cost, null),
            linkedNCs: relatedNCMap[cost.id] || [],
        });
    }

    return rankVehicleMetricRecords(rows, metricKey);
};

export const rankVehicleMetricRecords = (records = [], metricKey) => {
    const total = records.reduce((sum, row) => sum + (row.contribution || 0), 0) || 0;
    const safeTotal = total > 0 ? total : 1;

    const enriched = records.map((row) => ({
        ...row,
        contributionShare: ((row.contribution || 0) / safeTotal) * 100,
    }));

    enriched.sort((left, right) => {
        const contribDiff = (right.contribution || 0) - (left.contribution || 0);
        if (contribDiff !== 0) return contribDiff;

        const shareDiff = (right.contributionShare || 0) - (left.contributionShare || 0);
        if (shareDiff !== 0) return shareDiff;

        const metricDiff = metricSpecificTieBreak(right, metricKey) - metricSpecificTieBreak(left, metricKey);
        if (metricDiff !== 0) return metricDiff;

        const dateRight = new Date(right.cost_date || 0).getTime();
        const dateLeft = new Date(left.cost_date || 0).getTime();
        if (dateRight !== dateLeft) return dateRight - dateLeft;

        return String(left.displayPart || '').localeCompare(String(right.displayPart || ''), 'tr');
    });

    return enriched.map((row, index) => ({
        ...row,
        rank: index + 1,
    }));
};
