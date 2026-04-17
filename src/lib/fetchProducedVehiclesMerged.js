import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_LIMIT = 250;
const IN_CHUNK = 100;
/** PostgREST varsayılan max satır (~1000); tek sorguda tüm child kayıtlar gelmez — kesilince tabloda 0 hata görünür. */
const CHILD_PAGE_SIZE = 1000;

function chunkIds(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
        out.push(ids.slice(i, i + IN_CHUNK));
    }
    return out;
}

function inspectionKey(id) {
    return id == null ? '' : String(id);
}

/**
 * inspection_id ile filtrelenen tabloları sayfalayarak çeker (1000+ satırda kesilme olmaz).
 */
async function fetchByInspectionIdsPaginated(table, select, idChunks) {
    const merged = [];
    for (const ch of idChunks) {
        let from = 0;
        for (;;) {
            const { data, error } = await supabase
                .from(table)
                .select(select)
                .in('inspection_id', ch)
                .order('id', { ascending: true })
                .range(from, from + CHILD_PAGE_SIZE - 1);

            if (error) return { error, data: null };
            if (!data?.length) break;
            merged.push(...data);
            if (data.length < CHILD_PAGE_SIZE) break;
            from += CHILD_PAGE_SIZE;
        }
    }
    return { data: merged, error: null };
}

async function mergeInspectionsWithFaults(inspections) {
    if (!inspections?.length) return { error: null, data: [] };

    const ids = inspections.map((i) => i.id);
    const idChunks = chunkIds(ids);

    const [faultsRes, timelineRes, historyRes] = await Promise.all([
        fetchByInspectionIdsPaginated(
            'quality_inspection_faults',
            '*, fault_category:fault_categories(name, discipline)',
            idChunks
        ),
        fetchByInspectionIdsPaginated('vehicle_timeline_events', '*', idChunks),
        fetchByInspectionIdsPaginated('quality_inspection_history', '*', idChunks),
    ]);

    if (faultsRes.error) return { error: faultsRes.error, data: null };
    if (timelineRes.error) return { error: timelineRes.error, data: null };
    if (historyRes.error) return { error: historyRes.error, data: null };

    const faultsBy = {};
    (faultsRes.data || []).forEach((f) => {
        const id = inspectionKey(f.inspection_id);
        if (!faultsBy[id]) faultsBy[id] = [];
        faultsBy[id].push(f);
    });
    const timelineBy = {};
    (timelineRes.data || []).forEach((e) => {
        const id = inspectionKey(e.inspection_id);
        if (!timelineBy[id]) timelineBy[id] = [];
        timelineBy[id].push(e);
    });
    const historyBy = {};
    (historyRes.data || []).forEach((h) => {
        const id = inspectionKey(h.inspection_id);
        if (!historyBy[id]) historyBy[id] = [];
        historyBy[id].push(h);
    });

    return {
        error: null,
        data: inspections.map((insp) => ({
            ...insp,
            quality_inspection_faults: faultsBy[inspectionKey(insp.id)] || [],
            vehicle_timeline_events: timelineBy[inspectionKey(insp.id)] || [],
            quality_inspection_history: historyBy[inspectionKey(insp.id)] || [],
        })),
    };
}

/**
 * Kaliteye verilen araçlar: tek dev iç içe select yerine ana tablo + 3 paralel sorgu (statement timeout önlemi).
 */
export async function fetchProducedVehiclesMerged({ limit = DEFAULT_LIMIT } = {}) {
    const { data: inspections, error: inspError } = await supabase
        .from('quality_inspections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (inspError) return { data: [], error: inspError };
    if (!inspections?.length) return { data: [], error: null };

    const merged = await mergeInspectionsWithFaults(inspections);
    if (merged.error) return { data: [], error: merged.error };
    return { data: merged.data, error: null };
}

/**
 * İcra / A3 raporları için: dönem içindeki tüm kalite muayeneleri (context’teki 250 kayıt sınırını aşar).
 */
export async function fetchProducedVehiclesMergedByDateRange({ startDate, endDate }) {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    const allInspections = [];
    let from = 0;
    const pageSize = 1000;

    for (;;) {
        const { data, error } = await supabase
            .from('quality_inspections')
            .select('*')
            .gte('created_at', startISO)
            .lte('created_at', endISO)
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) return { data: [], error };
        if (!data?.length) break;
        allInspections.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    if (!allInspections.length) return { data: [], error: null };

    const merged = await mergeInspectionsWithFaults(allInspections);
    if (merged.error) return { data: [], error: merged.error };
    return { data: merged.data, error: null };
}
