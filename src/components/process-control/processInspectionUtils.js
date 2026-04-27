import { v4 as uuidv4 } from 'uuid';

const findOptionLabel = (options = [], value) => {
    if (!value) return null;

    const match = options.find((item) => item?.value === value || item?.id === value);
    return match?.label || match?.name || null;
};

export const calculateMeasurementCount = (characteristicType, quantity) => {
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
        measurement_method: row?.measurement_method || row?.method || null,
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

export const getInspectionResultMeasured = (row) =>
    row?.measured_value ?? row?.measurement_value ?? row?.actual_value ?? '';

/**
 * UUID id, created_at aynı batch'te: form / bundle sırası ile çoğu zaman uyuşmaz.
 * Öncelik: line_sequence (kayıtta verilir) > kalem+ölçüm no > en son created_at
 */
export const sortProcessInspectionResultsForBundleOrder = (inspectionResults, controlPlan) => {
    const rows = [...(inspectionResults || [])];
    if (rows.length === 0) return rows;

    const allHaveLineSeq = rows.every((r) => r.line_sequence != null && r.line_sequence !== undefined);
    if (allHaveLineSeq) {
        return rows.sort((a, b) => Number(a.line_sequence) - Number(b.line_sequence));
    }

    const idToLineIdx = new Map();
    (controlPlan?.items || []).forEach((it, idx) => {
        if (it?.id != null && it.id !== '') {
            idToLineIdx.set(String(it.id), idx);
        }
    });

    const canSortByPlan = rows.every(
        (r) => r?.control_plan_item_id != null && r.measurement_number != null && r.measurement_number !== ''
    );
    if (canSortByPlan) {
        return rows.sort((a, b) => {
            const la = idToLineIdx.get(String(a.control_plan_item_id)) ?? 9999;
            const lb = idToLineIdx.get(String(b.control_plan_item_id)) ?? 9999;
            if (la !== lb) return la - lb;
            return Number(a.measurement_number) - Number(b.measurement_number);
        });
    }

    return rows.sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return 0;
    });
};

/**
 * INKR ön doldurma: önce (kalem_id+ölçüm no) slot anahtarı, sonra bire bir satır, son kova.
 */
export const buildInkrPrefillBundle = ({
    controlPlan,
    quantityProduced,
    characteristics = [],
    equipment = [],
    inspectionResults = [],
}) => {
    const qty = Number(quantityProduced) > 0 ? Number(quantityProduced) : 1;
    const { results: templateSlots } = buildMeasurementBundle({
        controlPlan,
        quantityProduced: qty,
        characteristics,
        equipment,
        existingRows: [],
    });

    const rows = sortProcessInspectionResultsForBundleOrder(inspectionResults, controlPlan);

    const byKey = new Map();
    rows.forEach((r) => {
        if (r?.control_plan_item_id == null) return;
        if (r?.measurement_number == null || r?.measurement_number === '') return;
        byKey.set(`${r.control_plan_item_id}:${Number(r.measurement_number)}`, getInspectionResultMeasured(r));
    });

    if (byKey.size > 0) {
        const filled = templateSlots.map((slot) => {
            if (slot?.control_plan_item_id == null) {
                return { ...slot, measured_value: '' };
            }
            const k = `${slot.control_plan_item_id}:${Number(slot.measurement_number)}`;
            return { ...slot, measured_value: byKey.get(k) ?? '' };
        });
        const keyPathOk =
            templateSlots.length > 0 &&
            templateSlots.every((slot) => {
                if (slot?.control_plan_item_id == null) return false;
                const k = `${slot.control_plan_item_id}:${Number(slot.measurement_number)}`;
                return byKey.has(k);
            });
        if (keyPathOk) {
            return filled;
        }
    }

    if (templateSlots.length > 0 && templateSlots.length === rows.length) {
        return templateSlots.map((slot, i) => ({
            ...slot,
            measured_value: getInspectionResultMeasured(rows[i]),
        }));
    }

    return buildMeasurementBundle({
        controlPlan,
        quantityProduced: qty,
        characteristics,
        equipment,
        existingRows: rows,
    }).results;
};

/**
 * Düz bundle çıktısında, her kontrol planı satırının ilk ölçümü (INKR tek hücresi).
 */
export const getFirstMeasurementValuePerPlanLine = ({ controlPlan, quantityProduced, flatBundleResults = [] }) => {
    const q = Number(quantityProduced) > 0 ? Number(quantityProduced) : 1;
    const byIndex = new Map();
    let offset = 0;
    (controlPlan?.items || []).forEach((item, lineIdx) => {
        const c = calculateMeasurementCount(item.characteristic_type || 'Genel', q);
        if (c <= 0) {
            byIndex.set(lineIdx, '');
            return;
        }
        byIndex.set(lineIdx, flatBundleResults[offset]?.measured_value ?? '');
        offset += c;
    });
    return byIndex;
};
