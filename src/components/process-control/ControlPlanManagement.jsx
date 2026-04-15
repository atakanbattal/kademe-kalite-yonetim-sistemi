import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Search, FilePlus, History, Eye, Minus, ChevronsRight, ArrowLeft, FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    lookupTs9013LimitDeviationMm,
    normalizeLegacyTs9013StandardItem,
    parseNumericNominalMm,
    ts9013QualityClassFromToleranceClass,
} from '@/lib/ts9013LimitDeviations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { parseProcessControlVehicleTypes } from '@/lib/df8dTextUtils';
import { Combobox } from '@/components/ui/combobox';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';
import ControlPlanDetailModal from './ControlPlanDetailModal';
import { Badge } from '@/components/ui/badge';

const NON_DIMENSIONAL_EQUIPMENT_LABELS = [
    "Geçer/Geçmez Mastar", "Karşı Parça ile Deneme", 
    "Fonksiyonel Test", "Manuel Kontrol", "Pürüzlülük Ölçüm Cihazı", 
    "Sertlik Test Cihazı", "Vida Diş Ölçer (Pitch Gauge)", "Gözle Kontrol",
    "Şablon"
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

// TS EN ISO 13920 tolerans tablosu (Kaynaklı yapılar için genel toleranslar)
// Tolerans sınıfları: A (en hassas), B, C, D (en kaba)
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

// Process Control'e özel standartlar (13920 ve 9013 sadece burada)
const STANDARD_OPTIONS = [
    // ISO 2768-1 standartları
    { value: 'ISO 2768-1_f', label: 'ISO 2768-1 f (Fine - İnce)' },
    { value: 'ISO 2768-1_m', label: 'ISO 2768-1 m (Medium - Orta)' },
    { value: 'ISO 2768-1_c', label: 'ISO 2768-1 c (Coarse - Kaba)' },
    { value: 'ISO 2768-1_v', label: 'ISO 2768-1 v (Very Coarse - Çok Kaba)' },
    // TS EN ISO 13920 - Kaynak Toleransları (A, B, C, D sınıfları)
    { value: 'TS 13920_A', label: 'TS 13920 A (En Hassas)' },
    { value: 'TS 13920_B', label: 'TS 13920 B (Hassas)' },
    { value: 'TS 13920_C', label: 'TS 13920 C (Normal)' },
    { value: 'TS 13920_D', label: 'TS 13920 D (Kaba)' },
    // TS EN ISO 9013: Sınıf 1 / Sınıf 2 tabloları (sac kalınlığı × anma boyutu)
    { value: 'TS 9013_S1', label: 'TS 9013 Sınıf 1' },
    { value: 'TS 9013_S2', label: 'TS 9013 Sınıf 2' },
];

const ControlPlanItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
    const isDimensional = equipment?.find(e => e.value === item.equipment_id) && 
                          !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(equipment.find(e => e.value === item.equipment_id)?.label || '');

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
            if (!tolerance_class) {
                return { ...currentItem };
            }
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
                max_value: parseFloat(max.toPrecision(10)).toString()
            };
        }

        if (!tolerance_class) {
            return { ...currentItem };
        }

        let toleranceTable = null;
        if (standard_class.startsWith('TS 13920')) {
            toleranceTable = TS_13920_TOLERANCES;
        } else if (standard_class.startsWith('ISO 2768-1')) {
            toleranceTable = ISO_2768_1_TOLERANCES;
        } else {
            toleranceTable = ISO_2768_1_TOLERANCES;
        }

        const toleranceRule = toleranceTable.linear.find(
            rule => nominal >= rule.range[0] && nominal < rule.range[1]
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
                // Tüm standartlar için aynı işlem: value formatı "STANDART_SINIF" şeklinde
                // Örn: "ISO 2768-1_f", "TS 13920_A", "TS 9013_S1"
                const parts = value.split('_');
                const toleranceClass = parts.pop(); // Son kısım tolerans sınıfı
                const standardName = parts.join('_'); // Geri kalan standart adı
                
                // ISO 2768-1 için standard_id'yi bul (tolerance_standards tablosundan)
                let standardId = null;
                if (standardName.startsWith('ISO 2768-1') && standards) {
                    const standard = standards.find(s => s.label.startsWith('ISO 2768-1'));
                    standardId = standard ? standard.value : null;
                }
                
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
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: null, sheet_thickness_mm: '' };
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
            if(selectedCharacteristic) {
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

    const isTs9013 = item.standard_class?.startsWith('TS 9013');

    return (
        <tr className="border-b transition-colors hover:bg-muted/50 text-sm">
            <td className="p-2 align-top text-center font-medium">{index + 1}</td>
            <td className="p-2 align-top min-w-[180px]">
                <Combobox options={characteristics || []} value={item.characteristic_id} onChange={(v) => handleFieldChange('characteristic_id', v)} placeholder="Karakteristik seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." />
            </td>
            <td className="p-2 align-top min-w-[180px]">
                <Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı."/>
            </td>
            <td className="p-2 align-top min-w-[200px]">
                <div className="space-y-1">
                    <Combobox 
                        options={STANDARD_OPTIONS} 
                        value={item.standard_class || ''} 
                        onChange={(v) => handleFieldChange('standard_class', v)} 
                        placeholder="Standart seçin..." 
                        searchPlaceholder="Ara..." 
                        notFoundText="Bulunamadı." 
                        disabled={!isDimensional}
                    />
                </div>
            </td>
            <td className="p-2 align-top min-w-[110px]">
                <Input
                    type="text"
                    inputMode="decimal"
                    title={isTs9013 ? 'TS 9013 için iş parçası / sac kalınlığı (mm)' : undefined}
                    placeholder={isTs9013 ? 'mm' : '—'}
                    value={item.sheet_thickness_mm ?? ''}
                    onChange={(e) => handleFieldChange('sheet_thickness_mm', e.target.value)}
                    disabled={!isDimensional || !isTs9013}
                    className={!isTs9013 ? 'opacity-60' : ''}
                />
            </td>
            <td className="p-2 align-top min-w-[120px]">
                <Input 
                    type="text" 
                    placeholder={isTs9013 ? 'Sayısal boyut: 158 veya Ø158' : 'Örn: M8, 15.5, OK'} 
                    value={item.nominal_value || ''} 
                    onChange={(e) => handleFieldChange('nominal_value', e.target.value)} 
                    maxLength="50"
                />
            </td>
            <td className="p-2 align-top min-w-[100px]">
              <Combobox 
                options={[{value: '±', label: '±'}, {value: '+', label: '+'}, {value: '-', label: '-'}]} 
                value={item.tolerance_direction} 
                onChange={(v) => handleFieldChange('tolerance_direction', v)} 
                placeholder="Yön" 
                disabled={!isDimensional}
              />
            </td>
            <td className="p-2 align-top min-w-[100px]">
                <Input type="text" inputMode="decimal" placeholder="Min" value={item.min_value ?? ''} onChange={(e) => handleFieldChange('min_value', e.target.value)} disabled={!isDimensional}/>
            </td>
            <td className="p-2 align-top min-w-[100px]">
                <Input type="text" inputMode="decimal" placeholder="Max" value={item.max_value ?? ''} onChange={(e) => handleFieldChange('max_value', e.target.value)} disabled={!isDimensional}/>
            </td>
            <td className="p-2 align-top text-center">
                <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => onUpdate(index, null)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </td>
        </tr>
    );
};

/** Parça kodu — DB ile aynı normalizasyon (handleSubmit ile uyumlu) */
const normalizePartCodeForPlan = (text) => {
    if (!text || typeof text !== 'string') return '';
    return String(text)
        .normalize('NFC')
        .replace(/\u0131/g, 'ı')
        .replace(/\u0130/g, 'İ')
        .replace(/\u0069\u0307/g, 'i')
        .replace(/\u0049\u0307/g, 'İ')
        .trim();
};

const ControlPlanManagement = ({ equipment, plans, loading, refreshPlans, refreshEquipment }) => {
    const { toast } = useToast();
    const { characteristics, equipment: measurementEquipment, standards, products, productCategories, refreshEquipment: refreshMeasurementEquipment } = useData();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [step, setStep] = useState(1);
    /** Birden fazla araç modeli (virgülle birleştirilerek vehicle_type olarak kaydedilir) */
    const [selectedVehicleTypes, setSelectedVehicleTypes] = useState(['']);
    const [partCode, setPartCode] = useState('');
    const [partName, setPartName] = useState('');
    const [characteristicCount, setCharacteristicCount] = useState(5);
    const [items, setItems] = useState([]);
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duplicatePlan, setDuplicatePlan] = useState(null);
    /** Adım 1: bu parça kodu için mevcut plan(lar) — anında uyarı */
    const [partCodeDuplicatePlans, setPartCodeDuplicatePlans] = useState([]);
    /** Parça kodu mevcut planda — planda birleştirilecek ek araç satırları */
    const [inlineMergeVehicleRows, setInlineMergeVehicleRows] = useState(['']);
    const [mergingVehiclesIntoPlan, setMergingVehiclesIntoPlan] = useState(false);
    const partCodeLookupTimerRef = useRef(null);
    const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [revisionNotes, setRevisionNotes] = useState('');

    // Araç tiplerini products tablosundan çek
    const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    const vehicleTypeOptions = (products || [])
        .filter(p => p.category_id === vehicleTypeCategory?.id)
        .map(p => ({
            value: p.product_name,
            label: p.product_name
        }));

    // Sadece araç tiplerini göster (products'tan)
    const equipmentOptions = vehicleTypeOptions;

    useEffect(() => {
        refreshMeasurementEquipment?.();
    }, [refreshMeasurementEquipment]);

    const initialItemState = { 
        id: uuidv4(), 
        characteristic_id: '', 
        characteristic_type: '', 
        equipment_id: '', 
        standard_id: null, 
        tolerance_class: null, 
        nominal_value: '', 
        min_value: null, 
        max_value: null, 
        tolerance_direction: '±', 
        standard_class: '',
        sheet_thickness_mm: '',
    };

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'application/pdf': ['.pdf'] }, 
        maxFiles: 1 
    });

    const updateVehicleTypeRow = (index, value) => {
        setSelectedVehicleTypes((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const addVehicleTypeRow = () => setSelectedVehicleTypes((prev) => [...prev, '']);

    const removeVehicleTypeRow = (index) => {
        setSelectedVehicleTypes((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    };

    useEffect(() => {
        if (!isFormOpen) {
            setStep(1);
            setSelectedVehicleTypes(['']);
            setPartCode('');
            setPartName('');
            setCharacteristicCount(5);
            setItems([]);
            setFile(null);
            setSelectedPlan(null);
            setDuplicatePlan(null);
            setPartCodeDuplicatePlans([]);
            setInlineMergeVehicleRows(['']);
            setRevisionNotes('');
        } else if (selectedPlan) {
            const fromVt = parseProcessControlVehicleTypes(selectedPlan.vehicle_type);
            setSelectedVehicleTypes(fromVt.length > 0 ? fromVt : ['']);
            setPartCode(selectedPlan.part_code || '');
            setPartName(selectedPlan.part_name || '');
            setRevisionNotes(selectedPlan.revision_notes || '');
            const planItems = selectedPlan.items || [];
            setCharacteristicCount(planItems.length || 1);
            const loadedItems = planItems.map((raw) => {
                const item = normalizeLegacyTs9013StandardItem(raw);
                return {
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
                sheet_thickness_mm: item.sheet_thickness_mm !== undefined && item.sheet_thickness_mm !== null ? String(item.sheet_thickness_mm) : '',
            };
            });
            setItems(loadedItems);
            setStep(2);
        }
    }, [isFormOpen, selectedPlan]);

    // Yeni plan — adım 1: parça kodu girildiğinde mevcut kontrol planı var mı?
    useEffect(() => {
        if (partCodeLookupTimerRef.current) {
            clearTimeout(partCodeLookupTimerRef.current);
            partCodeLookupTimerRef.current = null;
        }
        if (!isFormOpen || selectedPlan || step !== 1) {
            setPartCodeDuplicatePlans([]);
            return;
        }
        const code = normalizePartCodeForPlan(partCode);
        if (!code) {
            setPartCodeDuplicatePlans([]);
            return;
        }
        partCodeLookupTimerRef.current = setTimeout(async () => {
            partCodeLookupTimerRef.current = null;
            const { data, error } = await supabase
                .from('process_control_plans')
                .select('id, part_code, part_name, vehicle_type, revision_number, plan_name')
                .eq('part_code', code);
            if (error) {
                console.warn('Parça kodu kontrol planı sorgusu:', error);
                setPartCodeDuplicatePlans([]);
                return;
            }
            setPartCodeDuplicatePlans(data?.length ? data : []);
        }, 450);
        return () => {
            if (partCodeLookupTimerRef.current) {
                clearTimeout(partCodeLookupTimerRef.current);
                partCodeLookupTimerRef.current = null;
            }
        };
    }, [isFormOpen, selectedPlan, step, partCode]);

    const handleNextStep = async () => {
        const chosenVehicles = selectedVehicleTypes
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean);
        if (chosenVehicles.length === 0) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen en az bir araç modeli seçin.' });
            return;
        }
        if (new Set(chosenVehicles).size !== chosenVehicles.length) {
            toast({ variant: 'destructive', title: 'Mükerrer', description: 'Aynı araç modelini iki kez seçemezsiniz.' });
            return;
        }

        if (!partCode || !partName) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen parça kodu ve adını girin.' });
            return;
        }

        const normalizedPartCode = normalizePartCodeForPlan(partCode);

        const { data: samePartPlans, error } = await supabase
            .from('process_control_plans')
            .select('*')
            .eq('part_code', normalizedPartCode);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kontrol planı kontrol edilirken bir hata oluştu: ${error.message}` });
            return;
        }

        for (const p of samePartPlans || []) {
            if (selectedPlan?.id && p.id === selectedPlan.id) continue;
            const existingVehicles = parseProcessControlVehicleTypes(p.vehicle_type);
            // Eski kayıtlarda vehicle_type boş olabilir; çakışma: bu parça için zaten plan var
            if (existingVehicles.length === 0) {
                setDuplicatePlan({
                    plan: p,
                    overlappingVehicles: [...chosenVehicles],
                    legacyNoVehicle: true,
                });
                return;
            }
            const overlapping = chosenVehicles.filter((v) => existingVehicles.includes(v));
            if (overlapping.length > 0) {
                setDuplicatePlan({ plan: p, overlappingVehicles: overlapping, legacyNoVehicle: false });
                return;
            }
        }

        setItems(Array.from({ length: characteristicCount }, () => ({ ...initialItemState, id: uuidv4() })));
        setStep(2);
    };

    const handleItemUpdate = (index, updatedItem) => {
        const newItems = [...items];
        if (updatedItem === null) {
            newItems.splice(index, 1);
        } else {
            newItems[index] = updatedItem;
        }
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Türkçe karakterleri korumak için veriyi normalize et
            const normalizeTurkishChars = (text) => {
                if (!text) return null;
                // Input'tan gelen veriyi UTF-8 olarak işle
                const normalized = String(text)
                    .normalize('NFC') // Unicode normalization
                    .replace(/\u0131/g, 'ı') // dotless i
                    .replace(/\u0130/g, 'İ') // dotted I
                    .replace(/\u0069\u0307/g, 'i') // i with combining dot
                    .replace(/\u0049\u0307/g, 'İ'); // I with combining dot
                
                return normalized;
            };
            
            // Parça adı ve kodunu normalize et (kod, sorgu ile aynı anahtar)
            const normalizedPartName = normalizeTurkishChars(partName);
            const normalizedPartCode = normalizePartCodeForPlan(partCode) || null;
            
            console.log('💾 Kaydedilecek veri:', {
                original_part_name: partName,
                normalized_part_name: normalizedPartName,
                original_part_code: partCode,
                normalized_part_code: normalizedPartCode
            });
            // Validasyon: Tüm karakteristikler seçilmeli ve equipment_id seçilmeli
            const validationError = items.some(item => {
                if (!item.characteristic_id || !item.characteristic_type) {
                    return true; // Karakteristik seçilmemiş
                }
                if (!item.equipment_id || item.equipment_id.trim() === '') {
                    return true; // Ölçüm ekipmanı seçilmemiş
                }
                const selectedEquipment = measurementEquipment?.find(eq => eq.value === item.equipment_id);
                const isDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
                if (isDimensional && item.min_value && item.max_value && parseFloat(String(item.min_value).replace(',', '.')) > parseFloat(String(item.max_value).replace(',', '.'))) {
                    return true; // Min > Max
                }
                if (isDimensional && item.standard_class?.startsWith('TS 9013')) {
                    const t = parseFloat(String(item.sheet_thickness_mm ?? '').replace(',', '.'));
                    const nom = parseNumericNominalMm(item.nominal_value);
                    const q = ts9013QualityClassFromToleranceClass(item.tolerance_class);
                    if (isNaN(t) || t <= 0 || isNaN(nom) || !q) return true;
                    if (lookupTs9013LimitDeviationMm(t, nom, q) === null) return true;
                }
                return false;
            });

            if (validationError) {
                toast({ variant: 'destructive', title: 'Validasyon Hatası', description: 'Lütfen tüm karakteristikleri ve ölçüm ekipmanlarını seçin. TS 9013 için Sınıf 1 veya 2, sac kalınlığı (mm) ve sayısal nominal boyut zorunludur; kombinasyon tabloda tanımlı olmalıdır. Min toleransın Max toleranstan büyük olmadığından emin olun.' });
                setIsSubmitting(false);
                return;
            }
            
            let filePath = selectedPlan?.file_path;
            let fileName = selectedPlan?.file_name;

            if (file) {
                const sanitizedName = sanitizeFileName(file.name);
                const newFilePath = `control_plans/${uuidv4()}-${sanitizedName}`;
                const { error: uploadError } = await supabase.storage.from('process_control').upload(newFilePath, file);
                if (uploadError) {
                    toast({ variant: 'destructive', title: 'Hata!', description: `Dosya yüklenemedi: ${uploadError.message}` });
                    setIsSubmitting(false);
                    return;
                }
                filePath = newFilePath;
                fileName = sanitizedName;
            }

            const itemsToSave = items.map((item) => {
                const selectedEquipment = measurementEquipment?.find(eq => eq.value === item.equipment_id);
                const isDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
                const characteristic = characteristics?.find(c => c.value === item.characteristic_id);

                let finalCharacteristicType = item.characteristic_type;
                if (!finalCharacteristicType && characteristic) {
                    finalCharacteristicType = characteristic.type;
                }
                if (!finalCharacteristicType) {
                    finalCharacteristicType = 'Bilinmiyor';
                }
            
                // equipment_id boşsa null gönder
                const equipmentId = item.equipment_id && item.equipment_id.trim() !== '' ? item.equipment_id : null;
                
                return {
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id || null,
                    characteristic_type: finalCharacteristicType,
                    equipment_id: equipmentId,
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || null,
                    nominal_value: item.nominal_value || null,
                    min_value: item.min_value !== undefined && item.min_value !== null && item.min_value !== '' ? String(item.min_value) : null,
                    max_value: item.max_value !== undefined && item.max_value !== null && item.max_value !== '' ? String(item.max_value) : null,
                    tolerance_direction: item.tolerance_direction || '±',
                    sheet_thickness_mm:
                        item.standard_class?.startsWith('TS 9013') && item.sheet_thickness_mm !== undefined && item.sheet_thickness_mm !== null && String(item.sheet_thickness_mm).trim() !== ''
                            ? String(item.sheet_thickness_mm).replace(',', '.')
                            : null,
                };
            });

            const chosenVehicles = selectedVehicleTypes.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
            if (chosenVehicles.length === 0) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen en az bir araç modeli seçin.' });
                setIsSubmitting(false);
                return;
            }
            if (new Set(chosenVehicles).size !== chosenVehicles.length) {
                toast({ variant: 'destructive', title: 'Mükerrer', description: 'Aynı araç modeli iki kez seçilemez.' });
                setIsSubmitting(false);
                return;
            }
            const vehicleTypeStored = chosenVehicles.join(', ');

            // Plan adını otomatik oluştur: Parça Kodu - Araç modelleri
            const autoPlanName = `${normalizedPartCode} - ${vehicleTypeStored}`;
            
            // Plan verilerini hazırla - sadece geçerli alanları ekle
            const planData = {
                equipment_id: null, // vehicle_type kullanıldığında null
                vehicle_type: vehicleTypeStored || null, // Birden fazla araç virgülle
                plan_name: autoPlanName || `${normalizedPartCode} - ${vehicleTypeStored}`,
                part_code: normalizedPartCode || null,
                part_name: normalizedPartName || null,
                items: itemsToSave || [],
                file_path: filePath || null,
                file_name: fileName || null,
                revision_number: selectedPlan?.revision_number || 0,
                revision_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            
            // revision_notes sadece revizyon modunda ve değer varsa ekle
            // NOT: Veritabanında revision_notes sütunu yoksa bu alan gönderilmez
            if (revisionNotes && revisionNotes.trim() !== '') {
                planData.revision_notes = revisionNotes;
            }
            
            // Undefined değerleri temizle (Supabase'e göndermeden önce)
            Object.keys(planData).forEach(key => {
                if (planData[key] === undefined) {
                    delete planData[key];
                }
            });

            let savedData, error;
            if (selectedPlan) {
                const { data, error: updateError } = await supabase.from('process_control_plans').update(planData).eq('id', selectedPlan.id).select().single();
                savedData = data;
                error = updateError;
            } else {
                const { data, error: insertError } = await supabase.from('process_control_plans').insert(planData).select().single();
                savedData = data;
                error = insertError;
            }

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Kontrol planı kaydedilemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Kontrol planı başarıyla kaydedildi.` });
                refreshPlans();
                setIsFormOpen(false);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenForm = (plan = null) => {
        setSelectedPlan(plan);
        setIsFormOpen(true);
    };

    const handleDuplicateAction = (action) => {
        const conflict = duplicatePlan?.plan || duplicatePlan;
        if (action === 'edit') {
            setSelectedPlan(conflict || null);
            setIsFormOpen(true);
        } else if (action === 'revise') {
            const newRevisionNumber = (conflict?.revision_number || 0) + 1;
            setSelectedPlan(conflict ? { ...conflict, revision_number: newRevisionNumber } : null);
            setIsFormOpen(true);
        } else if (action === 'addVehicle') {
            setSelectedVehicleTypes((prev) => [...prev, '']);
        }
        setDuplicatePlan(null);
    };

    /** Liste (props) + API: parça kodu uyarısı anında gösterilsin */
    const mergedDuplicatePlansForPart = useMemo(() => {
        const code = normalizePartCodeForPlan(partCode);
        if (!code || selectedPlan || step !== 1) return [];
        const fromList = (plans || []).filter(
            (p) => normalizePartCodeForPlan(p.part_code || '') === code
        );
        const map = new Map();
        fromList.forEach((p) => map.set(p.id, p));
        partCodeDuplicatePlans.forEach((p) => map.set(p.id, p));
        return [...map.values()];
    }, [plans, partCode, partCodeDuplicatePlans, selectedPlan, step]);

    const registeredVehiclesForPart = useMemo(() => {
        const set = new Set();
        mergedDuplicatePlansForPart.forEach((p) => {
            parseProcessControlVehicleTypes(p.vehicle_type).forEach((v) => set.add(v));
        });
        return [...set];
    }, [mergedDuplicatePlansForPart]);

    /** Aynı parça için birden fazla satır varsa en yüksek revizyona araç eklenir */
    const primaryPlanSummaryForMerge = useMemo(() => {
        if (!mergedDuplicatePlansForPart.length) return null;
        return [...mergedDuplicatePlansForPart].sort(
            (a, b) => (b.revision_number ?? 0) - (a.revision_number ?? 0)
        )[0];
    }, [mergedDuplicatePlansForPart]);

    const resolvePlanFromCache = useCallback(
        (summary) => {
            if (!summary?.id) return summary;
            return (plans || []).find((p) => p.id === summary.id) || summary;
        },
        [plans]
    );

    const handleOpenPlanEditor = useCallback(
        (planSummary) => {
            setSelectedPlan(resolvePlanFromCache(planSummary));
            setIsFormOpen(true);
        },
        [resolvePlanFromCache]
    );

    /** Birincil (güncellenecek) planda zaten olan araçlar — eklenebilecek modeller buna göre filtrelenir */
    const vehiclesOnPrimaryPlan = useMemo(() => {
        if (!primaryPlanSummaryForMerge) return [];
        return parseProcessControlVehicleTypes(primaryPlanSummaryForMerge.vehicle_type);
    }, [primaryPlanSummaryForMerge]);

    const vehicleOptionsNotOnPlan = useMemo(() => {
        const reg = new Set(vehiclesOnPrimaryPlan);
        return equipmentOptions.filter((o) => o.value && !reg.has(o.value));
    }, [equipmentOptions, vehiclesOnPrimaryPlan]);

    const updateInlineMergeRow = useCallback((index, value) => {
        setInlineMergeVehicleRows((prev) => {
            const next = [...prev];
            next[index] = value || '';
            return next;
        });
    }, []);

    const mergeVehiclesIntoPrimaryPlan = async () => {
        const chosen = inlineMergeVehicleRows.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
        if (!primaryPlanSummaryForMerge?.id) {
            toast({
                variant: 'destructive',
                title: 'Plan bulunamadı',
                description: 'Araç eklemek için geçerli bir kontrol planı gerekli.',
            });
            return;
        }
        if (chosen.length === 0) {
            toast({ variant: 'destructive', title: 'Araç seçin', description: 'Plana eklenecek en az bir araç modeli seçin.' });
            return;
        }
        if (new Set(chosen).size !== chosen.length) {
            toast({ variant: 'destructive', title: 'Tekrarlanan seçim', description: 'Aynı araç modelini iki kez seçemezsiniz.' });
            return;
        }
        const existingOnPrimary = parseProcessControlVehicleTypes(primaryPlanSummaryForMerge.vehicle_type);
        const overlap = chosen.filter((v) => existingOnPrimary.includes(v));
        if (overlap.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Zaten bu planda',
                description: `Şu araçlar seçilen revizyonda kayıtlı: ${overlap.join(', ')}`,
            });
            return;
        }

        const merged = [...existingOnPrimary, ...chosen];
        const vehicleTypeStored = merged.join(', ');
        const npc = normalizePartCodeForPlan(partCode);
        const autoPlanName = `${npc} - ${vehicleTypeStored}`;

        setMergingVehiclesIntoPlan(true);
        try {
            const { error } = await supabase
                .from('process_control_plans')
                .update({
                    vehicle_type: vehicleTypeStored,
                    plan_name: autoPlanName,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', primaryPlanSummaryForMerge.id);

            if (error) {
                toast({ variant: 'destructive', title: 'Kaydedilemedi', description: error.message });
                return;
            }
            toast({
                title: 'Araçlar güncellendi',
                description: `${chosen.join(', ')} kontrol planına eklendi (Rev. ${primaryPlanSummaryForMerge.revision_number ?? 0}).`,
            });
            setInlineMergeVehicleRows(['']);
            refreshPlans?.();
            const { data: refreshed } = await supabase
                .from('process_control_plans')
                .select('id, part_code, part_name, vehicle_type, revision_number, plan_name')
                .eq('part_code', npc);
            setPartCodeDuplicatePlans(refreshed?.length ? refreshed : []);
        } finally {
            setMergingVehiclesIntoPlan(false);
        }
    };

    /** Parça adı boşken listedeki kayıttan öner */
    useEffect(() => {
        if (!isFormOpen || selectedPlan || step !== 1) return;
        if (partName.trim()) return;
        const pn = mergedDuplicatePlansForPart.find((p) => p.part_name?.trim())?.part_name;
        if (pn) setPartName(pn);
    }, [isFormOpen, selectedPlan, step, partName, mergedDuplicatePlansForPart]);

    const filteredPlans = plans.filter(plan => {
        const searchLower = searchTerm.toLowerCase();
        return (
            plan.part_code?.toLowerCase().includes(searchLower) ||
            plan.part_name?.toLowerCase().includes(searchLower) ||
            plan.vehicle_type?.toLowerCase().includes(searchLower) ||
            plan.process_control_equipment?.equipment_name?.toLowerCase().includes(searchLower)
        );
    });

    const handleViewDetail = (plan) => {
        setSelectedPlanDetail(plan);
        setIsDetailModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('process_control_plans').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Plan silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kontrol planı silindi.' });
            refreshPlans();
        }
    };

    const handleDownloadDetailPDF = (planData) => {
        // Veritabanından gelen veriyi kontrol et ve encoding sorununu düzelt
        console.log('📄 Rapor için veri:', {
            part_name: planData.part_name,
            part_name_type: typeof planData.part_name,
            part_name_length: planData.part_name?.length,
            part_name_bytes: planData.part_name ? new TextEncoder().encode(planData.part_name) : null
        });
        
        // Türkçe karakterleri korumak için veriyi normalize et
        const normalizeTurkishChars = (text) => {
            if (!text) return null;
            // Veritabanından gelen veriyi UTF-8 olarak işle
            const normalized = String(text)
                .normalize('NFC') // Unicode normalization
                .replace(/\u0131/g, 'ı') // dotless i
                .replace(/\u0130/g, 'İ') // dotted I
                .replace(/\u0069\u0307/g, 'i') // i with combining dot
                .replace(/\u0049\u0307/g, 'İ'); // I with combining dot
            
            return normalized;
        };
        
        // Karakteristik ve ekipman bilgilerini ekle
        const enrichedData = {
            ...planData,
            part_name: normalizeTurkishChars(planData.part_name) || planData.part_name,
            part_code: normalizeTurkishChars(planData.part_code) || planData.part_code,
            vehicle_type: normalizeTurkishChars(planData.vehicle_type) || planData.vehicle_type,
            items: (planData.items || []).map(item => {
                // Standart bilgisini işle - standard_class varsa onu kullan, yoksa standard_name
                let standardName = null;
                if (item.standard_class) {
                    standardName = item.standard_class; // TS 13920, TS 9013 gibi
                } else if (item.standard_id) {
                    standardName = standards?.find(s => s.value === item.standard_id)?.label || item.standard_id;
                }
                
                return {
                    ...item,
                    characteristic_name: normalizeTurkishChars(characteristics?.find(c => c.value === item.characteristic_id)?.label) || item.characteristic_id,
                    equipment_name: normalizeTurkishChars(measurementEquipment?.find(e => e.value === item.equipment_id)?.label) || item.equipment_id,
                    standard_name: standardName,
                };
            })
        };
        
        console.log('📄 Normalize edilmiş veri:', {
            part_name: enrichedData.part_name,
            part_name_type: typeof enrichedData.part_name
        });
        
        openPrintableReport(enrichedData, 'process_control_plans', true);
    };

    return (
        <div className="space-y-4">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                    {step === 1 && !selectedPlan ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kontrol Planı Oluştur - Adım 1</DialogTitle>
                                <DialogDescription>Planın temel bilgilerini girin.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Araç modelleri (*)</Label>
                                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                                        Aynı parça için birden fazla araç tipi seçebilirsiniz. Satır eklemek için &quot;Araç modeli ekle&quot; kullanın.
                                    </p>
                                    <div className="space-y-2">
                                        {selectedVehicleTypes.map((rowVal, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="flex-1 min-w-0">
                                                    <Combobox
                                                        options={equipmentOptions}
                                                        value={rowVal || null}
                                                        onChange={(v) => updateVehicleTypeRow(idx, v)}
                                                        placeholder="Araç modeli seçin..."
                                                    />
                                                </div>
                                                {selectedVehicleTypes.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 mt-1"
                                                        onClick={() => removeVehicleTypeRow(idx)}
                                                        title="Bu satırı kaldır"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addVehicleTypeRow}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Araç modeli ekle
                                    </Button>
                                </div>
                                <div>
                                    <Label>Parça Kodu (*)</Label>
                                    <Input value={partCode} onChange={(e) => setPartCode(e.target.value)} required autoComplete="off" />
                                    {mergedDuplicatePlansForPart.length > 0 && (
                                        <div className="mt-3 rounded-lg border border-primary/25 bg-muted/50 px-3 py-3 text-sm space-y-3">
                                            <div>
                                                <p className="font-semibold text-foreground flex items-center gap-2">
                                                    Bu parça için kontrol planı zaten var
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Aşağıda kayıtlı araçlar ve plan satırları listelenir. Yalnızca planda olmayan araçları seçerek mevcut plana ekleyebilir veya planı doğrudan düzenleyebilirsiniz.
                                                </p>
                                            </div>
                                            {mergedDuplicatePlansForPart.length > 1 && (
                                                <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 rounded px-2 py-1.5 border border-amber-500/20">
                                                    Bu parça kodu için birden fazla kayıt bulundu. Araç ekleme işlemi <strong>en yüksek revizyon</strong> (Rev.{' '}
                                                    {primaryPlanSummaryForMerge?.revision_number ?? 0}) olan plana uygulanır.
                                                </p>
                                            )}
                                            <ul className="space-y-2">
                                                {mergedDuplicatePlansForPart.slice(0, 8).map((p) => (
                                                    <li
                                                        key={p.id}
                                                        className="rounded-md border border-border/80 bg-background/80 px-2.5 py-2 text-xs flex flex-wrap items-start justify-between gap-2"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-medium text-foreground">
                                                                Rev.{p.revision_number ?? 0}
                                                                {p.plan_name ? ` · ${p.plan_name}` : ''}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {parseProcessControlVehicleTypes(p.vehicle_type).length > 0 ? (
                                                                    parseProcessControlVehicleTypes(p.vehicle_type).map((v) => (
                                                                        <Badge key={v} variant="secondary" className="text-[10px] font-normal">
                                                                            {v}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-muted-foreground italic">Araç atanmamış (eski kayıt)</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="shrink-0 h-8 text-xs gap-1"
                                                            onClick={() => handleOpenPlanEditor(p)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Planı aç
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Planda kayıtlı araçlar (birleşik)</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {registeredVehiclesForPart.length > 0 ? (
                                                        registeredVehiclesForPart.map((v) => (
                                                            <Badge key={v} className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">
                                                                {v}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Henüz araç modeli eklenmemiş.</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pt-1 border-t border-border/60 space-y-2">
                                                <p className="text-xs font-semibold text-foreground">Plana yeni araç ekle</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Sadece yukarıda olmayan modeller listelenir. Birden fazla satır ekleyebilirsiniz.
                                                </p>
                                                <div className="space-y-2">
                                                    {inlineMergeVehicleRows.map((rowVal, idx) => {
                                                        const takenElsewhere = new Set(
                                                            inlineMergeVehicleRows
                                                                .map((x, i) => (i !== idx ? String(x || '').trim() : ''))
                                                                .filter(Boolean)
                                                        );
                                                        const rowOptions = vehicleOptionsNotOnPlan.filter(
                                                            (o) => !takenElsewhere.has(o.value) || o.value === rowVal
                                                        );
                                                        return (
                                                            <div key={`merge-${idx}`} className="flex gap-2 items-start">
                                                                <div className="flex-1 min-w-0">
                                                                    <Combobox
                                                                        options={rowOptions}
                                                                        value={rowVal || null}
                                                                        onChange={(v) => updateInlineMergeRow(idx, v)}
                                                                        placeholder="Eklenecek araç modeli..."
                                                                    />
                                                                </div>
                                                                {inlineMergeVehicleRows.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="shrink-0 mt-1 h-8 w-8"
                                                                        onClick={() =>
                                                                            setInlineMergeVehicleRows((prev) =>
                                                                                prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                                                                            )
                                                                        }
                                                                        title="Satırı kaldır"
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {vehicleOptionsNotOnPlan.length > 0 ? (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setInlineMergeVehicleRows((prev) => [...prev, ''])}
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Araç satırı ekle
                                                        </Button>
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                disabled={mergingVehiclesIntoPlan || vehicleOptionsNotOnPlan.length === 0}
                                                                onClick={mergeVehiclesIntoPrimaryPlan}
                                                            >
                                                                {mergingVehiclesIntoPlan ? (
                                                                    <>
                                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                        Kaydediliyor...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Plus className="h-4 w-4 mr-2" />
                                                                        Seçilen araçları planda birleştir
                                                                    </>
                                                                )}
                                                            </Button>
                                                            {primaryPlanSummaryForMerge?.id && (
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleOpenPlanEditor(primaryPlanSummaryForMerge)
                                                                    }
                                                                >
                                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                                    Plana git (düzenle)
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic py-1">
                                                        Tanımlı tüm araç modelleri bu planda. Yeni model eklemek için önce ürün listesine araç tipi ekleyin veya mevcut planı düzenleyin.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Label>Parça Adı (*)</Label>
                                    <Input value={partName} onChange={(e) => setPartName(e.target.value)} required />
                                </div>
                                <div>
                                    <Label>Kontrol Edilecek Karakteristik Sayısı</Label>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => Math.max(1, p - 1))}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input className="text-center w-24" type="number" min="1" value={characteristicCount} onChange={(e) => setCharacteristicCount(Math.max(1, parseInt(e.target.value) || 1))} />
                                        <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => p + 1)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>İptal</Button>
                                <Button type="button" onClick={handleNextStep}>İleri <ChevronsRight className="h-4 w-4 ml-2" /></Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kontrol Planı - {selectedPlan ? `Düzenle (${partCode})` : 'Adım 2'}</DialogTitle>
                                <DialogDescription>{partName} ({items.length} Karakteristik)</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                {selectedPlan && (
                                    <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label>Parça Kodu (*)</Label>
                                                <Input
                                                    value={partCode}
                                                    onChange={(e) => setPartCode(e.target.value)}
                                                    required
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div>
                                                <Label>Parça Adı (*)</Label>
                                                <Input
                                                    value={partName}
                                                    onChange={(e) => setPartName(e.target.value)}
                                                    required
                                                    className="mt-1"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Araç modelleri (*)</Label>
                                            <div className="space-y-2 mt-1">
                                                {selectedVehicleTypes.map((rowVal, idx) => (
                                                    <div key={idx} className="flex gap-2 items-start">
                                                        <div className="flex-1 min-w-0">
                                                            <Combobox
                                                                options={equipmentOptions}
                                                                value={rowVal || null}
                                                                onChange={(v) => updateVehicleTypeRow(idx, v)}
                                                                placeholder="Araç modeli seçin..."
                                                            />
                                                        </div>
                                                        {selectedVehicleTypes.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="shrink-0 mt-1"
                                                                onClick={() => removeVehicleTypeRow(idx)}
                                                                title="Bu satırı kaldır"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addVehicleTypeRow}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Araç modeli ekle
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <ScrollArea className="h-[70vh] p-1">
                                    {!characteristics || !measurementEquipment || !standards ? (
                                        <div className="flex justify-center items-center h-[60vh]">
                                            <p>Veriler yükleniyor...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b">
                                                            <th className="p-2 text-left w-10">#</th>
                                                            <th className="p-2 text-left">Karakteristik</th>
                                                            <th className="p-2 text-left">Ölçüm Ekipmanı</th>
                                                            <th className="p-2 text-left">Standart</th>
                                                            <th className="p-2 text-left whitespace-nowrap" title="TS EN ISO 9013 için zorunlu">Sac kalınlığı (mm)</th>
                                                            <th className="p-2 text-left">Nominal Değer</th>
                                                            <th className="p-2 text-left">Tol. Yönü</th>
                                                            <th className="p-2 text-left">Min Tolerans</th>
                                                            <th className="p-2 text-left">Max Tolerans</th>
                                                            <th className="p-2 text-left w-16">Sil</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map((item, index) => (
                                                            <ControlPlanItem 
                                                                key={item.id} 
                                                                item={item} 
                                                                index={index} 
                                                                onUpdate={handleItemUpdate} 
                                                                characteristics={characteristics} 
                                                                equipment={measurementEquipment} 
                                                                standards={standards} 
                                                            />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Button type="button" variant="outline" onClick={() => setItems(prev => [...prev, {...initialItemState, id: uuidv4()}])} className="mt-4">
                                                <Plus className="h-4 w-4 mr-2" /> Yeni Madde Ekle
                                            </Button>
                                            {(selectedPlan?.revision_number > 0 || revisionNotes) && (
                                                <div className="mt-4">
                                                    <Label>Revizyon Notları</Label>
                                                    <Textarea 
                                                        placeholder="Revizyon nedeni ve değişiklikler hakkında notlar..."
                                                        value={revisionNotes}
                                                        onChange={(e) => setRevisionNotes(e.target.value)}
                                                        rows={3}
                                                    />
                                                </div>
                                            )}
                                            <div className="mt-4">
                                                <Label>Onaylı Plan (PDF)</Label>
                                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                                    <input {...getInputProps()} />
                                                    {file ? <p className="mt-2 text-sm">{file.name}</p> : <p className="mt-2 text-sm text-muted-foreground">Dosyayı buraya sürükleyin veya seçin</p>}
                                                </div>
                                                {(selectedPlan?.file_name && !file) && <p className="text-sm text-muted-foreground mt-2">Mevcut dosya: {selectedPlan.file_name}</p>}
                                            </div>
                                        </>
                                    )}
                                </ScrollArea>
                                <DialogFooter className="mt-4 pt-4 border-t">
                                    {!selectedPlan && <Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>}
                                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!duplicatePlan} onOpenChange={() => setDuplicatePlan(null)}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mükerrer Kontrol Planı</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-sm text-muted-foreground space-y-2 pt-1">
                                <p>
                                    Parça kodu{' '}
                                    <strong className="text-foreground">{duplicatePlan?.plan?.part_code || duplicatePlan?.part_code}</strong>{' '}
                                    için seçtiğiniz araç modellerinden en az biri, mevcut bir kontrol planında zaten tanımlı
                                    (Rev.{' '}
                                    {duplicatePlan?.plan?.revision_number ?? duplicatePlan?.revision_number}
                                    ).
                                </p>
                                {(duplicatePlan?.overlappingVehicles?.length > 0 || duplicatePlan?.legacyNoVehicle) && (
                                    <p>
                                        {duplicatePlan?.legacyNoVehicle ? (
                                            <>
                                                Eski kayıtta araç modeli boş; bu parça için plan zaten tanımlı kabul edilir.
                                            </>
                                        ) : (
                                            <>
                                                Çakışan araç(lar):{' '}
                                                <strong className="text-foreground">{duplicatePlan.overlappingVehicles.join(', ')}</strong>
                                            </>
                                        )}
                                    </p>
                                )}
                                <p>
                                    Farklı araç ekleyerek devam edebilir, mevcut planı düzenleyebilir veya yeni revizyon oluşturabilirsiniz.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <AlertDialogCancel className="mt-0">İptal</AlertDialogCancel>
                        <Button type="button" variant="secondary" onClick={() => handleDuplicateAction('addVehicle')}>
                            <Plus className="h-4 w-4 mr-2" />
                            Araç modeli ekle
                        </Button>
                        <AlertDialogAction onClick={() => handleDuplicateAction('edit')}>Mevcut Planı Düzenle</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDuplicateAction('revise')}>Yeni Revizyon Oluştur</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="search-box w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Parça kodu, parça adı veya araç ile ara..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenForm()} className="w-full shrink-0 sm:w-auto">
                    <FilePlus className="w-4 h-4 mr-2" /> Yeni Plan
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Araç
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                    Parça Kodu
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[12rem]">
                                    Parça Adı
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-24">
                                    Rev. No
                                </th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">
                                    Ölçüm Sayısı
                                </th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[11.5rem]">
                                    İşlemler
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="px-4 py-10 text-center text-muted-foreground">Yükleniyor...</td>
                            </tr>
                        ) : filteredPlans.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-4 py-10 text-center text-muted-foreground">Kontrol planı bulunamadı.</td>
                            </tr>
                        ) : (
                            filteredPlans.map((plan) => (
                                <tr key={plan.id} className="transition-colors hover:bg-muted/40">
                                    <td className="px-4 py-3 align-middle text-foreground/90">
                                        {plan.vehicle_type || plan.process_control_equipment?.equipment_name || '-'}
                                    </td>
                                    <td className="px-4 py-3 align-middle font-medium tabular-nums text-foreground whitespace-nowrap">
                                        {plan.part_code}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-foreground/90 max-w-[20rem] sm:max-w-md break-words">
                                        {plan.part_name}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-muted-foreground whitespace-nowrap">
                                        Rev.{plan.revision_number || 0}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-center tabular-nums text-foreground/90">
                                        {(plan.items || []).length}
                                    </td>
                                    <td className="px-2 py-2 align-middle">
                                        <div
                                            className="flex flex-nowrap items-center justify-end gap-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => handleViewDetail(plan)} title="Detayları Görüntüle">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => handleDownloadDetailPDF(plan)} title="Rapor Al">
                                                <FileSpreadsheet className="h-4 w-4" />
                                            </Button>
                                            {plan.file_path && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => {
                                                    supabase.storage.from('process_control').createSignedUrl(plan.file_path, 3600).then(({ data }) => {
                                                        if (data) window.open(data.signedUrl, '_blank');
                                                    });
                                                }} title="PDF Dosyasını Görüntüle">
                                                    <FilePlus className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => {
                                                setSelectedPlan(plan);
                                                setIsFormOpen(true);
                                            }} title="Düzenle">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => {
                                                const newRevisionNumber = (plan.revision_number || 0) + 1;
                                                setSelectedPlan({ ...plan, revision_number: newRevisionNumber });
                                                setIsFormOpen(true);
                                            }} title="Revize Et">
                                                <History className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                                if (confirm('Bu kontrol planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                                                    handleDelete(plan.id);
                                                }
                                            }} title="Sil">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detay Modal */}
            {isDetailModalOpen && (
                <ControlPlanDetailModal
                    isOpen={isDetailModalOpen}
                    setIsOpen={setIsDetailModalOpen}
                    plan={selectedPlanDetail}
                    onDownloadPDF={handleDownloadDetailPDF}
                />
            )}
        </div>
    );
};

export default ControlPlanManagement;

