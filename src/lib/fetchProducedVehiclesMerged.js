import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_LIMIT = 250;
const IN_CHUNK = 100;

function chunkIds(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
        out.push(ids.slice(i, i + IN_CHUNK));
    }
    return out;
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

    const ids = inspections.map((i) => i.id);
    const idChunks = chunkIds(ids);

    const fetchInChunks = async (table, select) => {
        const merged = [];
        for (const ch of idChunks) {
            const { data, error } = await supabase.from(table).select(select).in('inspection_id', ch);
            if (error) return { error, data: null };
            merged.push(...(data || []));
        }
        return { data: merged, error: null };
    };

    const [faultsRes, timelineRes, historyRes] = await Promise.all([
        fetchInChunks('quality_inspection_faults', '*, fault_category:fault_categories(name)'),
        fetchInChunks('vehicle_timeline_events', '*'),
        fetchInChunks('quality_inspection_history', '*'),
    ]);

    if (faultsRes.error) return { data: [], error: faultsRes.error };
    if (timelineRes.error) return { data: [], error: timelineRes.error };
    if (historyRes.error) return { data: [], error: historyRes.error };

    const faultsBy = {};
    (faultsRes.data || []).forEach((f) => {
        const id = f.inspection_id;
        if (!faultsBy[id]) faultsBy[id] = [];
        faultsBy[id].push(f);
    });
    const timelineBy = {};
    (timelineRes.data || []).forEach((e) => {
        const id = e.inspection_id;
        if (!timelineBy[id]) timelineBy[id] = [];
        timelineBy[id].push(e);
    });
    const historyBy = {};
    (historyRes.data || []).forEach((h) => {
        const id = h.inspection_id;
        if (!historyBy[id]) historyBy[id] = [];
        historyBy[id].push(h);
    });

    const merged = inspections.map((insp) => ({
        ...insp,
        quality_inspection_faults: faultsBy[insp.id] || [],
        vehicle_timeline_events: timelineBy[insp.id] || [],
        quality_inspection_history: historyBy[insp.id] || [],
    }));

    return { data: merged, error: null };
}
