import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ProcessInkrDetailModal from './ProcessInkrDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Search, FileText, Eye, UploadCloud, X as XIcon, FileIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '@/contexts/DataContext';
import { Combobox } from '@/components/ui/combobox';
import { useDropzone } from 'react-dropzone';
import {
    lookupTs9013LimitDeviationMm,
    normalizeLegacyTs9013StandardItem,
    parseNumericNominalMm,
    ts9013QualityClassFromToleranceClass,
} from '@/lib/ts9013LimitDeviations';
import {
    buildProcessPlanVehicleTypeMap,
    enrichProcessInkrReports,
    fetchProcessInkrAttachmentsForReport,
    getProcessInkrVehicleType,
    insertProcessInkrAttachment,
    normalizeProcessPartCode,
} from './processInkrUtils';
import { buildMeasurementBundle } from './processInspectionUtils';

const NON_DIMENSIONAL_EQUIPMENT_LABELS = [
    "Geçer/Geçmez Mastar", "Karşı Parça ile Deneme",
    "Fonksiyonel Test", "Manuel Kontrol", "Pürüzlülük Ölçüm Cihazı",
    "Yüzey Pürüzlülük Ölçüm Cihazı", "Sertlik Test Cihazı", "Sertlik Ölçüm Cihazı",
    "Vida Diş Ölçer (Pitch Gauge)", "Gözle Kontrol"
];

const ISO_2768_1_TOLERANCES = {
    linear: [
        { range: [0.5, 3], f: 0.05, m: 0.1, c: 0.2, v: null },
        { range: [3, 6], f: 0.05, m: 0.1, c: 0.3, v: 0.5 },
        { range: [6, 30], f: 0.1, m: 0.2, c: 0.5, v: 1.0 },
        { range: [30, 120], f: 0.15, m: 0.3, c: 0.8, v: 1.5 },
        { range: [120, 400], f: 0.2, m: 0.5, c: 1.2, v: 2.5 },
        { range: [400, 1000], f: 0.3, m: 0.8, c: 2.0, v: 4.0 },
        { range: [1000, 2000], f: 0.5, m: 1.2, c: 3.0, v: 6.0 },
        { range: [2000, 4000], f: 0.8, m: 2.0, c: 5.0, v: 8.0 }
    ]
};

const TS_13920_TOLERANCES = {
    linear: [
        { range: [0, 30], A: 1.0, B: 1.0, C: 1.0, D: 1.0 },
        { range: [30, 120], A: 1.0, B: 2.0, C: 3.0, D: 4.0 },
        { range: [120, 400], A: 1.0, B: 2.0, C: 4.0, D: 7.0 },
        { range: [400, 1000], A: 2.0, B: 3.0, C: 6.0, D: 9.0 },
        { range: [1000, 2000], A: 3.0, B: 4.0, C: 8.0, D: 12.0 },
        { range: [2000, 4000], A: 4.0, B: 6.0, C: 11.0, D: 16.0 },
        { range: [4000, 8000], A: 5.0, B: 8.0, C: 14.0, D: 21.0 },
        { range: [8000, 12000], A: 6.0, B: 10.0, C: 18.0, D: 27.0 },
        { range: [12000, 16000], A: 7.0, B: 12.0, C: 21.0, D: 32.0 },
        { range: [16000, 20000], A: 8.0, B: 14.0, C: 24.0, D: 36.0 },
        { range: [20000, 1000000], A: 9.0, B: 16.0, C: 27.0, D: 40.0 }
    ]
};

const STANDARD_OPTIONS = [
    { value: 'ISO 2768-1_f', label: 'ISO 2768-1 f (Fine - İnce)' },
    { value: 'ISO 2768-1_m', label: 'ISO 2768-1 m (Medium - Orta)' },
    { value: 'ISO 2768-1_c', label: 'ISO 2768-1 c (Coarse - Kaba)' },
    { value: 'ISO 2768-1_v', label: 'ISO 2768-1 v (Very Coarse - Çok Kaba)' },
    { value: 'TS 13920_A', label: 'TS 13920 A (En Hassas)' },
    { value: 'TS 13920_B', label: 'TS 13920 B (Hassas)' },
    { value: 'TS 13920_C', label: 'TS 13920 C (Normal)' },
    { value: 'TS 13920_D', label: 'TS 13920 D (Kaba)' },
    { value: 'TS 9013_S1', label: 'TS 9013 Sınıf 1' },
    { value: 'TS 9013_S2', label: 'TS 9013 Sınıf 2' },
];

const getToleranceTable = (standardClass = '') => {
    if (standardClass.startsWith('TS 13920')) return TS_13920_TOLERANCES;
    return ISO_2768_1_TOLERANCES;
};

const getStandardIdFromClass = (standardClass, standards = []) => {
    if (!standardClass) return null;

    const parts = String(standardClass).split('_');
    parts.pop();
    const standardName = parts.join('_');

    if (!standardName) return null;

    const matchingStandard = standards.find((standard) => {
        const label = standard?.label || standard?.name || standard?.code || '';
        return label.startsWith(standardName);
    });

    return matchingStandard?.value || matchingStandard?.id || null;
};

const deriveStandardClassValue = ({
    standardClass,
    standardId,
    toleranceClass,
    standards = [],
}) => {
    if (standardClass) return standardClass;
    if (!toleranceClass) return '';

    const matchingStandard = standards.find(
        (standard) => standard?.value === standardId || standard?.id === standardId
    );
    const label = matchingStandard?.label || matchingStandard?.name || matchingStandard?.code || '';

    if (label.includes('ISO 2768-1')) return `ISO 2768-1_${toleranceClass}`;
    if (label.includes('TS 13920')) return `TS 13920_${toleranceClass}`;
    if (label.includes('TS 9013')) {
        if (['1', '2', '3', '4'].includes(String(toleranceClass))) return 'TS 9013_S1';
        return `TS 9013_${toleranceClass}`;
    }

    if (['f', 'm', 'c', 'v'].includes(String(toleranceClass))) {
        return `ISO 2768-1_${toleranceClass}`;
    }
    if (['A', 'B', 'C', 'D'].includes(String(toleranceClass))) {
        return `TS 13920_${toleranceClass}`;
    }
    if (['S1', 'S2'].includes(String(toleranceClass))) {
        return `TS 9013_${toleranceClass}`;
    }
    if (['1', '2', '3', '4'].includes(String(toleranceClass))) {
        return 'TS 9013_S1';
    }

    return '';
};

const hydrateInkrItem = (item, { characteristics = [], equipment = [], standards = [] } = {}) => {
    const normalized = normalizeLegacyTs9013StandardItem(item);
    const matchingCharacteristic = characteristics.find((characteristic) => characteristic.value === normalized.characteristic_id);
    const matchingEquipment = equipment.find((entry) => entry.value === normalized.equipment_id);
    const isDimensional =
        !!matchingEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(matchingEquipment.label);

    let standardId = normalized.standard_id || null;
    let toleranceClass = normalized.tolerance_class || null;
    let standardClass = deriveStandardClassValue({
        standardClass: normalized.standard_class || '',
        standardId,
        toleranceClass,
        standards,
    });

    if (isDimensional && !standardClass && !standardId && !toleranceClass) {
        standardClass = 'ISO 2768-1_m';
        toleranceClass = 'm';
        standardId = getStandardIdFromClass(standardClass, standards);
    }

    return {
        id: normalized.id || uuidv4(),
        characteristic_id: normalized.characteristic_id || '',
        characteristic_type: normalized.characteristic_type || matchingCharacteristic?.type || '',
        equipment_id: normalized.equipment_id || '',
        standard_id: standardId,
        tolerance_class: toleranceClass,
        standard_class: standardClass,
        nominal_value: normalized.nominal_value !== undefined && normalized.nominal_value !== null ? normalized.nominal_value : '',
        min_value: normalized.min_value !== undefined && normalized.min_value !== null ? normalized.min_value : null,
        max_value: normalized.max_value !== undefined && normalized.max_value !== null ? normalized.max_value : null,
        tolerance_direction: normalized.tolerance_direction || '±',
        measured_value: normalized.measured_value || '',
        sheet_thickness_mm:
            normalized.sheet_thickness_mm !== undefined && normalized.sheet_thickness_mm !== null
                ? String(normalized.sheet_thickness_mm)
                : '',
    };
};

const normalizePartCode = normalizeProcessPartCode;

const getTimestamp = (...values) => {
    for (const value of values) {
        if (!value) continue;
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.getTime();
        }
    }

    return null;
};

const getInkrReportSortValue = (report) =>
    getTimestamp(report?.report_date, report?.updated_at, report?.created_at);

const getPartSortValue = (part) =>
    getTimestamp(
        part?.latestInspectionDate,
        part?.firstInspectionDate,
        part?.inkrReport?.report_date,
        part?.inkrReport?.updated_at,
        part?.inkrReport?.created_at
    );

const InkrItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
    const isDimensional = useMemo(() => {
        if (!equipment) return false;
        const selectedEquipment = equipment.find(e => e.value === item.equipment_id);
        return selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
    }, [item.equipment_id, equipment]);

    const autoCalculateTolerance = useCallback((currentItem) => {
        const { nominal_value, tolerance_class, tolerance_direction, standard_class, sheet_thickness_mm } = currentItem;

        if (!isDimensional || !nominal_value || !standard_class) {
            return { ...currentItem };
        }

        const nominal = parseNumericNominalMm(nominal_value);
        if (isNaN(nominal)) {
            return { ...currentItem };
        }

        if (standard_class.startsWith('TS 9013')) {
            if (!tolerance_class) return { ...currentItem };
            const qClass = ts9013QualityClassFromToleranceClass(tolerance_class);
            if (!qClass) {
                return { ...currentItem, min_value: null, max_value: null };
            }
            const t = parseFloat(String(sheet_thickness_mm ?? '').replace(',', '.'));
            if (isNaN(t) || t <= 0) {
                return { ...currentItem, min_value: null, max_value: null };
            }
            const tolerance = lookupTs9013LimitDeviationMm(t, nominal, qClass);
            if (tolerance === null) {
                return { ...currentItem, min_value: null, max_value: null };
            }
            let min, max;
            switch (tolerance_direction) {
                case '+':
                    min = nominal;
                    max = nominal + tolerance;
                    break;
                case '-':
                    min = nominal - tolerance;
                    max = nominal;
                    break;
                case '±':
                default:
                    min = nominal - tolerance;
                    max = nominal + tolerance;
                    break;
            }
            return {
                ...currentItem,
                min_value: parseFloat(min.toPrecision(10)).toString(),
                max_value: parseFloat(max.toPrecision(10)).toString(),
            };
        }

        if (!tolerance_class) {
            return { ...currentItem };
        }

        const toleranceRule = getToleranceTable(standard_class).linear.find(
            (rule) => nominal >= rule.range[0] && nominal < rule.range[1]
        );

        if (toleranceRule && toleranceRule[tolerance_class] !== null && toleranceRule[tolerance_class] !== undefined) {
            const tolerance = toleranceRule[tolerance_class];
            let min, max;

            switch (tolerance_direction) {
                case '+':
                    min = nominal;
                    max = nominal + tolerance;
                    break;
                case '-':
                    min = nominal - tolerance;
                    max = nominal;
                    break;
                case '±':
                default:
                    min = nominal - tolerance;
                    max = nominal + tolerance;
                    break;
            }
            return {
                ...currentItem,
                min_value: parseFloat(min.toPrecision(10)).toString(),
                max_value: parseFloat(max.toPrecision(10)).toString()
            };
        }
        return currentItem;
    }, [isDimensional]);

    const handleFieldChange = (field, value) => {
        let newItem = { ...item, [field]: value };

        if (field === 'standard_class') {
            if (value) {
                const parts = value.split('_');
                const toleranceClass = parts.pop();
                const standardId = getStandardIdFromClass(value, standards);
                newItem = {
                    ...newItem,
                    standard_id: standardId,
                    tolerance_class: toleranceClass,
                    standard_class: value,
                    ...(!value.startsWith('TS 9013') ? { sheet_thickness_mm: '' } : {}),
                };

                const calculatedItem = autoCalculateTolerance(newItem);
                onUpdate(index, calculatedItem);
                return;
            } else {
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: '', sheet_thickness_mm: '' };
            }
        }

        if (field === 'equipment_id' && equipment) {
            const selectedEquipment = equipment.find(e => e.value === value);
            const isNowDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
            if (!isNowDimensional) {
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: null, sheet_thickness_mm: '', tolerance_direction: '±', min_value: null, max_value: null };
            }
        }

        if (field === 'characteristic_id' && characteristics) {
            const selectedCharacteristic = characteristics.find(c => c.value === value);
            if (selectedCharacteristic) {
                newItem.characteristic_type = selectedCharacteristic.type;
            }
        }

        if (['nominal_value', 'tolerance_direction', 'sheet_thickness_mm'].includes(field)) {
            const calculatedItem = autoCalculateTolerance(newItem);
            onUpdate(index, calculatedItem);
        } else {
            onUpdate(index, newItem);
        }
    };

    const standardClassValue = useMemo(
        () =>
            deriveStandardClassValue({
                standardClass: item.standard_class || '',
                standardId: item.standard_id,
                toleranceClass: item.tolerance_class,
                standards,
            }),
        [item.standard_class, item.standard_id, item.tolerance_class, standards]
    );

    const isTs9013 = item.standard_class?.startsWith('TS 9013');

    return (
        <tr className="border-b transition-colors hover:bg-muted/50 text-sm">
            <td className="p-2 align-top text-center font-medium">{index + 1}</td>
            <td className="p-2 align-top min-w-[200px]">
                <Combobox options={characteristics || []} value={item.characteristic_id} onChange={(v) => handleFieldChange('characteristic_id', v)} placeholder="Karakteristik seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." />
            </td>
            <td className="p-2 align-top min-w-[200px]"><Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." /></td>
            <td className="p-2 align-top min-w-[220px]"><Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional} /></td>
            <td className="p-2 align-top min-w-[100px]">
                <Input
                    type="text"
                    inputMode="decimal"
                    title={isTs9013 ? 'TS 9013 için iş parçası / sac kalınlığı (mm)' : undefined}
                    placeholder={isTs9013 ? 'mm' : '—'}
                    value={item.sheet_thickness_mm ?? ''}
                    onChange={(e) => handleFieldChange('sheet_thickness_mm', e.target.value)}
                    disabled={!isDimensional || !isTs9013}
                    className={`w-full ${!isTs9013 ? 'opacity-60' : ''}`}
                />
            </td>
            <td className="p-2 align-top min-w-[130px]">
                <Input
                    type="text"
                    placeholder="Örn: M8, 15.5, OK"
                    value={item.nominal_value || ''}
                    onChange={(e) => handleFieldChange('nominal_value', e.target.value)}
                    maxLength="50"
                    className="w-full"
                />
            </td>
            <td className="p-2 align-top min-w-[100px]">
                <Combobox
                    options={[{ value: '±', label: '±' }, { value: '+', label: '+' }, { value: '-', label: '-' }]}
                    value={item.tolerance_direction}
                    onChange={(v) => handleFieldChange('tolerance_direction', v)}
                    placeholder="Yön"
                    disabled={!isDimensional}
                />
            </td>
            <td className="p-2 align-top min-w-[110px]"><Input type="text" inputMode="decimal" placeholder="Min" value={item.min_value ?? ''} onChange={(e) => handleFieldChange('min_value', e.target.value)} disabled={!isDimensional} className="w-full" /></td>
            <td className="p-2 align-top min-w-[110px]"><Input type="text" inputMode="decimal" placeholder="Max" value={item.max_value ?? ''} onChange={(e) => handleFieldChange('max_value', e.target.value)} disabled={!isDimensional} className="w-full" /></td>
            <td className="p-2 align-top min-w-[140px]"><Input type="text" inputMode="decimal" placeholder="Ölçülen Değer" value={item.measured_value ?? ''} onChange={(e) => handleFieldChange('measured_value', e.target.value)} className="w-full" /></td>
            <td className="p-2 align-top text-center min-w-[120px]">
                {(() => {
                    const measuredStr = String(item.measured_value || '').trim().toUpperCase();
                    const nominalStr = String(item.nominal_value || '').trim().toUpperCase();

                    if (!measuredStr) {
                        return <span className="text-xs text-muted-foreground">-</span>;
                    }

                    const normalizeValue = (val) => {
                        if (val === null || val === undefined || val === '') return NaN;
                        return parseFloat(String(val).replace(',', '.'));
                    };

                    const measured = normalizeValue(item.measured_value);
                    const min = normalizeValue(item.min_value);
                    const max = normalizeValue(item.max_value);

                    // 1. KESİN RED KELİMELERİ
                    const isExplicitFail = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(failText =>
                        measuredStr === failText || measuredStr.startsWith(failText + ' ')
                    );

                    if (isExplicitFail) {
                        return <Badge variant="destructive" className="bg-red-500 text-white hover:bg-red-600">Ret</Badge>;
                    }

                    // 2. KESİN KABUL KELİMELERİ
                    const isExplicitPass = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GEÇER', 'VAR', 'EVET'].some(okText =>
                        measuredStr === okText || measuredStr.startsWith(okText + ' ')
                    );

                    if (isExplicitPass) {
                        return <Badge variant="success" className="bg-green-500 text-white hover:bg-green-600">Kabul</Badge>;
                    }

                    // 3. NOMİNAL DEĞER İLE BİREBİR EŞLEŞME (Metin olarak)
                    if (nominalStr && measuredStr === nominalStr) {
                        return <Badge variant="success" className="bg-green-500 text-white hover:bg-green-600">Kabul</Badge>;
                    }

                    // 4. SAYISAL KONTROL
                    if (!isNaN(measured)) {
                        let isInRange = false;
                        if (!isNaN(min) && !isNaN(max)) {
                            isInRange = measured >= min && measured <= max;
                        } else if (!isNaN(min)) {
                            isInRange = measured >= min;
                        } else if (!isNaN(max)) {
                            isInRange = measured <= max;
                        } else {
                            // Aralık yoksa ve nominal sayısal ise eşitliğe bak
                            const nominalNum = normalizeValue(item.nominal_value);
                            if (!isNaN(nominalNum) && measured === nominalNum) {
                                isInRange = true;
                            } else {
                                // Hiçbir kriter yoksa ama değer girildiyse (ve fail kelimesi değilse)
                                // Kullanıcı sadece değer girdi, min/max yok. 
                                // Varsayılan olarak nötr veya kabul gösterilebilir.
                                // Şimdilik nötr (-) bırakalım veya kabul diyelim?
                                // Önceki mantıkta "-" dönüyordu. Ancak kullanıcı "dinamik uygun" istiyor.
                                // Eğer min/max yoksa ve değer varsa genelde "bilgi" amaçlıdır.
                                return <span className="text-xs text-muted-foreground">-</span>;
                            }
                        }

                        return isInRange ? (
                            <Badge variant="success" className="bg-green-500 text-white hover:bg-green-600">Kabul</Badge>
                        ) : (
                            <Badge variant="destructive" className="bg-red-500 text-white hover:bg-red-600">Ret</Badge>
                        );
                    }

                    // Sayısal değil ve özel kelime de değilse, ve nominal ile eşleşmiyorsa -> RET
                    // Ayrıca boş değilse (yukarıda kontrol edildi)
                    return <Badge variant="destructive" className="bg-red-500 text-white hover:bg-red-600">Ret</Badge>;
                })()}
            </td>
            <td className="p-2 align-top text-center"><Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => onUpdate(index, null)}><Trash2 className="h-4 w-4" /></Button></td>
        </tr>
    );
};

const ProcessInkrFormModal = ({
    isOpen,
    setIsOpen,
    existingReport,
    refreshReports,
    refreshData,
    onReportSaved,
}) => {
    const { toast } = useToast();
    const isEditMode = !!(existingReport && existingReport.id);
    const [formData, setFormData] = useState({});
    const [items, setItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const { characteristics, equipment, standards, loading: dataLoading } = useData();
    const refreshInkrReports = refreshReports || refreshData;

    const initialItemState = { id: uuidv4(), characteristic_id: '', characteristic_type: '', equipment_id: '', standard_id: null, tolerance_class: null, nominal_value: '', min_value: null, max_value: null, tolerance_direction: '±', standard_class: '', measured_value: '', sheet_thickness_mm: '' };

    useEffect(() => {
        const initializeForm = async () => {
            // Reset state
            setFiles([]);
            setExistingAttachments([]);
            setDeletedAttachmentIds([]);

            if (existingReport && existingReport.id) {
                // Mevcut raporu düzenleme modu
                let derivedVehicleType = existingReport.vehicle_type || '';

                if (existingReport.part_code && !derivedVehicleType) {
                    const { data: controlPlan } = await supabase
                        .from('process_control_plans')
                        .select('vehicle_type')
                        .eq('part_code', existingReport.part_code)
                        .order('revision_number', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (controlPlan?.vehicle_type) {
                        derivedVehicleType = controlPlan.vehicle_type;
                    }
                }

                setFormData({
                    ...existingReport,
                    vehicle_type: derivedVehicleType,
                    report_date: existingReport.report_date ? new Date(existingReport.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    notes: existingReport.notes || ''
                });
                const reportItems = existingReport.items || [];
                const loadedItems = reportItems.map((item) =>
                    hydrateInkrItem(item, { characteristics, equipment, standards })
                );
                setItems(loadedItems);

                // Mevcut attachment'ları yükle
                try {
                    const attachments = await fetchProcessInkrAttachmentsForReport(
                        supabase,
                        existingReport.id
                    );
                    setExistingAttachments(attachments);
                } catch (attachmentsError) {
                    console.error('INKR attachment yükleme hatası:', attachmentsError);
                }
            } else {
                // Yeni rapor oluşturma modu
                let initialReportDate = new Date().toISOString().split('T')[0];
                let initialItems = [];
                let derivedPartName = existingReport?.part_name || '';
                let derivedVehicleType = existingReport?.vehicle_type || '';

                if (existingReport?.part_code) {
                    try {
                        // 1. İlgili parça kodunun son revizyon Kontrol Planını getir
                        const { data: controlPlan, error: planError } = await supabase
                            .from('process_control_plans')
                            .select('items, part_name, vehicle_type')
                            .eq('part_code', existingReport.part_code)
                            .order('revision_number', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (controlPlan && controlPlan.part_name) {
                            derivedPartName = controlPlan.part_name;
                        }
                        if (controlPlan?.vehicle_type) {
                            derivedVehicleType = controlPlan.vehicle_type;
                        }

                        // 2. İlk üretim denemesi/muayenesi kaydını getir
                        const { data: firstInspection, error: inspectionError } = await supabase
                            .from('process_inspections')
                            .select('id, inspection_date, part_name, quantity_produced')
                            .eq('part_code', existingReport.part_code)
                            .order('inspection_date', { ascending: true })
                            .order('created_at', { ascending: true })
                            .limit(1)
                            .maybeSingle();

                        if (firstInspection) {
                            if (firstInspection.inspection_date) {
                                initialReportDate = new Date(firstInspection.inspection_date).toISOString().split('T')[0];
                            }
                            if (!derivedPartName && firstInspection.part_name?.trim()) {
                                derivedPartName = firstInspection.part_name.trim();
                            }

                            // İlk testin sonuçlarını getir (sıra, dağıtım mantığı ile uyumlu olsun)
                            const { data: inspectionResults } = await supabase
                                .from('process_inspection_results')
                                .select('*')
                                .eq('inspection_id', firstInspection.id)
                                .order('id', { ascending: true });

                            // Proses muayene formu ile aynı buildMeasurementBundle matrisi: plan satırı + ölçüm no.
                            // Eski yalnızca characteristic_id + shift() yaklaşımı, aynı karakteristikli birden
                            // fazla kalem veya kalem başına çoklu ölçümde kaydırır; nominal-ölçü çifti kayar.
                            const quantityProduced = Number(firstInspection.quantity_produced) || 0;
                            const effectiveQty = quantityProduced > 0 ? quantityProduced : 1;
                            if (controlPlan && controlPlan.items?.length) {
                                const { results: bundleResults } = buildMeasurementBundle({
                                    controlPlan,
                                    quantityProduced: effectiveQty,
                                    characteristics: characteristics || [],
                                    equipment: equipment || [],
                                    existingRows: inspectionResults || [],
                                });
                                initialItems = controlPlan.items.map((planItem) => {
                                    const matchForLine = (bundleResults || []).find(
                                        (r) =>
                                            r.control_plan_item_id === planItem.id && Number(r.measurement_number) === 1
                                    );
                                    const nextMeasuredValue =
                                        matchForLine?.measured_value != null && matchForLine.measured_value !== ''
                                            ? matchForLine.measured_value
                                            : '';
                                    return hydrateInkrItem(
                                        {
                                            ...planItem,
                                            measured_value: nextMeasuredValue,
                                        },
                                        { characteristics, equipment, standards }
                                    );
                                });
                            }
                        } else if (controlPlan && controlPlan.items?.length) {
                            // Sadece kontrol planı varsa
                            initialItems = controlPlan.items.map((planItem) =>
                                hydrateInkrItem(planItem, { characteristics, equipment, standards })
                            );
                        }
                    } catch (err) {
                        console.error('Proses muayene bilgileri alınamadı:', err);
                    }
                }

                setFormData({
                    part_code: existingReport?.part_code || '',
                    part_name: derivedPartName,
                    vehicle_type: derivedVehicleType,
                    report_date: initialReportDate,
                    status: 'Beklemede',
                    notes: '',
                    items: []
                });
                setItems(initialItems);
            }
        };

        if (isOpen) {
            initializeForm();
        }
    }, [isOpen, existingReport, characteristics, equipment, standards]);

    // Dosya yükleme fonksiyonları
    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.png', '.jpg', '.gif'],
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
        }
    });

    const removeFile = (fileToRemove) => {
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const removeExistingAttachment = (attachmentId) => {
        setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
        setDeletedAttachmentIds(prev => [...prev, attachmentId]);
    };

    // Dosya uzantısına göre MIME type belirleme fonksiyonu
    const getMimeTypeFromFileName = (fileName) => {
        if (!fileName) return 'application/octet-stream';

        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
        };

        return mimeTypes[extension] || 'application/octet-stream';
    };

    const sanitizeFileName = (fileName) => {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    };

    const handleItemUpdate = (index, updatedItem) => {
        if (updatedItem === null) {
            setItems(prev => prev.filter((_, i) => i !== index));
        } else {
            setItems(prev => {
                const newItems = [...prev];
                newItems[index] = updatedItem;
                return newItems;
            });
        }
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, { ...initialItemState, id: uuidv4() }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const filteredItems = items.filter(item => item.characteristic_id && item.equipment_id);
            const normalizedPartCode = String(formData.part_code || '').trim();
            const normalizedPartName = String(formData.part_name || '').trim();

            const ts9013Invalid = filteredItems.some((item) => {
                if (!item.standard_class?.startsWith('TS 9013')) return false;
                const selectedEquipment = equipment?.find((eq) => eq.value === item.equipment_id);
                const isDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
                if (!isDimensional) return false;
                const t = parseFloat(String(item.sheet_thickness_mm ?? '').replace(',', '.'));
                const nom = parseNumericNominalMm(item.nominal_value);
                const q = ts9013QualityClassFromToleranceClass(item.tolerance_class);
                if (isNaN(t) || t <= 0 || isNaN(nom) || !q) return true;
                return lookupTs9013LimitDeviationMm(t, nom, q) === null;
            });
            if (ts9013Invalid) {
                toast({
                    variant: 'destructive',
                    title: 'TS 9013 — eksik veya geçersiz veri',
                    description: 'Sınıf 1 veya 2, sac kalınlığı (mm) ve sayısal nominal boyut girilmeli; kombinasyon tabloda tanımlı olmalıdır.',
                });
                setIsSubmitting(false);
                return;
            }

            const reportData = {
                part_code: normalizedPartCode,
                part_name: normalizedPartName,
                report_date: formData.report_date,
                status: formData.status,
                notes: formData.notes || '',
                items: filteredItems.map((item) => ({
                    ...item,
                    sheet_thickness_mm:
                        item.standard_class?.startsWith('TS 9013') &&
                        item.sheet_thickness_mm !== undefined &&
                        item.sheet_thickness_mm !== null &&
                        String(item.sheet_thickness_mm).trim() !== ''
                            ? String(item.sheet_thickness_mm).replace(',', '.')
                            : null,
                })),
            };

            if (!reportData.part_code || !reportData.part_name || !reportData.report_date || !reportData.status) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Parça kodu, parça adı, rapor tarihi ve durum alanları zorunludur.' });
                setIsSubmitting(false);
                return;
            }

            // Düzenleme modunda mevcut id'yi kullanarak güncelleme yap
            let savedReport;
            if (isEditMode && existingReport?.id) {
                const { data: updatedReport, error: updateError } = await supabase
                    .from('process_inkr_reports')
                    .update(reportData)
                    .eq('id', existingReport.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('INKR güncelleme hatası:', updateError);
                    toast({ variant: 'destructive', title: 'Hata!', description: `INKR Raporu güncellenemedi: ${updateError.message}` });
                    return;
                }
                savedReport = updatedReport;
            } else {
                const { data: existingReports, error: existingReportError } = await supabase
                    .from('process_inkr_reports')
                    .select('id')
                    .eq('part_code', normalizedPartCode)
                    .order('report_date', { ascending: false })
                    .order('updated_at', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (existingReportError) {
                    console.error('Mevcut INKR kaydı kontrol edilemedi:', existingReportError);
                    toast({
                        variant: 'destructive',
                        title: 'Hata!',
                        description: `INKR kaydı kontrol edilemedi: ${existingReportError.message}`,
                    });
                    return;
                }

                const existingRowId = existingReports?.[0]?.id;

                if (existingRowId) {
                    const { data: updatedReport, error: updateError } = await supabase
                        .from('process_inkr_reports')
                        .update(reportData)
                        .eq('id', existingRowId)
                        .select()
                        .single();

                    if (updateError) {
                        console.error('INKR güncelleme hatası:', updateError);
                        toast({
                            variant: 'destructive',
                            title: 'Hata!',
                            description: `INKR Raporu güncellenemedi: ${updateError.message}`,
                        });
                        return;
                    }

                    savedReport = updatedReport;
                } else {
                    const { data: insertedReport, error: insertError } = await supabase
                        .from('process_inkr_reports')
                        .insert(reportData)
                        .select()
                        .single();

                    if (insertError) {
                        console.error('INKR kaydetme hatası:', insertError);
                        toast({
                            variant: 'destructive',
                            title: 'Hata!',
                            description: `INKR Raporu kaydedilemedi: ${insertError.message}`,
                        });
                        return;
                    }

                    savedReport = insertedReport;
                }
            }

            if (!savedReport) {
                console.error('INKR kaydedildi ancak yanıt alınamadı');
                toast({ variant: 'destructive', title: 'Hata!', description: 'INKR Raporu kaydedildi ancak yanıt alınamadı. Sayfayı yenileyiniz.' });
                return;
            }

            // Silinen attachment'ları sil
            if (deletedAttachmentIds.length > 0) {
                for (const attachmentId of deletedAttachmentIds) {
                    try {
                        const { data: attData } = await supabase
                            .from('process_inkr_attachments')
                            .select('file_path')
                            .eq('id', attachmentId)
                            .maybeSingle();

                        if (attData?.file_path) {
                            await supabase.storage.from('process_inkr_attachments').remove([attData.file_path]);
                        }
                        await supabase.from('process_inkr_attachments').delete().eq('id', attachmentId);
                    } catch (attErr) {
                        console.error(`Attachment silme hatası (${attachmentId}):`, attErr);
                    }
                }
            }

            // Yeni dosyaları yükle
            if (files.length > 0 && savedReport) {
                for (const file of files) {
                    try {
                        const sanitizedFileName = sanitizeFileName(file.name);
                        const contentType = getMimeTypeFromFileName(file.name);
                        const timestamp = Date.now();
                        const randomStr = Math.random().toString(36).substring(2, 9);
                        const filePath = `${savedReport.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;

                        const maxSize = 50 * 1024 * 1024;
                        if (file.size > maxSize) {
                            toast({ variant: 'destructive', title: 'Dosya Hatası', description: `${file.name} çok büyük (max 50MB)` });
                            continue;
                        }

                        const fileArrayBuffer = await file.arrayBuffer();
                        const uploadResult = await supabase.storage.from('process_inkr_attachments').upload(filePath, fileArrayBuffer, {
                            contentType: contentType,
                            upsert: false
                        });

                        if (uploadResult.error) {
                            toast({ variant: 'destructive', title: 'Dosya Yükleme Hatası', description: `${file.name} yüklenemedi: ${uploadResult.error.message}` });
                            continue;
                        }

                        await insertProcessInkrAttachment(supabase, savedReport.id, {
                            file_path: uploadResult.data.path,
                            file_name: file.name,
                            file_type: contentType,
                            file_size: file.size
                        });
                    } catch (fileError) {
                        console.error(`Dosya yükleme hatası (${file.name}):`, fileError);
                        toast({ variant: 'destructive', title: 'Hata', description: `${file.name} yüklenemedi` });
                    }
                }
            }

            toast({ title: 'Başarılı!', description: `INKR Raporu başarıyla kaydedildi.` });
            await refreshInkrReports?.();
            if (onReportSaved) {
                const { data, error: fetchError } = await supabase
                    .from('process_inkr_reports')
                    .select('*')
                    .order('report_date', { ascending: false })
                    .order('updated_at', { ascending: false });

                if (!fetchError && data) {
                    // Yeni kaydedilen rapor fetch'te olmayabilir (Supabase 1000 limit) - mutlaka ekle
                    const hasSaved = data.some(r => r.id === savedReport.id);
                    if (!hasSaved) {
                        data.unshift({ ...savedReport });
                    }
                    data.sort((a, b) => {
                        const dateA = getInkrReportSortValue(a);
                        const dateB = getInkrReportSortValue(b);
                        if (dateA !== null && dateB !== null) return dateB - dateA;
                        if (dateA !== null) return -1;
                        if (dateB !== null) return 1;
                        return 0;
                    });
                    onReportSaved(data);
                }
            }
            setIsOpen(false);
        } catch (err) {
            console.error('INKR kaydetme genel hatası:', err);
            toast({ variant: 'destructive', title: 'Beklenmeyen Hata!', description: `INKR Raporu kaydedilemedi: ${err?.message || 'Bilinmeyen hata'}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value === '' || value === 'none' ? null : value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[95vw] w-[98vw] sm:w-[95vw] max-h-[95vh] flex flex-col p-0">
                {/* Gradient Header */}
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0 rounded-t-lg">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><Plus className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'INKR Raporu Düzenle' : 'Yeni INKR Raporu Oluştur'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">İlk numune kontrol raporu bilgilerini girin</p>
                        </div>
                    </div>
                </header>
                <DialogHeader className="sr-only">
                    <DialogTitle>{isEditMode ? 'INKR Raporu Düzenle' : 'Yeni INKR Raporu Oluştur'}</DialogTitle>
                    <DialogDescription>İlk numune kontrol raporu bilgilerini girin ve ölçümleri kaydedin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
                        <div className="p-6 space-y-6">
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Parça Kodu</Label><Input value={formData.part_code || ''} onChange={(e) => setFormData(f => ({ ...f, part_code: e.target.value }))} required disabled={isEditMode || !!(existingReport && existingReport.part_code && !existingReport.id)} /></div>
                                    <div><Label>Parça Adı</Label><Input value={formData.part_name || ''} onChange={(e) => setFormData(f => ({ ...f, part_name: e.target.value }))} required /></div>
                                    <div>
                                        <Label>Araç Tipi</Label>
                                        <Input
                                            value={formData.vehicle_type || ''}
                                            readOnly
                                            placeholder="Kontrol planından otomatik gelir"
                                            className="bg-muted/40"
                                        />
                                    </div>
                                    <div><Label>Rapor Tarihi</Label><Input type="date" value={formData.report_date || ''} onChange={(e) => setFormData(f => ({ ...f, report_date: e.target.value }))} required /></div>
                                    <div><Label>Durum</Label><Select value={formData.status || ''} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Beklemede">Beklemede</SelectItem><SelectItem value="Onaylandı">Onaylandı</SelectItem><SelectItem value="Reddedildi">Reddedildi</SelectItem></SelectContent></Select></div>
                                    <div className="col-span-2">
                                        <Label>Kritik Bilgiler / Notlar</Label>
                                        <Textarea
                                            value={formData.notes || ''}
                                            onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="Örn: Parça, ISO 2081 standardına uygun olarak komple elektrolitik galvaniz ile kaplanacaktır. Kaplama kalınlığı 8 µm ±2 µm olacaktır..."
                                            rows={4}
                                            className="resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <Label className="text-lg font-semibold">Ölçüm Özellikleri</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={dataLoading}>
                                            <Plus className="w-4 h-4 mr-2" /> Özellik Ekle
                                        </Button>
                                    </div>
                                    {dataLoading ? (
                                        <div className="text-center py-8 text-muted-foreground">Veriler yükleniyor...</div>
                                    ) : items.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <p>Henüz özellik eklenmedi.</p>
                                            <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="mt-4">
                                                <Plus className="w-4 h-4 mr-2" /> İlk Özelliği Ekle
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse" style={{ minWidth: '1460px' }}>
                                                <thead>
                                                    <tr className="border-b bg-muted/50">
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground w-12">#</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Karakteristik</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Ekipman</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[220px]">Standart/Sınıf</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[100px]" title="TS 9013 için zorunlu">Sac kalın. (mm)</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[130px]">Nominal</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[100px]">Yön</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[110px]">Min</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[110px]">Max</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[140px]">Ölçülen Değer</th>
                                                        <th className="p-2 text-center text-xs font-semibold text-muted-foreground min-w-[120px]">Sonuç</th>
                                                        <th className="p-2 text-center text-xs font-semibold text-muted-foreground w-12"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, index) => (
                                                        <InkrItem
                                                            key={item.id}
                                                            item={item}
                                                            index={index}
                                                            onUpdate={handleItemUpdate}
                                                            characteristics={characteristics}
                                                            equipment={equipment}
                                                            standards={standards}
                                                        />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Dosya Ekleme Bölümü */}
                                <div className="border-t pt-4">
                                    <Label className="text-lg font-semibold mb-4 block">Dosya Ekle</Label>
                                    <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                        <input {...getInputProps()} />
                                        <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Dosyaları buraya sürükleyin ya da seçmek için tıklayın.</p>
                                    </div>

                                    {/* Mevcut attachment'lar (sadece düzenleme modunda) */}
                                    {isEditMode && existingAttachments.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-xs text-muted-foreground font-medium">Mevcut Ekler:</p>
                                            {existingAttachments.map((att) => (
                                                <div key={att.id} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                                    <div className="flex items-center gap-2">
                                                        <FileIcon className="w-4 h-4" />
                                                        <span className="text-sm">{att.file_name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExistingAttachment(att.id)}>
                                                        <XIcon className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Yeni eklenen dosyalar */}
                                    {files.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-xs text-muted-foreground font-medium">Yeni Eklenen Dosyalar:</p>
                                            {files.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                                    <div className="flex items-center gap-2">
                                                        <FileIcon className="w-4 h-4" />
                                                        <span className="text-sm">{file.name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file)}>
                                                        <XIcon className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t px-6 py-4 flex-shrink-0 bg-muted/30">
                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ProcessInkrManagement = ({ onViewPdf, plans = [], refreshReports, refreshData }) => {
    const { toast } = useToast();
    const { loading: globalLoading } = useData();
    const refreshInkrReports = refreshReports || refreshData;
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInkrDetail, setSelectedInkrDetail] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allParts, setAllParts] = useState([]);
    const [partsLoading, setPartsLoading] = useState(true);
    const [inkrStatusFilter, setInkrStatusFilter] = useState('all');
    const [inkrReports, setInkrReports] = useState([]);
    const [inkrReportsLoading, setInkrReportsLoading] = useState(true);
    const planVehicleTypeMap = useMemo(() => buildProcessPlanVehicleTypeMap(plans), [plans]);
    const enrichedInkrReports = useMemo(
        () => enrichProcessInkrReports(inkrReports, planVehicleTypeMap),
        [inkrReports, planVehicleTypeMap]
    );

    const handleEdit = (report) => {
        setSelectedReport(report);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedReport(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('process_inkr_reports').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Rapor silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'INKR raporu silindi.' });
            const { data, error: fetchError } = await supabase
                .from('process_inkr_reports')
                .select('*');

            if (!fetchError && data) {
                data.sort((a, b) => {
                    const dateA = getInkrReportSortValue(a);
                    const dateB = getInkrReportSortValue(b);
                    if (dateA !== null && dateB !== null) return dateB - dateA;
                    if (dateA !== null) return -1;
                    if (dateB !== null) return 1;
                    return 0;
                });
                setInkrReports(data);
            }
            await refreshInkrReports?.();
        }
    };

    const handleViewRecord = (report) => {
        setSelectedInkrDetail(report);
        setIsDetailModalOpen(true);
    };

    const handleDownloadDetailPDF = (enrichedData) =>
        openPrintableReport(enrichedData, 'inkr_management', true);

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            default: return 'secondary';
        }
    };

    useEffect(() => {
        const fetchInkrReports = async () => {
            setInkrReportsLoading(true);
            try {
                // Supabase varsayılan 1000 limit - tüm raporları almak için pagination
                let allReports = [];
                let page = 0;
                const PAGE_SIZE = 1000;
                let hasMore = true;

                while (hasMore) {
                    const from = page * PAGE_SIZE;
                    const to = from + PAGE_SIZE - 1;

                    const { data, error } = await supabase
                        .from('process_inkr_reports')
                        .select('*')
                        .order('report_date', { ascending: false })
                        .order('updated_at', { ascending: false })
                        .range(from, to);

                    if (error) throw error;

                    if (data && data.length > 0) {
                        allReports = allReports.concat(data);
                    }

                    if (!data || data.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }

                allReports.sort((a, b) => {
                    const dateA = getInkrReportSortValue(a);
                    const dateB = getInkrReportSortValue(b);
                    if (dateA !== null && dateB !== null) return dateB - dateA;
                    if (dateA !== null) return -1;
                    if (dateB !== null) return 1;
                    return 0;
                });

                setInkrReports(allReports);
            } catch (error) {
                console.error('INKR raporları alınamadı:', error);
                toast({ variant: 'destructive', title: 'Hata', description: `INKR raporları alınamadı: ${error.message}` });
                setInkrReports([]);
            } finally {
                setInkrReportsLoading(false);
            }
        };

        fetchInkrReports();
    }, [toast]);

    useEffect(() => {
        const fetchAllParts = async () => {
            setPartsLoading(true);
            try {
                let allInspections = [];
                let page = 0;
                const PAGE_SIZE = 1000;
                let hasMore = true;

                while (hasMore) {
                    const from = page * PAGE_SIZE;
                    const to = from + PAGE_SIZE - 1;

                    const { data: inspections, error: inspectionsError } = await supabase
                        .from('process_inspections')
                        .select('id, part_code, part_name, inspection_date, created_at, updated_at, record_no')
                        .not('part_code', 'is', null)
                        .not('part_code', 'eq', '')
                        .order('inspection_date', { ascending: false })
                        .order('created_at', { ascending: false })
                        .range(from, to);

                    if (inspectionsError) throw inspectionsError;

                    if (inspections && inspections.length > 0) {
                        allInspections = allInspections.concat(inspections);
                    }

                    if (!inspections || inspections.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }

                console.log('📥 ProcessInkrManagement - Toplam inspection kaydı çekildi:', allInspections.length);

                const uniquePartsMap = new Map();
                (allInspections || []).forEach((inspection) => {
                    if (inspection.part_code) {
                        const normalizedCode = normalizePartCode(inspection.part_code);
                        if (!normalizedCode) {
                            return;
                        }

                        const inspectionTimestamp = getTimestamp(
                            inspection.inspection_date,
                            inspection.created_at,
                            inspection.updated_at
                        );
                        const existingPart = uniquePartsMap.get(normalizedCode);

                        if (!existingPart) {
                            uniquePartsMap.set(normalizedCode, {
                                part_code: inspection.part_code.trim(),
                                part_name: inspection.part_name?.trim() || '-',
                                latestInspectionDate:
                                    inspection.inspection_date || inspection.created_at || inspection.updated_at || null,
                                firstInspectionDate:
                                    inspection.inspection_date || inspection.created_at || inspection.updated_at || null,
                                latestInspectionTimestamp: inspectionTimestamp,
                                firstInspectionTimestamp: inspectionTimestamp,
                                inspectionCount: 1,
                            });
                            return;
                        }

                        existingPart.inspectionCount += 1;

                        if (inspection.part_name?.trim() && (!existingPart.part_name || existingPart.part_name === '-')) {
                            existingPart.part_name = inspection.part_name.trim();
                        }

                        if (
                            inspectionTimestamp !== null &&
                            (existingPart.latestInspectionTimestamp === null ||
                                inspectionTimestamp > existingPart.latestInspectionTimestamp)
                        ) {
                            existingPart.latestInspectionTimestamp = inspectionTimestamp;
                            existingPart.latestInspectionDate =
                                inspection.inspection_date || inspection.created_at || inspection.updated_at || null;

                            if (inspection.part_name?.trim()) {
                                existingPart.part_name = inspection.part_name.trim();
                            }
                        }

                        if (
                            inspectionTimestamp !== null &&
                            (existingPart.firstInspectionTimestamp === null ||
                                inspectionTimestamp < existingPart.firstInspectionTimestamp)
                        ) {
                            existingPart.firstInspectionTimestamp = inspectionTimestamp;
                            existingPart.firstInspectionDate =
                                inspection.inspection_date || inspection.created_at || inspection.updated_at || null;
                        }
                    }
                });

                const inkrMap = new Map();
                (enrichedInkrReports || []).forEach((r) => {
                    if (r.part_code) {
                        inkrMap.set(normalizePartCode(r.part_code), r);
                    }
                });

                const partsWithInkrStatus = Array.from(uniquePartsMap.values()).map((part) => {
                    const normalizedPartCode = normalizePartCode(part.part_code);
                    const inkrReport = inkrMap.get(normalizedPartCode);
                    const vehicleType =
                        getProcessInkrVehicleType(inkrReport, planVehicleTypeMap) ||
                        planVehicleTypeMap.get(normalizedPartCode) ||
                        '';
                    return {
                        ...part,
                        vehicle_type: vehicleType || null,
                        hasInkr: !!inkrReport,
                        inkrReport: inkrReport || null,
                    };
                });

                const existingNormalizedCodes = new Set(
                    Array.from(uniquePartsMap.values()).map((p) => normalizePartCode(p.part_code))
                );

                (enrichedInkrReports || []).forEach((inkrReport) => {
                    const normalizedInkrPartCode = normalizePartCode(inkrReport.part_code);
                    if (inkrReport.part_code && !existingNormalizedCodes.has(normalizedInkrPartCode)) {
                        partsWithInkrStatus.push({
                            part_code: inkrReport.part_code.trim(),
                            part_name: inkrReport.part_name || '-',
                            vehicle_type: getProcessInkrVehicleType(inkrReport, planVehicleTypeMap) || null,
                            latestInspectionDate: null,
                            firstInspectionDate: null,
                            latestInspectionTimestamp: null,
                            firstInspectionTimestamp: null,
                            inspectionCount: 0,
                            hasInkr: true,
                            inkrReport,
                        });
                        existingNormalizedCodes.add(normalizedInkrPartCode);
                    }
                });

                // Debug: INKR durumu özeti
                const withInkr = partsWithInkrStatus.filter(p => p.hasInkr).length;
                const withoutInkr = partsWithInkrStatus.filter(p => !p.hasInkr).length;
                console.log('📋 INKR Yönetimi - Parça Listesi:', {
                    toplam: partsWithInkrStatus.length,
                    inkrMevcut: withInkr,
                    inkrEksik: withoutInkr,
                    ornekEksikler: partsWithInkrStatus.filter(p => !p.hasInkr).slice(0, 5).map(p => p.part_code)
                });

                partsWithInkrStatus.sort((a, b) => {
                    if (a.hasInkr !== b.hasInkr) {
                        return a.hasInkr ? 1 : -1;
                    }

                    const dateA = getPartSortValue(a);
                    const dateB = getPartSortValue(b);

                    if (dateA !== null && dateB !== null) {
                        return dateB - dateA;
                    }

                    if (dateA !== null) return -1;
                    if (dateB !== null) return 1;

                    return a.part_code.localeCompare(b.part_code);
                });

                setAllParts(partsWithInkrStatus);
            } catch (error) {
                console.error('Parça listesi alınamadı:', error);
                toast({ variant: 'destructive', title: 'Hata', description: 'Parça listesi alınamadı.' });
                setAllParts([]);
            } finally {
                setPartsLoading(false);
            }
        };

        if (!inkrReportsLoading) {
            fetchAllParts();
        }
    }, [enrichedInkrReports, inkrReportsLoading, planVehicleTypeMap, toast]);

    const filteredParts = useMemo(() => {
        let filtered = allParts;

        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(part =>
                part.part_code.toLowerCase().includes(normalizedSearch) ||
                (part.part_name && part.part_name.toLowerCase().includes(normalizedSearch)) ||
                (part.vehicle_type && part.vehicle_type.toLowerCase().includes(normalizedSearch))
            );
        }

        if (inkrStatusFilter === 'Mevcut') {
            filtered = filtered.filter(part => part.hasInkr);
        } else if (inkrStatusFilter === 'Mevcut Değil') {
            filtered = filtered.filter(part => !part.hasInkr);
        }

        filtered.sort((a, b) => {
            if (a.hasInkr !== b.hasInkr) {
                return a.hasInkr ? 1 : -1;
            }

            const dateA = getPartSortValue(a);
            const dateB = getPartSortValue(b);

            if (dateA !== null && dateB !== null) {
                return dateB - dateA;
            }

            if (dateA !== null) return -1;
            if (dateB !== null) return 1;

            return a.part_code.localeCompare(b.part_code);
        });

        return filtered;
    }, [allParts, searchTerm, inkrStatusFilter]);

    return (
        <div className="dashboard-widget">
            <ProcessInkrFormModal
                isOpen={isModalOpen}
                setIsOpen={setIsModalOpen}
                existingReport={selectedReport}
                refreshReports={refreshReports}
                refreshData={refreshInkrReports}
                onReportSaved={setInkrReports}
            />
            <ProcessInkrDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                report={selectedInkrDetail}
                onDownloadPDF={handleDownloadDetailPDF}
                onViewPdf={onViewPdf}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="search-box w-full sm:w-auto sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Parça kodu, adı veya araç tipi ile ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={inkrStatusFilter} onValueChange={setInkrStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="INKR Durumu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="Mevcut">INKR Mevcut</SelectItem>
                            <SelectItem value="Mevcut Değil">INKR Eksik</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" /> Yeni INKR Raporu</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table document-module-table">
                    <thead>
                        <tr>
                            <th>Parça Kodu</th>
                            <th>Parça Adı</th>
                            <th>Araç Tipi</th>
                            <th>INKR Durumu</th>
                            <th>Rapor Tarihi</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partsLoading || inkrReportsLoading || globalLoading ? (
                            <tr><td colSpan="7" className="text-center py-8">Yükleniyor...</td></tr>
                        ) : filteredParts.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-8">Parça bulunamadı.</td></tr>
                        ) : (
                            filteredParts.map((part, index) => (
                                <tr
                                    key={part.part_code}
                                    onClick={() => part.inkrReport && handleViewRecord(part.inkrReport)}
                                    className={`transition-colors ${part.inkrReport ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                >
                                    <td className="font-medium text-foreground">{part.part_code}</td>
                                    <td className="text-foreground">{part.part_name}</td>
                                    <td className="text-muted-foreground">{part.inkrReport?.vehicle_type || part.vehicle_type || '-'}</td>
                                    <td>
                                        {part.hasInkr ? (
                                            <Badge variant="success" className="bg-green-500">Mevcut</Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-red-500">Eksik</Badge>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground">
                                        {part.inkrReport?.report_date ? new Date(part.inkrReport.report_date).toLocaleDateString('tr-TR') : '-'}
                                    </td>
                                    <td>
                                        {part.inkrReport ? (
                                            <Badge variant={getStatusVariant(part.inkrReport.status)}>{part.inkrReport.status}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {part.inkrReport ? (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(part.inkrReport)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleViewRecord(part.inkrReport)}><FileText className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(part.inkrReport.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setSelectedReport({
                                                    part_code: part.part_code,
                                                    part_name: part.part_name,
                                                    vehicle_type: part.vehicle_type || null,
                                                });
                                                setIsModalOpen(true);
                                            }}>
                                                <Plus className="h-4 w-4 mr-1" /> Ekle
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProcessInkrManagement;
