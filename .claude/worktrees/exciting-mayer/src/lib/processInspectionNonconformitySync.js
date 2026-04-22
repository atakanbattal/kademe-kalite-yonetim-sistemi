import {
    LOCKED_NONCONFORMITY_STATUSES,
    parseNonconformityRecordNumber,
} from './vehicleFaultNonconformitySync';
import { withRetryOnDeadlock } from './supabaseRetry';

const PROCESS_DETECTION_AREA = 'Proses İçi Kontrol';
const AUTO_NOTE_TITLE = 'Bu kayıt proses muayene kaydındaki uygun olmayan ölçümlerden otomatik oluşturuldu.';
const PRESERVED_NOTE = 'Kaynak muayene kaydı artık uygunsuz ölçüm içermiyor ancak açılmış DF/8D süreci korundu.';
const SOURCE_REFERENCE_LABEL = 'Muayene Kayıt No:';

const RECORD_SELECT =
    'id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department, action_taken';

const fetchAllRows = async (fetchPage) => {
    const pageSize = 1000;
    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await fetchPage(from, from + pageSize - 1);
        if (error) throw error;

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return rows;
};

const sameDateTime = (left, right) => {
    if (!left && !right) return true;
    if (!left || !right) return false;

    const leftTime = new Date(left).getTime();
    const rightTime = new Date(right).getTime();

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return String(left) === String(right);
    }

    return leftTime === rightTime;
};

const normalizeMeasurementRow = (row) => ({
    ...row,
    result:
        typeof row?.result === 'boolean'
            ? row.result
            : typeof row?.is_ok === 'boolean'
              ? row.is_ok
              : null,
    measured_value: row?.measured_value ?? row?.measurement_value ?? '',
    characteristic_name: row?.characteristic_name || row?.feature || row?.characteristic_id || 'Karakteristik',
});

const getFailedMeasurements = (results = []) =>
    results.map(normalizeMeasurementRow).filter((row) => row.result === false);

const getSourceReference = (inspection) =>
    `${SOURCE_REFERENCE_LABEL} ${inspection?.record_no || inspection?.id || 'Bilinmiyor'}`;

const extractSourceReference = (record) => {
    const sourceText = `${record?.notes || ''}\n${record?.description || ''}`;
    const matched = sourceText.match(/Muayene Kayıt No:\s*([^\n\r]+)/i);
    return matched ? `${SOURCE_REFERENCE_LABEL} ${matched[1].trim()}` : null;
};

const getAutoNotes = ({ inspection, failedMeasurements }) =>
    [
        AUTO_NOTE_TITLE,
        getSourceReference(inspection),
        `Uygun Olmayan Ölçüm Sayısı: ${failedMeasurements.length}`,
        inspection?.operator_name ? `Operatör: ${inspection.operator_name}` : null,
    ]
        .filter(Boolean)
        .join('\n');

const getPreservedNotes = (inspection) =>
    [AUTO_NOTE_TITLE, getSourceReference(inspection), PRESERVED_NOTE].filter(Boolean).join('\n');

const getMeasurementCategory = (failedMeasurements) =>
    failedMeasurements.some((row) => row.min_value !== null || row.max_value !== null)
        ? 'Ölçü Tolerans Dışı'
        : 'Fonksiyon Hatası';

const getMeasurementSeverity = ({ inspection, failedMeasurements }) => {
    const characteristicTypes = failedMeasurements.map((row) =>
        String(row.characteristic_type || '').toLocaleLowerCase('tr-TR')
    );
    const impactSize = Math.max(
        failedMeasurements.length,
        Number(inspection?.quantity_rejected) || 0,
        Number(inspection?.quantity_conditional) || 0
    );

    if (characteristicTypes.some((type) => type.includes('emniyet')) || impactSize >= 10) {
        return 'Kritik';
    }

    if (characteristicTypes.some((type) => type.includes('kritik')) || impactSize >= 5) {
        return 'Yüksek';
    }

    return 'Orta';
};

const buildMeasurementLine = (row) => {
    const label =
        row.measurement_number && row.total_measurements
            ? `${row.characteristic_name} (${row.measurement_number}/${row.total_measurements})`
            : row.characteristic_name;
    const nominal = row.nominal_value ? `Nominal: ${row.nominal_value}` : null;
    const tolerance =
        row.min_value !== null || row.max_value !== null
            ? `Tol: ${row.min_value ?? '-'} - ${row.max_value ?? '-'}`
            : null;
    const measured = row.measured_value ? `Ölçülen: ${row.measured_value}` : 'Ölçülen: -';
    const method = row.measurement_method ? `Yöntem: ${row.measurement_method}` : null;

    return `- ${[label, nominal, tolerance, measured, method].filter(Boolean).join(' | ')}`;
};

const buildPayload = ({ inspection, failedMeasurements }) => {
    const category = getMeasurementCategory(failedMeasurements);
    const quantity = Math.max(
        failedMeasurements.length,
        Number(inspection?.quantity_rejected) || 0,
        Number(inspection?.quantity_conditional) || 0,
        1
    );

    return {
        part_code: inspection?.part_code || null,
        part_name: inspection?.part_name || inspection?.part_code || null,
        description: [
            `${category} tespit edildi.`,
            getSourceReference(inspection),
            inspection?.operator_name ? `Operatör: ${inspection.operator_name}` : null,
            `Uygun Olmayan Ölçüm Sayısı: ${failedMeasurements.length}`,
            Number(inspection?.quantity_rejected) > 0
                ? `Ret Miktarı: ${inspection.quantity_rejected}`
                : null,
            Number(inspection?.quantity_conditional) > 0
                ? `Şartlı Kabul Miktarı: ${inspection.quantity_conditional}`
                : null,
            'Uygun Olmayan Ölçümler:',
            failedMeasurements.map(buildMeasurementLine).join('\n'),
        ]
            .filter(Boolean)
            .join('\n'),
        category,
        detection_area: PROCESS_DETECTION_AREA,
        detection_date: inspection?.inspection_date
            ? new Date(inspection.inspection_date).toISOString()
            : new Date().toISOString(),
        detected_by: inspection?.operator_name || 'Proses Kontrol Muayenesi',
        severity: getMeasurementSeverity({ inspection, failedMeasurements }),
        quantity,
        department: null,
        action_taken: inspection?.operator_name ? `Kaynak proses muayene operatörü: ${inspection.operator_name}` : null,
        notes: getAutoNotes({ inspection, failedMeasurements }),
    };
};

const sortRecordsForPrimarySelection = (records) =>
    [...records].sort((left, right) => {
        const leftLocked = LOCKED_NONCONFORMITY_STATUSES.has(left.status) ? 1 : 0;
        const rightLocked = LOCKED_NONCONFORMITY_STATUSES.has(right.status) ? 1 : 0;

        if (leftLocked !== rightLocked) {
            return rightLocked - leftLocked;
        }

        return (
            parseNonconformityRecordNumber(right.record_number) -
            parseNonconformityRecordNumber(left.record_number)
        );
    });

const deleteRecordsByIds = async (supabase, ids) => {
    const validIds = (ids || []).filter((id) => id != null && id !== '');
    if (!validIds.length) return;

    const { error } = await supabase.from('nonconformity_records').delete().in('id', validIds);
    if (error) throw error;
};

const getNextNonconformityRecordNumber = async (supabase) => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const prefix = `UYG-${yearPrefix}-`;
    const { data, error } = await supabase.rpc('next_nc_record_number', {
        p_year_prefix: prefix,
    });

    if (error) throw error;
    return data;
};

const needsUpdate = (record, payload, nextStatus) =>
    !(
        (record.part_code || null) === (payload.part_code || null) &&
        (record.part_name || null) === (payload.part_name || null) &&
        (record.description || null) === (payload.description || null) &&
        (record.category || null) === (payload.category || null) &&
        (record.detection_area || null) === (payload.detection_area || null) &&
        sameDateTime(record.detection_date, payload.detection_date) &&
        (record.detected_by || null) === (payload.detected_by || null) &&
        (record.severity || null) === (payload.severity || null) &&
        Number(record.quantity || 0) === Number(payload.quantity || 0) &&
        (record.department || null) === (payload.department || null) &&
        (record.action_taken || null) === (payload.action_taken || null) &&
        (record.notes || null) === (payload.notes || null) &&
        (record.status || null) === (nextStatus || null)
    );

const fetchExistingRecordsForInspection = async (supabase, inspection) => {
    if (!inspection?.part_code) return [];

    const sourceReference = getSourceReference(inspection);
    const { data, error } = await supabase
        .from('nonconformity_records')
        .select(RECORD_SELECT)
        .eq('detection_area', PROCESS_DETECTION_AREA)
        .eq('part_code', inspection.part_code)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).filter((record) => extractSourceReference(record) === sourceReference);
};

const reconcileInspection = async ({
    supabase,
    inspection,
    failedMeasurements,
    existingRecords,
    userId,
}) => {
    const sortedRecords = sortRecordsForPrimarySelection(existingRecords || []);
    const primaryRecord = sortedRecords[0] || null;
    const duplicateRecords = sortedRecords.slice(1);

    if (duplicateRecords.length > 0) {
        const duplicateIds = duplicateRecords.map((r) => r.id).filter((id) => id != null && id !== '');
        await deleteRecordsByIds(supabase, duplicateIds);
    }

    if (!failedMeasurements.length) {
        if (!primaryRecord) {
            return { mode: 'missing', record: null, deletedDuplicates: duplicateRecords.length };
        }

        if (LOCKED_NONCONFORMITY_STATUSES.has(primaryRecord.status)) {
            const preservedId = primaryRecord?.id;
            if (preservedId == null || preservedId === '') {
                throw new Error('Korunacak proses uygunsuzluk kaydının id alanı eksik.');
            }

            const { data, error } = await supabase
                .from('nonconformity_records')
                .update({ notes: getPreservedNotes(inspection) })
                .eq('id', preservedId)
                .select(RECORD_SELECT)
                .single();

            if (error) throw error;

            return { mode: 'preserved', record: data, deletedDuplicates: duplicateRecords.length };
        }

        const idToDelete = primaryRecord?.id;
        if (idToDelete != null && idToDelete !== '') {
            await deleteRecordsByIds(supabase, [idToDelete]);
        }
        return {
            mode: 'deleted',
            record: primaryRecord,
            deletedDuplicates: duplicateRecords.length + 1,
        };
    }

    const payload = buildPayload({ inspection, failedMeasurements });
    const nextStatus = LOCKED_NONCONFORMITY_STATUSES.has(primaryRecord?.status)
        ? primaryRecord.status
        : 'Açık';

    if (!primaryRecord) {
        const recordNumber = await getNextNonconformityRecordNumber(supabase);
        const { data, error } = await supabase
            .from('nonconformity_records')
            .insert({
                ...payload,
                status: nextStatus,
                record_number: recordNumber,
                created_by: userId || null,
            })
            .select(RECORD_SELECT)
            .single();

        if (error) throw error;

        return { mode: 'created', record: data, deletedDuplicates: duplicateRecords.length };
    }

    if (!needsUpdate(primaryRecord, payload, nextStatus)) {
        return { mode: 'existing', record: primaryRecord, deletedDuplicates: duplicateRecords.length };
    }

    const recordId = primaryRecord?.id;
    if (recordId == null || recordId === '') {
        throw new Error('Güncellenecek proses uygunsuzluk kaydının id alanı geçersiz veya eksik.');
    }

    const { data, error } = await supabase
        .from('nonconformity_records')
        .update({
            part_code: payload.part_code,
            part_name: payload.part_name,
            description: payload.description,
            category: payload.category,
            detection_area: payload.detection_area,
            detection_date: payload.detection_date,
            detected_by: payload.detected_by,
            severity: payload.severity,
            quantity: payload.quantity,
            department: payload.department,
            action_taken: payload.action_taken,
            notes: payload.notes,
            status: nextStatus,
        })
        .eq('id', recordId)
        .select(RECORD_SELECT)
        .single();

    if (error) throw error;

    return { mode: 'updated', record: data, deletedDuplicates: duplicateRecords.length };
};

export const syncProcessInspectionNonconformity = async ({
    supabase,
    inspection,
    results,
    userId,
}) => {
    if (!inspection?.part_code) {
        return { mode: 'skipped', record: null, deletedDuplicates: 0 };
    }

    const failedMeasurements = getFailedMeasurements(results);
    const existingRecords = await fetchExistingRecordsForInspection(supabase, inspection);

    return reconcileInspection({
        supabase,
        inspection,
        failedMeasurements,
        existingRecords,
        userId,
    });
};

// ---------------------------------------------------------------------------
// Defect-based nonconformity sync
// ---------------------------------------------------------------------------

const DEFECT_AUTO_NOTE_TITLE =
    'Bu kayıt proses muayene kaydındaki tespit edilen hatalardan otomatik oluşturuldu.';
const DEFECT_PRESERVED_NOTE =
    'Kaynak muayene kaydında bu hata tipi artık mevcut değil ancak açılmış DF/8D süreci korundu.';
const DEFECT_TYPE_LABEL = 'Hata Tipi:';

const getDefectSourceKey = (inspection, defectType) =>
    `${getSourceReference(inspection)} | ${DEFECT_TYPE_LABEL} ${defectType}`;

const extractDefectSourceKey = (record) => {
    const sourceText = `${record?.notes || ''}\n${record?.description || ''}`;
    const matched = sourceText.match(
        /Muayene Kayıt No:\s*([^\n\r|]+)\s*\|\s*Hata Tipi:\s*([^\n\r]+)/i
    );
    if (!matched) return null;
    return `${SOURCE_REFERENCE_LABEL} ${matched[1].trim()} | ${DEFECT_TYPE_LABEL} ${matched[2].trim()}`;
};

const getDefectAutoNotes = ({ inspection, defect }) =>
    [
        DEFECT_AUTO_NOTE_TITLE,
        getDefectSourceKey(inspection, defect.defect_type),
        defect.description ? `Açıklama: ${defect.description}` : null,
        `Adet: ${Number(defect.defect_count) || 1}`,
        inspection?.operator_name ? `Operatör: ${inspection.operator_name}` : null,
    ]
        .filter(Boolean)
        .join('\n');

const getDefectPreservedNotes = (inspection, defectType) =>
    [DEFECT_AUTO_NOTE_TITLE, getDefectSourceKey(inspection, defectType), DEFECT_PRESERVED_NOTE]
        .filter(Boolean)
        .join('\n');

const getDefectSeverity = (defectCount) => {
    const count = Number(defectCount) || 1;
    if (count >= 10) return 'Kritik';
    if (count >= 5) return 'Yüksek';
    return 'Orta';
};

const buildDefectPayload = ({ inspection, defect }) => ({
    part_code: inspection?.part_code || null,
    part_name: inspection?.part_name || inspection?.part_code || null,
    description: [
        `${defect.defect_type} tespit edildi.`,
        getDefectSourceKey(inspection, defect.defect_type),
        defect.description ? `Açıklama: ${defect.description}` : null,
        `Adet: ${Number(defect.defect_count) || 1}`,
        inspection?.operator_name ? `Operatör: ${inspection.operator_name}` : null,
    ]
        .filter(Boolean)
        .join('\n'),
    category: defect.defect_type,
    detection_area: PROCESS_DETECTION_AREA,
    detection_date: inspection?.inspection_date
        ? new Date(inspection.inspection_date).toISOString()
        : new Date().toISOString(),
    detected_by: inspection?.operator_name || 'Proses Kontrol Muayenesi',
    severity: getDefectSeverity(defect.defect_count),
    quantity: Number(defect.defect_count) || 1,
    department: null,
    action_taken: null,
    notes: getDefectAutoNotes({ inspection, defect }),
});

const fetchExistingDefectRecords = async (supabase, inspection) => {
    const { data, error } = await supabase
        .from('nonconformity_records')
        .select(RECORD_SELECT)
        .eq('detection_area', PROCESS_DETECTION_AREA)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const sourceRef = getSourceReference(inspection);
    return (data || []).filter((record) => {
        const key = extractDefectSourceKey(record);
        return key && key.startsWith(sourceRef);
    });
};

const reconcileDefects = async ({ supabase, inspection, defects, existingRecords, userId }) => {
    const validDefects = (defects || []).filter((d) => d.defect_type?.trim());

    const defectKeySet = new Set(
        validDefects.map((d) => getDefectSourceKey(inspection, d.defect_type))
    );

    const recordsByKey = new Map();
    (existingRecords || []).forEach((record) => {
        const key = extractDefectSourceKey(record);
        if (!key) return;
        if (!recordsByKey.has(key)) recordsByKey.set(key, []);
        recordsByKey.get(key).push(record);
    });

    const stats = { created: 0, updated: 0, deleted: 0, preserved: 0 };

    for (const [key, records] of recordsByKey.entries()) {
        if (defectKeySet.has(key)) continue;

        const sorted = sortRecordsForPrimarySelection(records);
        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        if (duplicates.length > 0) {
            await deleteRecordsByIds(supabase, duplicates.map((r) => r.id));
            stats.deleted += duplicates.length;
        }

        if (LOCKED_NONCONFORMITY_STATUSES.has(primary.status)) {
            const defectType = key.split(`${DEFECT_TYPE_LABEL} `)[1] || '';
            await supabase
                .from('nonconformity_records')
                .update({ notes: getDefectPreservedNotes(inspection, defectType) })
                .eq('id', primary.id);
            stats.preserved += 1;
        } else {
            await deleteRecordsByIds(supabase, [primary.id]);
            stats.deleted += 1;
        }
    }

    for (const defect of validDefects) {
        const key = getDefectSourceKey(inspection, defect.defect_type);
        const existing = recordsByKey.get(key) || [];
        const sorted = sortRecordsForPrimarySelection(existing);
        const primary = sorted[0] || null;
        const duplicates = sorted.slice(1);

        if (duplicates.length > 0) {
            await deleteRecordsByIds(supabase, duplicates.map((r) => r.id));
            stats.deleted += duplicates.length;
        }

        const payload = buildDefectPayload({ inspection, defect });
        const nextStatus = LOCKED_NONCONFORMITY_STATUSES.has(primary?.status)
            ? primary.status
            : 'Açık';

        if (!primary) {
            const recordNumber = await getNextNonconformityRecordNumber(supabase);
            const { error } = await supabase
                .from('nonconformity_records')
                .insert({
                    ...payload,
                    status: nextStatus,
                    record_number: recordNumber,
                    created_by: userId || null,
                });
            if (error) throw error;
            stats.created += 1;
            continue;
        }

        if (needsUpdate(primary, payload, nextStatus)) {
            const { error } = await supabase
                .from('nonconformity_records')
                .update({
                    part_code: payload.part_code,
                    part_name: payload.part_name,
                    description: payload.description,
                    category: payload.category,
                    detection_area: payload.detection_area,
                    detection_date: payload.detection_date,
                    detected_by: payload.detected_by,
                    severity: payload.severity,
                    quantity: payload.quantity,
                    department: payload.department,
                    action_taken: payload.action_taken,
                    notes: payload.notes,
                    status: nextStatus,
                })
                .eq('id', primary.id);
            if (error) throw error;
            stats.updated += 1;
        }
    }

    return stats;
};

export const syncProcessInspectionDefectNonconformities = async ({
    supabase,
    inspection,
    defects,
    userId,
}) => {
    const existingRecords = await fetchExistingDefectRecords(supabase, inspection);
    return reconcileDefects({ supabase, inspection, defects, existingRecords, userId });
};

export const backfillProcessInspectionNonconformities = async ({ supabase, userId }) => {
    const [inspections, results, allDefects, existingRecords] = await Promise.all([
        fetchAllRows((from, to) =>
            supabase
                .from('process_inspections')
                .select('*')
                .order('inspection_date', { ascending: false })
                .range(from, to)
        ),
        fetchAllRows((from, to) =>
            supabase
                .from('process_inspection_results')
                .select('*')
                .order('id', { ascending: true })
                .range(from, to)
        ),
        fetchAllRows((from, to) =>
            supabase
                .from('process_inspection_defects')
                .select('*')
                .order('id', { ascending: true })
                .range(from, to)
        ),
        fetchAllRows((from, to) =>
            supabase
                .from('nonconformity_records')
                .select(RECORD_SELECT)
                .eq('detection_area', PROCESS_DETECTION_AREA)
                .order('created_at', { ascending: false })
                .range(from, to)
        ),
    ]);

    const resultsByInspection = new Map();
    (results || []).forEach((row) => {
        const inspectionId = row.inspection_id;
        if (!inspectionId) return;

        if (!resultsByInspection.has(inspectionId)) {
            resultsByInspection.set(inspectionId, []);
        }

        resultsByInspection.get(inspectionId).push(normalizeMeasurementRow(row));
    });

    const defectsByInspection = new Map();
    (allDefects || []).forEach((row) => {
        const inspectionId = row.inspection_id;
        if (!inspectionId) return;

        if (!defectsByInspection.has(inspectionId)) {
            defectsByInspection.set(inspectionId, []);
        }

        defectsByInspection.get(inspectionId).push(row);
    });

    const measurementRecordsBySource = new Map();
    const defectRecordsBySource = new Map();

    (existingRecords || []).forEach((record) => {
        const defectKey = extractDefectSourceKey(record);
        if (defectKey) {
            const baseRef = defectKey.split(' | ')[0];
            if (!defectRecordsBySource.has(baseRef)) {
                defectRecordsBySource.set(baseRef, []);
            }
            defectRecordsBySource.get(baseRef).push(record);
            return;
        }

        const sourceReference = extractSourceReference(record);
        if (!sourceReference) return;

        if (!measurementRecordsBySource.has(sourceReference)) {
            measurementRecordsBySource.set(sourceReference, []);
        }

        measurementRecordsBySource.get(sourceReference).push(record);
    });

    const stats = {
        created: 0,
        updated: 0,
        deletedDuplicates: 0,
        defectsCreated: 0,
        defectsUpdated: 0,
        defectsDeleted: 0,
    };

    for (const inspection of inspections || []) {
        const sourceReference = getSourceReference(inspection);

        const failedMeasurements = getFailedMeasurements(resultsByInspection.get(inspection.id) || []);
        const measurementResult = await withRetryOnDeadlock(() =>
            reconcileInspection({
                supabase,
                inspection,
                failedMeasurements,
                existingRecords: measurementRecordsBySource.get(sourceReference) || [],
                userId,
            })
        );

        if (measurementResult.mode === 'created') stats.created += 1;
        if (measurementResult.mode === 'updated') stats.updated += 1;
        stats.deletedDuplicates += measurementResult.deletedDuplicates || 0;

        const inspectionDefects = defectsByInspection.get(inspection.id) || [];
        if (inspectionDefects.length > 0 || defectRecordsBySource.has(sourceReference)) {
            const defectResult = await withRetryOnDeadlock(() =>
                reconcileDefects({
                    supabase,
                    inspection,
                    defects: inspectionDefects,
                    existingRecords: defectRecordsBySource.get(sourceReference) || [],
                    userId,
                })
            );

            stats.defectsCreated += defectResult.created || 0;
            stats.defectsUpdated += defectResult.updated || 0;
            stats.defectsDeleted += defectResult.deleted || 0;
        }
    }

    return stats;
};
