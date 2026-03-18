import { withRetryOnDeadlock } from './supabaseRetry';

export const LOCKED_NONCONFORMITY_STATUSES = new Set(['DF Açıldı', '8D Açıldı']);

const AUTO_RECORD_NOTE = [
    'Bu kayıt, aynı araç ve kategori için Üretilen Araçlar modülünden otomatik toplanır.',
    'Adet alanı, bu gruptaki toplam hata sayısını gösterir.'
].join('\n');

const PRESERVED_RECORD_NOTE = 'Kaynak araç hataları silinmiş olsa da açılmış DF/8D süreci korundu.';

export const parseNonconformityRecordNumber = (recordNumber) => {
    if (!recordNumber) return -1;

    const match = String(recordNumber).match(/UYG-(\d+)-(\d+)/i);
    if (!match) return -1;

    const yearPart = parseInt(match[1], 10);
    const sequencePart = parseInt(match[2], 10);

    if (Number.isNaN(yearPart) || Number.isNaN(sequencePart)) return -1;

    return (yearPart * 100000) + sequencePart;
};

export const enrichVehicleFaultRecord = (fault, { categoriesById = {}, departmentsById = {} } = {}) => {
    if (!fault) return fault;

    const category = fault.category || categoriesById[String(fault.category_id)] || fault.fault_category || null;
    const department = fault.department || departmentsById[String(fault.department_id)] || null;

    return {
        ...fault,
        category,
        department,
        category_name: category?.name || fault.category_name || 'Kategorisiz',
        department_name: department?.name || fault.department_name || 'Bilinmeyen'
    };
};

const getVehicleIdentifier = (vehicle) => vehicle?.serial_no || vehicle?.chassis_no || vehicle?.id || null;

const getVehicleDisplayName = (vehicle) => {
    const label = [vehicle?.vehicle_type, vehicle?.customer_name].filter(Boolean).join(' / ');
    return label || vehicle?.vehicle_type || 'Araç';
};

const getCategoryName = (faultOrCategory) => {
    if (!faultOrCategory) return 'Kategorisiz';
    if (typeof faultOrCategory === 'string') return faultOrCategory;
    return faultOrCategory.category_name || faultOrCategory.category?.name || 'Kategorisiz';
};

const buildGroupKey = ({ vehicleIdentifier, categoryName }) => `${vehicleIdentifier || 'no-vehicle'}__${categoryName || 'Kategorisiz'}`;

const getAutoSeverityByQuantity = (quantity) => {
    const normalizedQuantity = Number(quantity) || 1;
    if (normalizedQuantity >= 10) return 'Kritik';
    if (normalizedQuantity >= 5) return 'Yüksek';
    return 'Orta';
};

const getLinkedRecordStatus = (currentStatus, hasOpenFault) => {
    if (LOCKED_NONCONFORMITY_STATUSES.has(currentStatus)) {
        return currentStatus;
    }

    return hasOpenFault ? 'Açık' : 'Kapatıldı';
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

const pickMostFrequentValue = (values) => {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
    });

    let bestValue = null;
    let bestCount = 0;

    counts.forEach((count, value) => {
        if (count > bestCount) {
            bestValue = value;
            bestCount = count;
        }
    });

    return bestValue;
};

const buildAggregatedPayload = ({ vehicle, faults, reporterName, categoryName }) => {
    const totalQuantity = faults.reduce((sum, fault) => sum + (Number(fault.quantity) || 1), 0);
    const hasOpenFault = faults.some((fault) => !fault.is_resolved);
    const vehicleIdentifier = getVehicleIdentifier(vehicle);
    const department = pickMostFrequentValue(faults.map((fault) => fault.department_name || fault.department?.name));
    const detectionDate = faults
        .map((fault) => fault.fault_date || fault.created_at)
        .filter(Boolean)
        .sort((left, right) => new Date(left) - new Date(right))[0] || new Date().toISOString();

    const descriptionSummary = new Map();
    faults.forEach((fault) => {
        const description = fault.description?.trim() || 'Açıklama girilmedi';
        const quantity = Number(fault.quantity) || 1;
        descriptionSummary.set(description, (descriptionSummary.get(description) || 0) + quantity);
    });

    const detailLines = Array.from(descriptionSummary.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'tr'))
        .map(([description, quantity]) => `- ${description}${quantity > 1 ? ` (${quantity} adet)` : ''}`);

    return {
        part_code: vehicleIdentifier,
        part_name: getVehicleDisplayName(vehicle),
        description: [
            `${categoryName} kategorisinde araç hatası tespit edildi.`,
            vehicle?.vehicle_type ? `Araç Tipi: ${vehicle.vehicle_type}` : null,
            vehicle?.serial_no ? `Seri No: ${vehicle.serial_no}` : null,
            vehicle?.chassis_no ? `Şasi No: ${vehicle.chassis_no}` : null,
            `Toplam Adet: ${totalQuantity}`,
            detailLines.length > 0 ? 'Hata Detayları:' : null,
            detailLines.length > 0 ? detailLines.join('\n') : null
        ].filter(Boolean).join('\n'),
        category: categoryName,
        detection_area: 'Üretilen Araçlar',
        detection_date: detectionDate,
        detected_by: 'Üretilen Araçlar', // reporterName yerine her zaman modül adını yazıyoruz
        severity: getAutoSeverityByQuantity(totalQuantity),
        vehicle_type: vehicle?.vehicle_type || null,
        quantity: totalQuantity,
        department: department || null,
        notes: AUTO_RECORD_NOTE,
        hasOpenFault
    };
};

const needsRecordUpdate = (record, payload, nextStatus) => {
    return !(
        (record.part_code || null) === (payload.part_code || null) &&
        (record.part_name || null) === (payload.part_name || null) &&
        (record.description || null) === (payload.description || null) &&
        (record.category || null) === (payload.category || null) &&
        (record.detection_area || null) === (payload.detection_area || null) &&
        sameDateTime(record.detection_date, payload.detection_date) &&
        (record.detected_by || null) === (payload.detected_by || null) &&
        (record.severity || null) === (payload.severity || null) &&
        (record.vehicle_type || null) === (payload.vehicle_type || null) &&
        Number(record.quantity || 0) === Number(payload.quantity || 0) &&
        (record.department || null) === (payload.department || null) &&
        (record.notes || null) === (payload.notes || null) &&
        (record.status || null) === (nextStatus || null)
    );
};

const fetchAllRows = async (fetchPage) => {
    const pageSize = 1000;
    const allRows = [];
    let from = 0;

    while (true) {
        const { data, error } = await fetchPage(from, from + pageSize - 1);
        if (error) throw error;

        const rows = data || [];
        allRows.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return allRows;
};

const fetchVehicleFaults = async (supabase, vehicleId) => {
    const { data, error } = await supabase
        .from('quality_inspection_faults')
        .select(`
            *,
            department:production_departments(name),
            category:fault_categories(name)
        `)
        .eq('inspection_id', vehicleId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((fault) => enrichVehicleFaultRecord(fault));
};

const fetchGroupRecords = async (supabase, { vehicleIdentifier, categoryName, vehicleType }) => {
    let query = supabase
        .from('nonconformity_records')
        .select('id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department')
        .eq('detection_area', 'Üretilen Araçlar')
        .eq('part_code', vehicleIdentifier)
        .eq('category', categoryName)
        .order('created_at', { ascending: false });

    if (vehicleType) {
        query = query.eq('vehicle_type', vehicleType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
};

const getNextNonconformityRecordNumber = async (supabase) => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const prefix = `UYG-${yearPrefix}-`;

    // Atomik RPC kullanarak benzersiz kayıt numarası al (race condition yok)
    const { data, error } = await supabase.rpc('next_nc_record_number', {
        p_year_prefix: prefix
    });

    if (error) throw error;

    return data;
};

const sortRecordsForPrimarySelection = (records) => {
    return [...records].sort((left, right) => {
        const leftLocked = LOCKED_NONCONFORMITY_STATUSES.has(left.status) ? 1 : 0;
        const rightLocked = LOCKED_NONCONFORMITY_STATUSES.has(right.status) ? 1 : 0;
        if (leftLocked !== rightLocked) {
            return rightLocked - leftLocked;
        }

        return parseNonconformityRecordNumber(right.record_number) - parseNonconformityRecordNumber(left.record_number);
    });
};

const deleteRecordsByIds = async (supabase, recordIds) => {
    const validIds = (recordIds || []).filter((id) => id != null && id !== '');
    if (!validIds.length) return;

    const { error } = await supabase
        .from('nonconformity_records')
        .delete()
        .in('id', validIds);

    if (error) throw error;
};

const preserveLockedRecord = async (supabase, record) => {
    const recordId = record?.id;
    if (recordId == null || recordId === '') {
        throw new Error('Kilidi korunacak uygunsuzluk kaydının id alanı eksik.');
    }

    const nextNotes = [AUTO_RECORD_NOTE, PRESERVED_RECORD_NOTE].join('\n\n');

    if (nextNotes === record.notes) {
        return record;
    }

    const { data, error } = await supabase
        .from('nonconformity_records')
        .update({ notes: nextNotes })
        .eq('id', recordId)
        .select('id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department')
        .single();

    if (error) throw error;

    return data;
};

const reconcileGroup = async ({ supabase, vehicle, categoryName, faults, existingRecords, reporterName, userId }) => {
    const sortedRecords = sortRecordsForPrimarySelection(existingRecords || []);
    const primaryRecord = sortedRecords[0] || null;
    const duplicateRecords = sortedRecords.slice(1);

    if (duplicateRecords.length > 0) {
        const duplicateIds = duplicateRecords.map((r) => r.id).filter((id) => id != null && id !== '');
        await deleteRecordsByIds(supabase, duplicateIds);
    }

    if (!faults.length) {
        if (!primaryRecord) {
            return { mode: 'missing', record: null, deletedDuplicates: duplicateRecords.length };
        }

        if (LOCKED_NONCONFORMITY_STATUSES.has(primaryRecord.status)) {
            const preservedRecord = await preserveLockedRecord(supabase, primaryRecord);
            return { mode: 'preserved', record: preservedRecord, deletedDuplicates: duplicateRecords.length };
        }

        const idToDelete = primaryRecord?.id;
        if (idToDelete != null && idToDelete !== '') {
            await deleteRecordsByIds(supabase, [idToDelete]);
        }
        return { mode: 'deleted', record: primaryRecord, deletedDuplicates: duplicateRecords.length + 1 };
    }

    const { hasOpenFault, ...dbPayload } = buildAggregatedPayload({ vehicle, faults, reporterName, categoryName });
    const nextStatus = getLinkedRecordStatus(primaryRecord?.status, hasOpenFault);

    if (!primaryRecord) {
        const recordNumber = await getNextNonconformityRecordNumber(supabase);
        const { data, error } = await supabase
            .from('nonconformity_records')
            .insert({
                ...dbPayload,
                status: nextStatus,
                record_number: recordNumber,
                created_by: userId || null
            })
            .select('id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department')
            .single();

        if (error) throw error;

        return { mode: 'created', record: data, deletedDuplicates: duplicateRecords.length };
    }

    if (!needsRecordUpdate(primaryRecord, dbPayload, nextStatus)) {
        return { mode: 'existing', record: primaryRecord, deletedDuplicates: duplicateRecords.length };
    }

    const recordId = primaryRecord?.id;
    if (recordId == null || recordId === '') {
        throw new Error('Güncellenecek araç uygunsuzluk kaydının id alanı geçersiz veya eksik.');
    }

    const { data, error } = await supabase
        .from('nonconformity_records')
        .update({
            part_code: dbPayload.part_code,
            part_name: dbPayload.part_name,
            description: dbPayload.description,
            category: dbPayload.category,
            detection_area: dbPayload.detection_area,
            detection_date: dbPayload.detection_date,
            detected_by: dbPayload.detected_by,
            severity: dbPayload.severity,
            vehicle_type: dbPayload.vehicle_type,
            quantity: dbPayload.quantity,
            department: dbPayload.department,
            notes: dbPayload.notes,
            status: nextStatus
        })
        .eq('id', recordId)
        .select('id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department')
        .single();

    if (error) throw error;

    return { mode: 'updated', record: data, deletedDuplicates: duplicateRecords.length };
};

export const syncVehicleFaultGroupNonconformity = async ({
    supabase,
    vehicle,
    reporterName,
    userId,
    categoryId = null,
    categoryName = null
}) => {
    const resolvedCategoryName = categoryName || 'Kategorisiz';
    const vehicleIdentifier = getVehicleIdentifier(vehicle);

    if (!vehicle?.id || !vehicleIdentifier) {
        return { mode: 'skipped', record: null, deletedDuplicates: 0 };
    }

    const faults = (await fetchVehicleFaults(supabase, vehicle.id)).filter((fault) => {
        if (categoryId && String(fault.category_id) === String(categoryId)) return true;
        return getCategoryName(fault) === resolvedCategoryName;
    });

    const records = await fetchGroupRecords(supabase, {
        vehicleIdentifier,
        categoryName: resolvedCategoryName,
        vehicleType: vehicle.vehicle_type || null
    });

    return reconcileGroup({
        supabase,
        vehicle,
        categoryName: resolvedCategoryName,
        faults,
        existingRecords: records,
        reporterName,
        userId
    });
};

export const syncVehicleFaultNonconformity = async ({ supabase, fault, vehicle, reporterName, userId }) => {
    return syncVehicleFaultGroupNonconformity({
        supabase,
        vehicle,
        reporterName,
        userId,
        categoryId: fault?.category_id || null,
        categoryName: getCategoryName(fault)
    });
};

export const cleanupVehicleFaultNonconformity = async ({ supabase, fault, vehicle, reporterName, userId }) => {
    return syncVehicleFaultGroupNonconformity({
        supabase,
        vehicle,
        reporterName,
        userId,
        categoryId: fault?.category_id || null,
        categoryName: getCategoryName(fault)
    });
};

export const backfillVehicleFaultNonconformities = async ({ supabase, reporterName, userId }) => {
    const [faults, records] = await Promise.all([
        fetchAllRows((from, to) => supabase
            .from('quality_inspection_faults')
            .select(`
                *,
                department:production_departments(name),
                category:fault_categories(name),
                inspection:quality_inspections(id, serial_no, chassis_no, vehicle_type, customer_name)
            `)
            .order('created_at', { ascending: true })
            .range(from, to)),
        fetchAllRows((from, to) => supabase
            .from('nonconformity_records')
            .select('id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, quantity, department')
            .eq('detection_area', 'Üretilen Araçlar')
            .order('created_at', { ascending: false })
            .range(from, to))
    ]);

    const groupedFaults = new Map();
    const vehicleMap = new Map();

    (faults || []).forEach((rawFault) => {
        const fault = enrichVehicleFaultRecord(rawFault);
        const vehicle = fault.inspection || null;
        const vehicleIdentifier = getVehicleIdentifier(vehicle);
        const categoryName = getCategoryName(fault);

        if (!vehicle || !vehicleIdentifier) return;

        const groupKey = buildGroupKey({ vehicleIdentifier, categoryName });
        if (!groupedFaults.has(groupKey)) {
            groupedFaults.set(groupKey, []);
            vehicleMap.set(groupKey, vehicle);
        }

        groupedFaults.get(groupKey).push(fault);
    });

    const groupedRecords = new Map();
    (records || []).forEach((record) => {
        const groupKey = buildGroupKey({
            vehicleIdentifier: record.part_code,
            categoryName: record.category
        });

        if (!groupedRecords.has(groupKey)) {
            groupedRecords.set(groupKey, []);
        }

        groupedRecords.get(groupKey).push(record);
    });

    const allGroupKeys = new Set([...groupedFaults.keys(), ...groupedRecords.keys()]);

    const stats = {
        created: 0,
        updated: 0,
        deletedDuplicates: 0
    };

    for (const groupKey of allGroupKeys) {
        const faultsInGroup = groupedFaults.get(groupKey) || [];
        const existingRecords = groupedRecords.get(groupKey) || [];
        const vehicle = vehicleMap.get(groupKey) || {
            id: null,
            serial_no: existingRecords[0]?.part_code || null,
            chassis_no: existingRecords[0]?.part_code || null,
            vehicle_type: existingRecords[0]?.vehicle_type || null,
            customer_name: null
        };
        const categoryName = faultsInGroup[0]?.category_name || existingRecords[0]?.category || 'Kategorisiz';

        const result = await withRetryOnDeadlock(() =>
            reconcileGroup({
                supabase,
                vehicle,
                categoryName,
                faults: faultsInGroup,
                existingRecords,
                reporterName,
                userId
            })
        );

        if (result.mode === 'created') stats.created += 1;
        if (result.mode === 'updated') stats.updated += 1;
        stats.deletedDuplicates += result.deletedDuplicates || 0;
    }

    return stats;
};
