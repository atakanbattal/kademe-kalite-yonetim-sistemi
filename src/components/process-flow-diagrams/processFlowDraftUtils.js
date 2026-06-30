export function cloneUnits(units) {
    return JSON.parse(JSON.stringify(units || []));
}

export function slugFromCode(code) {
    return String(code || '')
        .trim()
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function unitToForm(unit) {
    return {
        code: unit?.code || '',
        name: unit?.name || '',
        subtitle: unit?.subtitle || '',
        owner_role: unit?.owner_role || '',
        roles: unit?.roles || '',
        purpose: unit?.purpose || '',
        is_ideal_process: !!unit?.is_ideal_process,
    };
}

export const EMPTY_UNIT_FORM = {
    code: '',
    name: '',
    subtitle: '',
    owner_role: '',
    roles: '',
    purpose: '',
    is_ideal_process: false,
};

export function findFlowInUnits(units, flowId) {
    for (const unit of units) {
        const flow = unit.flows?.find((f) => f.id === flowId);
        if (flow) return { unit, flow };
    }
    return { unit: null, flow: null };
}

export function findStepInUnits(units, stepId) {
    for (const unit of units) {
        for (const flow of unit.flows || []) {
            const step = flow.steps?.find((s) => s.id === stepId);
            if (step) return { unit, flow, step };
        }
    }
    return { unit: null, flow: null, step: null };
}

export function patchUnitsStep(units, flowId, stepId, patch) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => {
            if (flow.id !== flowId) return flow;
            return {
                ...flow,
                steps: flow.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
            };
        }),
    }));
}

export function reorderStepInUnits(units, flowId, stepId, direction) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => {
            if (flow.id !== flowId) return flow;
            const steps = [...flow.steps];
            const idx = steps.findIndex((s) => s.id === stepId);
            if (idx < 0) return flow;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= steps.length) return flow;
            [steps[idx], steps[swapIdx]] = [steps[swapIdx], steps[idx]];
            return {
                ...flow,
                steps: steps.map((step, order) => ({ ...step, sort_order: order })),
            };
        }),
    }));
}

export function markStepDeletedInUnits(units, flowId, stepId) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => {
            if (flow.id !== flowId) return flow;
            return {
                ...flow,
                steps: flow.steps.filter((step) => step.id !== stepId),
            };
        }),
    }));
}

export function insertStepAfterInUnits(units, flowId, afterStepId, template = {}) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => {
            if (flow.id !== flowId) return flow;
            const steps = [...flow.steps];
            const idx = steps.findIndex((s) => s.id === afterStepId);
            const insertAt = idx >= 0 ? idx + 1 : steps.length;
            const newStep = {
                id: `draft-${crypto.randomUUID()}`,
                flow_id: flowId,
                step_type: template.step_type || 'process',
                text: template.text || 'Yeni adım',
                role: template.role || null,
                decision_question: null,
                decision_yes_text: null,
                decision_no_text: null,
                sort_order: insertAt,
                documents: [],
                _isNew: true,
            };
            steps.splice(insertAt, 0, newStep);
            return {
                ...flow,
                steps: steps.map((step, order) => ({ ...step, sort_order: order })),
            };
        }),
    }));
}

export function insertFirstStepInUnits(units, flowId, template = {}) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => {
            if (flow.id !== flowId) return flow;
            const newStep = {
                id: `draft-${crypto.randomUUID()}`,
                flow_id: flowId,
                step_type: template.step_type || 'start',
                text: template.text || 'Süreç başlangıcı',
                role: template.role || null,
                decision_question: null,
                decision_yes_text: null,
                decision_no_text: null,
                sort_order: 0,
                documents: [],
                _isNew: true,
            };
            return {
                ...flow,
                steps: [newStep],
            };
        }),
    }));
}

export function applySavedStepToUnits(units, flowId, savedSteps) {
    return units.map((unit) => ({
        ...unit,
        flows: unit.flows.map((flow) => (flow.id === flowId ? { ...flow, steps: savedSteps } : flow)),
    }));
}
