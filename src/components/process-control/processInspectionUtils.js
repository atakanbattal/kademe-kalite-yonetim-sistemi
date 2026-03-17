import { v4 as uuidv4 } from 'uuid';

const findOptionLabel = (options = [], value) => {
    if (!value) return null;

    const match = options.find((item) => item?.value === value || item?.id === value);
    return match?.label || match?.name || null;
};

const calculateMeasurementCount = (characteristicType, quantity) => {
    const qty = Number(quantity) || 0;
    if (qty <= 0) return 0;

    const type = String(characteristicType || '').toLowerCase();

    if (type.includes('emniyet')) return qty;
    if (type.includes('kritik')) return Math.ceil(qty / 3);
    if (type.includes('fonksiyonel')) return Math.ceil(qty / 5);
    if (type.includes('minor') || type.includes('minoer') || type.includes('minör')) return 1;
    return 1;
};

export const normalizeExistingResult = (row, index, characteristics = []) => {
    const characteristicName =
        row?.characteristic_name ||
        row?.feature ||
        findOptionLabel(characteristics, row?.characteristic_id) ||
        'Bilinmeyen Karakteristik';

    return {
        ...row,
        __uid: row?.id || `${row?.characteristic_id || characteristicName}-${index}`,
        characteristic_name: characteristicName,
        measured_value: row?.measured_value ?? row?.measurement_value ?? row?.actual_value ?? '',
        measurement_number: Number(row?.measurement_number) || null,
        total_measurements: Number(row?.total_measurements) || null,
        nominal_value: row?.nominal_value ?? '',
        min_value: row?.min_value ?? null,
        max_value: row?.max_value ?? null,
        measurement_method: row?.measurement_method || row?.method || '-',
        result:
            typeof row?.result === 'boolean'
                ? row.result
                : typeof row?.is_ok === 'boolean'
                  ? row.is_ok
                  : null,
    };
};

const buildFallbackMeasurementRows = (existingRows = [], characteristics = []) => {
    const normalizedRows = existingRows.map((row, index) =>
        normalizeExistingResult(row, index, characteristics)
    );

    const totalsByKey = normalizedRows.reduce((accumulator, row) => {
        const key = row.control_plan_item_id || row.characteristic_id || row.characteristic_name || row.__uid;
        accumulator.set(key, (accumulator.get(key) || 0) + 1);
        return accumulator;
    }, new Map());

    const counters = new Map();

    return normalizedRows.map((row) => {
        const key = row.control_plan_item_id || row.characteristic_id || row.characteristic_name || row.__uid;
        const nextIndex = row.measurement_number || (counters.get(key) || 0) + 1;
        counters.set(key, nextIndex);

        return {
            ...row,
            measurement_number: nextIndex,
            total_measurements: row.total_measurements || totalsByKey.get(key) || 1,
        };
    });
};

export const buildMeasurementBundle = ({
    controlPlan,
    quantityProduced,
    characteristics = [],
    equipment = [],
    existingRows = [],
}) => {
    const normalizedExistingRows = (existingRows || []).map((row, index) =>
        normalizeExistingResult(row, index, characteristics)
    );

    if (!controlPlan?.items?.length || Number(quantityProduced) <= 0) {
        return {
            summary: [],
            results: normalizedExistingRows.length
                ? buildFallbackMeasurementRows(normalizedExistingRows, characteristics)
                : [],
        };
    }

    const exactMatches = new Map();
    const characteristicBuckets = new Map();
    const nameBuckets = new Map();
    const consumed = new Set();

    normalizedExistingRows.forEach((row) => {
        if (row.control_plan_item_id && row.measurement_number) {
            exactMatches.set(`${row.control_plan_item_id}:${row.measurement_number}`, row);
        }

        if (row.characteristic_id) {
            const currentBucket = characteristicBuckets.get(row.characteristic_id) || [];
            currentBucket.push(row);
            characteristicBuckets.set(row.characteristic_id, currentBucket);
        }

        if (row.characteristic_name) {
            const currentBucket = nameBuckets.get(row.characteristic_name) || [];
            currentBucket.push(row);
            nameBuckets.set(row.characteristic_name, currentBucket);
        }
    });

    const takeFromBucket = (bucket = []) => {
        while (bucket.length > 0) {
            const candidate = bucket.shift();
            if (!consumed.has(candidate.__uid)) {
                consumed.add(candidate.__uid);
                return candidate;
            }
        }

        return null;
    };

    const summary = [];
    const results = [];

    controlPlan.items.forEach((item) => {
        const characteristicName =
            findOptionLabel(characteristics, item.characteristic_id) ||
            item.characteristic_name ||
            'Bilinmeyen Karakteristik';
        const characteristicType = item.characteristic_type || 'Genel';
        const measurementCount = calculateMeasurementCount(characteristicType, quantityProduced);

        if (measurementCount <= 0) return;

        const measurementMethod =
            findOptionLabel(equipment, item.equipment_id) || 'Bilinmiyor';

        summary.push({
            name: characteristicName,
            type: characteristicType,
            count: measurementCount,
            method: measurementMethod,
            nominal: item.nominal_value,
            tolerance:
                item.min_value !== null && item.min_value !== undefined
                    ? `${item.min_value} - ${item.max_value}`
                    : 'Yok',
        });

        for (let measurementIndex = 1; measurementIndex <= measurementCount; measurementIndex += 1) {
            let matchedRow = exactMatches.get(`${item.id}:${measurementIndex}`);

            if (matchedRow && consumed.has(matchedRow.__uid)) {
                matchedRow = null;
            }

            if (matchedRow) {
                consumed.add(matchedRow.__uid);
            }

            if (!matchedRow) {
                matchedRow = takeFromBucket(characteristicBuckets.get(item.characteristic_id));
            }

            if (!matchedRow) {
                matchedRow = takeFromBucket(nameBuckets.get(characteristicName));
            }

            results.push({
                id: matchedRow?.id || uuidv4(),
                characteristic_id: item.characteristic_id,
                control_plan_item_id: item.id,
                characteristic_name: characteristicName,
                characteristic_type: characteristicType,
                measurement_method: matchedRow?.measurement_method || measurementMethod,
                measurement_number: measurementIndex,
                total_measurements: measurementCount,
                nominal_value:
                    item.nominal_value !== null && item.nominal_value !== undefined
                        ? item.nominal_value
                        : matchedRow?.nominal_value || '',
                min_value:
                    item.min_value !== null && item.min_value !== undefined
                        ? item.min_value
                        : matchedRow?.min_value ?? null,
                max_value:
                    item.max_value !== null && item.max_value !== undefined
                        ? item.max_value
                        : matchedRow?.max_value ?? null,
                measured_value: matchedRow?.measured_value ?? '',
                result: matchedRow?.result ?? null,
            });
        }
    });

    if (!results.length && normalizedExistingRows.length) {
        return {
            summary: [],
            results: buildFallbackMeasurementRows(normalizedExistingRows, characteristics),
        };
    }

    return { summary, results };
};
