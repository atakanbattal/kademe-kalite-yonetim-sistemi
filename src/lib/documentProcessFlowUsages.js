import { supabase } from '@/lib/customSupabaseClient';
import { formatDocumentChip } from '@/components/process-flow-diagrams/processFlowConstants';

export function processFlowUsageKey(usage) {
    return `${usage.usage_type}|${usage.usage_id}|${usage.document_code || ''}`;
}

export function formatProcessFlowUsageLabel(usage) {
    const docLabel = formatDocumentChip({
        document_code: usage.document_code,
        section_ref: usage.section_ref,
    }) || usage.document_code;

    if (usage.usage_type === 'step_document') {
        const step = usage.step_text?.trim();
        const stepPart = step ? (step.length > 72 ? `${step.slice(0, 72)}…` : step) : 'Adım';
        return `${usage.unit_name} → ${usage.flow_title} → ${stepPart} (${docLabel})`;
    }
    if (usage.usage_type === 'unit_key_document') {
        return `${usage.unit_name} → Birim anahtar dokümanları (${docLabel})`;
    }
    if (usage.usage_type === 'flow_header_document') {
        return `${usage.unit_name} → ${usage.flow_title} → Akış başlığı (${docLabel})`;
    }
    return docLabel;
}

export function formatProcessFlowUsageType(usageType) {
    if (usageType === 'step_document') return 'Adım dokümanı';
    if (usageType === 'unit_key_document') return 'Birim anahtar dokümanı';
    if (usageType === 'flow_header_document') return 'Akış başlık dokümanı';
    return usageType;
}

export async function fetchDocumentProcessFlowUsages(documentId) {
    const { data, error } = await supabase.rpc('get_document_process_flow_usages', {
        p_document_id: documentId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : (data || []);
}

export async function removeDocumentProcessFlowUsages(usages) {
    if (!usages?.length) return 0;
    const removals = usages.map((usage) => ({
        usage_type: usage.usage_type,
        usage_id: usage.usage_id,
        document_code: usage.document_code,
    }));
    const { data, error } = await supabase.rpc('remove_document_process_flow_usages', {
        p_removals: removals,
    });
    if (error) throw error;
    return data ?? 0;
}
