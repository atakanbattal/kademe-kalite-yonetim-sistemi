import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import InkrDetailModal from './InkrDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Search, FileText, Eye, UploadCloud, X as XIcon, FileIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '@/contexts/DataContext';
import { Combobox } from '@/components/ui/combobox';
import { useDropzone } from 'react-dropzone';

const NON_DIMENSIONAL_EQUIPMENT_LABELS = [
    "Geçer/Geçmez Mastar", "Karşı Parça ile Deneme",
    "Fonksiyonel Test", "Manuel Kontrol", "Pürüzlülük Ölçüm Cihazı",
    "Sertlik Test Cihazı", "Vida Diş Ölçer (Pitch Gauge)", "Gözle Kontrol"
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

const STANDARD_OPTIONS = [
    { value: 'ISO 2768-1_f', label: 'ISO 2768-1 f (Fine - İnce)' },
    { value: 'ISO 2768-1_m', label: 'ISO 2768-1 m (Medium - Orta)' },
    { value: 'ISO 2768-1_c', label: 'ISO 2768-1 c (Coarse - Kaba)' },
    { value: 'ISO 2768-1_v', label: 'ISO 2768-1 v (Very Coarse - Çok Kaba)' },
];

const InkrItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
    const isDimensional = useMemo(() => {
        if (!equipment) return false;
        const selectedEquipment = equipment.find(e => e.value === item.equipment_id);
        return selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
    }, [item.equipment_id, equipment]);

    const autoCalculateTolerance = useCallback((currentItem) => {
        const { nominal_value, tolerance_class, tolerance_direction } = currentItem;

        if (!isDimensional || !tolerance_class || !nominal_value) {
            return { ...currentItem };
        }

        const nominal = parseFloat(String(nominal_value).replace(',', '.'));
        if (isNaN(nominal)) {
            return { ...currentItem };
        }

        const toleranceRule = ISO_2768_1_TOLERANCES.linear.find(
            rule => nominal > rule.range[0] && nominal <= rule.range[1]
        );

        if (toleranceRule && toleranceRule[tolerance_class] !== null) {
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
            if (value && standards) {
                const [standardName, toleranceClass] = value.split('_');
                const standard = standards.find(s => s.label.startsWith(standardName));
                newItem = { ...newItem, standard_id: standard ? standard.value : null, tolerance_class: toleranceClass };

                const calculatedItem = autoCalculateTolerance(newItem);
                onUpdate(index, calculatedItem);
                return;
            } else {
                newItem = { ...newItem, standard_id: null, tolerance_class: null };
            }
        }

        if (field === 'equipment_id' && equipment) {
            const selectedEquipment = equipment.find(e => e.value === value);
            const isNowDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
            if (!isNowDimensional) {
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: null, tolerance_direction: '±', min_value: null, max_value: null };
            }
        }

        if (field === 'characteristic_id' && characteristics) {
            const selectedCharacteristic = characteristics.find(c => c.value === value);
            if (selectedCharacteristic) {
                newItem.characteristic_type = selectedCharacteristic.type;
            }
        }

        if (['nominal_value', 'tolerance_direction'].includes(field)) {
            const calculatedItem = autoCalculateTolerance(newItem);
            onUpdate(index, calculatedItem);
        } else {
            onUpdate(index, newItem);
        }
    };

    const selectedCharacteristic = characteristics?.find(c => c.value === item.characteristic_id);

    const standardClassValue = useMemo(() => {
        if (!standards) return item.standard_class || '';
        const standard = standards.find(s => s.value === item.standard_id);
        if (standard && item.tolerance_class) {
            const standardBaseName = standard.label.split(' ')[0];
            return `${standardBaseName}_${item.tolerance_class}`;
        }
        return item.standard_class || '';
    }, [item.standard_id, item.tolerance_class, standards, item.standard_class]);

    return (
        <tr className="border-b transition-colors hover:bg-muted/50 text-sm">
            <td className="p-2 align-top text-center font-medium">{index + 1}</td>
            <td className="p-2 align-top min-w-[200px]">
                <Combobox options={characteristics || []} value={item.characteristic_id} onChange={(v) => handleFieldChange('characteristic_id', v)} placeholder="Karakteristik seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." />
            </td>
            <td className="p-2 align-top min-w-[200px]"><Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." /></td>
            <td className="p-2 align-top min-w-[220px]"><Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional} /></td>
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

const InkrFormModal = ({ isOpen, setIsOpen, existingReport, refreshReports, onReportSaved }) => {
    const { toast } = useToast();
    const isEditMode = !!(existingReport && existingReport.id);
    const [formData, setFormData] = useState({});
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const { characteristics, equipment, standards, loading: dataLoading } = useData();

    const initialItemState = { id: uuidv4(), characteristic_id: '', characteristic_type: '', equipment_id: '', standard_id: null, tolerance_class: null, nominal_value: '', min_value: null, max_value: null, tolerance_direction: '±', standard_class: '', measured_value: '' };

    useEffect(() => {
        const initializeForm = async () => {
            // Reset state
            setFiles([]);
            setExistingAttachments([]);
            setDeletedAttachmentIds([]);
            
            if (existingReport && existingReport.id) {
                // Mevcut raporu düzenleme modu
                setFormData({
                    ...existingReport,
                    report_date: existingReport.report_date ? new Date(existingReport.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                });
                const reportItems = existingReport.items || [];
                const loadedItems = reportItems.map((item) => ({
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id || '',
                    characteristic_type: item.characteristic_type || '',
                    equipment_id: item.equipment_id || '',
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || '',
                    nominal_value: item.nominal_value !== undefined && item.nominal_value !== null ? item.nominal_value : '',
                    min_value: item.min_value !== undefined && item.min_value !== null ? item.min_value : null,
                    max_value: item.max_value !== undefined && item.max_value !== null ? item.max_value : null,
                    tolerance_direction: item.tolerance_direction || '±',
                    measured_value: item.measured_value || ''
                }));
                setItems(loadedItems);
                
                // Mevcut attachment'ları yükle
                const { data: attachments, error: attachmentsError } = await supabase
                    .from('inkr_attachments')
                    .select('*')
                    .eq('inkr_report_id', existingReport.id)
                    .order('uploaded_at', { ascending: false });
                
                if (!attachmentsError && attachments) {
                    setExistingAttachments(attachments);
                }
            } else {
                // Yeni rapor oluşturma modu
                let initialReportDate = new Date().toISOString().split('T')[0];
                let initialSupplierId = null;
                let initialItems = [];

                // Eğer parça kodu varsa, bu parçanın ilk girdi muayene tarihini, tedarikçisini ve ölçümlerini bul
                if (existingReport?.part_code) {
                    try {
                        // İlk muayene kaydını ve kontrol planını paralel olarak al
                        const [inspectionRes, controlPlanRes] = await Promise.all([
                            supabase
                                .from('incoming_inspections')
                                .select('id, inspection_date, supplier_id')
                                .eq('part_code', existingReport.part_code)
                                .order('inspection_date', { ascending: true })
                                .limit(1)
                                .maybeSingle(),
                            supabase
                                .from('incoming_control_plans')
                                .select('*')
                                .eq('part_code', existingReport.part_code)
                                .order('revision_number', { ascending: false })
                                .limit(1)
                                .maybeSingle()
                        ]);

                        const firstInspection = inspectionRes.data;
                        const controlPlan = controlPlanRes.data;

                        if (firstInspection) {
                            // Ürünün firmamıza ilk geldiği tarihi kullan
                            if (firstInspection.inspection_date) {
                                initialReportDate = new Date(firstInspection.inspection_date).toISOString().split('T')[0];
                            }
                            // İlk gelen tedarikçiyi kullan
                            if (firstInspection.supplier_id) {
                                initialSupplierId = firstInspection.supplier_id;
                            }

                            // İlk muayenenin ölçüm sonuçlarını al
                            const { data: inspectionResults, error: resultsError } = await supabase
                                .from('incoming_inspection_results')
                                .select('*')
                                .eq('inspection_id', firstInspection.id);

                            // Kontrol planı varsa, kontrol planındaki tüm item'ları kullan
                            // Muayene sonuçlarından sadece ölçülen değerleri eşleştir
                            if (controlPlan?.items && controlPlan.items.length > 0) {
                                // Muayene sonuçlarını Map'e dönüştür
                                const resultsMap = new Map();
                                if (!resultsError && inspectionResults) {
                                    inspectionResults.forEach(result => {
                                        // 1. control_plan_item_id ile eşleştir (en güvenilir)
                                        if (result.control_plan_item_id) {
                                            const key = result.control_plan_item_id;
                                            // İlk ölçümü (measurement_number = 1) al
                                            if (!resultsMap.has(key) || (result.measurement_number === 1)) {
                                                resultsMap.set(key, result);
                                            }
                                        }

                                        // 2. Nominal + Min + Max değerlerine göre eşleştir (fallback)
                                        // Bu kombinasyon her karakteristik için benzersiz olmalı
                                        const nominalKey = `values_${result.nominal_value || ''}_${result.min_value || ''}_${result.max_value || ''}`;
                                        if (!resultsMap.has(nominalKey) || (result.measurement_number === 1)) {
                                            resultsMap.set(nominalKey, result);
                                        }
                                    });
                                }

                                // Kontrol planındaki her item için INKR item oluştur
                                controlPlan.items.forEach(planItem => {
                                    // Karakteristik bilgilerini bul
                                    const matchingChar = characteristics?.find(c => c.value === planItem.characteristic_id);

                                    // Ekipman bilgilerini bul
                                    const matchingEquip = equipment?.find(e => e.value === planItem.equipment_id);

                                    // Ekipmanın boyutsal olup olmadığını kontrol et
                                    const isDimensional = matchingEquip && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(matchingEquip.label);

                                    // Muayene sonuçlarından ölçülen değeri bul
                                    let measuredValue = '';

                                    // 1. Önce control_plan_item_id ile eşleştir
                                    let result = resultsMap.get(planItem.id);

                                    // 2. Bulunamazsa nominal + min + max değerleri ile eşleştir
                                    if (!result) {
                                        const nominalKey = `values_${planItem.nominal_value || ''}_${planItem.min_value || ''}_${planItem.max_value || ''}`;
                                        result = resultsMap.get(nominalKey);
                                    }

                                    if (result) {
                                        measuredValue = result.measured_value || result.actual_value || '';
                                    }

                                    // Standart bilgilerini kontrol planından al
                                    let standardId = planItem.standard_id || null;
                                    let toleranceClass = planItem.tolerance_class || null;
                                    let standardClass = planItem.standard_class || '';

                                    // Eğer boyutsal ekipman seçili ama standart yoksa, varsayılan olarak ISO 2768-1 m ata
                                    if (isDimensional && !standardClass && !standardId) {
                                        standardClass = 'ISO 2768-1_m';
                                        toleranceClass = 'm';
                                        // Standards listesinden ISO 2768-1 bul
                                        const isoStandard = standards?.find(s => s.label?.includes('ISO 2768-1'));
                                        if (isoStandard) {
                                            standardId = isoStandard.value;
                                        }
                                    }

                                    // Standart sınıfını oluştur (eğer hala boşsa)
                                    if (!standardClass && standardId && toleranceClass && standards) {
                                        const matchingStd = standards.find(s => s.value === standardId);
                                        if (matchingStd) {
                                            const stdBaseName = matchingStd.label.split(' ')[0];
                                            standardClass = `${stdBaseName}_${toleranceClass}`;
                                        }
                                    }

                                    initialItems.push({
                                        id: uuidv4(),
                                        characteristic_id: planItem.characteristic_id || '',
                                        characteristic_type: planItem.characteristic_type || matchingChar?.type || '',
                                        equipment_id: planItem.equipment_id || '',
                                        standard_id: standardId,
                                        tolerance_class: toleranceClass,
                                        nominal_value: planItem.nominal_value !== undefined && planItem.nominal_value !== null ? planItem.nominal_value : '',
                                        min_value: planItem.min_value !== undefined && planItem.min_value !== null ? planItem.min_value : null,
                                        max_value: planItem.max_value !== undefined && planItem.max_value !== null ? planItem.max_value : null,
                                        tolerance_direction: planItem.tolerance_direction || '±',
                                        standard_class: standardClass,
                                        measured_value: measuredValue
                                    });
                                });
                            } else if (!resultsError && inspectionResults && inspectionResults.length > 0) {
                                // Kontrol planı yoksa, muayene sonuçlarını kullan (eski mantık)
                                const uniqueCharacteristics = new Map();
                                inspectionResults.forEach(result => {
                                    const charName = result.characteristic_name || result.feature;
                                    if (charName && !uniqueCharacteristics.has(charName)) {
                                        uniqueCharacteristics.set(charName, result);
                                    }
                                });

                                uniqueCharacteristics.forEach((result, charName) => {
                                    const matchingChar = characteristics?.find(c =>
                                        c.label?.toLowerCase() === charName?.toLowerCase()
                                    );
                                    const matchingEquip = equipment?.find(e =>
                                        e.label?.toLowerCase() === result.measurement_method?.toLowerCase()
                                    );

                                    initialItems.push({
                                        id: uuidv4(),
                                        characteristic_id: matchingChar?.value || '',
                                        characteristic_type: result.characteristic_type || matchingChar?.type || '',
                                        equipment_id: matchingEquip?.value || '',
                                        standard_id: null,
                                        tolerance_class: null,
                                        nominal_value: result.nominal_value !== undefined && result.nominal_value !== null ? result.nominal_value : '',
                                        min_value: result.min_value !== undefined && result.min_value !== null ? result.min_value : null,
                                        max_value: result.max_value !== undefined && result.max_value !== null ? result.max_value : null,
                                        tolerance_direction: '±',
                                        standard_class: '',
                                        measured_value: result.measured_value || result.actual_value || ''
                                    });
                                });
                            }
                        }
                    } catch (err) {
                        console.error('İlk muayene bilgileri alınamadı:', err);
                    }
                }

                setFormData({
                    part_code: existingReport?.part_code || '',
                    part_name: existingReport?.part_name || '',
                    supplier_id: initialSupplierId,
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
    }, [isOpen, existingReport]);

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

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
            if (!error) setSuppliers(data);
        };
        fetchSuppliers();
    }, []);

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

        const reportData = {
            ...formData,
            items: items.filter(item => item.characteristic_id && item.equipment_id)
        };
        if (reportData.supplier_id === '' || reportData.supplier_id === 'none') reportData.supplier_id = null;

        // INKR numarası oluştur - parça numarası ile ilişkili: INKR-parça_kodu
        if (!reportData.inkr_number || !reportData.inkr_number.startsWith('INKR-')) {
            if (reportData.part_code) {
                // Parça kodundan INKR numarası oluştur: INKR-parça_kodu
                // Özel karakterleri temizle ve sadece alfanumerik karakterleri kullan
                const cleanPartCode = reportData.part_code.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                reportData.inkr_number = `INKR-${cleanPartCode}`;
            } else {
                // Parça kodu yoksa yıl bazlı sıralı numara kullan
                const currentYear = new Date().getFullYear();
                const { data: lastReport } = await supabase
                    .from('inkr_reports')
                    .select('inkr_number')
                    .like('inkr_number', `INKR-${currentYear}-%`)
                    .not('inkr_number', 'like', `INKR-${currentYear}-%-%`) // Parça kodlu olanları hariç tut
                    .order('inkr_number', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let sequence = 1;
                if (lastReport?.inkr_number) {
                    const match = lastReport.inkr_number.match(new RegExp(`INKR-${currentYear}-(\\d+)`));
                    if (match && match[1]) {
                        sequence = parseInt(match[1], 10) + 1;
                    }
                }
                reportData.inkr_number = `INKR-${currentYear}-${String(sequence).padStart(4, '0')}`;
            }
        }

        delete reportData.id;
        delete reportData.created_at;
        delete reportData.updated_at;
        delete reportData.supplier;

        const { data: savedReport, error } = await supabase.from('inkr_reports').upsert(reportData, { onConflict: 'part_code' }).select().single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `INKR Raporu kaydedilemedi: ${error.message}` });
            setIsSubmitting(false);
            return;
        }

        // Silinen attachment'ları sil
        if (deletedAttachmentIds.length > 0) {
            for (const attachmentId of deletedAttachmentIds) {
                const attachment = existingAttachments.find(att => att.id === attachmentId);
                if (attachment) {
                    // Storage'dan sil
                    await supabase.storage.from('inkr_attachments').remove([attachment.file_path]);
                    // Veritabanından sil
                    await supabase.from('inkr_attachments').delete().eq('id', attachmentId);
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

                    // Dosya boyutunu kontrol et (max 50MB)
                    const maxSize = 50 * 1024 * 1024;
                    if (file.size > maxSize) {
                        toast({ variant: 'destructive', title: 'Dosya Hatası', description: `${file.name} çok büyük (max 50MB)` });
                        continue;
                    }

                    const fileArrayBuffer = await file.arrayBuffer();
                    const uploadResult = await supabase.storage.from('inkr_attachments').upload(filePath, fileArrayBuffer, { 
                        contentType: contentType,
                        upsert: false
                    });

                    if (uploadResult.error) {
                        toast({ variant: 'destructive', title: 'Dosya Yükleme Hatası', description: `${file.name} yüklenemedi: ${uploadResult.error.message}` });
                        continue;
                    }

                    // Veritabanına kaydet
                    await supabase.from('inkr_attachments').insert({
                        inkr_report_id: savedReport.id,
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
        if (refreshReports) refreshReports();
        if (onReportSaved) {
            const { data, error: fetchError } = await supabase
                .from('inkr_reports')
                .select('*, supplier:supplier_id(name)')
                .order('created_at', { ascending: false });
            if (!fetchError) {
                onReportSaved(data || []);
            }
        }
        setIsOpen(false);
        setIsSubmitting(false);
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value === '' || value === 'none' ? null : value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-[95vw] w-full max-h-[95vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{isEditMode ? 'INKR Raporu Düzenle' : 'Yeni INKR Raporu Oluştur'}</DialogTitle>
                    <DialogDescription>İlk numune kontrol raporu bilgilerini girin ve ölçümleri kaydedin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
                        <div className="p-4 space-y-6">
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Parça Kodu</Label><Input value={formData.part_code || ''} onChange={(e) => setFormData(f => ({ ...f, part_code: e.target.value }))} required disabled={isEditMode || !!(existingReport && existingReport.part_code && !existingReport.id)} /></div>
                                    <div><Label>Parça Adı</Label><Input value={formData.part_name || ''} onChange={(e) => setFormData(f => ({ ...f, part_name: e.target.value }))} required /></div>
                                    <div className="col-span-2">
                                        <Label>Tedarikçi <span className="text-muted-foreground text-xs font-normal">(Opsiyonel - Fabrika içi üretim için boş bırakın)</span></Label>
                                        <Select value={formData.supplier_id || 'none'} onValueChange={(v) => handleSelectChange('supplier_id', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tedarikçi seçin (fabrika içi üretim için boş bırakın)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Tedarikçi Yok (Fabrika İçi Üretim)</SelectItem>
                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label>Rapor Tarihi</Label><Input type="date" value={formData.report_date || ''} onChange={(e) => setFormData(f => ({ ...f, report_date: e.target.value }))} required /></div>
                                    <div><Label>Durum</Label><Select value={formData.status || ''} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Beklemede">Beklemede</SelectItem><SelectItem value="Onaylandı">Onaylandı</SelectItem><SelectItem value="Reddedildi">Reddedildi</SelectItem></SelectContent></Select></div>
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
                                            <table className="w-full border-collapse" style={{ minWidth: '1350px' }}>
                                                <thead>
                                                    <tr className="border-b bg-muted/50">
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground w-12">#</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Karakteristik</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Ekipman</th>
                                                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[220px]">Standart/Sınıf</th>
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
                    <DialogFooter className="mt-4 border-t pt-4 flex-shrink-0">
                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const InkrManagement = ({ onViewPdf }) => {
    const { toast } = useToast();
    const { loading: globalLoading, refreshData } = useData();
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

    const handleEdit = (report) => {
        setSelectedReport(report);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedReport(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('inkr_reports').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Rapor silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'INKR raporu silindi.' });
            const { data, error: fetchError } = await supabase
                .from('inkr_reports')
                .select('*, supplier:supplier_id(name)')
                .order('created_at', { ascending: false });
            if (!fetchError) {
                setInkrReports(data || []);
            }
            refreshData();
        }
    };

    const handleViewRecord = (report) => {
        setSelectedInkrDetail(report);
        setIsDetailModalOpen(true);
    };

    const handleDownloadDetailPDF = (enrichedData) => {
        openPrintableReport(enrichedData, 'inkr_management', true);
    };

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
                const { data, error } = await supabase
                    .from('inkr_reports')
                    .select('*, supplier:supplier_id(name)')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setInkrReports(data || []);
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
                const { data: inspections, error: inspectionsError } = await supabase
                    .from('incoming_inspections_with_supplier')
                    .select('part_code, part_name')
                    .not('part_code', 'is', null)
                    .not('part_code', 'eq', '')
                    .order('part_code');

                if (inspectionsError) throw inspectionsError;

                const uniquePartsMap = new Map();
                (inspections || []).forEach(inspection => {
                    if (inspection.part_code && !uniquePartsMap.has(inspection.part_code)) {
                        uniquePartsMap.set(inspection.part_code, {
                            part_code: inspection.part_code,
                            part_name: inspection.part_name || '-',
                        });
                    }
                });

                const inkrMap = new Map((inkrReports || []).map(r => [r.part_code, r]));

                const partsWithInkrStatus = Array.from(uniquePartsMap.values()).map(part => {
                    const inkrReport = inkrMap.get(part.part_code);
                    return {
                        ...part,
                        hasInkr: !!inkrReport,
                        inkrReport: inkrReport || null,
                    };
                });

                (inkrReports || []).forEach(inkrReport => {
                    if (inkrReport.part_code && !uniquePartsMap.has(inkrReport.part_code)) {
                        partsWithInkrStatus.push({
                            part_code: inkrReport.part_code,
                            part_name: inkrReport.part_name || '-',
                            hasInkr: true,
                            inkrReport: inkrReport,
                        });
                    }
                });

                partsWithInkrStatus.sort((a, b) => {
                    if (a.part_code < b.part_code) return -1;
                    if (a.part_code > b.part_code) return 1;
                    return 0;
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
    }, [inkrReports, inkrReportsLoading, toast]);

    const filteredParts = useMemo(() => {
        let filtered = allParts;

        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(part =>
                part.part_code.toLowerCase().includes(normalizedSearch) ||
                (part.part_name && part.part_name.toLowerCase().includes(normalizedSearch))
            );
        }

        if (inkrStatusFilter === 'Mevcut') {
            filtered = filtered.filter(part => part.hasInkr);
        } else if (inkrStatusFilter === 'Mevcut Değil') {
            filtered = filtered.filter(part => !part.hasInkr);
        }

        return filtered;
    }, [allParts, searchTerm, inkrStatusFilter]);

    return (
        <div className="dashboard-widget">
            <InkrFormModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} existingReport={selectedReport} refreshReports={refreshData} onReportSaved={setInkrReports} />
            <InkrDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                report={selectedInkrDetail}
                onDownloadPDF={handleDownloadDetailPDF}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="search-box w-full sm:w-auto sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Parça kodu veya adı ile ara..."
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
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Parça Kodu</th>
                            <th>Parça Adı</th>
                            <th>INKR Durumu</th>
                            <th>Tedarikçi</th>
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
                                    <td>
                                        {part.hasInkr ? (
                                            <Badge variant="success" className="bg-green-500">Mevcut</Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-red-500">Eksik</Badge>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground">{part.inkrReport?.supplier?.name || '-'}</td>
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
                                                setSelectedReport({ part_code: part.part_code, part_name: part.part_name });
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

export default InkrManagement;
