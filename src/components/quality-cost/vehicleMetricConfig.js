const currencyFormatter = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
});

const numberFormatter = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const VEHICLE_METRIC_ORDER = [
    'scrap_cost_per_vehicle',
    'rework_cost_per_vehicle',
    'scrap_kg_per_vehicle',
    'waste_kg_per_vehicle',
    'rejection_count_per_vehicle',
];

/** Araç başı metriklerde tutarlı gösterim: boşluk + küçük "araç" */
export const PER_VEHICLE_UNIT_SUFFIX = ' / araç';

export const VEHICLE_METRIC_DEFINITIONS = {
    scrap_cost_per_vehicle: {
        key: 'scrap_cost_per_vehicle',
        label: 'Hurda Maliyeti',
        shortLabel: 'Hurda',
        unit: 'TRY / araç',
        contributionUnit: 'TRY',
        chartUnit: 'TRY',
        chartKey: 'scrapCostPerVehicle',
        color: '#f43f5e',
        isCurrency: true,
        costTypes: ['Hurda Maliyeti'],
        valueAccessor: (cost) => parseFloat(cost.amount) || 0,
    },
    rework_cost_per_vehicle: {
        key: 'rework_cost_per_vehicle',
        label: 'Yeniden İşlem Maliyeti',
        shortLabel: 'Yeniden işlem',
        unit: 'TRY / araç',
        contributionUnit: 'TRY',
        chartUnit: 'TRY',
        chartKey: 'reworkPerVehicle',
        color: '#3b82f6',
        isCurrency: true,
        costTypes: ['Yeniden İşlem Maliyeti'],
        valueAccessor: (cost) => parseFloat(cost.amount) || 0,
    },
    scrap_kg_per_vehicle: {
        key: 'scrap_kg_per_vehicle',
        label: 'Hurda Ağırlığı',
        shortLabel: 'Hurda Kg',
        unit: 'kg / araç',
        contributionUnit: 'Kg',
        chartUnit: 'Kg',
        chartKey: 'scrapPerVehicle',
        color: '#8b5cf6',
        isCurrency: false,
        costTypes: ['Hurda Maliyeti'],
        valueAccessor: (cost) => parseFloat(cost.scrap_weight) || 0,
    },
    waste_kg_per_vehicle: {
        key: 'waste_kg_per_vehicle',
        label: 'Fire Ağırlığı',
        shortLabel: 'Fire Kg',
        unit: 'kg / araç',
        contributionUnit: 'Kg',
        chartUnit: 'Kg',
        chartKey: 'wastePerVehicle',
        color: '#f97316',
        isCurrency: false,
        costTypes: ['Fire Maliyeti'],
        valueAccessor: (cost) => parseFloat(cost.scrap_weight) || 0,
    },
    rejection_count_per_vehicle: {
        key: 'rejection_count_per_vehicle',
        label: 'Ret Adedi',
        shortLabel: 'Ret',
        unit: 'adet / araç',
        contributionUnit: 'Adet',
        chartUnit: 'Adet',
        chartKey: 'rejectionPerVehicle',
        color: '#ef4444',
        isCurrency: false,
        costTypes: ['Hurda Maliyeti'],
        valueAccessor: (cost) => parseFloat(cost.quantity) || 0,
    },
};

export const getVehicleMetricDefinition = (metricKey) => VEHICLE_METRIC_DEFINITIONS[metricKey];

export const getVehicleMetricContribution = (cost, metricKey) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition || !cost) return 0;
    if (!definition.costTypes.includes(cost.cost_type)) return 0;
    return definition.valueAccessor(cost);
};

export const getVehicleMetricRecords = (costs = [], metricKey) =>
    costs.filter((cost) => getVehicleMetricContribution(cost, metricKey) > 0);

export const formatVehicleMetricValue = (value, metricKey, { perVehicle = true } = {}) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition) return '-';

    if (definition.isCurrency) {
        const base = currencyFormatter.format(value || 0);
        return perVehicle ? `${base}${PER_VEHICLE_UNIT_SUFFIX}` : base;
    }

    const suffix = perVehicle ? definition.unit : definition.contributionUnit;
    return `${numberFormatter.format(value || 0)} ${suffix}`;
};

export const formatVehicleMetricDelta = (value, metricKey) => {
    const definition = getVehicleMetricDefinition(metricKey);
    if (!definition) return '-';

    if (definition.isCurrency) {
        return currencyFormatter.format(value || 0);
    }

    return `${numberFormatter.format(value || 0)} ${definition.contributionUnit}`;
};
