import {
    LOCKED_NONCONFORMITY_STATUSES,
    parseNonconformityRecordNumber,
} from './vehicleFaultNonconformitySync';
import { withRetryOnDeadlock } from './supabaseRetry';

const LEAK_DETECTION_AREA = 'Sızdırmazlık Kontrol';
const AUTO_NOTE_TITLE =
    'Bu kayıt Sızdırmazlık Kontrol modülündeki kaçaklı test sonucundan otomatik oluşturuldu.';
const PRESERVED_NOTE =
    'Kaynak sızdırmazlık test kaydı silinmiş veya sonuç kabul olarak değiştirilmiş olsa da açılmış DF/8D süreci korundu.';
const SOURCE_REFERENCE_LABEL = 'Sızdırmazlık Kayıt No:';

const RECORD_SELECT =
    'id, record_number, status, notes, created_at, part_code, part_name, description, category, detection_area, detection_date, detected_by, severity, vehicle_type, vehicle_identifier, quantity, department, action_taken';

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

export const getLeakTestSourceReference = (leak) =>
    `${SOURCE_REFERENCE_LABEL} ${leak?.record_number || 'Bilinmiyor'}`;

export const extractLeakTestSourceReference = (record) => {
    const sourceText = `${record?.notes || ''}\n${record?.description || ''}`;
    const matched = sourceText.match(/Sızdırmazlık Kayıt No:\s*([^\n\r]+)/i);
    return matched ? `${SOURCE_REFERENCE_LABEL} ${matched[1].trim()}` : null;
};

const getAutoNotes = (leak, leakCount) =>
    [
        AUTO_NOTE_TITLE,
        getLeakTestSourceReference(leak),
        `Kaçak adedi: ${leakCount}`,
    ]
        .filter(Boolean)
        .join('\n');

const getPreservedNotes = (leak) =>
    [AUTO_NOTE_TITLE, getLeakTestSourceReference(leak), PRESERVED_NOTE].filter(Boolean).join('\n');

const getLeakSeverity = (leakCount) => {
    const n = Number(leakCount) || 0;
    if (n >= 10) return 'Kritik';
    if (n >= 5) return 'Yüksek';
    return 'Orta';
};

const buildWelderDescriptionLine = (leak) => {
    if (leak?.welding_at_supplier) {
        return `Kaynak tedarikçi: ${leak.supplier_name || '-'}`;
    }
    return `Ürünü kaynatan: ${leak.welded_by_name || '-'}`;
};

const buildPayload = (leak) => {
    const leakCount = Math.max(Number(leak?.leak_count) || 0, 1);

    return {
        part_code: leak?.record_number || null,
        part_name: leak?.tank_type || 'Sızdırmazlık parçası',
        description: [
            `Sızdırmazlık testinde kaçak tespit edildi (${leakCount} adet).`,
            getLeakTestSourceReference(leak),
            `Araç tipi: ${leak?.vehicle_type_label || '-'}`,
            `Seri no: ${leak?.vehicle_serial_number || '-'}`,
            `Sızdırmazlık parçası: ${leak?.tank_type || '-'}`,
            `Test tarihi: ${leak?.test_date || '-'}`,
            `Test başlangıcı: ${leak?.test_start_time || '-'}`,
            `Test süresi: ${leak?.test_duration_minutes ?? '-'} dk`,
            `Testi yapan: ${leak?.tested_by_name || '-'}`,
            buildWelderDescriptionLine(leak),
            leak?.notes ? `Test notları: ${leak.notes}` : null,
        ]
            .filter(Boolean)
            .join('\n'),
        category: 'Sızdırmazlık Kaçağı',
        detection_area: LEAK_DETECTION_AREA,
        detection_date: leak?.test_date ? new Date(`${leak.test_date}T12:00:00`).toISOString() : new Date().toISOString(),
        detected_by: leak?.tested_by_name || 'Sızdırmazlık Kontrol',
        severity: getLeakSeverity(leakCount),
        quantity: leakCount,
        department: null,
        action_taken: null,
        vehicle_type: leak?.vehicle_type_label || null,
        vehicle_identifier: leak?.vehicle_serial_number || null,
        notes: getAutoNotes(leak, leakCount),
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
        (record.vehicle_type || null) === (payload.vehicle_type || null) &&
        (record.vehicle_identifier || null) === (payload.vehicle_identifier || null) &&
        (record.status || null) === (nextStatus || null)
    );

const fetchExistingRecordsForLeak = async (supabase, leak) => {
    if (!leak?.record_number) return [];

    const sourceReference = getLeakTestSourceReference(leak);
    const { data, error } = await supabase
        .from('nonconformity_records')
        .select(RECORD_SELECT)
        .eq('detection_area', LEAK_DETECTION_AREA)
        .eq('part_code', leak.record_number)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).filter((row) => extractLeakTestSourceReference(row) === sourceReference);
};

const leakHasOpenNonconformity = (leak) =>
    leak?.test_result === 'Kaçak Var' && Number(leak?.leak_count) > 0;

const reconcileLeak = async ({ supabase, leak, existingRecords, userId }) => {
    const sortedRecords = sortRecordsForPrimarySelection(existingRecords || []);
    const primaryRecord = sortedRecords[0] || null;
    const duplicateRecords = sortedRecords.slice(1);

    if (duplicateRecords.length > 0) {
        const duplicateIds = duplicateRecords.map((r) => r.id).filter((id) => id != null && id !== '');
        await deleteRecordsByIds(supabase, duplicateIds);
    }

    if (!leakHasOpenNonconformity(leak)) {
        if (!primaryRecord) {
            return { mode: 'missing', record: null, deletedDuplicates: duplicateRecords.length };
        }

        if (LOCKED_NONCONFORMITY_STATUSES.has(primaryRecord.status)) {
            const preservedId = primaryRecord?.id;
            if (preservedId == null || preservedId === '') {
                throw new Error('Korunacak sızdırmazlık uygunsuzluk kaydının id alanı eksik.');
            }

            const { data, error } = await supabase
                .from('nonconformity_records')
                .update({ notes: getPreservedNotes(leak) })
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

    const payload = buildPayload(leak);
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
        throw new Error('Güncellenecek sızdırmazlık uygunsuzluk kaydının id alanı geçersiz veya eksik.');
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
            vehicle_type: payload.vehicle_type,
            vehicle_identifier: payload.vehicle_identifier,
            status: nextStatus,
        })
        .eq('id', recordId)
        .select(RECORD_SELECT)
        .single();

    if (error) throw error;

    return { mode: 'updated', record: data, deletedDuplicates: duplicateRecords.length };
};

/**
 * Kaçaklı sızdırmazlık kaydı için uygunsuzluk oluşturur / günceller; kabul veya kaçaksız durumda kaldırır (DF/8D kilitliyse notla korur).
 */
export const syncLeakTestNonconformity = async ({ supabase, leakTestRecord, userId }) => {
    if (!leakTestRecord?.record_number) {
        return { mode: 'skipped', record: null, deletedDuplicates: 0 };
    }

    const existingRecords = await fetchExistingRecordsForLeak(supabase, leakTestRecord);

    return withRetryOnDeadlock(() =>
        reconcileLeak({
            supabase,
            leak: leakTestRecord,
            existingRecords,
            userId,
        })
    );
};

/**
 * Sızdırmazlık kaydı silinmeden önce çağrılır; bağlı uygunsuzluğu siler veya DF/8D ise koruma notu yazar.
 */
export const cleanupLeakTestNonconformity = async ({ supabase, leakTestRecord, userId }) => {
    if (!leakTestRecord?.record_number) return { mode: 'skipped', record: null, deletedDuplicates: 0 };

    const existingRecords = await fetchExistingRecordsForLeak(supabase, leakTestRecord);
    const syntheticLeak = { ...leakTestRecord, test_result: 'Kabul', leak_count: 0 };

    return withRetryOnDeadlock(() =>
        reconcileLeak({
            supabase,
            leak: syntheticLeak,
            existingRecords,
            userId,
        })
    );
};

export const backfillLeakTestNonconformities = async ({ supabase, userId }) => {
    const [leaks, existingRecords] = await Promise.all([
        fetchAllRows((from, to) =>
            supabase
                .from('leak_test_records')
                .select('*')
                .order('test_date', { ascending: false })
                .range(from, to)
        ),
        fetchAllRows((from, to) =>
            supabase
                .from('nonconformity_records')
                .select(RECORD_SELECT)
                .eq('detection_area', LEAK_DETECTION_AREA)
                .order('created_at', { ascending: false })
                .range(from, to)
        ),
    ]);

    const recordsBySource = new Map();
    (existingRecords || []).forEach((record) => {
        const sourceReference = extractLeakTestSourceReference(record);
        if (!sourceReference) return;

        if (!recordsBySource.has(sourceReference)) {
            recordsBySource.set(sourceReference, []);
        }

        recordsBySource.get(sourceReference).push(record);
    });

    const stats = {
        created: 0,
        updated: 0,
        deletedDuplicates: 0,
        deleted: 0,
        preserved: 0,
    };

    for (const leak of leaks || []) {
        const sourceReference = getLeakTestSourceReference(leak);
        const result = await withRetryOnDeadlock(() =>
            reconcileLeak({
                supabase,
                leak,
                existingRecords: recordsBySource.get(sourceReference) || [],
                userId,
            })
        );

        if (result.mode === 'created') stats.created += 1;
        if (result.mode === 'updated') stats.updated += 1;
        if (result.mode === 'deleted') stats.deleted += 1;
        if (result.mode === 'preserved') stats.preserved += 1;
        stats.deletedDuplicates += result.deletedDuplicates || 0;
    }

    return stats;
};
