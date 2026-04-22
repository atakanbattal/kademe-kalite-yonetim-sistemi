import { normalizeTurkishForSearch } from '@/lib/utils';

export const CASE_TYPE_OPTIONS = [
    'Müşteri Şikayeti',
    'Servis Talebi',
    'Garanti Talebi',
    'Teknik Destek',
    'Yedek Parça Talebi',
    'Bakım Talebi',
    'Saha Servisi',
    'Revizyon Takibi',
];

export const CASE_SOURCE_OPTIONS = [
    'Email',
    'Telefon',
    'Portal',
    'Saha Ziyareti',
    'Toplantı',
    'WhatsApp',
    'Help Desk',
    'Diğer',
];

export const CASE_CATEGORY_OPTIONS = [
    'Ürün Kalitesi',
    'Servis',
    'Garanti',
    'Yedek Parça',
    'Dokümantasyon',
    'Bakım',
    'Montaj',
    'Eğitim',
    'İletişim',
    'Diğer',
];

export const SERVICE_LOCATION_OPTIONS = [
    'Yurt İçi',
    'Yurt Dışı',
    'Uzak Destek',
    'Müşteri Tesisi',
    'Fabrika',
];

export const SERVICE_PARTNER_OPTIONS = ['Kademe SSH', 'Asist Oto', 'Oktay Telli'];

export const WARRANTY_STATUS_OPTIONS = [
    'Garanti İçinde',
    'Garanti Dışı',
    'İyi Niyet',
    'Belirsiz',
];

export const SPARE_PART_STATUS_OPTIONS = [
    'Gerekmiyor',
    'Stokta Var',
    'Üretimde',
    'Tedarikte',
    'Sevk Edildi',
    'Teslim Edildi',
    'İptal',
];

export const ROOT_CAUSE_METHOD_OPTIONS = [
    '5 Neden',
    'Ishikawa',
    '8D',
    'DÖF',
    '6 Sigma',
    'FMEA',
    'Diğer',
];

export const BOOLEAN_SELECT_OPTIONS = [
    { value: 'unknown', label: 'Belirtilmedi' },
    { value: 'true', label: 'Evet' },
    { value: 'false', label: 'Hayır' },
];

export const VEHICLE_FILE_TYPES = [
    'Araç Kimlik Dosyası',
    'Logbook',
    'Garanti Belgesi',
    'Kullanıcı Kitapçığı',
    'Bakım Kataloğu',
    'Yedek Parça Kataloğu',
    'Servis Raporu',
    'Diğer',
];

/** Sicille birlikte veya hızlı PDF yüklemesinde kullanılan varsayılan evrak sınıflandırması */
export const REGISTRY_VEHICLE_FILE_DEFAULTS = {
    document_type: 'Garanti Belgesi',
    document_group: 'Garanti ve Teslim Belgeleri',
};

/**
 * GB-YYYY-#### formatında bir sonraki garanti belge numarası (aynı yıl içindeki mevcut numaralardan).
 */
export function computeNextWarrantyDocumentNo(year, existingValues) {
    const prefix = `GB-${year}-`;
    let max = 0;
    for (const raw of existingValues) {
        if (!raw || typeof raw !== 'string') continue;
        const m = raw.trim().match(/^GB-(\d{4})-(\d+)$/i);
        if (m && Number(m[1]) === year) {
            max = Math.max(max, parseInt(m[2], 10) || 0);
        }
    }
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export const DOCUMENT_GROUP_OPTIONS = [
    'Araç Kimlik Kartı',
    'Fabrika Kontrol Kayıtları',
    'Logbook ve Saha Defteri',
    'Garanti ve Teslim Belgeleri',
    'Kullanıcı Kitapçıkları ve Kataloglar',
    'Servis Müdahale Evrakları',
    'Diğer',
];

export const VEHICLE_CATEGORY_OPTIONS = [
    'Kompakt Araç',
    'Araç Üstü Süpürge',
    'Çöp Aracı',
    'Çekilir Tip',
    'Çay Toplama Aracı',
];

export const VEHICLE_MODEL_OPTIONS = {
    'Kompakt Araç': ['AGA2100', 'AGA3000', 'AGA6000'],
    'Araç Üstü Süpürge': ['80S', 'KDM35', 'KDM45', 'KDM70'],
    'Çöp Aracı': ['4,5+1', '6+1', '8+1', '13+1,5', '16+2'],
    'Çekilir Tip': ['Ural', 'FTH-240', 'Çelik-2000'],
    'Çay Toplama Aracı': ['Çay Toplama Aracı'],
};

export const CHASSIS_BRAND_OPTIONS = ['Otokar', 'Isuzu', 'Mercedes', 'Ford', 'Mitsubishi'];

export const CHASSIS_MODEL_OPTIONS = {
    Otokar: ['Atlas', 'Navigo', 'Diğer'],
    Isuzu: ['NPR', 'NQR', 'FVR', 'Diğer'],
    Mercedes: ['Atego', 'Actros', 'Axor', 'Diğer'],
    Ford: ['F-Line', 'Cargo', 'Transit', 'Diğer'],
    Mitsubishi: ['Canter', 'Fuso', 'Diğer'],
};

export const AFTER_SALES_BOOLEAN_FIELDS = [
    'helpdesk_supported',
    'conversation_recorded',
    'service_record_created',
    'spare_part_required',
    'spare_part_shipped_by_company',
    'warranty_terms_explained',
    'out_of_warranty_explained',
    'user_manual_available',
    'maintenance_catalog_available',
    'spare_parts_catalog_available',
    'multilingual_docs_available',
    'documents_archived_by_work_order',
    'design_revision_applied',
    'survey_sent',
];

export const AFTER_SALES_INTEGER_FIELDS = [
    'quantity_affected',
    'spare_part_eta_days',
    'repeat_failure_count',
];

export const AFTER_SALES_FLOAT_FIELDS = [
    'financial_impact',
    'survey_score',
];

export const AFTER_SALES_DATE_FIELDS = [
    'complaint_date',
    'production_date',
    'target_close_date',
    'actual_close_date',
    'delivery_date',
    'warranty_start_date',
    'warranty_end_date',
    'first_response_date',
    'service_start_date',
    'service_completion_date',
];

export const getCustomerDisplayName = (customer) =>
    customer?.customer_name || customer?.name || customer?.label || 'Bilinmeyen Müşteri';

export const getAssignedPersonName = (record) =>
    record?.assigned_to?.full_name ||
    record?.responsible_person?.full_name ||
    record?.assigned_to ||
    record?.responsible_person ||
    '-';

export const formatBooleanLabel = (value) => {
    if (value === true) return 'Evet';
    if (value === false) return 'Hayır';
    return 'Belirtilmedi';
};

export const toBooleanSelectValue = (value) => {
    if (value === true) return 'true';
    if (value === false) return 'false';
    return 'unknown';
};

export const fromBooleanSelectValue = (value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
};

export const calculateResolutionDays = (record) => {
    if (!record?.complaint_date) return null;
    const start = new Date(record.complaint_date);
    const endDate = record.actual_close_date || record.service_completion_date;
    const end = endDate ? new Date(endDate) : new Date();
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const calculateFirstResponseHours = (record) => {
    const responseDate = record?.first_response_date || record?.service_start_date;
    if (record?.first_response_hours) return Number(record.first_response_hours) || 0;
    if (!record?.complaint_date || !responseDate) return 0;
    const start = new Date(record.complaint_date);
    const response = new Date(responseDate);
    const diffHours = Number(((response.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1));
    return diffHours <= 0 ? 24 : Math.max(0, diffHours);
};

export const calculateResolutionHours = (record) => {
    if (record?.resolution_hours) return Number(record.resolution_hours) || 0;
    const closeDate = record?.actual_close_date || record?.service_completion_date;
    if (!record?.complaint_date || !closeDate) return 0;
    const start = new Date(record.complaint_date);
    const end = new Date(closeDate);
    const diffHours = Number(((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1));
    return diffHours <= 0 ? 24 : Math.max(0, diffHours);
};

export const getComplaintDisplayStatus = (record) => {
    if (record?.actual_close_date || record?.service_completion_date) return 'Kapalı';
    return record?.status || 'Açık';
};

export const getCaseTypeLabel = (record) =>
    record?.case_type || record?.complaint_type || 'Müşteri Şikayeti';

export const getAfterSalesCaseNumber = (record) =>
    record?.complaint_number || record?.case_number || (record?.id ? record.id.slice(0, 8) : '-');

export const requiresChassisSelection = (vehicleCategory) =>
    ['Araç Üstü Süpürge', 'Çöp Aracı'].includes(vehicleCategory);

export const getVehicleModelsForCategory = (vehicleCategory) =>
    VEHICLE_MODEL_OPTIONS[vehicleCategory] || [];

export const getChassisModelsForBrand = (brand) => CHASSIS_MODEL_OPTIONS[brand] || [];

export const splitFaultField = (value) =>
    String(value || '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);

export const getFaultPartsFromComplaint = (record) => {
    const codes = splitFaultField(record?.fault_part_code || record?.product_code);
    const names = splitFaultField(record?.fault_part_name || record?.product_name);
    const length = Math.max(codes.length, names.length);

    if (length === 0) {
        return [];
    }

    return Array.from({ length }, (_, index) => ({
        part_code: codes[index] || '',
        part_name: names[index] || '',
    })).filter((part) => part.part_code || part.part_name);
};

export const getPrimaryFaultPart = (record) =>
    getFaultPartsFromComplaint(record)[0] || { part_code: '', part_name: '' };

export const getFaultPartSummaryLabel = (record) => {
    const parts = getFaultPartsFromComplaint(record);
    if (parts.length === 0) return '-';

    return parts
        .map((part) => {
            if (part.part_name && part.part_code) return `${part.part_name} (${part.part_code})`;
            return part.part_name || part.part_code;
        })
        .join(', ');
};

const getComplaintReferenceIdFromText = (value) => {
    const text = String(value || '');
    const match = text.match(/kaynak vaka id:\s*([0-9a-f-]{8,})/i);
    return match?.[1] || null;
};

const includesNormalizedValue = (haystack, value) => {
    const normalizedValue = normalizeTurkishForSearch(value);
    if (!normalizedValue || normalizedValue === '-') return false;
    return haystack.includes(normalizedValue);
};

export const getComplaintIdsForNCRecord = (methodRecord, complaints = [], complaintIdsByRelatedNc = {}) => {
    if (!methodRecord) return [];

    const matchedIds = new Set();
    const normalizedHaystack = normalizeTurkishForSearch(
        [methodRecord?.title, methodRecord?.description]
            .filter(Boolean)
            .join(' ')
    );

    if (methodRecord.source_complaint_id) {
        matchedIds.add(methodRecord.source_complaint_id);
    }

    (complaintIdsByRelatedNc[methodRecord.id] || []).forEach((complaintId) => {
        matchedIds.add(complaintId);
    });

    const referencedComplaintId = getComplaintReferenceIdFromText(methodRecord?.description);
    if (referencedComplaintId && complaints.some((complaint) => complaint.id === referencedComplaintId)) {
        matchedIds.add(referencedComplaintId);
    }

    const complaintNumberMatches = complaints
        .filter((complaint) => includesNormalizedValue(normalizedHaystack, getAfterSalesCaseNumber(complaint)))
        .map((complaint) => complaint.id);

    complaintNumberMatches.forEach((complaintId) => {
        matchedIds.add(complaintId);
    });

    if (matchedIds.size > 0) {
        return Array.from(matchedIds);
    }

    const strongTitleMatches = complaints
        .filter((complaint) => {
            const normalizedTitle = normalizeTurkishForSearch(complaint?.title);
            return normalizedTitle && normalizedTitle.length >= 12 && normalizedHaystack.includes(normalizedTitle);
        })
        .map((complaint) => complaint.id);

    strongTitleMatches.forEach((complaintId) => {
        matchedIds.add(complaintId);
    });

    if (matchedIds.size > 0) {
        return Array.from(matchedIds);
    }

    const contextualMatches = complaints
        .filter((complaint) => {
            const primaryFaultPart = getPrimaryFaultPart(complaint);
            const hasPartMatch =
                includesNormalizedValue(normalizedHaystack, primaryFaultPart.part_code) ||
                includesNormalizedValue(normalizedHaystack, primaryFaultPart.part_name);
            const hasVehicleMatch =
                includesNormalizedValue(normalizedHaystack, complaint?.vehicle_serial_number) ||
                includesNormalizedValue(normalizedHaystack, complaint?.vehicle_chassis_number) ||
                includesNormalizedValue(normalizedHaystack, getVehicleDisplayLabel(complaint));

            return hasPartMatch && hasVehicleMatch;
        })
        .map((complaint) => complaint.id);

    contextualMatches.forEach((complaintId) => {
        matchedIds.add(complaintId);
    });

    return Array.from(matchedIds);
};

const ISSUE_STOPWORDS = new Set([
    've',
    'ile',
    'olan',
    'icin',
    'için',
    'gibi',
    'veya',
    'bir',
    'daha',
    'cok',
    'çok',
    'nedeniyle',
    'sebebiyle',
    'meydana',
    'gelmesi',
    'sorunu',
    'problemi',
    'arizasi',
    'arızası',
]);

const tokenizeIssueText = (value) =>
    normalizeTurkishForSearch(value)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !ISSUE_STOPWORDS.has(token))
        .map((token) => (token.length > 6 ? token.slice(0, 6) : token));

export const getIssueClusterKey = (record) => {
    const faultParts = getFaultPartsFromComplaint(record);
    const partCodes = faultParts
        .map((part) => normalizeTurkishForSearch(part.part_code))
        .filter(Boolean)
        .sort()
        .join('|');
    const partNames = faultParts
        .map((part) => tokenizeIssueText(part.part_name).join(''))
        .filter(Boolean)
        .sort()
        .join('|');
    const context = normalizeTurkishForSearch(record?.complaint_category || record?.case_type || '');

    if (partCodes) return `part-code:${partCodes}:${context}`;
    if (partNames) return `part-name:${partNames}:${context}`;

    const textSource = [
        record?.title,
        record?.complaint_type,
        record?.root_cause,
        record?.complaint_category,
    ]
        .filter(Boolean)
        .join(' ');
    const signature = Array.from(new Set(tokenizeIssueText(textSource))).sort().join('|');
    return `text:${signature || normalizeTurkishForSearch(textSource || 'Belirsiz')}:${context}`;
};

export const getIssueClusterLabel = (record) => {
    const faultSummary = getFaultPartSummaryLabel(record);
    if (faultSummary !== '-') return faultSummary;
    return record?.title || record?.root_cause || record?.complaint_type || record?.complaint_category || 'Belirsiz';
};

export const normalizeIssueKey = (record) => getIssueClusterKey(record);

export const getIssueLabel = (record) =>
    record?.title || record?.root_cause || record?.complaint_category || getIssueClusterLabel(record) || 'Belirsiz';

export const recommendWorkflowForComplaint = (record) => {
    const repeatCount = Number(record?.repeat_failure_count || 0);
    const financialImpact = Number(record?.financial_impact || 0);
    const severity = record?.severity;

    if (severity === 'Kritik' || repeatCount >= 2 || financialImpact >= 150000) {
        return {
            type: '8D',
            reason: 'Kritik, tekrarlı veya yüksek maliyetli problem; disiplinler arası derin analiz önerilir.',
        };
    }

    if (
        record?.vehicle_serial_number ||
        record?.customer_id ||
        ['Müşteri Şikayeti', 'Servis Talebi', 'Garanti Talebi', 'Teknik Destek'].includes(getCaseTypeLabel(record))
    ) {
        return {
            type: 'MDI',
            reason: 'Araç veya müşteri sahası kaynaklı problem; mühendislik değişiklik isteği yaklaşımı daha uygundur.',
        };
    }

    return {
        type: 'DF',
        reason: 'Standart düzeltici faaliyet ile yönetilebilecek seviyede görünüyor.',
    };
};

export const getWarrantyStatusVariant = (status) => {
    switch (status) {
        case 'Garanti İçinde':
            return 'default';
        case 'Garanti Dışı':
            return 'secondary';
        case 'İyi Niyet':
            return 'outline';
        default:
            return 'secondary';
    }
};

export const normalizeSlaStatus = (status) => {
    switch (status) {
        case 'On Time':
        case 'Hedef İçinde':
            return 'Hedef İçinde';
        case 'At Risk':
        case 'Riskte':
            return 'Riskte';
        case 'Overdue':
        case 'Süre Aşıldı':
            return 'Süre Aşıldı';
        case 'Pending':
        case 'Beklemede':
        default:
            return 'Beklemede';
    }
};

export const getDynamicSlaStatus = (record) => {
    if (record?.sla_status) {
        return normalizeSlaStatus(record.sla_status);
    }

    const targetDate = record?.target_close_date;
    const closeDate = record?.actual_close_date || record?.service_completion_date;

    if (closeDate) {
        if (!targetDate) return 'Hedef İçinde';
        return new Date(closeDate) <= new Date(targetDate) ? 'Hedef İçinde' : 'Süre Aşıldı';
    }

    if (!targetDate) return 'Beklemede';

    const diffHours = (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 0) return 'Süre Aşıldı';
    if (diffHours <= 48) return 'Riskte';
    return 'Hedef İçinde';
};

export const getSlaStatusVariant = (status) => {
    switch (normalizeSlaStatus(status)) {
        case 'Hedef İçinde':
            return 'default';
        case 'Riskte':
            return 'warning';
        case 'Süre Aşıldı':
            return 'destructive';
        default:
            return 'secondary';
    }
};

export const getVehicleDisplayLabel = (record) => {
    const category = record?.vehicle_category;
    const model = record?.vehicle_model_code || record?.vehicle_model || record?.vehicle_type;
    const chassis = record?.chassis_brand && record?.chassis_model
        ? `${record.chassis_brand} ${record.chassis_model}`
        : record?.chassis_brand;

    return [category, model, chassis].filter(Boolean).join(' / ') || '-';
};

const normalizeBomDate = (value) => {
    if (!value) return null;
    const date = new Date(typeof value === 'string' ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const isBomRevisionEffectiveForDate = (bomRevision, referenceDate) => {
    if (!bomRevision) return false;
    if (!referenceDate) return bomRevision.is_active !== false;

    const effectiveFrom = normalizeBomDate(bomRevision.effective_from || bomRevision.revision_date);
    const effectiveTo = normalizeBomDate(bomRevision.effective_to);
    const targetDate = normalizeBomDate(referenceDate);

    if (!targetDate) return bomRevision.is_active !== false;
    if (effectiveFrom && targetDate < effectiveFrom) return false;
    if (effectiveTo && targetDate > effectiveTo) return false;
    return true;
};

export const findMatchingBomRevision = (
    bomRevisions = [],
    { vehicleCategory, vehicleModelCode, productionDate, deliveryDate } = {}
) => {
    const scopedRevisions = bomRevisions
        .filter((revision) =>
            (!vehicleCategory || revision.vehicle_category === vehicleCategory) &&
            (!vehicleModelCode || revision.vehicle_model_code === vehicleModelCode)
        )
        .sort((left, right) => {
            const leftDate = normalizeBomDate(left.effective_from || left.revision_date)?.getTime() || 0;
            const rightDate = normalizeBomDate(right.effective_from || right.revision_date)?.getTime() || 0;
            if (rightDate !== leftDate) return rightDate - leftDate;
            return Number(right.revision_no || 0) - Number(left.revision_no || 0);
        });

    if (scopedRevisions.length === 0) return null;

    const referenceDate = productionDate || deliveryDate || null;
    if (!referenceDate) {
        return scopedRevisions.find((revision) => revision.is_active !== false) || scopedRevisions[0];
    }

    return scopedRevisions.find((revision) => isBomRevisionEffectiveForDate(revision, referenceDate)) || scopedRevisions[0];
};

export const getBomRevisionDisplayLabel = (bomRevision) => {
    if (!bomRevision) return '-';
    const revisionText = `Rev.${bomRevision.revision_no || 0}`;
    const dateText = bomRevision.effective_from
        ? ` • ${new Date(`${bomRevision.effective_from}T00:00:00`).toLocaleDateString('tr-TR')}`
        : '';
    return [bomRevision.vehicle_category, bomRevision.vehicle_model_code, revisionText].filter(Boolean).join(' / ') + dateText;
};
