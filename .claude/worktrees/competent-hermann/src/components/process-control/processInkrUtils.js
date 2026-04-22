export const getProcessInkrDisplayNumber = (report) => {
    const directValue = [
        report?.process_inkr_number,
        report?.inkr_number,
        report?.report_number,
        report?.report_no,
        report?.record_no,
    ].find((value) => typeof value === 'string' && value.trim());

    if (directValue) {
        return directValue.trim();
    }

    if (report?.part_code) {
        return `INKR-${String(report.part_code).trim()}`;
    }

    if (report?.id) {
        return `INKR-${String(report.id).slice(0, 8).toUpperCase()}`;
    }

    return 'INKR';
};

const PROCESS_INKR_ATTACHMENT_FOREIGN_KEYS = ['inkr_report_id', 'report_id'];

const isMissingColumnError = (error) => error?.code === '42703';

const getAttachmentSortValue = (attachment) => {
    const parsed = new Date(attachment?.uploaded_at || attachment?.created_at || 0);
    const time = parsed.getTime();
    return Number.isNaN(time) ? 0 : time;
};

const normalizeProcessInkrAttachment = (attachment) => ({
    ...attachment,
    inkr_report_id: attachment?.inkr_report_id ?? attachment?.report_id ?? null,
});

const dedupeProcessInkrAttachments = (attachments = []) => {
    const seen = new Map();

    attachments.forEach((attachment) => {
        const normalized = normalizeProcessInkrAttachment(attachment);
        const key = normalized.id || normalized.file_path || JSON.stringify(normalized);

        if (!seen.has(key)) {
            seen.set(key, normalized);
        }
    });

    return Array.from(seen.values()).sort(
        (left, right) => getAttachmentSortValue(right) - getAttachmentSortValue(left)
    );
};

export const getProcessInkrAttachmentReportId = (attachment) =>
    attachment?.inkr_report_id ?? attachment?.report_id ?? null;

export const fetchProcessInkrAttachmentsForReport = async (supabase, reportId) => {
    if (!reportId) return [];

    const collectedAttachments = [];
    let hasSuccessfulQuery = false;
    let lastMissingColumnError = null;

    for (const foreignKey of PROCESS_INKR_ATTACHMENT_FOREIGN_KEYS) {
        const { data, error } = await supabase
            .from('process_inkr_attachments')
            .select('*')
            .eq(foreignKey, reportId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            if (isMissingColumnError(error)) {
                lastMissingColumnError = error;
                continue;
            }

            throw error;
        }

        hasSuccessfulQuery = true;
        if (data?.length) {
            collectedAttachments.push(...data);
        }
    }

    if (collectedAttachments.length > 0) {
        return dedupeProcessInkrAttachments(collectedAttachments);
    }

    if (hasSuccessfulQuery) {
        return [];
    }

    throw lastMissingColumnError || new Error('process_inkr_attachments ilişkisi çözümlenemedi.');
};

export const fetchProcessInkrAttachmentsForReports = async (supabase, reportIds = []) => {
    if (!Array.isArray(reportIds) || reportIds.length === 0) return [];

    const collectedAttachments = [];
    let hasSuccessfulQuery = false;
    let lastMissingColumnError = null;

    for (const foreignKey of PROCESS_INKR_ATTACHMENT_FOREIGN_KEYS) {
        const { data, error } = await supabase
            .from('process_inkr_attachments')
            .select('*')
            .in(foreignKey, reportIds)
            .order('uploaded_at', { ascending: false });

        if (error) {
            if (isMissingColumnError(error)) {
                lastMissingColumnError = error;
                continue;
            }

            throw error;
        }

        hasSuccessfulQuery = true;
        if (data?.length) {
            collectedAttachments.push(...data);
        }
    }

    if (collectedAttachments.length > 0) {
        return dedupeProcessInkrAttachments(collectedAttachments);
    }

    if (hasSuccessfulQuery) {
        return [];
    }

    throw lastMissingColumnError || new Error('process_inkr_attachments ilişkisi çözümlenemedi.');
};

export const insertProcessInkrAttachment = async (supabase, reportId, attachmentPayload) => {
    let lastMissingColumnError = null;

    for (const foreignKey of PROCESS_INKR_ATTACHMENT_FOREIGN_KEYS) {
        const { data, error } = await supabase
            .from('process_inkr_attachments')
            .insert({
                ...attachmentPayload,
                [foreignKey]: reportId,
            })
            .select('*')
            .maybeSingle();

        if (error) {
            if (isMissingColumnError(error)) {
                lastMissingColumnError = error;
                continue;
            }

            throw error;
        }

        return normalizeProcessInkrAttachment(data || attachmentPayload);
    }

    throw lastMissingColumnError || new Error('process_inkr_attachments ilişkisi çözümlenemedi.');
};

export const normalizeProcessPartCode = (code) =>
    code ? String(code).trim().toLowerCase() : '';

const getPlanTimestamp = (plan) => {
    const candidates = [plan?.revision_date, plan?.updated_at, plan?.created_at];

    for (const candidate of candidates) {
        if (!candidate) continue;

        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.getTime();
        }
    }

    return null;
};

const isCandidatePlanNewer = (candidate, current) => {
    const candidateRevision = Number(candidate?.revision_number ?? -1);
    const currentRevision = Number(current?.revision_number ?? -1);

    if (candidateRevision !== currentRevision) {
        return candidateRevision > currentRevision;
    }

    const candidateTimestamp = getPlanTimestamp(candidate);
    const currentTimestamp = getPlanTimestamp(current);

    if (candidateTimestamp !== null && currentTimestamp !== null) {
        return candidateTimestamp > currentTimestamp;
    }

    if (candidateTimestamp !== null) return true;
    if (currentTimestamp !== null) return false;

    return false;
};

export const buildProcessPlanVehicleTypeMap = (plans = []) => {
    const latestPlansByPartCode = new Map();

    (plans || []).forEach((plan) => {
        const normalizedPartCode = normalizeProcessPartCode(plan?.part_code);
        if (!normalizedPartCode) return;

        const currentPlan = latestPlansByPartCode.get(normalizedPartCode);
        if (!currentPlan || isCandidatePlanNewer(plan, currentPlan)) {
            latestPlansByPartCode.set(normalizedPartCode, plan);
        }
    });

    const vehicleTypeMap = new Map();
    latestPlansByPartCode.forEach((plan, normalizedPartCode) => {
        const vehicleType = typeof plan?.vehicle_type === 'string' ? plan.vehicle_type.trim() : '';
        if (vehicleType) {
            vehicleTypeMap.set(normalizedPartCode, vehicleType);
        }
    });

    return vehicleTypeMap;
};

export const getProcessInkrVehicleType = (report, planVehicleTypeMap = new Map()) => {
    const directVehicleType = typeof report?.vehicle_type === 'string' ? report.vehicle_type.trim() : '';
    if (directVehicleType) {
        return directVehicleType;
    }

    const normalizedPartCode = normalizeProcessPartCode(report?.part_code);
    if (!normalizedPartCode) {
        return '';
    }

    return planVehicleTypeMap.get(normalizedPartCode) || '';
};

export const enrichProcessInkrReport = (report, planVehicleTypeMap = new Map()) => {
    if (!report) return report;

    const vehicleType = getProcessInkrVehicleType(report, planVehicleTypeMap);
    return {
        ...report,
        vehicle_type: vehicleType || null,
    };
};

export const enrichProcessInkrReports = (reports = [], plansOrVehicleTypeMap = []) => {
    const vehicleTypeMap =
        plansOrVehicleTypeMap instanceof Map
            ? plansOrVehicleTypeMap
            : buildProcessPlanVehicleTypeMap(plansOrVehicleTypeMap);

    return (reports || []).map((report) => enrichProcessInkrReport(report, vehicleTypeMap));
};
