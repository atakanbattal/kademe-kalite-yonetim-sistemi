import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    FileText,
    Globe,
    Hash,
    Package,
    Plus,
    ShieldCheck,
    Trash2,
    Users,
    Wrench,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    AFTER_SALES_BOOLEAN_FIELDS,
    AFTER_SALES_DATE_FIELDS,
    AFTER_SALES_FLOAT_FIELDS,
    AFTER_SALES_INTEGER_FIELDS,
    BOOLEAN_SELECT_OPTIONS,
    CASE_CATEGORY_OPTIONS,
    CASE_SOURCE_OPTIONS,
    CASE_TYPE_OPTIONS,
    CHASSIS_BRAND_OPTIONS,
    findMatchingBomRevision,
    getBomRevisionDisplayLabel,
    ROOT_CAUSE_METHOD_OPTIONS,
    SERVICE_PARTNER_OPTIONS,
    SERVICE_LOCATION_OPTIONS,
    VEHICLE_CATEGORY_OPTIONS,
    WARRANTY_STATUS_OPTIONS,
    formatBooleanLabel,
    fromBooleanSelectValue,
    getFaultPartSummaryLabel,
    getFaultPartsFromComplaint,
    getChassisModelsForBrand,
    getCustomerDisplayName,
    getVehicleModelsForCategory,
    recommendWorkflowForComplaint,
    requiresChassisSelection,
    toBooleanSelectValue,
} from '@/components/customer-complaints/afterSalesConfig';

const SEVERITIES = ['Kritik', 'Yüksek', 'Orta', 'Düşük'];
const PRIORITIES = ['Acil', 'Yüksek', 'Normal', 'Düşük'];
const STATUSES = ['Açık', 'Analiz Aşamasında', 'Aksiyon Alınıyor', 'Doğrulama Bekleniyor', 'Kapalı', 'İptal'];
const CLASSIFICATIONS = ['Ürün', 'Servis', 'Montaj', 'Yanlış Kullanım', 'Diğer'];
const EMPTY_FAULT_PART = { part_code: '', part_name: '' };

const INITIAL_FORM = {
    customer_id: '',
    complaint_date: new Date().toISOString().split('T')[0],
    case_type: 'Müşteri Şikayeti',
    complaint_type: '',
    complaint_source: 'Email',
    service_channel: 'Email',
    complaint_category: 'Ürün Kalitesi',
    complaint_classification: 'Ürün',
    severity: 'Orta',
    priority: 'Normal',
    status: 'Açık',
    title: '',
    description: '',
    product_code: '',
    product_name: '',
    fault_part_code: '',
    fault_part_name: '',
    batch_number: '',
    quantity_affected: '',
    production_date: '',
    vehicle_type: '',
    vehicle_category: '',
    vehicle_model_code: '',
    vehicle_model: '',
    chassis_brand: '',
    chassis_model: '',
    vehicle_serial_number: '',
    vehicle_chassis_number: '',
    vehicle_plate_number: '',
    delivery_date: '',
    customer_impact: '',
    financial_impact: '',
    service_location_type: 'Yurt İçi',
    service_country: 'Türkiye',
    service_city: '',
    service_partner_name: 'Kademe SSH',
    helpdesk_supported: 'unknown',
    conversation_recorded: 'unknown',
    service_record_created: 'true',
    responsible_department_id: '',
    responsible_personnel_id: '',
    assigned_to_id: '',
    target_close_date: '',
    actual_close_date: '',
    first_response_date: '',
    service_start_date: '',
    service_completion_date: '',
    warranty_status: '',
    warranty_start_date: '',
    warranty_end_date: '',
    warranty_document_no: '',
    warranty_terms_explained: 'unknown',
    out_of_warranty_explained: 'unknown',
    user_manual_available: 'unknown',
    maintenance_catalog_available: 'unknown',
    spare_parts_catalog_available: 'unknown',
    multilingual_docs_available: 'unknown',
    documents_archived_by_work_order: 'unknown',
    spare_part_required: 'unknown',
    spare_part_status: '',
    spare_part_eta_days: '',
    spare_part_shipped_by_company: 'unknown',
    root_cause_methodology: '',
    repeat_failure_count: '',
    recurrence_risk_level: '',
    design_revision_applied: 'unknown',
    design_revision_reference: '',
    survey_sent: 'unknown',
    survey_score: '',
    survey_notes: '',
    related_nc_id: '',
    related_deviation_id: '',
    recommended_workflow: '',
    workflow_reason: '',
};

const formatDateInput = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
    return value;
};

const normalizeComparisonValue = (value) =>
    String(value || '').trim().toLocaleLowerCase('tr-TR');

const normalizeFaultPart = (part) => ({
    part_code: String(part?.part_code || '').trim(),
    part_name: String(part?.part_name || '').trim(),
});

const getDerivedRecurrenceLevel = (repeatCount) => {
    if (repeatCount >= 5) return 'Kritik';
    if (repeatCount >= 3) return 'Yüksek';
    if (repeatCount >= 1) return 'Orta';
    return 'Düşük';
};

const getMissingComplaintColumnName = (error) => {
    const message = error?.message || '';

    const postgresMatch = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+of\s+relation/i);
    if (postgresMatch?.[1]) return postgresMatch[1];

    const relationMatch = message.match(/column\s+customer_complaints\.([a-zA-Z0-9_]+)\s+does not exist/i);
    if (relationMatch?.[1]) return relationMatch[1];

    const schemaCacheMatch = message.match(/Could not find the '([a-zA-Z0-9_]+)' column/i);
    if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

    return null;
};

const matchesRepeatPattern = (record, draft) => {
    const samePartCode =
        draft.faultPartCode &&
        normalizeComparisonValue(record.fault_part_code || record.product_code) === draft.faultPartCode;
    const samePartName =
        draft.faultPartName &&
        normalizeComparisonValue(record.fault_part_name || record.product_name) === draft.faultPartName;
    const sameSerial =
        draft.vehicleSerialNumber &&
        normalizeComparisonValue(record.vehicle_serial_number) === draft.vehicleSerialNumber;
    const sameChassis =
        draft.vehicleChassisNumber &&
        normalizeComparisonValue(record.vehicle_chassis_number) === draft.vehicleChassisNumber;
    const sameTitle =
        draft.title &&
        normalizeComparisonValue(record.title) === draft.title;
    const sameCategory =
        draft.complaintCategory &&
        normalizeComparisonValue(record.complaint_category) === draft.complaintCategory;
    const sameCustomer = draft.customerId && record.customer_id === draft.customerId;

    return (
        (samePartCode && (sameSerial || sameChassis || sameCategory || sameCustomer)) ||
        (samePartName && (sameSerial || sameChassis)) ||
        (sameSerial && sameTitle) ||
        (sameChassis && sameTitle) ||
        (sameTitle && sameCategory && sameCustomer)
    );
};

const prepareFormState = (record) => {
    if (!record) return INITIAL_FORM;

    const mapped = {
        ...INITIAL_FORM,
        ...record,
    };

    AFTER_SALES_BOOLEAN_FIELDS.forEach((field) => {
        mapped[field] = toBooleanSelectValue(record[field]);
    });

    AFTER_SALES_DATE_FIELDS.forEach((field) => {
        mapped[field] = formatDateInput(record[field]);
    });

    return mapped;
};

const BooleanSelect = ({ label, value, onChange }) => (
    <div>
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {BOOLEAN_SELECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);

const ComplaintFormModal = ({ open, setOpen, existingComplaint, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customers, customerComplaints } = useData();
    const isEditMode = Boolean(existingComplaint);

    const [formData, setFormData] = useState(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedRegistryId, setSelectedRegistryId] = useState('');
    const [vehicleRegistryRecords, setVehicleRegistryRecords] = useState([]);
    const [bomRevisions, setBomRevisions] = useState([]);
    const [bomItems, setBomItems] = useState([]);
    const [faultParts, setFaultParts] = useState([EMPTY_FAULT_PART]);

    useEffect(() => {
        if (!open) return;
        setFormData(prepareFormState(existingComplaint));
        setFaultParts(getFaultPartsFromComplaint(existingComplaint).length > 0 ? getFaultPartsFromComplaint(existingComplaint) : [EMPTY_FAULT_PART]);
        setSelectedRegistryId('');
    }, [existingComplaint, open]);

    useEffect(() => {
        if (!open) return undefined;

        let isMounted = true;

        const loadReferenceData = async () => {
            const [registryResult, bomResult, bomItemsResult] = await Promise.all([
                supabase
                    .from('after_sales_vehicle_registry')
                    .select('id, customer_id, vehicle_serial_number, vehicle_chassis_number, vehicle_category, vehicle_model_code, vehicle_model_name, chassis_brand, chassis_model, delivery_date, production_date, warranty_document_no')
                    .order('delivery_date', { ascending: false }),
                supabase
                    .from('after_sales_product_boms')
                    .select('*')
                    .order('revision_no', { ascending: false }),
                supabase
                    .from('after_sales_bom_items')
                    .select(`
                        id,
                        bom_id,
                        part_code,
                        part_name,
                        quantity,
                        unit,
                        level,
                        parent_part_code,
                        notes,
                        bom:bom_id(id, vehicle_category, vehicle_model_code, revision_no, effective_from, effective_to, is_active)
                    `)
                    .order('part_code', { ascending: true }),
            ]);

            if (!isMounted) return;

            if (registryResult.error) {
                console.warn('Vehicle registry lookup failed in complaint form:', registryResult.error);
                setVehicleRegistryRecords([]);
            } else {
                setVehicleRegistryRecords(registryResult.data || []);
            }

            if (bomResult.error && !['42P01', 'PGRST205'].includes(bomResult.error.code)) {
                console.warn('BOM revisions lookup failed in complaint form:', bomResult.error);
            } else {
                setBomRevisions(bomResult.data || []);
            }

            if (bomItemsResult.error && !['42P01', 'PGRST205'].includes(bomItemsResult.error.code)) {
                console.warn('BOM items lookup failed in complaint form:', bomItemsResult.error);
            } else {
                setBomItems(bomItemsResult.data || []);
            }
        };

        loadReferenceData();

        return () => {
            isMounted = false;
        };
    }, [open]);

    useEffect(() => {
        const validModels = getVehicleModelsForCategory(formData.vehicle_category);
        if (formData.vehicle_model_code && !validModels.includes(formData.vehicle_model_code)) {
            setFormData((prev) => ({ ...prev, vehicle_model_code: '' }));
        }

        if (!requiresChassisSelection(formData.vehicle_category) && (formData.chassis_brand || formData.chassis_model)) {
            setFormData((prev) => ({ ...prev, chassis_brand: '', chassis_model: '' }));
        }
    }, [formData.vehicle_category]);

    useEffect(() => {
        if (formData.vehicle_model_code && !formData.vehicle_model) {
            setFormData((prev) => ({ ...prev, vehicle_model: prev.vehicle_model_code }));
        }
    }, [formData.vehicle_model_code, formData.vehicle_model]);

    useEffect(() => {
        const validChassisModels = getChassisModelsForBrand(formData.chassis_brand);
        if (formData.chassis_model && !validChassisModels.includes(formData.chassis_model)) {
            setFormData((prev) => ({ ...prev, chassis_model: '' }));
        }
    }, [formData.chassis_brand]);

    const applyRegistryRecord = useCallback((registryRecord) => {
        if (!registryRecord) return;

        setSelectedRegistryId(registryRecord.id);
        setFormData((prev) => ({
            ...prev,
            customer_id: registryRecord.customer_id || prev.customer_id,
            vehicle_category: registryRecord.vehicle_category || prev.vehicle_category,
            vehicle_model_code: registryRecord.vehicle_model_code || prev.vehicle_model_code,
            vehicle_model: registryRecord.vehicle_model_name || registryRecord.vehicle_model_code || prev.vehicle_model,
            vehicle_type: registryRecord.vehicle_model_name || registryRecord.vehicle_model_code || prev.vehicle_type,
            chassis_brand: registryRecord.chassis_brand || prev.chassis_brand,
            chassis_model: registryRecord.chassis_model || prev.chassis_model,
            vehicle_serial_number: registryRecord.vehicle_serial_number || prev.vehicle_serial_number,
            vehicle_chassis_number: registryRecord.vehicle_chassis_number || prev.vehicle_chassis_number,
            delivery_date: formatDateInput(registryRecord.delivery_date) || prev.delivery_date,
            production_date: formatDateInput(registryRecord.production_date) || prev.production_date,
            warranty_document_no: registryRecord.warranty_document_no || prev.warranty_document_no,
        }));
    }, []);

    useEffect(() => {
        if (!vehicleRegistryRecords.length || selectedRegistryId) return;

        const matchedRegistry = vehicleRegistryRecords.find((record) =>
            (formData.vehicle_serial_number && record.vehicle_serial_number === formData.vehicle_serial_number) ||
            (formData.vehicle_chassis_number && record.vehicle_chassis_number === formData.vehicle_chassis_number)
        );

        if (matchedRegistry) {
            applyRegistryRecord(matchedRegistry);
        }
    }, [applyRegistryRecord, formData.vehicle_chassis_number, formData.vehicle_serial_number, selectedRegistryId, vehicleRegistryRecords]);

    const handleInputChange = (event) => {
        const { id, value } = event.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleComplaintSourceChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            complaint_source: value,
            service_channel: prev.service_channel || value,
        }));
    };

    const handleRegistrySelection = (value) => {
        if (!value) {
            setSelectedRegistryId('');
            return;
        }

        const registryRecord = vehicleRegistryRecords.find((record) => record.id === value);
        applyRegistryRecord(registryRecord);
    };

    const handleFaultPartChange = (index, field, value) => {
        setFaultParts((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };

            const normalizedValue = normalizeComparisonValue(value);
            const matchedBomItem = availableBomItems.find((item) =>
                normalizeComparisonValue(field === 'part_code' ? item.part_code : item.part_name) === normalizedValue
            );

            if (matchedBomItem) {
                next[index] = {
                    ...next[index],
                    part_code: matchedBomItem.part_code || next[index].part_code,
                    part_name: matchedBomItem.part_name || next[index].part_name,
                };
            }

            return next;
        });
    };

    const handleFaultPartSelection = (index, value) => {
        setFaultParts((prev) => {
            const next = [...prev];

            if (!value) {
                next[index] = EMPTY_FAULT_PART;
                return next;
            }

            const matchedBomItem = availableBomItems.find((item) => item.id === value);
            if (matchedBomItem) {
                next[index] = {
                    part_code: matchedBomItem.part_code || '',
                    part_name: matchedBomItem.part_name || '',
                };
            }

            return next;
        });
    };

    const addFaultPartRow = () => {
        setFaultParts((prev) => [...prev, EMPTY_FAULT_PART]);
    };

    const removeFaultPartRow = (index) => {
        setFaultParts((prev) => (prev.length === 1 ? prev : prev.filter((_, currentIndex) => currentIndex !== index)));
    };

    const customerOptions = useMemo(
        () =>
            (customers || [])
                .filter((customer) => customer.is_active !== false)
                .map((customer) => ({
                    value: customer.id,
                    label: `${getCustomerDisplayName(customer)}${customer.customer_code ? ` (${customer.customer_code})` : ''}`,
                })),
        [customers]
    );

    const filteredVehicleRegistryRecords = useMemo(() => {
        if (!formData.customer_id) return vehicleRegistryRecords;
        return vehicleRegistryRecords.filter((record) => record.customer_id === formData.customer_id);
    }, [formData.customer_id, vehicleRegistryRecords]);

    const registryOptions = useMemo(
        () =>
            filteredVehicleRegistryRecords.map((record) => ({
                value: record.id,
                label: `${record.vehicle_serial_number || '-'} • ${record.vehicle_model_name || record.vehicle_model_code || '-'}`,
                triggerLabel: `${record.vehicle_serial_number || '-'} • ${record.vehicle_model_name || record.vehicle_model_code || '-'}`,
                description: [
                    record.vehicle_chassis_number ? `Şasi: ${record.vehicle_chassis_number}` : 'Şasi bilgisi yok',
                    record.chassis_brand ? `Şase: ${record.chassis_brand}${record.chassis_model ? ` / ${record.chassis_model}` : ''}` : null,
                    record.vehicle_category ? `Kategori: ${record.vehicle_category}` : null,
                    record.delivery_date ? `Teslim: ${record.delivery_date}` : null,
                    record.warranty_document_no ? `Garanti Belgesi: ${record.warranty_document_no}` : null,
                ]
                    .filter(Boolean)
                    .join(' • '),
                searchText: [
                    record.vehicle_serial_number,
                    record.vehicle_model_name,
                    record.vehicle_model_code,
                    record.vehicle_chassis_number,
                    record.vehicle_category,
                    record.chassis_brand,
                    record.chassis_model,
                    record.warranty_document_no,
                ]
                    .filter(Boolean)
                    .join(' '),
            })),
        [filteredVehicleRegistryRecords]
    );

    const selectedRegistryRecord = useMemo(
        () => vehicleRegistryRecords.find((record) => record.id === selectedRegistryId) || null,
        [selectedRegistryId, vehicleRegistryRecords]
    );

    const customerVehicleCount = useMemo(
        () => filteredVehicleRegistryRecords.length,
        [filteredVehicleRegistryRecords]
    );

    useEffect(() => {
        if (!formData.customer_id || selectedRegistryId) return;
        if (formData.vehicle_serial_number || formData.vehicle_chassis_number || formData.vehicle_model_code) return;

        const customerVehicles = vehicleRegistryRecords.filter((record) => record.customer_id === formData.customer_id);
        if (customerVehicles.length >= 1) {
            applyRegistryRecord(customerVehicles[0]);
        }
    }, [
        applyRegistryRecord,
        formData.customer_id,
        formData.vehicle_chassis_number,
        formData.vehicle_model_code,
        formData.vehicle_serial_number,
        selectedRegistryId,
        vehicleRegistryRecords,
    ]);

    const handleCustomerChange = (value) => {
        setSelectedRegistryId('');
        setFormData((prev) => ({
            ...prev,
            customer_id: value,
            vehicle_type: '',
            vehicle_category: '',
            vehicle_model_code: '',
            vehicle_model: '',
            chassis_brand: '',
            chassis_model: '',
            vehicle_serial_number: '',
            vehicle_chassis_number: '',
            vehicle_plate_number: '',
            delivery_date: '',
            production_date: '',
            warranty_document_no: '',
        }));
    };

    const customerName = useMemo(
        () => getCustomerDisplayName((customers || []).find((customer) => customer.id === formData.customer_id)),
        [customers, formData.customer_id]
    );

    const matchedBomRevision = useMemo(
        () =>
            findMatchingBomRevision(bomRevisions, {
                vehicleCategory: formData.vehicle_category,
                vehicleModelCode: formData.vehicle_model_code,
                productionDate: formData.production_date,
                deliveryDate: formData.delivery_date,
            }),
        [bomRevisions, formData.delivery_date, formData.production_date, formData.vehicle_category, formData.vehicle_model_code]
    );

    const availableBomItems = useMemo(() => {
        if (matchedBomRevision) {
            return bomItems.filter((item) => item.bom_id === matchedBomRevision.id);
        }

        return bomItems.filter((item) =>
            (!formData.vehicle_category || item.bom?.vehicle_category === formData.vehicle_category) &&
            (!formData.vehicle_model_code || item.bom?.vehicle_model_code === formData.vehicle_model_code) &&
            item.bom?.is_active !== false
        );
    }, [bomItems, formData.vehicle_category, formData.vehicle_model_code, matchedBomRevision]);

    const bomPartOptions = useMemo(
        () =>
            availableBomItems.map((item) => ({
                value: item.id,
                label: `${item.part_code || '-'} • ${item.part_name || 'Parça adı yok'}`,
            })),
        [availableBomItems]
    );

    const getSelectedBomItemId = useCallback(
        (part) =>
            availableBomItems.find(
                (item) =>
                    (part.part_code && normalizeComparisonValue(item.part_code) === normalizeComparisonValue(part.part_code)) ||
                    (part.part_name && normalizeComparisonValue(item.part_name) === normalizeComparisonValue(part.part_name))
            )?.id || '',
        [availableBomItems]
    );

    const normalizedFaultParts = useMemo(
        () => faultParts.map(normalizeFaultPart).filter((part) => part.part_code || part.part_name),
        [faultParts]
    );

    const faultPartRepeatSummary = useMemo(
        () =>
            normalizedFaultParts.map((currentPart) => {
                const repeatCount = (customerComplaints || []).filter((record) => {
                    if (record.id === existingComplaint?.id) return false;

                    return getFaultPartsFromComplaint(record).some((recordPart) =>
                        (currentPart.part_code && normalizeComparisonValue(recordPart.part_code) === normalizeComparisonValue(currentPart.part_code)) ||
                        (currentPart.part_name && normalizeComparisonValue(recordPart.part_name) === normalizeComparisonValue(currentPart.part_name))
                    );
                }).length;

                return {
                    ...currentPart,
                    repeatCount,
                };
            }),
        [customerComplaints, existingComplaint?.id, normalizedFaultParts]
    );

    const derivedRepeatFailureCount = useMemo(() => {
        const matchingComplaintIds = new Set();

        (customerComplaints || []).forEach((record) => {
            if (record.id === existingComplaint?.id) return;

            const matches = getFaultPartsFromComplaint(record).some((recordPart) =>
                normalizedFaultParts.some((currentPart) =>
                    (currentPart.part_code && normalizeComparisonValue(recordPart.part_code) === normalizeComparisonValue(currentPart.part_code)) ||
                    (currentPart.part_name && normalizeComparisonValue(recordPart.part_name) === normalizeComparisonValue(currentPart.part_name))
                )
            );

            if (matches) {
                matchingComplaintIds.add(record.id);
            }
        });

        return matchingComplaintIds.size;
    }, [customerComplaints, existingComplaint?.id, normalizedFaultParts]);

    const derivedRecurrenceRiskLevel = useMemo(
        () => getDerivedRecurrenceLevel(derivedRepeatFailureCount),
        [derivedRepeatFailureCount]
    );

    const workflowRecommendation = recommendWorkflowForComplaint({
        ...formData,
        repeat_failure_count: derivedRepeatFailureCount,
        recurrence_risk_level: derivedRecurrenceRiskLevel,
    });
    const showLifecycleFields = isEditMode;

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.customer_id || !formData.title || !formData.description) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Müşteri, başlık ve açıklama alanları zorunludur.',
            });
            return;
        }

        const cleanedFaultParts = normalizedFaultParts;
        if (cleanedFaultParts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'En az bir arızalı parça kodu veya adı girilmelidir.',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const {
                id,
                created_at,
                updated_at,
                complaint_number,
                customer,
                responsible_person,
                assigned_to,
                responsible_department,
                ...payload
            } = formData;

            AFTER_SALES_BOOLEAN_FIELDS.forEach((field) => {
                payload[field] = fromBooleanSelectValue(payload[field]);
            });

            AFTER_SALES_INTEGER_FIELDS.forEach((field) => {
                payload[field] = payload[field] === '' || payload[field] === null ? null : parseInt(payload[field], 10);
            });

            AFTER_SALES_FLOAT_FIELDS.forEach((field) => {
                payload[field] = payload[field] === '' || payload[field] === null ? null : parseFloat(payload[field]);
            });

            payload.product_code = null;
            payload.product_name = null;
            payload.batch_number = null;
            payload.financial_impact = null;
            payload.fault_part_code = cleanedFaultParts.map((part) => part.part_code).filter(Boolean).join(' | ') || null;
            payload.fault_part_name = cleanedFaultParts.map((part) => part.part_name).filter(Boolean).join(' | ') || null;
            if (!isEditMode) {
                payload.responsible_department_id = null;
                payload.responsible_personnel_id = null;
                payload.assigned_to_id = null;
                payload.helpdesk_supported = null;
                payload.conversation_recorded = null;
            }
            payload.repeat_failure_count = derivedRepeatFailureCount;
            payload.recurrence_risk_level = derivedRecurrenceRiskLevel;
            payload.recommended_workflow = workflowRecommendation.type;
            payload.workflow_reason = workflowRecommendation.reason;
            payload.service_channel = payload.service_channel || payload.complaint_source;

            Object.keys(payload).forEach((key) => {
                if (payload[key] === '') payload[key] = null;
            });

            if (payload.service_completion_date && !payload.actual_close_date) {
                payload.actual_close_date = payload.service_completion_date;
            }
            if (payload.actual_close_date && !payload.service_completion_date) {
                payload.service_completion_date = payload.actual_close_date;
            }

            const persistComplaint = async (initialPayload) => {
                const nextPayload = { ...initialPayload };
                const removedColumns = [];

                for (let attempt = 0; attempt < 12; attempt += 1) {
                    const result = isEditMode
                        ? await supabase
                            .from('customer_complaints')
                            .update(nextPayload)
                            .eq('id', existingComplaint.id)
                            .select()
                            .single()
                        : await supabase
                            .from('customer_complaints')
                            .insert([{ ...nextPayload, created_by: user?.id }])
                            .select()
                            .single();

                    if (!result.error) {
                        return { ...result, removedColumns };
                    }

                    const missingColumn = getMissingComplaintColumnName(result.error);
                    if (!missingColumn || !(missingColumn in nextPayload)) {
                        return { ...result, removedColumns };
                    }

                    delete nextPayload[missingColumn];
                    removedColumns.push(missingColumn);
                }

                return {
                    data: null,
                    error: new Error('Satış sonrası vaka kaydı için kolon eşleştirme denemeleri aşıldı.'),
                    removedColumns,
                };
            };

            const result = await persistComplaint(payload);

            if (result.error) throw result.error;

            toast({
                title: 'Başarılı',
                description: `Satış sonrası vaka başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.`,
            });

            if (result.removedColumns?.length) {
                console.warn('Customer complaints payload columns skipped because they are missing in DB schema:', result.removedColumns);
            }

            setOpen(false);
            onSuccess?.(result.data);
        } catch (error) {
            console.error('After sales save error:', error);
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Satış sonrası vaka kaydedilemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const rightPanel = (
        <div className="p-6 space-y-5">
            <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-xl p-4 border border-primary/15 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-[0.06] pointer-events-none">
                    <Wrench className="w-24 h-24" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <p className="text-xs font-medium text-primary uppercase tracking-widest">Satış Sonrası Vaka</p>
                </div>
                <p className="text-base font-bold text-foreground leading-tight line-clamp-2">{formData.title || '-'}</p>
                <p className="text-sm text-muted-foreground mt-1 truncate">{customerName}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{formData.case_type}</Badge>
                <Badge variant="outline" className="text-xs">{formData.status}</Badge>
                <Badge className="text-xs">{formData.severity}</Badge>
            </div>

            <Separator />

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Araç ve Arıza
                </p>
                <div className="space-y-2 text-sm">
                    <div>
                        <p className="text-muted-foreground">Araç</p>
                        <p className="font-semibold">{formData.vehicle_model_code || formData.vehicle_model || formData.vehicle_type || '-'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Seri / Şasi</p>
                        <p className="font-semibold">{formData.vehicle_serial_number || '-'} {formData.vehicle_chassis_number ? `• ${formData.vehicle_chassis_number}` : ''}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Arızalı Parçalar</p>
                        <p className="font-semibold">{getFaultPartSummaryLabel({ fault_part_code: normalizedFaultParts.map((part) => part.part_code).join(' | '), fault_part_name: normalizedFaultParts.map((part) => part.part_name).join(' | ') })}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Eşleşen Ürün Ağacı</p>
                        <p className="font-semibold">{matchedBomRevision ? getBomRevisionDisplayLabel(matchedBomRevision) : '-'}</p>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Servis Özeti
                </p>
                <div className="space-y-2 text-sm">
                    <div>
                        <p className="text-muted-foreground">Lokasyon</p>
                        <p className="font-semibold">{formData.service_location_type || '-'} {formData.service_city ? `• ${formData.service_city}` : ''}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Servis / Partner</p>
                        <p className="font-semibold">{formData.service_partner_name || '-'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Hedef Kapanış</p>
                        <p className="font-semibold">{formData.target_close_date || '-'}</p>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Garanti ve Tekrar
                </p>
                <div className="space-y-2 text-sm">
                    <div>
                        <p className="text-muted-foreground">Garanti</p>
                        <p className="font-semibold">{formData.warranty_status || '-'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Tekrar Sayısı</p>
                        <p className="font-semibold">{derivedRepeatFailureCount}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Önerilen Yöntem</p>
                        <p className="font-semibold">{workflowRecommendation.type}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Risk Seviyesi</p>
                        <p className="font-semibold">{derivedRecurrenceRiskLevel}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={open}
            onOpenChange={setOpen}
            title={isEditMode ? 'Satış Sonrası Vakayı Düzenle' : 'Yeni Satış Sonrası Vaka'}
            subtitle="Satış Sonrası Hizmetler"
            icon={<Wrench className="h-5 w-5 text-white" />}
            badge={isEditMode ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Kaydet"
            cancelLabel="İptal"
            formId="after-sales-form"
            footerDate={formData.complaint_date}
            rightPanel={isEditMode ? rightPanel : null}
        >
            <form id="after-sales-form" onSubmit={handleSubmit} className="space-y-6 py-5 px-6 text-[15px]">
                {!isEditMode && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <div className="font-medium">Vaka açılışında sadece temel bilgileri girmen yeterli.</div>
                        <div className="text-sm text-muted-foreground mt-1">
                            Çözüm tarihi, servis başlangıcı, kapanış ve anket gibi alanları operasyon ilerledikçe daha sonra güncelleyebilirsin.
                        </div>
                    </div>
                )}

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 gap-2 md:grid-cols-3">
                        <TabsTrigger value="basic">
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Temel Bilgiler
                        </TabsTrigger>
                        <TabsTrigger value="vehicle">
                            <Package className="w-4 h-4 mr-2" />
                            Araç ve Parça
                        </TabsTrigger>
                        <TabsTrigger value="advanced">
                            <FileText className="w-4 h-4 mr-2" />
                            Takip ve Karar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label>Müşteri *</Label>
                                <SearchableSelectDialog
                                    options={customerOptions}
                                    value={formData.customer_id}
                                    onChange={handleCustomerChange}
                                    triggerPlaceholder="Müşteri seçin..."
                                    dialogTitle="Müşteri Seç"
                                    searchPlaceholder="Müşteri ara..."
                                    notFoundText="Müşteri bulunamadı."
                                />
                            </div>

                            <div className="md:col-span-2 rounded-xl border border-dashed px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="font-medium">Araç Arşivinden Getir</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {formData.customer_id
                                                ? customerVehicleCount > 0
                                                    ? `Bu müşteri için araç arşivinde ${customerVehicleCount} kayıt bulundu. Seçince seri, şasi, model ve garanti bilgileri otomatik dolar.`
                                                    : 'Bu müşteri için araç arşivinde eşleşen kayıt bulunamadı. Araç bilgilerini elle de girebilirsin.'
                                                : 'Önce müşteri seçildiğinde araç arşivindeki kayıtlar burada filtrelenir.'}
                                        </div>
                                    </div>
                                    <div className="w-full lg:w-[420px]">
                                        <SearchableSelectDialog
                                            options={registryOptions}
                                            value={selectedRegistryId}
                                            onChange={handleRegistrySelection}
                                            triggerPlaceholder={
                                                registryOptions.length > 0
                                                    ? 'Araç arşivinden kayıt seçin...'
                                                    : 'Araç arşivi kaydı yok'
                                            }
                                            dialogTitle="Araç Arşivinden Seç"
                                            searchPlaceholder="Seri no, şasi veya model ile ara..."
                                            notFoundText="Araç bulunamadı."
                                            allowClear
                                            dialogContentClassName="w-[96vw] max-w-none sm:max-w-[1100px] max-h-[82vh]"
                                            listClassName="max-h-[60vh]"
                                        />
                                    </div>
                                </div>

                                {selectedRegistryRecord && (
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-lg border bg-background/80 px-3 py-3">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bağlı Araç</div>
                                            <div className="mt-1 font-semibold">
                                                {selectedRegistryRecord.vehicle_model_name || selectedRegistryRecord.vehicle_model_code || '-'}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {selectedRegistryRecord.vehicle_category || 'Kategori belirtilmedi'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border bg-background/80 px-3 py-3">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seri / Şasi</div>
                                            <div className="mt-1 font-semibold">
                                                {selectedRegistryRecord.vehicle_serial_number || '-'}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {selectedRegistryRecord.vehicle_chassis_number || 'Şasi bilgisi yok'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border bg-background/80 px-3 py-3">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Şase</div>
                                            <div className="mt-1 font-semibold">
                                                {selectedRegistryRecord.chassis_brand || '-'}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {selectedRegistryRecord.chassis_model || 'Model belirtilmedi'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border bg-background/80 px-3 py-3">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Garanti / Teslim</div>
                                            <div className="mt-1 font-semibold">
                                                {selectedRegistryRecord.warranty_document_no || 'Belge yok'}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Teslim: {formatDateInput(selectedRegistryRecord.delivery_date) || '-'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label>Vaka Tipi *</Label>
                                <Select value={formData.case_type} onValueChange={(value) => handleSelectChange('case_type', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CASE_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="complaint_date">Kayıt Tarihi *</Label>
                                <Input id="complaint_date" type="date" value={formData.complaint_date} onChange={handleInputChange} required />
                            </div>

                            <div>
                                <Label>Giriş Kanalı</Label>
                                <Select value={formData.complaint_source} onValueChange={handleComplaintSourceChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CASE_SOURCE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Servis Kanalı</Label>
                                <Select value={formData.service_channel || 'none'} onValueChange={(value) => handleSelectChange('service_channel', value === 'none' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Servis kanalı seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                        {CASE_SOURCE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Kategori</Label>
                                <Select value={formData.complaint_category} onValueChange={(value) => handleSelectChange('complaint_category', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CASE_CATEGORY_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Sınıflandırma</Label>
                                <Select value={formData.complaint_classification} onValueChange={(value) => handleSelectChange('complaint_classification', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLASSIFICATIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="complaint_type">Alt Konu</Label>
                                <Input
                                    id="complaint_type"
                                    value={formData.complaint_type}
                                    onChange={handleInputChange}
                                    placeholder="Örn. teleskop arızası, saha bakım..."
                                />
                            </div>

                            <div>
                                <Label>Önem Seviyesi</Label>
                                <Select value={formData.severity} onValueChange={(value) => handleSelectChange('severity', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SEVERITIES.map((severity) => (
                                            <SelectItem key={severity} value={severity}>
                                                {severity}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="title">Başlık *</Label>
                                <Input id="title" value={formData.title} onChange={handleInputChange} required placeholder="Vaka başlığı" />
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="description">Açıklama *</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={5}
                                    required
                                    placeholder="Problemin, müşterinin beklentisinin ve tespitlerin detayını yazın..."
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="vehicle" className="space-y-4 mt-4">
                        <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                            Araç arşivi bağlantısı Vaka Açılışı sekmesinden yönetilir. Bu sekmede seçilen kayıt doğrulanır; gerekiyorsa manuel alanlar güncellenir.
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-4">
                            <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium">Bağlı Araç Sicili</div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {selectedRegistryRecord
                                                ? 'Vaka, araç arşivindeki sicil kaydıyla eşleşti. Aşağıdaki araç alanları bu kayıt üzerinden ön dolduruldu.'
                                                : formData.customer_id && customerVehicleCount > 0
                                                    ? 'Bu müşteri için araç arşivi kaydı bulundu. Vaka Açılışı sekmesinden seçim yapıldığında araç alanları otomatik dolar.'
                                                    : 'Bu vakaya henüz araç sicil kaydı bağlanmadı. Araç bilgilerini manuel girebilir veya üst sekmeden araç arşivinden seçim yapabilirsin.'}
                                        </div>
                                    </div>
                                    {selectedRegistryRecord && (
                                        <Badge variant="outline">Arşiv Bağlantısı Aktif</Badge>
                                    )}
                                </div>

                                {selectedRegistryRecord ? (
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                                        <div className="rounded-lg bg-background px-3 py-3">
                                            <div className="text-muted-foreground">Araç</div>
                                            <div className="mt-1 font-medium">
                                                {selectedRegistryRecord.vehicle_model_name || selectedRegistryRecord.vehicle_model_code || '-'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-background px-3 py-3">
                                            <div className="text-muted-foreground">Seri No</div>
                                            <div className="mt-1 font-medium">{selectedRegistryRecord.vehicle_serial_number || '-'}</div>
                                        </div>
                                        <div className="rounded-lg bg-background px-3 py-3">
                                            <div className="text-muted-foreground">Şasi No</div>
                                            <div className="mt-1 font-medium">{selectedRegistryRecord.vehicle_chassis_number || '-'}</div>
                                        </div>
                                        <div className="rounded-lg bg-background px-3 py-3">
                                            <div className="text-muted-foreground">Şase</div>
                                            <div className="mt-1 font-medium">
                                                {[selectedRegistryRecord.chassis_brand, selectedRegistryRecord.chassis_model].filter(Boolean).join(' ') || '-'}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="rounded-xl border bg-background p-4">
                                <div className="font-medium">Vaka İçin Hazır Alanlar</div>
                                <div className="mt-3 space-y-3 text-sm">
                                    <div>
                                        <div className="text-muted-foreground">Garanti Belge No</div>
                                        <div className="mt-1 font-medium">{formData.warranty_document_no || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Teslim Tarihi</div>
                                        <div className="mt-1 font-medium">{formData.delivery_date || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Eşleşen Ürün Ağacı</div>
                                        <div className="mt-1 font-medium">
                                            {matchedBomRevision ? getBomRevisionDisplayLabel(matchedBomRevision) : '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Müşteri</div>
                                        <div className="mt-1 font-medium">{customerName || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Araç Kategorisi</Label>
                                <Select value={formData.vehicle_category || 'none'} onValueChange={(value) => handleSelectChange('vehicle_category', value === 'none' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Araç kategorisi seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                        {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Model Kodu</Label>
                                <Select
                                    value={formData.vehicle_model_code || 'none'}
                                    onValueChange={(value) => handleSelectChange('vehicle_model_code', value === 'none' ? '' : value)}
                                    disabled={!formData.vehicle_category}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Önce kategori seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                        {getVehicleModelsForCategory(formData.vehicle_category).map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="vehicle_serial_number">Seri No</Label>
                                <Input id="vehicle_serial_number" value={formData.vehicle_serial_number} onChange={handleInputChange} placeholder="Araç seri numarası" />
                            </div>
                            <div>
                                <Label htmlFor="vehicle_chassis_number">Şasi No</Label>
                                <Input id="vehicle_chassis_number" value={formData.vehicle_chassis_number} onChange={handleInputChange} placeholder="Şasi numarası" />
                            </div>
                            {requiresChassisSelection(formData.vehicle_category) && (
                                <>
                                    <div>
                                        <Label>Şase Sağlayıcısı</Label>
                                        <Select value={formData.chassis_brand || 'none'} onValueChange={(value) => handleSelectChange('chassis_brand', value === 'none' ? '' : value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Şase markası seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Belirtilmedi</SelectItem>
                                                {CHASSIS_BRAND_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Şase Modeli</Label>
                                        <Select
                                            value={formData.chassis_model || 'none'}
                                            onValueChange={(value) => handleSelectChange('chassis_model', value === 'none' ? '' : value)}
                                            disabled={!formData.chassis_brand}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Önce şase markası seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Belirtilmedi</SelectItem>
                                                {getChassisModelsForBrand(formData.chassis_brand).map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                            <div>
                                <Label htmlFor="vehicle_plate_number">Plaka</Label>
                                <Input id="vehicle_plate_number" value={formData.vehicle_plate_number} onChange={handleInputChange} placeholder="Plaka" />
                            </div>
                            <div>
                                <Label htmlFor="production_date">Üretim Tarihi</Label>
                                <Input id="production_date" type="date" value={formData.production_date} onChange={handleInputChange} />
                            </div>
                            <div>
                                <Label htmlFor="delivery_date">Teslim Tarihi</Label>
                                <Input id="delivery_date" type="date" value={formData.delivery_date} onChange={handleInputChange} />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="customer_impact">Müşteri Etkisi</Label>
                                <Textarea id="customer_impact" value={formData.customer_impact} onChange={handleInputChange} rows={4} placeholder="Araç kullanılabilirliği, iş kaybı, güvenlik veya operasyon etkisi..." />
                            </div>
                        </div>

                        <div className="rounded-xl border p-4 space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="font-medium">Arızalı Parçalar</div>
                                    <div className="text-sm text-muted-foreground">
                                        {matchedBomRevision
                                            ? `${getBomRevisionDisplayLabel(matchedBomRevision)} bulundu. Parça kodu ve adını doğrudan yazabilir ya da istersen ürün ağacından hızlı doldurabilirsin.`
                                            : 'Ürün ağacı eşleşmesi yoksa arızalı parça kodu ve adını manuel gir. Ürün ağacı geldiğinde hızlı doldurma alanı otomatik açılır.'}
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={addFaultPartRow}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Parça Ekle
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {faultParts.map((part, index) => (
                                    <div key={`fault-part-${index}`} className="rounded-lg border bg-background p-4">
                                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.8fr_1fr_1fr_auto]">
                                            <div>
                                                <Label>Arızalı Parça Kodu</Label>
                                                <Input value={part.part_code} onChange={(event) => handleFaultPartChange(index, 'part_code', event.target.value)} placeholder="Parça kodu" />
                                            </div>
                                            <div>
                                                <Label>Arızalı Parça Adı</Label>
                                                <Input value={part.part_name} onChange={(event) => handleFaultPartChange(index, 'part_name', event.target.value)} placeholder="Parça adı" />
                                            </div>
                                            <div>
                                                <Label>Ürün Ağacından Doldur</Label>
                                                {bomPartOptions.length > 0 ? (
                                                    <SearchableSelectDialog
                                                        options={bomPartOptions}
                                                        value={getSelectedBomItemId(part)}
                                                        onChange={(value) => handleFaultPartSelection(index, value)}
                                                        triggerPlaceholder="İsteğe bağlı ürün ağacından getir..."
                                                        dialogTitle="Ürün Ağacından Parça Seç"
                                                        searchPlaceholder="Parça kodu veya adı ara..."
                                                        notFoundText="Eşleşen ürün ağacı parçası bulunamadı."
                                                        allowClear
                                                        triggerClassName="min-h-10"
                                                    />
                                                ) : (
                                                    <div className="flex min-h-[40px] items-center rounded-lg border bg-muted/20 px-3 text-sm text-muted-foreground">
                                                        Bu araç için ürün ağacında hazır parça listesi yok.
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-end">
                                                <Button type="button" variant="destructive" onClick={() => removeFaultPartRow(index)} disabled={faultParts.length === 1}>
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Sil
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4 mt-4">
                        <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                            Bu bölüm günlük kullanımda şart olmayan takip alanlarını toplar. Gerekli oldukça açıp doldurabilirsiniz.
                        </div>

                        <Accordion type="multiple" defaultValue={['service', 'improvement']} className="space-y-4">
                            <AccordionItem value="service" className="rounded-xl border px-4">
                                <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
                                    İlk Planlama ve Takip
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                    {!isEditMode && (
                                        <div className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                            Bu bölüm sadece ilk servis yönlendirme bilgisini toplar. Personel ataması ve maliyetler operasyon planlamada yönetilir.
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <Label>Servis Lokasyonu</Label>
                                            <Select value={formData.service_location_type} onValueChange={(value) => handleSelectChange('service_location_type', value)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SERVICE_LOCATION_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="service_country">Ülke</Label>
                                            <Input id="service_country" value={formData.service_country} onChange={handleInputChange} placeholder="Ülke" />
                                        </div>
                                        <div>
                                            <Label htmlFor="service_city">Şehir</Label>
                                            <Input id="service_city" value={formData.service_city} onChange={handleInputChange} placeholder="Şehir" />
                                        </div>
                                        <div>
                                            <Label htmlFor="service_partner_name">Servis / Partner</Label>
                                            <Select value={formData.service_partner_name || 'none'} onValueChange={(value) => handleSelectChange('service_partner_name', value === 'none' ? '' : value)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Servis / partner seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                                    {SERVICE_PARTNER_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="target_close_date">Hedef Kapanış</Label>
                                            <Input id="target_close_date" type="date" value={formData.target_close_date} onChange={handleInputChange} />
                                        </div>
                                        <div>
                                            <Label>Durum</Label>
                                            <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUSES.map((status) => (
                                                        <SelectItem key={status} value={status}>
                                                            {status}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Öncelik</Label>
                                            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PRIORITIES.map((priority) => (
                                                        <SelectItem key={priority} value={priority}>
                                                            {priority}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {showLifecycleFields && (
                                        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
                                            <div className="mb-3 font-medium">Takip ve Kapanış Bilgileri</div>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="first_response_date">İlk Yanıt Tarihi</Label>
                                                    <Input id="first_response_date" type="date" value={formData.first_response_date} onChange={handleInputChange} />
                                                </div>
                                                <div>
                                                    <Label htmlFor="service_start_date">Servis Başlangıç</Label>
                                                    <Input id="service_start_date" type="date" value={formData.service_start_date} onChange={handleInputChange} />
                                                </div>
                                                <div>
                                                    <Label htmlFor="service_completion_date">Servis Tamamlanma</Label>
                                                    <Input id="service_completion_date" type="date" value={formData.service_completion_date} onChange={handleInputChange} />
                                                </div>
                                                <div>
                                                    <Label htmlFor="actual_close_date">Gerçekleşen Kapanış</Label>
                                                    <Input id="actual_close_date" type="date" value={formData.actual_close_date} onChange={handleInputChange} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="warranty" className="rounded-xl border px-4">
                                <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
                                    Garanti Durumu
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                    <div className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                        Bu alan sadece aracın garanti statüsünü belirtir; teslim öncesi kontrol sorularını tekrar sormaz.
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <Label>Garanti Durumu</Label>
                                            <Select value={formData.warranty_status || 'none'} onValueChange={(value) => handleSelectChange('warranty_status', value === 'none' ? '' : value)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                                    {WARRANTY_STATUS_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="warranty_document_no">Garanti Belge No</Label>
                                            <Input id="warranty_document_no" value={formData.warranty_document_no} onChange={handleInputChange} placeholder="Belge numarası" />
                                        </div>
                                        <div>
                                            <Label htmlFor="warranty_start_date">Garanti Başlangıç</Label>
                                            <Input id="warranty_start_date" type="date" value={formData.warranty_start_date} onChange={handleInputChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="warranty_end_date">Garanti Bitiş</Label>
                                            <Input id="warranty_end_date" type="date" value={formData.warranty_end_date} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="improvement" className="rounded-xl border px-4">
                                <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
                                    Yöntem ve Tekrar Analizi
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Sistem Önerisi</div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge variant="outline">{workflowRecommendation.type}</Badge>
                                            <span className="text-sm text-muted-foreground">Parça tekrarı ve vaka yapısına göre otomatik değerlendirme</span>
                                        </div>
                                        <p className="mt-2 text-sm">{workflowRecommendation.reason}</p>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="rounded-xl border bg-muted/20 px-4 py-3">
                                            <div className="text-sm text-muted-foreground">Otomatik Tekrar Sayısı</div>
                                            <div className="mt-1 text-2xl font-semibold">{derivedRepeatFailureCount}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Arızalı parça kodu ve adına göre geçmiş vakalardan otomatik hesaplanır.
                                            </div>
                                        </div>
                                        <div className="rounded-xl border bg-muted/20 px-4 py-3">
                                            <div className="text-sm text-muted-foreground">Otomatik Risk Seviyesi</div>
                                            <div className="mt-1 text-2xl font-semibold">{getDerivedRecurrenceLevel(derivedRepeatFailureCount)}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Sistem, parça bazlı tekrar sayısına göre risk seviyesini otomatik belirler.
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 rounded-xl border p-4">
                                            <div className="font-medium">Parça Bazlı Tekrar Görünümü</div>
                                            {faultPartRepeatSummary.length === 0 ? (
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    Tekrar hesabı için en az bir arızalı parça girin.
                                                </div>
                                            ) : (
                                                <div className="mt-3 space-y-2">
                                                    {faultPartRepeatSummary.map((item, index) => (
                                                        <div key={`${item.part_code}-${item.part_name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                                                            <div className="font-medium">
                                                                {item.part_name || 'Parça adı yok'}{item.part_code ? ` (${item.part_code})` : ''}
                                                            </div>
                                                            <Badge variant="outline">{item.repeatCount} tekrar</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {showLifecycleFields && (
                                            <div>
                                                <Label>Kök Neden Metodu</Label>
                                                <Select value={formData.root_cause_methodology || 'none'} onValueChange={(value) => handleSelectChange('root_cause_methodology', value === 'none' ? '' : value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                                        {ROOT_CAUSE_METHOD_OPTIONS.map((option) => (
                                                            <SelectItem key={option} value={option}>
                                                                {option}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>
                </Tabs>
            </form>
        </ModernModalLayout>
    );
};

export default ComplaintFormModal;
