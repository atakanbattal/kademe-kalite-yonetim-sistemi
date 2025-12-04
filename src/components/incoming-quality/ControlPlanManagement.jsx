
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
import { Plus, Trash2, Edit, Search, UploadCloud, Eye, History, FilePlus, Minus, ChevronsRight, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useData } from '@/contexts/DataContext';

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
            if(selectedCharacteristic) {
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
            <td className="p-2 align-top min-w-[180px]"><Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı."/></td>
            <td className="p-2 align-top min-w-[200px]"><Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional}/></td>
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
            <td className="p-2 align-top min-w-[100px]"><Input type="text" inputMode="decimal" placeholder="Min" value={item.min_value ?? ''} onChange={(e) => handleFieldChange('min_value', e.target.value)} disabled={!isDimensional}/></td>
            <td className="p-2 align-top min-w-[100px]"><Input type="text" inputMode="decimal" placeholder="Max" value={item.max_value ?? ''} onChange={(e) => handleFieldChange('max_value', e.target.value)} disabled={!isDimensional}/></td>
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
                    const { data, error: updateError } = await supabase.from('incoming_control_plans').update(planData).eq('id', existingPlan.id).select().single();
                    savedData = data;
                    error = updateError;
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
                    if(refreshPlans) refreshPlans();
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
                    <DialogContent 
                      className={step === 1 ? "max-w-md" : "max-w-[90vw]"}
                    >
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
                                            <Input className="text-center w-20" type="number" min="1" max="50" value={characteristicCount} onChange={(e) => setCharacteristicCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} />
                                            <Button type="button" size="icon" variant="outline" onClick={() => setCharacteristicCount(p => Math.min(50, p + 1))}><Plus className="h-4 w-4" /></Button>
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
                                            <Button type="button" variant="outline" onClick={() => setItems(prev => [...prev, {...initialItemState, id: uuidv4()}])} className="mt-4"><Plus className="h-4 w-4 mr-2" /> Yeni Madde Ekle</Button>
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
        const [plans, setPlans] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isModalOpen, setIsModalOpen] = useState(isOpen || false);
        const [selectedPlan, setSelectedPlan] = useState(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
        const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);

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
            
            const { id, created_at, ...restOfPlan } = plan;

            const newPlanData = {
                ...restOfPlan,
                revision_number: newRevisionNumber,
                revision_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            
            const { data: newPlan, error } = await supabase.from('incoming_control_plans').insert(newPlanData).select().single();

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Revizyon oluşturulamadı: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Yeni revizyon oluşturuldu. Şimdi düzenleyebilirsiniz.' });
                handleEdit(newPlan);
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

        const handleDownloadDetailPDF = (enrichedData) => {
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
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Parça kodu veya adı ile ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button onClick={handleNew}><FilePlus className="w-4 h-4 mr-2" /> Yeni Plan</Button>
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
                                <th>İşlemler</th>
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
