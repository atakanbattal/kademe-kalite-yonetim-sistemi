import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, FilePlus, History, Eye, Minus, ChevronsRight, ArrowLeft } from 'lucide-react';
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
    const isDimensional = equipment?.find(e => e.value === item.equipment_id) && 
                          !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(equipment.find(e => e.value === item.equipment_id)?.label || '');

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
            <td className="p-2 align-top min-w-[180px]">
                <Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı."/>
            </td>
            <td className="p-2 align-top min-w-[200px]">
                <Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional}/>
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
    const [planName, setPlanName] = useState('');
    const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
    const [partCode, setPartCode] = useState('');
    const [partName, setPartName] = useState('');
    const [characteristicCount, setCharacteristicCount] = useState(5);
    const [items, setItems] = useState([]);
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duplicatePlan, setDuplicatePlan] = useState(null);

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
            setPlanName('');
            setSelectedEquipmentId(null);
            setPartCode('');
            setPartName('');
            setCharacteristicCount(5);
            setItems([]);
            setFile(null);
            setSelectedPlan(null);
            setDuplicatePlan(null);
        } else if (selectedPlan) {
            setPlanName(selectedPlan.plan_name || '');
            setSelectedEquipmentId(selectedPlan.vehicle_type || selectedPlan.equipment_id);
            setPartCode(selectedPlan.part_code || '');
            setPartName(selectedPlan.part_name || '');
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
        if (!selectedEquipmentId || !planName) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen araç ve plan adını seçin.' });
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
            const validationError = items.some(item => {
                const selectedEquipment = measurementEquipment?.find(eq => eq.value === item.equipment_id);
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
            
                return {
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id,
                    characteristic_type: finalCharacteristicType,
                    equipment_id: item.equipment_id,
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || null,
                    nominal_value: item.nominal_value || null,
                    min_value: item.min_value !== undefined && item.min_value !== null && item.min_value !== '' ? String(item.min_value) : null,
                    max_value: item.max_value !== undefined && item.max_value !== null && item.max_value !== '' ? String(item.max_value) : null,
                    tolerance_direction: item.tolerance_direction || '±',
                };
            });

            const planData = {
                vehicle_type: selectedEquipmentId, // Artık vehicle_type olarak kaydediyoruz
                plan_name: planName,
                part_code: partCode,
                part_name: partName,
                items: itemsToSave,
                file_path: filePath,
                file_name: fileName,
                revision_number: selectedPlan?.revision_number || 0,
                revision_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

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
            plan.plan_name?.toLowerCase().includes(searchLower) ||
            plan.part_code?.toLowerCase().includes(searchLower) ||
            plan.part_name?.toLowerCase().includes(searchLower) ||
            plan.process_control_equipment?.equipment_name?.toLowerCase().includes(searchLower)
        );
    });

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
                                    <Label>Plan Adı (*)</Label>
                                    <Input value={planName} onChange={(e) => setPlanName(e.target.value)} required />
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
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Plan adı, parça kodu veya araç ile ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                            <th className="p-3 text-left">Plan Adı</th>
                            <th className="p-3 text-left">Parça Kodu</th>
                            <th className="p-3 text-left">Parça Adı</th>
                            <th className="p-3 text-left">Rev. No</th>
                            <th className="p-3 text-left">Madde Sayısı</th>
                            <th className="p-3 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">Yükleniyor...</td>
                            </tr>
                        ) : filteredPlans.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">Kontrol planı bulunamadı.</td>
                            </tr>
                        ) : (
                            filteredPlans.map((plan) => (
                                <tr key={plan.id} className="border-t hover:bg-muted/50">
                                    <td className="p-3">{plan.vehicle_type || plan.process_control_equipment?.equipment_name || '-'}</td>
                                    <td className="p-3 font-medium">{plan.plan_name}</td>
                                    <td className="p-3">{plan.part_code}</td>
                                    <td className="p-3">{plan.part_name}</td>
                                    <td className="p-3">Rev.{plan.revision_number || 0}</td>
                                    <td className="p-3 text-center">{(plan.items || []).length}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {plan.file_path && (
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    supabase.storage.from('process_control').createSignedUrl(plan.file_path, 3600).then(({ data }) => {
                                                        if (data) window.open(data.signedUrl, '_blank');
                                                    });
                                                }}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                setSelectedPlan(plan);
                                                setIsFormOpen(true);
                                            }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                const newRevisionNumber = (plan.revision_number || 0) + 1;
                                                setSelectedPlan({ ...plan, revision_number: newRevisionNumber });
                                                setIsFormOpen(true);
                                            }}>
                                                <History className="h-4 w-4" />
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
    );
};

export default ControlPlanManagement;

