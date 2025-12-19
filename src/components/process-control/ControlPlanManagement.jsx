import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, FilePlus, History, Eye, Minus, ChevronsRight, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';
import ControlPlanDetailModal from './ControlPlanDetailModal';

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

// TS EN ISO 13920 tolerans tablosu (Kaynaklı yapılar için genel toleranslar)
// Tolerans sınıfları: A (en hassas), B, C, D (en kaba)
const TS_13920_TOLERANCES = {
    linear: [
        { range: [0, 30], A: 1.0, B: 2.0, C: 3.0, D: 4.0 },
        { range: [30, 120], A: 1.0, B: 2.0, C: 4.0, D: 6.0 },
        { range: [120, 400], A: 1.5, B: 3.0, C: 6.0, D: 10.0 },
        { range: [400, 1000], A: 2.0, B: 4.0, C: 8.0, D: 14.0 },
        { range: [1000, 2000], A: 3.0, B: 6.0, C: 11.0, D: 18.0 },
        { range: [2000, 4000], A: 4.0, B: 8.0, C: 14.0, D: 24.0 },
        { range: [4000, 8000], A: 5.0, B: 10.0, C: 18.0, D: 32.0 },
        { range: [8000, 12000], A: 6.0, B: 12.0, C: 22.0, D: 40.0 },
        { range: [12000, 16000], A: 7.0, B: 14.0, C: 26.0, D: 50.0 },
        { range: [16000, 20000], A: 8.0, B: 16.0, C: 30.0, D: 60.0 }
    ]
};

// TS EN ISO 9013 tolerans tablosu (Isıl kesim toleransları)
// Boyut toleransları (kesim uzunluğuna göre)
// Range sınıfları: 1 (en hassas), 2, 3, 4 (en kaba)
const TS_9013_TOLERANCES = {
    linear: [
        { range: [0, 30], '1': 0.5, '2': 1.0, '3': 1.5, '4': 2.5 },
        { range: [30, 120], '1': 1.0, '2': 1.5, '3': 2.5, '4': 4.0 },
        { range: [120, 315], '1': 1.5, '2': 2.0, '3': 3.5, '4': 6.0 },
        { range: [315, 1000], '1': 2.0, '2': 3.0, '3': 5.0, '4': 8.0 },
        { range: [1000, 2000], '1': 2.5, '2': 4.0, '3': 6.5, '4': 10.0 },
        { range: [2000, 4000], '1': 3.5, '2': 5.5, '3': 9.0, '4': 14.0 },
        { range: [4000, 8000], '1': 5.0, '2': 8.0, '3': 12.0, '4': 20.0 },
        { range: [8000, 12000], '1': 7.0, '2': 10.0, '3': 16.0, '4': 26.0 }
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
    // TS EN ISO 9013 - Isıl Kesim Toleransları (Range 1, 2, 3, 4)
    { value: 'TS 9013_1', label: 'TS 9013 Range 1 (En Hassas)' },
    { value: 'TS 9013_2', label: 'TS 9013 Range 2 (Hassas)' },
    { value: 'TS 9013_3', label: 'TS 9013 Range 3 (Normal)' },
    { value: 'TS 9013_4', label: 'TS 9013 Range 4 (Kaba)' },
];

const ControlPlanItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
    const isDimensional = equipment?.find(e => e.value === item.equipment_id) && 
                          !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(equipment.find(e => e.value === item.equipment_id)?.label || '');

    const autoCalculateTolerance = useCallback((currentItem) => {
        const { nominal_value, tolerance_class, tolerance_direction, standard_class } = currentItem;
        
        if (!isDimensional || !nominal_value || !tolerance_class || !standard_class) {
            return { ...currentItem };
        }

        const nominal = parseFloat(String(nominal_value).replace(',', '.'));
        if (isNaN(nominal)) {
             return { ...currentItem };
        }

        // Standarta göre tolerans tablosunu seç
        // standard_class formatı: "ISO 2768-1_f", "TS 13920_A", "TS 9013_1"
        let toleranceTable = null;
        if (standard_class.startsWith('TS 13920')) {
            toleranceTable = TS_13920_TOLERANCES;
        } else if (standard_class.startsWith('TS 9013')) {
            toleranceTable = TS_9013_TOLERANCES;
        } else if (standard_class.startsWith('ISO 2768-1')) {
            toleranceTable = ISO_2768_1_TOLERANCES;
        } else {
            // Varsayılan olarak ISO 2768-1 kullan
            toleranceTable = ISO_2768_1_TOLERANCES;
        }

        // Nominal değere göre tolerans kuralını bul
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
                // Örn: "ISO 2768-1_f", "TS 13920_A", "TS 9013_1"
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
                    standard_class: value 
                };
                const calculatedItem = autoCalculateTolerance(newItem);
                onUpdate(index, calculatedItem);
                return;
            } else {
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: null };
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
            if(selectedCharacteristic) {
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
            <td className="p-2 align-top min-w-[120px]">
                <Input 
                    type="text" 
                    placeholder="Örn: M8, 15.5, OK" 
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

const ControlPlanManagement = ({ equipment, plans, loading, refreshPlans, refreshEquipment }) => {
    const { toast } = useToast();
    const { characteristics, equipment: measurementEquipment, standards, products, productCategories } = useData();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [step, setStep] = useState(1);
    const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
    const [partCode, setPartCode] = useState('');
    const [partName, setPartName] = useState('');
    const [characteristicCount, setCharacteristicCount] = useState(5);
    const [items, setItems] = useState([]);
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duplicatePlan, setDuplicatePlan] = useState(null);
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
        standard_class: '' 
    };

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'application/pdf': ['.pdf'] }, 
        maxFiles: 1 
    });

    useEffect(() => {
        if (!isFormOpen) {
            setStep(1);
            setSelectedEquipmentId(null);
            setPartCode('');
            setPartName('');
            setCharacteristicCount(5);
            setItems([]);
            setFile(null);
            setSelectedPlan(null);
            setDuplicatePlan(null);
            setRevisionNotes('');
        } else if (selectedPlan) {
            setSelectedEquipmentId(selectedPlan.vehicle_type || selectedPlan.equipment_id);
            setPartCode(selectedPlan.part_code || '');
            setPartName(selectedPlan.part_name || '');
            setRevisionNotes(selectedPlan.revision_notes || '');
            const planItems = selectedPlan.items || [];
            setCharacteristicCount(planItems.length || 1);
            const loadedItems = planItems.map((item) => ({
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
                tolerance_direction: item.tolerance_direction || '±'
            }));
            setItems(loadedItems);
            setStep(2);
        }
    }, [isFormOpen, selectedPlan]);

    const handleNextStep = async () => {
        if (!selectedEquipmentId) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen araç seçin.' });
            return;
        }

        if (!partCode || !partName) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen parça kodu ve adını girin.' });
            return;
        }

        // selectedEquipmentId artık vehicle_type (araç tipi adı)
        const { data: existing, error } = await supabase
            .from('process_control_plans')
            .select('*')
            .eq('vehicle_type', selectedEquipmentId)
            .eq('part_code', partCode)
            .order('revision_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kontrol planı kontrol edilirken bir hata oluştu: ${error.message}` });
            return;
        }
        
        if (existing && !selectedPlan) {
            setDuplicatePlan(existing);
            return;
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
            
            // Parça adı ve kodunu normalize et
            const normalizedPartName = normalizeTurkishChars(partName);
            const normalizedPartCode = normalizeTurkishChars(partCode);
            
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
                return false;
            });

            if (validationError) {
                toast({ variant: 'destructive', title: 'Validasyon Hatası', description: 'Lütfen tüm karakteristikleri ve ölçüm ekipmanlarını seçin. Min toleransın Max toleranstan büyük olmadığından emin olun.' });
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
                };
            });

            // Plan adını otomatik oluştur: Parça Kodu - Araç Tipi
            const autoPlanName = `${partCode} - ${selectedEquipmentId}`;
            
            // Plan verilerini hazırla - sadece geçerli alanları ekle
            const planData = {
                equipment_id: null, // vehicle_type kullanıldığında null
                vehicle_type: selectedEquipmentId || null, // Araç tipi (products tablosundan)
                plan_name: autoPlanName || `${normalizedPartCode} - ${selectedEquipmentId}`,
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
        if (action === 'edit') {
            setSelectedPlan(duplicatePlan);
            setIsFormOpen(true);
        } else if (action === 'revise') {
            const newRevisionNumber = (duplicatePlan.revision_number || 0) + 1;
            setSelectedPlan({ ...duplicatePlan, revision_number: newRevisionNumber });
            setIsFormOpen(true);
        }
        setDuplicatePlan(null);
    };

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
                <DialogContent className={step === 1 ? "max-w-md" : "max-w-[90vw]"}>
                    {step === 1 && !selectedPlan ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kontrol Planı Oluştur - Adım 1</DialogTitle>
                                <DialogDescription>Planın temel bilgilerini girin.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Araç (*)</Label>
                                    <Combobox
                                        options={equipmentOptions}
                                        value={selectedEquipmentId}
                                        onChange={setSelectedEquipmentId}
                                        placeholder="Araç seçin..."
                                    />
                                </div>
                                <div>
                                    <Label>Parça Kodu (*)</Label>
                                    <Input value={partCode} onChange={(e) => setPartCode(e.target.value)} required />
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
                                        <Input className="text-center w-20" type="number" min="1" max="50" value={characteristicCount} onChange={(e) => setCharacteristicCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} />
                                        <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => Math.min(50, p + 1))}>
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mükerrer Kontrol Planı</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu araç ve parça koduna ({duplicatePlan?.part_code}) ait bir kontrol planı (Rev. {duplicatePlan?.revision_number}) zaten mevcut. Ne yapmak istersiniz?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDuplicateAction('edit')}>Mevcut Planı Düzenle</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDuplicateAction('revise')}>Yeni Revizyon Oluştur</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex justify-between items-center">
                <div className="search-box w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Parça kodu, parça adı veya araç ile ara..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <FilePlus className="w-4 h-4 mr-2" /> Yeni Plan
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="p-3 text-left">Araç</th>
                            <th className="p-3 text-left">Parça Kodu</th>
                            <th className="p-3 text-left">Parça Adı</th>
                            <th className="p-3 text-left">Rev. No</th>
                            <th className="p-3 text-center">Ölçüm Sayısı</th>
                            <th className="p-3 text-right z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-muted-foreground">Yükleniyor...</td>
                            </tr>
                        ) : filteredPlans.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-muted-foreground">Kontrol planı bulunamadı.</td>
                            </tr>
                        ) : (
                            filteredPlans.map((plan) => (
                                <tr key={plan.id} className="border-t hover:bg-muted/50">
                                    <td className="p-3">{plan.vehicle_type || plan.process_control_equipment?.equipment_name || '-'}</td>
                                    <td className="p-3 font-medium">{plan.part_code}</td>
                                    <td className="p-3">{plan.part_name}</td>
                                    <td className="p-3">Rev.{plan.revision_number || 0}</td>
                                    <td className="p-3 text-center">{(plan.items || []).length}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleViewDetail(plan)} title="Detayları Görüntüle">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDownloadDetailPDF(plan)} title="Rapor Al">
                                                <FileSpreadsheet className="h-4 w-4" />
                                            </Button>
                                            {plan.file_path && (
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    supabase.storage.from('process_control').createSignedUrl(plan.file_path, 3600).then(({ data }) => {
                                                        if (data) window.open(data.signedUrl, '_blank');
                                                    });
                                                }} title="PDF Dosyasını Görüntüle">
                                                    <FilePlus className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                setSelectedPlan(plan);
                                                setIsFormOpen(true);
                                            }} title="Düzenle">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                const newRevisionNumber = (plan.revision_number || 0) + 1;
                                                setSelectedPlan({ ...plan, revision_number: newRevisionNumber });
                                                setIsFormOpen(true);
                                            }} title="Revize Et">
                                                <History className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
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

