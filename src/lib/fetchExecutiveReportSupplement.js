import { subMonths, startOfDay } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchProducedVehiclesMergedByDateRange } from '@/lib/fetchProducedVehiclesMerged';

const NC_SELECT = 'id, record_number, source_nc_id, status, part_code, part_name, vehicle_type, vehicle_identifier, description, category, severity, quantity, detection_date, detection_area, detected_by, responsible_person, department, created_at';

const COMPLAINT_SELECT = '*, customer:customer_id(name, customer_name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)';

const STOCK_RISK_SELECT = `
    *,
    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no, part_code, part_name),
    controlled_inspection:incoming_inspections!stock_risk_controls_controlled_inspection_id_fkey(id, record_no, part_code, part_name, delivery_note_number),
    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
`;

async function fetchPaginated(buildQuery) {
    const all = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

function mergeById(rows) {
    const byId = new Map();
    (rows || []).forEach((r) => {
        if (r?.id != null) byId.set(r.id, r);
    });
    return Array.from(byId.values());
}

/** Kalibrasyon KPI: sayfalı tam ekipman (icra supplement + A3 yedek çekim) */
export async function fetchEquipmentsWithCalibrationsPaginated() {
    try {
        return await fetchPaginated(() =>
            supabase
                .from('equipments')
                .select(
                    'id, name, status, scrap_date, equipment_calibrations(id, calibration_date, next_calibration_date, is_active)'
                )
                .order('name', { ascending: true })
        );
    } catch (err) {
        console.warn('fetchEquipmentsWithCalibrationsPaginated:', err?.message || err);
        return null;
    }
}

/**
 * DataContext’teki düşük limitler (ör. 250 araç, 500 girdi) nedeniyle eksik kalan
 * dönem verilerini icra sunumu için tamamlar.
 */
export async function fetchExecutiveReportSupplement({ startDate, endDate }) {
    const s = startDate.toISOString();
    const e = endDate.toISOString();

    const twelveMonthsAgo = startOfDay(subMonths(endDate, 12));
    const vehicleStart =
        startDate.getTime() < twelveMonthsAgo.getTime() ? startDate : twelveMonthsAgo;

    const vehiclesPromise = fetchProducedVehiclesMergedByDateRange({
        startDate: vehicleStart,
        endDate,
    });

    const ncRecordsPromise = (async () => {
        const [a, b] = await Promise.all([
            fetchPaginated(() =>
                supabase
                    .from('nonconformity_records')
                    .select(NC_SELECT)
                    .not('detection_date', 'is', null)
                    .gte('detection_date', s)
                    .lte('detection_date', e)
                    .order('detection_date', { ascending: false })
            ),
            fetchPaginated(() =>
                supabase
                    .from('nonconformity_records')
                    .select(NC_SELECT)
                    .is('detection_date', null)
                    .gte('created_at', s)
                    .lte('created_at', e)
                    .order('created_at', { ascending: false })
            ),
        ]);
        return mergeById([...a, ...b]);
    })();

    const incomingPromise = (async () => {
        const [a, b] = await Promise.all([
            fetchPaginated(() =>
                supabase
                    .from('incoming_inspections_with_supplier')
                    .select('*')
                    .not('inspection_date', 'is', null)
                    .gte('inspection_date', s)
                    .lte('inspection_date', e)
                    .order('inspection_date', { ascending: false })
            ),
            fetchPaginated(() =>
                supabase
                    .from('incoming_inspections_with_supplier')
                    .select('*')
                    .is('inspection_date', null)
                    .gte('created_at', s)
                    .lte('created_at', e)
                    .order('created_at', { ascending: false })
            ),
        ]);
        return mergeById([...a, ...b]);
    })();

    const complaintsPromise = (async () => {
        const [a, b] = await Promise.all([
            fetchPaginated(() =>
                supabase
                    .from('customer_complaints')
                    .select(COMPLAINT_SELECT)
                    .not('complaint_date', 'is', null)
                    .gte('complaint_date', s)
                    .lte('complaint_date', e)
                    .order('complaint_date', { ascending: false })
            ),
            fetchPaginated(() =>
                supabase
                    .from('customer_complaints')
                    .select(COMPLAINT_SELECT)
                    .is('complaint_date', null)
                    .gte('created_at', s)
                    .lte('created_at', e)
                    .order('created_at', { ascending: false })
            ),
        ]);
        return mergeById([...a, ...b]);
    })();

    const nonConformitiesPromise = fetchPaginated(() =>
        supabase
            .from('non_conformities')
            .select('*, supplier:supplier_id(name)')
            .gte('created_at', s)
            .lte('created_at', e)
            .order('created_at', { ascending: false })
    );

    const trainingsPromise = (async () => {
        const all = await fetchPaginated(() =>
            supabase
                .from('trainings')
                .select('id, title, start_date, end_date, status, created_at, instructor, duration_hours, training_participants(count)')
                .order('start_date', { ascending: false, nullsFirst: false })
        );
        return all;
    })();

    const quarantinePromise = fetchPaginated(() =>
        supabase.from('quarantine_records_api').select('*').eq('status', 'Karantinada').order('quarantine_date', { ascending: false })
    );

    const stockRiskPromise = fetchPaginated(() =>
        supabase.from('stock_risk_controls').select(STOCK_RISK_SELECT).gte('created_at', s).lte('created_at', e).order('created_at', { ascending: false })
    );

    const supplierNcPromise = fetchPaginated(() =>
        supabase
            .from('supplier_non_conformities')
            .select('*, supplier:supplier_id(name)')
            .gte('created_at', s)
            .lte('created_at', e)
            .order('created_at', { ascending: false })
    );

    /** İcra sunumu: DataContext tek sayfa limitine takılmadan tam ekipman + kalibrasyon özeti */
    const equipmentsPromise = fetchEquipmentsWithCalibrationsPaginated();

    const processInspectionsPromise = (async () => {
        try {
            return await fetchPaginated(() =>
                supabase
                    .from('process_inspections')
                    .select('id, record_no, inspection_date, decision, part_code, part_name')
                    .gte('inspection_date', s)
                    .lte('inspection_date', e)
                    .order('inspection_date', { ascending: false })
            );
        } catch (err) {
            console.warn('process_inspections executive supplement:', err?.message || err);
            return [];
        }
    })();

    const processControlPlansPromise = (async () => {
        try {
            return await fetchPaginated(() =>
                supabase
                    .from('process_control_plans')
                    .select('id, plan_name, is_active, updated_at')
                    .order('updated_at', { ascending: false })
            );
        } catch (err) {
            console.warn('process_control_plans executive supplement:', err?.message || err);
            return [];
        }
    })();

    const processInkrReportsPromise = (async () => {
        try {
            return await fetchPaginated(() =>
                supabase
                    .from('process_inkr_reports')
                    .select('id, inkr_number, status, report_date, created_at, part_code, part_name')
                    .gte('created_at', s)
                    .lte('created_at', e)
                    .order('created_at', { ascending: false })
            );
        } catch (err) {
            console.warn('process_inkr_reports executive supplement:', err?.message || err);
            return [];
        }
    })();

    const leakTestRecordsPromise = (async () => {
        try {
            return await fetchPaginated(() =>
                supabase
                    .from('leak_test_records')
                    .select(
                        'id, record_number, test_date, test_result, leak_count, part_code, vehicle_serial_number, tank_type'
                    )
                    .gte('test_date', s)
                    .lte('test_date', e)
                    .order('test_date', { ascending: false })
            );
        } catch (err) {
            console.warn('leak_test_records executive supplement:', err?.message || err);
            return [];
        }
    })();

    const fanBalanceRecordsPromise = (async () => {
        try {
            const inRange = await fetchPaginated(() =>
                supabase
                    .from('fan_balance_records')
                    .select(
                        'id, serial_number, test_date, left_plane_result, right_plane_result, overall_result, created_at, fan_products(product_code, product_name)'
                    )
                    .gte('test_date', s)
                    .lte('test_date', e)
                    .order('test_date', { ascending: false })
            );
            if (inRange.length > 0) return inRange;
            return await fetchPaginated(() =>
                supabase
                    .from('fan_balance_records')
                    .select(
                        'id, serial_number, test_date, left_plane_result, right_plane_result, overall_result, created_at, fan_products(product_code, product_name)'
                    )
                    .gte('created_at', s)
                    .lte('created_at', e)
                    .order('created_at', { ascending: false })
            );
        } catch (err) {
            console.warn('fan_balance_records executive supplement:', err?.message || err);
            return [];
        }
    })();

    const [
        vehiclesRes,
        nonconformityRecords,
        incomingInspections,
        customerComplaints,
        nonConformities,
        trainingsAll,
        quarantineRecords,
        stockRiskControls,
        supplierNonConformities,
        processInspections,
        processControlPlans,
        processInkrReports,
        leakTestRecords,
        fanBalanceRecords,
        equipments,
    ] = await Promise.all([
        vehiclesPromise,
        ncRecordsPromise,
        incomingPromise,
        complaintsPromise,
        nonConformitiesPromise,
        trainingsPromise,
        quarantinePromise,
        stockRiskPromise,
        supplierNcPromise,
        processInspectionsPromise,
        processControlPlansPromise,
        processInkrReportsPromise,
        leakTestRecordsPromise,
        fanBalanceRecordsPromise,
        equipmentsPromise,
    ]);

    return {
        producedVehicles: vehiclesRes?.error ? null : vehiclesRes?.data ?? null,
        nonconformityRecords,
        incomingInspections,
        customerComplaints,
        nonConformities,
        trainingsRaw: trainingsAll,
        quarantineRecords,
        stockRiskControls,
        supplierNonConformities,
        processInspections,
        processControlPlans,
        processInkrReports,
        leakTestRecords,
        fanBalanceRecords,
        equipments: equipments ?? undefined,
    };
}
