
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ControlPlanDetailModal from './ControlPlanDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Edit, Search, UploadCloud, Eye, History, FilePlus, Minus, ChevronsRight, ArrowLeft, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useData } from '@/contexts/DataContext';
import IncomingControlPlanFolderDownloadModal from './IncomingControlPlanFolderDownloadModal';

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

const STANDARD_OPTIONS = [
    { value: 'ISO 2768-1_f', label: 'ISO 2768-1 f (Fine - İnce)' },
    { value: 'ISO 2768-1_m', label: 'ISO 2768-1 m (Medium - Orta)' },
    { value: 'ISO 2768-1_c', label: 'ISO 2768-1 c (Coarse - Kaba)' },
    { value: 'ISO 2768-1_v', label: 'ISO 2768-1 v (Very Coarse - Çok Kaba)' },
];

const ControlPlanItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
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

                console.log("🔧 Standard seçildi:", value);
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
                console.log("✓ characteristic_type atandı:", selectedCharacteristic.type);
            }
        }

        if (['nominal_value', 'tolerance_direction'].includes(field)) {
            console.log("🔧 " + field + " değişti, hesaplanıyor...");
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
            <td className="p-2 align-top min-w-[180px]">
                <Combobox options={characteristics || []} value={item.characteristic_id} onChange={(v) => handleFieldChange('characteristic_id', v)} placeholder="Karakteristik seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." />
            </td>
            <td className="p-2 align-top min-w-[180px]"><Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." /></td>
            <td className="p-2 align-top min-w-[200px]"><Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional} /></td>
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
                    options={[{ value: '±', label: '±' }, { value: '+', label: '+' }, { value: '-', label: '-' }]}
                    value={item.tolerance_direction}
                    onChange={(v) => handleFieldChange('tolerance_direction', v)}
                    placeholder="Yön"
                    disabled={!isDimensional}
                />
            </td>
            <td className="p-2 align-top min-w-[100px]"><Input type="text" inputMode="decimal" placeholder="Min" value={item.min_value ?? ''} onChange={(e) => handleFieldChange('min_value', e.target.value)} disabled={!isDimensional} /></td>
            <td className="p-2 align-top min-w-[100px]"><Input type="text" inputMode="decimal" placeholder="Max" value={item.max_value ?? ''} onChange={(e) => handleFieldChange('max_value', e.target.value)} disabled={!isDimensional} /></td>
            <td className="p-2 align-top text-center"><Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => onUpdate(index, null)}><Trash2 className="h-4 w-4" /></Button></td>
        </tr>
    );
};

const ControlPlanForm = ({ isOpen, setIsOpen, existingPlan, refreshPlans, onEdit, onRevise }) => {
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [partCode, setPartCode] = useState('');
    const [partName, setPartName] = useState('');
    const [characteristicCount, setCharacteristicCount] = useState(5);
    const [items, setItems] = useState([]);
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duplicatePlan, setDuplicatePlan] = useState(null);

    const { characteristics, equipment, standards, loading: dataLoading } = useData();

    const isEditMode = !!existingPlan;

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 });

    const initialItemState = { id: uuidv4(), characteristic_id: '', characteristic_type: '', equipment_id: '', standard_id: null, tolerance_class: null, nominal_value: '', min_value: null, max_value: null, tolerance_direction: '±', standard_class: '' };

    // ÖNEMLİ: Modal verilerini koru - sadece existingPlan değiştiğinde yükle
    useEffect(() => {
        if (!isOpen) {
            // Modal kapalıyken hiçbir şey yapma - veriler korunmalı
            return;
        }

        if (existingPlan) {
            // Düzenleme modu: Mevcut plan verilerini yükle
            console.log('📝 Kontrol planı düzenleme modu:', existingPlan.id);
            console.log('🔍 Gelen existingPlan TAM HALİYLE:', JSON.stringify(existingPlan, null, 2));
            setPartCode(existingPlan.part_code || '');
            setPartName(existingPlan.part_name || '');
            const planItems = existingPlan.items || [];
            setCharacteristicCount(planItems.length || 1);

            console.log('🔍 planItems array (RAW):', JSON.stringify(planItems, null, 2));

            // TÜM ALANLARI YÜKLE - Standartlar dahil
            const loadedItems = planItems.map((item, idx) => {
                console.log(`📦 Item ${idx + 1} RAW data:`, JSON.stringify(item, null, 2));
                console.log(`📦 Item ${idx + 1} yükleniyor:`, {
                    characteristic_id: item.characteristic_id,
                    standard_id: item.standard_id,
                    tolerance_class: item.tolerance_class,
                    standard_class: item.standard_class,
                    nominal: item.nominal_value,
                    min: item.min_value,
                    max: item.max_value,
                    // Değerlerin tipi
                    standard_id_type: typeof item.standard_id,
                    standard_class_type: typeof item.standard_class,
                    // Undefined mu kontrol et
                    standard_id_undefined: item.standard_id === undefined ? 'EVET' : 'HAYIR',
                    standard_class_undefined: item.standard_class === undefined ? 'EVET' : 'HAYIR'
                });

                return {
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id || '',
                    characteristic_type: item.characteristic_type || '',
                    equipment_id: item.equipment_id || '',
                    // STANDART ALANLARINI KAYIT OLDUĞU GİBİ YÜKLE
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || '',
                    // ÖLÇÜM DEĞERLERİ - KULLANICININ GİRDİĞİ DEĞERLERİ AYNEN YÜKLE
                    nominal_value: item.nominal_value !== undefined && item.nominal_value !== null ? item.nominal_value : '',
                    min_value: item.min_value !== undefined && item.min_value !== null ? item.min_value : null,
                    max_value: item.max_value !== undefined && item.max_value !== null ? item.max_value : null,
                    tolerance_direction: item.tolerance_direction || '±'
                };
            });

            setItems(loadedItems);
            console.log('✅ Kontrol planı yüklendi:', loadedItems.length, 'karakteristik');
            console.log('✅ Yüklenen items:', loadedItems);
            setStep(2);
        } else if (isOpen) {
            // Yeni plan modu: Sadece modal YENİ açıldığında sıfırla
            console.log('➕ Yeni kontrol planı modu');
            setPartCode('');
            setPartName('');
            setCharacteristicCount(5);
            setItems([]);
            setStep(1);
        }

        setFile(null);
        setDuplicatePlan(null);
        setIsSubmitting(false);
    }, [existingPlan, isOpen]);

    const handleNextStep = async () => {
        if (!partCode || !partName) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen parça kodu ve adını girin.' });
            return;
        }

        const { data: existing, error } = await supabase
            .from('incoming_control_plans')
            .select('*')
            .eq('part_code', partCode)
            .order('revision_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kontrol planı kontrol edilirken bir hata oluştu: ${error.message}` });
            return;
        }

        if (existing) {
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

    // İki item'ı karşılaştır ve değişiklikleri bul
    const compareItems = (oldItem, newItem) => {
        const changes = {};
        const fields = ['characteristic_id', 'equipment_id', 'standard_id', 'tolerance_class', 'standard_class', 'nominal_value', 'min_value', 'max_value', 'tolerance_direction', 'characteristic_type'];
        
        fields.forEach(field => {
            const oldVal = oldItem[field] || null;
            const newVal = newItem[field] || null;
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changes[field] = {
                    old: oldVal,
                    new: newVal
                };
            }
        });
        
        return Object.keys(changes).length > 0 ? changes : null;
    };

    // İki plan versiyonunu karşılaştır
    const comparePlans = (oldPlan, newPlan) => {
        const changes = {};
        const changedItems = [];
        
        // Temel alanları karşılaştır
        if (oldPlan.part_code !== newPlan.part_code) {
            changes.part_code = { old: oldPlan.part_code, new: newPlan.part_code };
        }
        if (oldPlan.part_name !== newPlan.part_name) {
            changes.part_name = { old: oldPlan.part_name, new: newPlan.part_name };
        }
        if (oldPlan.file_path !== newPlan.file_path) {
            changes.file_path = { old: oldPlan.file_path, new: newPlan.file_path };
        }
        if (oldPlan.file_name !== newPlan.file_name) {
            changes.file_name = { old: oldPlan.file_name, new: newPlan.file_name };
        }
        
        // Item'ları karşılaştır
        const oldItems = oldPlan.items || [];
        const newItems = newPlan.items || [];
        
        // Eski item'ları ID'ye göre map'le
        const oldItemsMap = new Map();
        oldItems.forEach(item => {
            if (item.id) oldItemsMap.set(item.id, item);
        });
        
        // Yeni item'ları kontrol et
        newItems.forEach((newItem, index) => {
            if (newItem.id && oldItemsMap.has(newItem.id)) {
                // Mevcut item - değişiklik var mı?
                const oldItem = oldItemsMap.get(newItem.id);
                const itemChanges = compareItems(oldItem, newItem);
                if (itemChanges) {
                    changedItems.push({
                        type: 'updated',
                        item_id: newItem.id,
                        index: index + 1,
                        old_item: oldItem,
                        new_item: newItem,
                        changes: itemChanges
                    });
                }
                oldItemsMap.delete(newItem.id);
            } else {
                // Yeni eklenen item
                changedItems.push({
                    type: 'added',
                    item_id: newItem.id || `new_${index}`,
                    index: index + 1,
                    item: newItem
                });
            }
        });
        
        // Silinen item'lar
        oldItemsMap.forEach((oldItem, id) => {
            const oldIndex = oldItems.findIndex(item => item.id === id);
            changedItems.push({
                type: 'deleted',
                item_id: id,
                index: oldIndex + 1,
                item: oldItem
            });
        });
        
        return { changes, changedItems };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        console.log("=== KONTROL PLANI KAYIT DEBUG ===");

        try {
            const validationError = items.some(item => {
                const selectedEquipment = equipment.find(eq => eq.value === item.equipment_id);
                const isDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
                if (!item.characteristic_id || !item.characteristic_type) return true;
                if (isDimensional && item.min_value && item.max_value && parseFloat(String(item.min_value).replace(',', '.')) > parseFloat(String(item.max_value).replace(',', '.'))) return true;
                return false;
            });

            if (validationError) {
                toast({ variant: 'destructive', title: 'Validasyon Hatası', description: 'Lütfen tüm karakteristikleri seçin ve Min toleransın Max toleranstan büyük olmadığından emin olun.' });
                setIsSubmitting(false);
                return;
            }

            let filePath = existingPlan?.file_path;
            let fileName = existingPlan?.file_name;

            if (file) {
                const sanitizedName = sanitizeFileName(file.name);
                const newFilePath = `control_plans/${uuidv4()}-${sanitizedName}`;
                const { error: uploadError } = await supabase.storage.from('incoming_control').upload(newFilePath, file);
                if (uploadError) {
                    toast({ variant: 'destructive', title: 'Hata!', description: `Dosya yüklenemedi: ${uploadError.message}` });
                    setIsSubmitting(false);
                    return;
                }
                filePath = newFilePath;
                fileName = sanitizedName;
            }

            const itemsToSave = items.map((item) => {
                const selectedEquipment = equipment.find(eq => eq.value === item.equipment_id);
                const isDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
                const characteristic = characteristics.find(c => c.value === item.characteristic_id);

                let finalCharacteristicType = item.characteristic_type;
                if (!finalCharacteristicType && characteristic) {
                    finalCharacteristicType = characteristic.type;
                }
                if (!finalCharacteristicType) {
                    finalCharacteristicType = 'Bilinmiyor';
                }

                // TÜM ALANLARI KAYDET - Standartlar dahil
                const savedItem = {
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id,
                    characteristic_type: finalCharacteristicType,
                    equipment_id: item.equipment_id,
                    // STANDART ALANLARINI OLDUĞU GİBİ KAYDET (varsa)
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || null,
                    // KULLANICININ GİRDİĞİ DEĞERLERİ AYNEN KAYDET
                    nominal_value: item.nominal_value || null,
                    min_value: item.min_value !== undefined && item.min_value !== null && item.min_value !== '' ? String(item.min_value) : null,
                    max_value: item.max_value !== undefined && item.max_value !== null && item.max_value !== '' ? String(item.max_value) : null,
                    tolerance_direction: item.tolerance_direction || '±',
                };

                console.log(`✓ Item ${item.characteristic_id}:`, {
                    characteristic_type: finalCharacteristicType,
                    standard_id: savedItem.standard_id,
                    standard_class: savedItem.standard_class,
                    nominal: savedItem.nominal_value,
                    min: savedItem.min_value,
                    max: savedItem.max_value
                });
                return savedItem;
            });

            console.log("Items sayısı:", itemsToSave.length);
            if (itemsToSave.length > 0) {
                console.log("İlk item:", itemsToSave[0]);
                console.log("characteristic_type var mı?", itemsToSave[0].characteristic_type ? "EVET" : "HAYIR");
            }


            const planData = {
                part_code: partCode,
                part_name: partName,
                items: itemsToSave,
                file_path: filePath,
                file_name: fileName,
                revision_number: existingPlan?.revision_number || 0,
                revision_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            console.log("Gönderilecek Plan Data:", planData);

            let savedData, error;
            if (isEditMode) {
                // Revizyon yapıldıktan sonra düzenleme yapılıyorsa, değişiklikleri kaydet
                const oldPlan = existingPlan;
                const newPlan = planData;
                
                // Plan güncelle
                const { data, error: updateError } = await supabase.from('incoming_control_plans').update(planData).eq('id', existingPlan.id).select().single();
                savedData = data;
                error = updateError;
                
                // Eğer revizyon yapılmışsa (revision_number > 0), değişiklikleri kaydet
                if (!error && savedData && existingPlan.revision_number > 0) {
                    const comparison = comparePlans(oldPlan, newPlan);
                    
                    // Mevcut revizyon numarasına göre revizyon geçmişi kaydını bul
                    const { data: lastRevision } = await supabase
                        .from('incoming_control_plan_revisions')
                        .select('*')
                        .eq('control_plan_id', existingPlan.id)
                        .eq('revision_number', existingPlan.revision_number) // Mevcut revizyon numarasına göre bul
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (lastRevision) {
                        // Değişiklik varsa revizyon geçmişi kaydını güncelle
                        if (Object.keys(comparison.changes).length > 0 || comparison.changedItems.length > 0) {
                            const { error: updateHistoryError } = await supabase
                                .from('incoming_control_plan_revisions')
                                .update({
                                    new_part_code: newPlan.part_code,
                                    new_part_name: newPlan.part_name,
                                    new_items: newPlan.items,
                                    new_file_path: newPlan.file_path,
                                    new_file_name: newPlan.file_name,
                                    changes: comparison.changes,
                                    changed_items: comparison.changedItems,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', lastRevision.id);
                            
                            if (updateHistoryError && updateHistoryError.code !== '42P01') {
                                console.warn('Revizyon geçmişi güncellenemedi:', updateHistoryError);
                            }
                        }
                    } else {
                        // Revizyon geçmişi kaydı yoksa oluştur (eski sistemden gelen planlar için)
                        const { error: insertHistoryError } = await supabase
                            .from('incoming_control_plan_revisions')
                            .insert({
                                control_plan_id: existingPlan.id,
                                revision_number: existingPlan.revision_number,
                                revision_date: existingPlan.revision_date || new Date().toISOString(),
                                old_part_code: oldPlan.part_code,
                                old_part_name: oldPlan.part_name,
                                old_items: oldPlan.items || [],
                                old_file_path: oldPlan.file_path,
                                old_file_name: oldPlan.file_name,
                                new_part_code: newPlan.part_code,
                                new_part_name: newPlan.part_name,
                                new_items: newPlan.items || [],
                                new_file_path: newPlan.file_path,
                                new_file_name: newPlan.file_name,
                                changes: comparison.changes,
                                changed_items: comparison.changedItems,
                                revision_note: `Revizyon ${existingPlan.revision_number} kaydedildi.`,
                                created_by: (await supabase.auth.getUser()).data.user?.id || null,
                            });
                        
                        if (insertHistoryError && insertHistoryError.code !== '42P01') {
                            console.warn('Revizyon geçmişi oluşturulamadı:', insertHistoryError);
                        }
                    }
                }
            } else {
                const { data, error: insertError } = await supabase.from('incoming_control_plans').insert(planData).select().single();
                savedData = data;
                error = insertError;
            }

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Kontrol planı kaydedilemedi: ${error.message}` });
                console.error("HATA - Kayıt başarısız:", error);
            } else {
                toast({ title: 'Başarılı!', description: `Kontrol planı başarıyla kaydedildi.` });
                console.log("✅ BAŞARILI - Kaydedilen veri:", savedData);
                console.log("Items kaydedildi mi?", savedData && savedData.items && savedData.items.length > 0 ? "EVET" : "HAYIR");
                if (refreshPlans) refreshPlans();
                setIsOpen(false);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicateAction = (action) => {
        if (action === 'edit') {
            onEdit(duplicatePlan);
        } else if (action === 'revise') {
            onRevise(duplicatePlan);
        }
        setDuplicatePlan(null);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                    {step === 1 && !isEditMode ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kontrol Planı Oluştur - Adım 1</DialogTitle>
                                <DialogDescription>Planın temel bilgilerini ve kontrol edilecek madde sayısını girin.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div><Label>Parça Kodu (*)</Label><Input value={partCode} onChange={(e) => setPartCode(e.target.value)} required /></div>
                                <div><Label>Parça Adı (*)</Label><Input value={partName} onChange={(e) => setPartName(e.target.value)} required /></div>
                                <div>
                                    <Label>Kontrol Edilecek Karakteristik Sayısı</Label>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => Math.max(1, p - 1))}><Minus className="h-4 w-4" /></Button>
                                        <Input className="text-center w-24" type="number" min="1" value={characteristicCount} onChange={(e) => setCharacteristicCount(Math.max(1, parseInt(e.target.value) || 1))} />
                                        <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => p + 1)}><Plus className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                                <Button type="button" onClick={handleNextStep}>İleri <ChevronsRight className="h-4 w-4 ml-2" /></Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kontrol Planı - {isEditMode ? `Düzenle (${partCode})` : 'Adım 2'}</DialogTitle>
                                <DialogDescription>{partName} ({items.length} Karakteristik)</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                <ScrollArea className="h-[70vh] p-1">
                                    {dataLoading || !characteristics || !equipment || !standards ? (
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
                                                            <ControlPlanItem key={item.id} item={item} index={index} onUpdate={handleItemUpdate} characteristics={characteristics} equipment={equipment} standards={standards} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Button type="button" variant="outline" onClick={() => setItems(prev => [...prev, { ...initialItemState, id: uuidv4() }])} className="mt-4"><Plus className="h-4 w-4 mr-2" /> Yeni Madde Ekle</Button>
                                            <div className="mt-4">
                                                <Label>Onaylı Plan (PDF)</Label>
                                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                                    <input {...getInputProps()} />
                                                    {file ? <p className="mt-2 text-sm">{file.name}</p> : <p className="mt-2 text-sm text-muted-foreground">Dosyayı buraya sürükleyin veya seçin</p>}
                                                </div>
                                                {(existingPlan?.file_name && !file) && <p className="text-sm text-muted-foreground mt-2">Mevcut dosya: {existingPlan.file_name}</p>}
                                            </div>
                                        </>
                                    )}
                                </ScrollArea>
                                <DialogFooter className="mt-4 pt-4 border-t">
                                    {!isEditMode && <Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>}
                                    <Button type="submit" disabled={isSubmitting || dataLoading}>{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</Button>
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
                            Bu parça koduna ({duplicatePlan?.part_code}) ait bir kontrol planı (Rev. {duplicatePlan?.revision_number}) zaten mevcut. Ne yapmak istersiniz?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDuplicateAction('edit')}>Mevcut Planı Düzenle</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDuplicateAction('revise')}>Yeni Revizyon Oluştur</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

const ControlPlanManagement = ({ onViewPdf, isOpen, setIsOpen }) => {
    const { toast } = useToast();
    const { characteristics, equipment, standards } = useData();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(isOpen || false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);
    const [isFolderDownloadOpen, setIsFolderDownloadOpen] = useState(false);

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('incoming_control_plans').select('*').order('updated_at', { ascending: false });
        if (searchTerm) {
            query = query.or(`part_code.ilike.%${searchTerm}%,part_name.ilike.%${searchTerm}%`);
        }
        const { data, error } = await query;
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Kontrol planları alınamadı.' });
            setPlans([]);
        } else {
            setPlans(data || []);
        }
        setLoading(false);
    }, [toast, searchTerm]);

    useEffect(() => {
        if (isOpen !== undefined) {
            setIsModalOpen(isOpen);
        }
    }, [isOpen]);

    useEffect(() => {
        if (setIsOpen !== undefined && setIsOpen !== null) {
            setIsOpen(isModalOpen);
        }
    }, [isModalOpen, setIsOpen]);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const handleEdit = (plan) => {
        setSelectedPlan(plan);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedPlan(null);
        setIsModalOpen(true);
    };

    const handleRevise = async (plan) => {
        const newRevisionNumber = (plan.revision_number || 0) + 1;
        const revisionDate = new Date().toISOString();

        // Eski plan verilerini kaydet (revizyon geçmişi için)
        const revisionHistoryData = {
            control_plan_id: plan.id,
            revision_number: newRevisionNumber, // YENİ revizyon numarası
            revision_date: revisionDate, // YENİ revizyon tarihi
            old_part_code: plan.part_code,
            old_part_name: plan.part_name,
            old_items: plan.items || [],
            old_file_path: plan.file_path || null,
            old_file_name: plan.file_name || null,
            // Yeni değerler başlangıçta eski değerlerle aynı (düzenleme sonrası güncellenecek)
            new_part_code: plan.part_code,
            new_part_name: plan.part_name,
            new_items: plan.items || [],
            new_file_path: plan.file_path || null,
            new_file_name: plan.file_name || null,
            revision_note: `Revizyon ${newRevisionNumber} başlatıldı.`,
            created_by: (await supabase.auth.getUser()).data.user?.id || null,
        };

        // Revizyon geçmişini kaydet (tablo yoksa sessizce devam et)
        const { error: historyError } = await supabase
            .from('incoming_control_plan_revisions')
            .insert(revisionHistoryData);

        if (historyError) {
            // Tablo yoksa veya başka bir hata varsa sadece log'la, revizyon işlemini durdurma
            if (historyError.code === '42P01' || historyError.message?.includes('does not exist')) {
                console.warn('Revizyon geçmişi tablosu henüz oluşturulmamış. Migration script çalıştırılmalı:', historyError);
            } else {
                console.error('Revizyon geçmişi kaydedilemedi:', historyError);
                // Kritik olmayan bir hata, sadece uyarı göster
                toast({ 
                    variant: 'default', 
                    title: 'Bilgi', 
                    description: `Revizyon yapıldı ancak geçmiş kaydı oluşturulamadı. Lütfen migration script'i çalıştırın.` 
                });
            }
        }

        const updateData = {
            revision_number: newRevisionNumber,
            revision_date: revisionDate,
            updated_at: revisionDate,
        };

        const { data: updatedPlan, error } = await supabase
            .from('incoming_control_plans')
            .update(updateData)
            .eq('id', plan.id)
            .select()
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Revizyon güncellenemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Kontrol planı Rev. ${newRevisionNumber} olarak revize edildi. Şimdi düzenleyebilirsiniz.` });
            handleEdit(updatedPlan);
            fetchPlans();
        }
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('incoming_control_plans').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Plan silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kontrol planı silindi.' });
            fetchPlans();
        }
    };

    const handleViewDetail = (plan) => {
        setSelectedPlanDetail(plan);
        setIsDetailModalOpen(true);
    };

    const handleDownloadDetailPDF = (planData) => {
        // Process control modülündeki gibi senkron çalış
        if (!planData || !planData.id) {
            console.error('Geçersiz plan verisi:', planData);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Geçerli bir kontrol planı bulunamadı!'
            });
            return;
        }

        console.log('📄 PDF raporu oluşturuluyor:', planData);

        // Karakteristik ve ekipman bilgilerini ekle (process control gibi)
        const enrichedData = {
            ...planData,
            items: (planData.items || []).map(item => {
                // Standart bilgisini işle - standard_class varsa onu kullan, yoksa standard_name
                let standardName = null;
                if (item.standard_class) {
                    standardName = item.standard_class;
                } else if (item.standard_id) {
                    standardName = standards?.find(s => s.value === item.standard_id)?.label || item.standard_id;
                }

                return {
                    ...item,
                    characteristic_name: characteristics?.find(c => c.value === item.characteristic_id)?.label || item.characteristic_id || '-',
                    equipment_name: equipment?.find(e => e.value === item.equipment_id)?.label || item.equipment_id || '-',
                    standard_name: standardName || '-',
                };
            })
        };

        console.log('📄 Zenginleştirilmiş veri:', enrichedData);
        openPrintableReport(enrichedData, 'incoming_control_plans', true);
    };

    return (
        <div className="dashboard-widget">
            <ControlPlanForm
                isOpen={isModalOpen}
                setIsOpen={setIsModalOpen}
                existingPlan={selectedPlan}
                refreshPlans={fetchPlans}
                onEdit={handleEdit}
                onRevise={handleRevise}
            />
            <ControlPlanDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                plan={selectedPlanDetail}
                onDownloadPDF={handleDownloadDetailPDF}
            />
            <IncomingControlPlanFolderDownloadModal
                isOpen={isFolderDownloadOpen}
                setIsOpen={setIsFolderDownloadOpen}
                plans={plans}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="search-box w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Parça kodu veya adı ile ara..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    <Button variant="outline" onClick={() => setIsFolderDownloadOpen(true)} className="flex-1 sm:flex-none">
                        <Download className="w-4 h-4 mr-2" />
                        Klasör İndir
                    </Button>
                    <Button onClick={handleNew} className="flex-1 sm:flex-none"><FilePlus className="w-4 h-4 mr-2" /> Yeni Plan</Button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Parça Kodu</th>
                            <th>Parça Adı</th>
                            <th>Rev. No</th>
                            <th>Madde Sayısı</th>
                            <th>Son Güncelleme</th>
                            <th className="px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8">Yükleniyor...</td></tr>
                        ) : plans.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8">Kontrol planı bulunamadı.</td></tr>
                        ) : (
                            plans.map((plan, index) => (
                                <tr
                                    key={plan.id}
                                    onClick={() => handleViewDetail(plan)}
                                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                >
                                    <td className="font-medium text-foreground">{plan.part_code}</td>
                                    <td className="text-foreground">{plan.part_name}</td>
                                    <td className="text-muted-foreground">Rev.{plan.revision_number || 0}</td>
                                    <td className="text-muted-foreground text-center">{(plan.items || []).length}</td>
                                    <td className="text-muted-foreground">{plan.updated_at ? new Date(plan.updated_at).toLocaleDateString('tr-TR') : '-'}</td>
                                    <td className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        {plan.file_path && (<Button variant="ghost" size="icon" onClick={() => onViewPdf(plan.file_path, `Kontrol Planı: ${plan.part_name}`)}><Eye className="h-4 w-4" /></Button>)}
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleRevise(plan)}><History className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="h-4 w-4" /></Button>
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

export default ControlPlanManagement;
