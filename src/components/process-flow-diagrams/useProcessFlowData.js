import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { splitDocumentCode } from './processFlowConstants';
import { nestProcessFlowData } from './processFlowNest';
import { slugFromCode } from './processFlowDraftUtils';

const DEFAULT_FLOW_STEPS = [
    { step_type: 'start', text: 'Süreç başlangıcı' },
    { step_type: 'process', text: 'İşlem adımı' },
    { step_type: 'end', text: 'Süreç bitişi' },
];

async function resolveDocumentId(documentCode) {
    const { data } = await supabase
        .from('documents')
        .select('id')
        .eq('document_number', documentCode)
        .maybeSingle();
    return data?.id || null;
}

export function useProcessFlowData() {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const [unitsRes, flowsRes, stepsRes, docsRes] = await Promise.all([
                supabase.from('process_flow_units').select('*').order('sort_order'),
                supabase.from('process_flows').select('*').order('sort_order'),
                supabase.from('process_flow_steps').select('*').order('sort_order'),
                supabase.from('process_flow_step_documents').select('*').order('sort_order'),
            ]);
            if (unitsRes.error) throw unitsRes.error;
            if (flowsRes.error) throw flowsRes.error;
            if (stepsRes.error) throw stepsRes.error;
            if (docsRes.error) throw docsRes.error;
            setUnits(nestProcessFlowData(unitsRes.data || [], flowsRes.data || [], stepsRes.data || [], docsRes.data || []));
        } catch (err) {
            console.error(err);
            setError(err.message || 'Veri yüklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const persistFlow = useCallback(async (flowId, stepsDraft, formsMap, deletedIds = []) => {
        for (const stepId of deletedIds) {
            const { error } = await supabase.from('process_flow_steps').delete().eq('id', stepId);
            if (error) throw error;
        }

        const savedSteps = [];

        for (let order = 0; order < stepsDraft.length; order += 1) {
            const draft = stepsDraft[order];
            const form = formsMap[draft.id] || draft;
            const payload = {
                step_type: form.step_type,
                text: form.text || '',
                role: form.role || null,
                decision_question: form.decision_question || null,
                decision_yes_text: form.decision_yes_text || null,
                decision_no_text: form.decision_no_text || null,
                sort_order: order,
            };

            let stepId = draft.id;

            if (draft._isNew) {
                const { data: inserted, error: insertError } = await supabase
                    .from('process_flow_steps')
                    .insert({ flow_id: flowId, ...payload })
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                stepId = inserted.id;
            } else {
                const { error: updateError } = await supabase
                    .from('process_flow_steps')
                    .update(payload)
                    .eq('id', stepId);
                if (updateError) throw updateError;
            }

            const docs = form.documents || [];
            const { error: deleteDocsError } = await supabase
                .from('process_flow_step_documents')
                .delete()
                .eq('step_id', stepId);
            if (deleteDocsError) throw deleteDocsError;

            if (docs.length) {
                const rows = await Promise.all(docs.map(async (entry, idx) => {
                    const { document_code, section_ref } = splitDocumentCode(entry.code || entry.document_code);
                    const document_id = entry.document_id || await resolveDocumentId(document_code);
                    return {
                        step_id: stepId,
                        document_code,
                        section_ref: entry.section_ref ?? section_ref,
                        document_id,
                        sort_order: idx,
                    };
                }));
                const { error: insertDocsError } = await supabase.from('process_flow_step_documents').insert(rows);
                if (insertDocsError) throw insertDocsError;
            }

            const { data: freshStep, error: fetchError } = await supabase
                .from('process_flow_steps')
                .select('*, process_flow_step_documents(*)')
                .eq('id', stepId)
                .single();
            if (fetchError) throw fetchError;

            savedSteps.push({
                ...freshStep,
                documents: (freshStep.process_flow_step_documents || []).sort((a, b) => a.sort_order - b.sort_order),
            });
        }

        setUnits((prev) => prev.map((unit) => ({
            ...unit,
            flows: unit.flows.map((flow) => (flow.id === flowId ? { ...flow, steps: savedSteps } : flow)),
        })));

        return savedSteps;
    }, []);

    const ensureUniqueSlug = useCallback(async (baseSlug, excludeUnitId = null) => {
        let slug = baseSlug;
        let suffix = 2;
        while (true) {
            let query = supabase.from('process_flow_units').select('id').eq('slug', slug);
            if (excludeUnitId) query = query.neq('id', excludeUnitId);
            const { data } = await query.maybeSingle();
            if (!data) return slug;
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
    }, []);

    const createUnit = useCallback(async (fields) => {
        const code = String(fields.code || '').trim().toUpperCase();
        const name = String(fields.name || '').trim();
        if (!code || !name) throw new Error('Birim kodu ve adı zorunludur.');

        const baseSlug = slugFromCode(code) || slugFromCode(name);
        if (!baseSlug) throw new Error('Geçerli bir birim kodu girin.');

        const slug = await ensureUniqueSlug(baseSlug);
        const { data: existing } = await supabase.from('process_flow_units').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
            .from('process_flow_units')
            .insert({
                code,
                slug,
                name,
                subtitle: fields.subtitle?.trim() || null,
                owner_role: fields.owner_role?.trim() || null,
                roles: fields.roles?.trim() || null,
                purpose: fields.purpose?.trim() || null,
                is_ideal_process: !!fields.is_ideal_process,
                sort_order: sortOrder,
            })
            .select('*')
            .single();
        if (error) throw error;
        await load({ silent: true });
        return data;
    }, [ensureUniqueSlug, load]);

    const updateUnit = useCallback(async (unitId, fields) => {
        const code = String(fields.code || '').trim().toUpperCase();
        const name = String(fields.name || '').trim();
        if (!code || !name) throw new Error('Birim kodu ve adı zorunludur.');

        const baseSlug = slugFromCode(code) || slugFromCode(name);
        const slug = await ensureUniqueSlug(baseSlug, unitId);

        const { data, error } = await supabase
            .from('process_flow_units')
            .update({
                code,
                slug,
                name,
                subtitle: fields.subtitle?.trim() || null,
                owner_role: fields.owner_role?.trim() || null,
                roles: fields.roles?.trim() || null,
                purpose: fields.purpose?.trim() || null,
                is_ideal_process: !!fields.is_ideal_process,
            })
            .eq('id', unitId)
            .select('*')
            .single();
        if (error) throw error;
        await load({ silent: true });
        return data;
    }, [ensureUniqueSlug, load]);

    const deleteUnit = useCallback(async (unitId) => {
        const { error } = await supabase.from('process_flow_units').delete().eq('id', unitId);
        if (error) throw error;
        await load({ silent: true });
    }, [load]);

    const createFlow = useCallback(async (unitId, { title, intro, withDefaultSteps = false }) => {
        const flowTitle = String(title || '').trim();
        if (!flowTitle) throw new Error('Süreç adı zorunludur.');

        const { data: existing } = await supabase
            .from('process_flows')
            .select('sort_order')
            .eq('unit_id', unitId)
            .order('sort_order', { ascending: false })
            .limit(1);
        const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

        const { data: flow, error } = await supabase
            .from('process_flows')
            .insert({
                unit_id: unitId,
                title: flowTitle,
                intro: intro?.trim() || null,
                sort_order: sortOrder,
            })
            .select('*')
            .single();
        if (error) throw error;

        if (withDefaultSteps) {
            const rows = DEFAULT_FLOW_STEPS.map((step, idx) => ({
                flow_id: flow.id,
                ...step,
                sort_order: idx,
            }));
            const { error: stepsError } = await supabase.from('process_flow_steps').insert(rows);
            if (stepsError) throw stepsError;
        }

        await load({ silent: true });
        return flow;
    }, [load]);

    const updateFlow = useCallback(async (flowId, { title, intro }) => {
        const flowTitle = String(title || '').trim();
        if (!flowTitle) throw new Error('Süreç adı zorunludur.');

        const { data, error } = await supabase
            .from('process_flows')
            .update({
                title: flowTitle,
                intro: intro?.trim() || null,
            })
            .eq('id', flowId)
            .select('*')
            .single();
        if (error) throw error;
        await load({ silent: true });
        return data;
    }, [load]);

    const deleteFlow = useCallback(async (flowId) => {
        const { error } = await supabase.from('process_flows').delete().eq('id', flowId);
        if (error) throw error;
        await load({ silent: true });
    }, [load]);

    return {
        units,
        setUnits,
        loading,
        refreshing,
        error,
        reload: () => load({ silent: true }),
        hardReload: () => load({ silent: false }),
        persistFlow,
        createUnit,
        updateUnit,
        deleteUnit,
        createFlow,
        updateFlow,
        deleteFlow,
    };
}
