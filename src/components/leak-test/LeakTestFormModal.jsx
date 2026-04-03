import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    CalendarDays,
    Clock3,
    Copy,
    Droplets,
    FileText,
    Hash,
    Layers,
    Package,
    Plus,
    ShieldCheck,
    Trash2,
    User,
    Wrench,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { syncLeakTestNonconformity } from '@/lib/leakTestNonconformitySync';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    ModalField,
    ModalSectionHeader,
    ModernModalLayout,
} from '@/components/shared/ModernModalLayout';

import {
    LEGACY_TANK_TYPE_OPTIONS,
    TEST_RESULT_OPTIONS,
    TANK_TYPE_OPTIONS,
    buildVehicleTypeLabel,
    calculateEndTime,
    formatDuration,
    formatTestDate,
    getVehicleTypeLabel,
    isGeneralScrapProduct,
} from './utils';

const TANK_TYPE_SUPPORT_CACHE_KEY = 'leak-test-extended-tank-types';
const EXTENDED_TANK_TYPE_PROBE_VALUE = 'Yağlama Haznesi';

const readCachedTankTypeSupport = () => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(TANK_TYPE_SUPPORT_CACHE_KEY);
};

const writeCachedTankTypeSupport = (mode) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(TANK_TYPE_SUPPORT_CACHE_KEY, mode);
};

const getInitialTankTypeOptions = () => (
    readCachedTankTypeSupport() === 'supported'
        ? TANK_TYPE_OPTIONS
        : LEGACY_TANK_TYPE_OPTIONS
);

const isTankTypeConstraintError = (error) => (
    error?.code === '23514'
    && String(error.message || '').includes('leak_test_records_tank_type_check')
);

const createDefaultItem = () => ({
    _key: crypto.randomUUID(),
    vehicle_type_id: '',
    vehicle_serial_number: '',
    part_code: '',
    tank_type: '',
    test_result: 'Kabul',
    leak_count: 0,
});

const createDefaultFormData = () => {
    const now = new Date();
    return {
        record_number: '',
        vehicle_type_id: '',
        vehicle_type_label: '',
        vehicle_serial_number: '',
        part_code: '',
        tank_type: '',
        test_date: now.toISOString().split('T')[0],
        test_start_time: now.toTimeString().slice(0, 5),
        test_duration_minutes: 20,
        test_result: 'Kabul',
        leak_count: 0,
        tested_by_personnel_id: '',
        tested_by_name: '',
        welded_by_personnel_id: '',
        welded_by_name: '',
        welding_at_supplier: false,
        supplier_id: '',
        supplier_name: '',
        notes: '',
    };
};

const LEADING_ICON_INPUT_PADDING = '2.75rem';

const LeadingIconField = ({ icon: Icon, children }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Icon className="h-4 w-4" />
        </div>
        {children}
    </div>
);

const BatchItemRow = ({
    item,
    index,
    vehicleTypeOptions,
    tankTypeOptions,
    isViewMode,
    onChange,
    onRemove,
    onDuplicate,
    canRemove,
}) => {
    const handleResultChange = (value) => {
        onChange(index, {
            test_result: value,
            leak_count: value === 'Kabul' ? 0 : Math.max(1, Number(item.leak_count) || 0),
        });
    };

    const handleLeakCountChange = (value) => {
        const parsed = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
        onChange(index, {
            leak_count: parsed,
            test_result: Number(parsed) > 0 ? 'Kaçak Var' : 'Kabul',
        });
    };

    const resultBadge = item.test_result === 'Kaçak Var'
        ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800';

    return (
        <div className="group relative rounded-xl border bg-card transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {index + 1}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${resultBadge}`}>
                        {item.test_result || 'Kabul'}
                    </Badge>
                </div>
                {!isViewMode && (
                    <div className="flex items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDuplicate(index)} title="Kopyala">
                            <Copy className="h-3 w-3" />
                        </Button>
                        {canRemove && (
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(index)} title="Sil">
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 md:grid-cols-4">
                <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Araç Tipi *</Label>
                    {isViewMode ? (
                        <Input value={vehicleTypeOptions.find((v) => v.value === item.vehicle_type_id)?.label || '-'} readOnly className="bg-muted/30 h-9 text-sm" />
                    ) : (
                        <SearchableSelectDialog
                            options={vehicleTypeOptions}
                            value={item.vehicle_type_id}
                            onChange={(value) => onChange(index, { vehicle_type_id: value })}
                            triggerPlaceholder="Araç tipi seçin..."
                            dialogTitle="Araç Tipi Seç"
                            searchPlaceholder="Ara..."
                            notFoundText="Bulunamadı."
                        />
                    )}
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sızd. Parçası *</Label>
                    <Select value={item.tank_type} onValueChange={(value) => onChange(index, { tank_type: value })} disabled={isViewMode}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            {tankTypeOptions.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Araç Seri No</Label>
                    <Input
                        value={item.vehicle_serial_number || ''}
                        onChange={(e) => onChange(index, { vehicle_serial_number: e.target.value })}
                        placeholder="ARC-2026-..."
                        disabled={isViewMode}
                        className="h-9 text-sm"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Parça Kodu</Label>
                    <Input
                        value={item.part_code || ''}
                        onChange={(e) => onChange(index, { part_code: e.target.value })}
                        placeholder="ABC-12345"
                        disabled={isViewMode}
                        className="h-9 text-sm"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sonuç *</Label>
                    <Select value={item.test_result} onValueChange={handleResultChange} disabled={isViewMode}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TEST_RESULT_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Kaçak Adet</Label>
                    <Input
                        type="number"
                        min="0"
                        value={item.leak_count}
                        onChange={(e) => handleLeakCountChange(e.target.value)}
                        disabled={isViewMode}
                        className="h-9 text-sm"
                    />
                </div>
            </div>
        </div>
    );
};

const LeakTestFormModal = ({
    isOpen,
    setIsOpen,
    record,
    isViewMode = false,
    onSuccess,
}) => {
    const { toast } = useToast();
    const { user } = useAuth();

    const isEditMode = !!record && !isViewMode;
    const hasExistingRecord = !!record;
    const isBatchMode = !hasExistingRecord && !isViewMode;

    const [formData, setFormData] = useState(createDefaultFormData());
    const [batchItems, setBatchItems] = useState(() => [createDefaultItem()]);
    const [vehicleTypes, setVehicleTypes] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [setupLoading, setSetupLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableTankTypeOptions, setAvailableTankTypeOptions] = useState(() => getInitialTankTypeOptions());
    const [isLegacyTankTypeMode, setIsLegacyTankTypeMode] = useState(
        () => getInitialTankTypeOptions().length !== TANK_TYPE_OPTIONS.length
    );

    const createFormDataFromRecord = useCallback((sourceRecord) => ({
        record_number: sourceRecord?.record_number || '',
        vehicle_type_id: sourceRecord?.vehicle_type_id || '',
        vehicle_type_label: sourceRecord?.vehicle_type_label || '',
        vehicle_serial_number: sourceRecord?.vehicle_serial_number || '',
        part_code: sourceRecord?.part_code || '',
        tank_type: sourceRecord?.tank_type || '',
        test_date: sourceRecord?.test_date || createDefaultFormData().test_date,
        test_start_time: sourceRecord?.test_start_time || '',
        test_duration_minutes: sourceRecord?.test_duration_minutes ?? 20,
        test_result: sourceRecord?.test_result || 'Kabul',
        leak_count: sourceRecord?.leak_count ?? 0,
        tested_by_personnel_id: sourceRecord?.tested_by_personnel_id || '',
        tested_by_name: sourceRecord?.tested_by_name || '',
        welded_by_personnel_id: sourceRecord?.welded_by_personnel_id || '',
        welded_by_name: sourceRecord?.welded_by_name || '',
        welding_at_supplier: !!sourceRecord?.welding_at_supplier,
        supplier_id: sourceRecord?.supplier_id || '',
        supplier_name: sourceRecord?.supplier_name || '',
        notes: sourceRecord?.notes || '',
    }), []);

    const fetchNextRecordNumberForDate = useCallback(async (testDate) => {
        const dateObj = testDate ? new Date(testDate) : new Date();
        const year = dateObj.getFullYear();
        const yearSuffix = String(year).slice(-2);
        const prefix = `SZK-${yearSuffix}-`;

        const yearStart = `${year}-01-01`;
        const dayAfter = new Date(dateObj);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const dayAfterStr = dayAfter.toISOString().split('T')[0];

        const { count, error } = await supabase
            .from('leak_test_records')
            .select('id', { count: 'exact', head: true })
            .like('record_number', `${prefix}%`)
            .gte('test_date', yearStart)
            .lt('test_date', dayAfterStr);

        if (error) throw error;

        const nextSequence = (count ?? 0) + 1;
        return `${prefix}${String(nextSequence).padStart(4, '0')}`;
    }, []);

    const fetchSetupData = useCallback(async () => {
        setSetupLoading(true);
        try {
            const [{ data: vehicleCategory, error: categoryError }, { data: personnelData, error: personnelError }, { data: suppliersData, error: suppliersError }] = await Promise.all([
                supabase
                    .from('product_categories')
                    .select('id')
                    .eq('category_code', 'VEHICLE_TYPES')
                    .maybeSingle(),
                supabase
                    .from('personnel')
                    .select('id, full_name, department')
                    .eq('is_active', true)
                    .order('full_name'),
                supabase
                    .from('suppliers')
                    .select('id, name')
                    .order('name'),
            ]);

            if (categoryError) throw categoryError;
            if (personnelError) throw personnelError;
            if (suppliersError) throw suppliersError;

            let productsData = [];
            if (vehicleCategory?.id) {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, product_code, product_name')
                    .eq('category_id', vehicleCategory.id)
                    .eq('is_active', true)
                    .order('product_name');

                if (error) throw error;
                productsData = data || [];
            }

            setVehicleTypes(productsData.filter((product) => !isGeneralScrapProduct(product)));
            setPersonnel(personnelData || []);
            setSuppliers(suppliersData || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Kurulum verileri alınamadı',
                description: error.message || 'Personel ve araç tipi bilgileri yüklenemedi.',
            });
        } finally {
            setSetupLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isOpen) return;
        fetchSetupData();
    }, [fetchSetupData, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;

        const loadFormState = async () => {
            if (hasExistingRecord && record) {
                if (isMounted) {
                    setFormData(createFormDataFromRecord(record));
                    setBatchItems([createDefaultItem()]);
                }
                return;
            }

            try {
                const defaultData = createDefaultFormData();
                const nextRecordNumber = await fetchNextRecordNumberForDate(defaultData.test_date);
                if (!isMounted) return;

                setFormData({
                    ...defaultData,
                    record_number: nextRecordNumber,
                });
                setBatchItems([createDefaultItem()]);
            } catch (error) {
                if (!isMounted) return;

                setFormData(createDefaultFormData());
                setBatchItems([createDefaultItem()]);
                toast({
                    variant: 'destructive',
                    title: 'Kayıt numarası üretilemedi',
                    description: error.message || 'Yeni kayıt numarası alınamadı.',
                });
            }
        };

        loadFormState();

        return () => {
            isMounted = false;
        };
    }, [createFormDataFromRecord, fetchNextRecordNumberForDate, hasExistingRecord, isOpen, record, toast]);

    const vehicleTypeOptions = useMemo(() => (
        vehicleTypes.map((product) => ({
            value: product.id,
            label: buildVehicleTypeLabel(product),
        }))
    ), [vehicleTypes]);

    const personnelOptions = useMemo(() => (
        personnel.map((person) => ({
            value: person.id,
            label: person.department ? `${person.full_name} • ${person.department}` : person.full_name,
        }))
    ), [personnel]);

    const supplierOptions = useMemo(
        () => (suppliers || []).map((s) => ({ value: s.id, label: s.name || '—' })),
        [suppliers],
    );

    const selectedVehicle = useMemo(
        () => vehicleTypes.find((vehicle) => vehicle.id === formData.vehicle_type_id),
        [vehicleTypes, formData.vehicle_type_id],
    );

    const selectedTester = useMemo(
        () => personnel.find((person) => person.id === formData.tested_by_personnel_id),
        [personnel, formData.tested_by_personnel_id],
    );

    const selectedWelder = useMemo(
        () => personnel.find((person) => person.id === formData.welded_by_personnel_id),
        [personnel, formData.welded_by_personnel_id],
    );

    const previewResultVariant = formData.test_result === 'Kabul' ? 'success' : 'destructive';
    const computedEndTime = calculateEndTime(formData.test_start_time, formData.test_duration_minutes);
    const previewVehicleLabel = selectedVehicle
        ? buildVehicleTypeLabel(selectedVehicle)
        : (formData.vehicle_type_label || getVehicleTypeLabel(record));
    const previewTesterName = selectedTester?.full_name || formData.tested_by_name || record?.tested_by_name || '-';
    const previewWelderName = selectedWelder?.full_name || formData.welded_by_name || record?.welded_by_name || '-';
    const previewWelderOrSupplier = formData.welding_at_supplier
        ? (formData.supplier_name || record?.supplier_name || '-')
        : previewWelderName;
    const isSetupMissing = !vehicleTypes.length || !personnel.length;

    const applyTankTypeMode = useCallback((mode) => {
        const nextOptions = mode === 'supported' ? TANK_TYPE_OPTIONS : LEGACY_TANK_TYPE_OPTIONS;
        setAvailableTankTypeOptions(nextOptions);
        setIsLegacyTankTypeMode(mode !== 'supported');
        writeCachedTankTypeSupport(mode);

        if (!hasExistingRecord) {
            setFormData((prev) => ({
                ...prev,
                tank_type: nextOptions.includes(prev.tank_type) ? prev.tank_type : '',
            }));
        }
    }, [hasExistingRecord]);

    const detectTankTypeSupport = useCallback(async () => {
        const cachedMode = readCachedTankTypeSupport();
        if (cachedMode === 'supported' || cachedMode === 'legacy') {
            applyTankTypeMode(cachedMode);
            return;
        }

        if (!isOpen || !user) {
            applyTankTypeMode('legacy');
            return;
        }

        const probeRecordNumber = `__LT_PROBE__${Date.now()}`;
        let probeId = null;

        try {
            const { data, error } = await supabase
                .from('leak_test_records')
                .insert([{
                    record_number: probeRecordNumber,
                    vehicle_type_label: 'Destek Kontrolü',
                    tank_type: EXTENDED_TANK_TYPE_PROBE_VALUE,
                    test_date: new Date().toISOString().split('T')[0],
                    test_start_time: '00:00',
                    test_duration_minutes: 1,
                    test_result: 'Kabul',
                    leak_count: 0,
                    tested_by_name: 'Destek Kontrolü',
                    welded_by_name: 'Destek Kontrolü',
                    created_by: user.id,
                }])
                .select('id')
                .single();

            if (error) {
                if (isTankTypeConstraintError(error)) {
                    applyTankTypeMode('legacy');
                    return;
                }
                throw error;
            }

            probeId = data?.id || null;
            applyTankTypeMode('supported');
        } catch (error) {
            console.warn('Leak test tank_type destek kontrolü başarısız:', error);
            applyTankTypeMode('legacy');
        } finally {
            if (probeId) {
                const { error: cleanupError } = await supabase
                    .from('leak_test_records')
                    .delete()
                    .eq('id', probeId);

                if (cleanupError) {
                    console.warn('Leak test destek kontrolü kaydı silinemedi:', cleanupError);
                }
            }
        }
    }, [applyTankTypeMode, isOpen, user]);

    useEffect(() => {
        if (!isOpen) return;
        detectTankTypeSupport();
    }, [detectTankTypeSupport, isOpen]);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleWeldingAtSupplierChange = (checked) => {
        setFormData((prev) => ({
            ...prev,
            welding_at_supplier: checked,
            ...(checked
                ? { welded_by_personnel_id: '', welded_by_name: '' }
                : { supplier_id: '', supplier_name: '' }),
        }));
    };

    const handleSupplierChange = (supplierId) => {
        const s = suppliers.find((x) => x.id === supplierId);
        setFormData((prev) => ({
            ...prev,
            supplier_id: supplierId || '',
            supplier_name: s?.name?.trim() || '',
        }));
    };

    const handleDateChange = useCallback(async (newDate) => {
        handleInputChange('test_date', newDate);

        if (hasExistingRecord) return;

        try {
            const newRecordNumber = await fetchNextRecordNumberForDate(newDate);
            setFormData((prev) => ({ ...prev, test_date: newDate, record_number: newRecordNumber }));
        } catch {
            setFormData((prev) => ({ ...prev, test_date: newDate }));
        }
    }, [fetchNextRecordNumberForDate, hasExistingRecord]);

    const handleResultChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            test_result: value,
            leak_count: value === 'Kabul' ? 0 : Math.max(1, Number(prev.leak_count) || 0),
        }));
    };

    const handleLeakCountChange = (value) => {
        const parsedValue = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
        setFormData((prev) => ({
            ...prev,
            leak_count: parsedValue,
            test_result: Number(parsedValue) > 0 ? 'Kaçak Var' : 'Kabul',
        }));
    };

    // --- Batch item handlers ---
    const handleBatchItemChange = useCallback((index, changes) => {
        setBatchItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));
    }, []);

    const addBatchItem = useCallback(() => {
        setBatchItems((prev) => {
            const last = prev[prev.length - 1];
            return [...prev, {
                ...createDefaultItem(),
                vehicle_type_id: last?.vehicle_type_id || '',
            }];
        });
    }, []);

    const removeBatchItem = useCallback((index) => {
        setBatchItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    }, []);

    const duplicateBatchItem = useCallback((index) => {
        setBatchItems((prev) => {
            const source = prev[index];
            if (!source) return prev;
            const copy = { ...source, _key: crypto.randomUUID() };
            const next = [...prev];
            next.splice(index + 1, 0, copy);
            return next;
        });
    }, []);

    const validateForm = () => {
        if (isBatchMode) {
            if (!formData.test_date || !formData.test_start_time) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Test tarihi ve başlama saati zorunludur.' });
                return false;
            }
            if (!Number(formData.test_duration_minutes) || Number(formData.test_duration_minutes) <= 0) {
                toast({ variant: 'destructive', title: 'Geçersiz süre', description: 'Test süresi sıfırdan büyük olmalıdır.' });
                return false;
            }
            if (!formData.tested_by_personnel_id) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Testi yapan personel seçilmelidir.' });
                return false;
            }
            if (formData.welding_at_supplier) {
                if (!formData.supplier_id || !String(formData.supplier_name || '').trim()) {
                    toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Tedarikçi seçilmelidir.' });
                    return false;
                }
            } else if (!formData.welded_by_personnel_id) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Ürünü kaynatan personel seçilmelidir.' });
                return false;
            }

            for (let i = 0; i < batchItems.length; i++) {
                const item = batchItems[i];
                if (!item.vehicle_type_id) {
                    toast({ variant: 'destructive', title: 'Eksik bilgi', description: `Satır ${i + 1}: Araç tipi seçilmeli.` });
                    return false;
                }
                if (!item.tank_type) {
                    toast({ variant: 'destructive', title: 'Eksik bilgi', description: `Satır ${i + 1}: Sızdırmazlık parçası seçilmeli.` });
                    return false;
                }
                if (!availableTankTypeOptions.includes(item.tank_type)) {
                    toast({ variant: 'destructive', title: 'Geçersiz parça', description: `Satır ${i + 1}: Geçersiz sızdırmazlık parçası.` });
                    return false;
                }
                if (item.test_result === 'Kaçak Var' && (!Number(item.leak_count) || Number(item.leak_count) <= 0)) {
                    toast({ variant: 'destructive', title: 'Eksik bilgi', description: `Satır ${i + 1}: Kaçaklı sonuç için kaçak adedi girilmelidir.` });
                    return false;
                }
            }
            return true;
        }

        if (!formData.record_number) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Kayıt numarası oluşturulamadı.' });
            return false;
        }
        if (!formData.vehicle_type_id) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Lütfen araç tipini seçin.' });
            return false;
        }
        if (!formData.tank_type) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Lütfen sızdırmazlık parçasını seçin.' });
            return false;
        }
        if (!availableTankTypeOptions.includes(formData.tank_type)) {
            toast({ variant: 'destructive', title: 'Geçersiz parça', description: 'Geçersiz sızdırmazlık parçası.' });
            return false;
        }
        if (!formData.test_date || !formData.test_start_time) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Test tarihi ve başlama saati zorunludur.' });
            return false;
        }
        if (!Number(formData.test_duration_minutes) || Number(formData.test_duration_minutes) <= 0) {
            toast({ variant: 'destructive', title: 'Geçersiz süre', description: 'Test süresi sıfırdan büyük olmalıdır.' });
            return false;
        }
        if (formData.test_result === 'Kaçak Var' && (!Number(formData.leak_count) || Number(formData.leak_count) <= 0)) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Kaçaklı sonuç için kaçak adedi girilmelidir.' });
            return false;
        }
        if (!formData.tested_by_personnel_id) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Testi yapan personel seçilmelidir.' });
            return false;
        }
        if (formData.welding_at_supplier) {
            if (!formData.supplier_id || !String(formData.supplier_name || '').trim()) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Tedarikçi seçilmelidir.' });
                return false;
            }
        } else if (!formData.welded_by_personnel_id) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Ürünü kaynatan personel seçilmelidir.' });
            return false;
        }
        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isViewMode) {
            setIsOpen(false);
            return;
        }

        if (isSetupMissing) {
            toast({ variant: 'destructive', title: 'Kurulum eksik', description: 'Araç tipi veya personel listesi eksik.' });
            return;
        }

        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const atSupplier = !!formData.welding_at_supplier;

            const commonPayload = {
                test_date: formData.test_date,
                test_start_time: formData.test_start_time,
                test_duration_minutes: Number(formData.test_duration_minutes),
                tested_by_personnel_id: formData.tested_by_personnel_id || null,
                tested_by_name: previewTesterName || null,
                welded_by_personnel_id: atSupplier ? null : (formData.welded_by_personnel_id || null),
                welded_by_name: atSupplier ? null : (previewWelderName || null),
                welding_at_supplier: atSupplier,
                supplier_id: atSupplier ? (formData.supplier_id || null) : null,
                supplier_name: atSupplier ? (String(formData.supplier_name || '').trim() || null) : null,
                notes: formData.notes?.trim() || null,
                updated_at: new Date().toISOString(),
            };

            if (isBatchMode) {
                const savedRows = [];
                let ncWarnings = [];

                for (const item of batchItems) {
                    const { data: rpcNum, error: rpcError } = await supabase.rpc('next_leak_test_record_number', {
                        p_test_date: formData.test_date,
                    });
                    if (rpcError) throw rpcError;
                    if (!rpcNum) throw new Error('Kayıt numarası alınamadı.');

                    const vehicleProduct = vehicleTypes.find((v) => v.id === item.vehicle_type_id);
                    const vehicleLabel = vehicleProduct ? buildVehicleTypeLabel(vehicleProduct) : '';

                    const payload = {
                        ...commonPayload,
                        record_number: rpcNum,
                        vehicle_type_id: item.vehicle_type_id || null,
                        vehicle_type_label: vehicleLabel || null,
                        vehicle_serial_number: item.vehicle_serial_number?.trim() || null,
                        part_code: item.part_code?.trim() || null,
                        tank_type: item.tank_type,
                        test_result: item.test_result,
                        leak_count: item.test_result === 'Kaçak Var' ? Number(item.leak_count) : 0,
                        created_by: user?.id || null,
                    };

                    const { data, error } = await supabase
                        .from('leak_test_records')
                        .insert([payload])
                        .select('*')
                        .single();

                    if (error) throw error;
                    savedRows.push(data);
                }

                for (const row of savedRows) {
                    try {
                        await syncLeakTestNonconformity({ supabase, leakTestRecord: row, userId: user?.id || null });
                    } catch (syncError) {
                        ncWarnings.push(`${row.record_number}: ${syncError.message}`);
                    }
                }

                const ncWarnText = ncWarnings.length > 0
                    ? ` (Uygunsuzluk senkronu uyarıları: ${ncWarnings.join('; ')})`
                    : '';

                toast({
                    title: 'Toplu kayıt tamamlandı',
                    description: `${savedRows.length} adet sızdırmazlık kaydı oluşturuldu.${ncWarnText}`,
                });

                setIsOpen(false);
                onSuccess?.();
                return;
            }

            // Single record (edit mode)
            let recordNumber = formData.record_number;
            if (!isEditMode) {
                const { data: rpcNum, error: rpcError } = await supabase.rpc('next_leak_test_record_number', {
                    p_test_date: formData.test_date,
                });
                if (rpcError) throw rpcError;
                if (!rpcNum) throw new Error('Kayıt numarası alınamadı.');
                recordNumber = rpcNum;
            }

            const payload = {
                ...commonPayload,
                record_number: recordNumber,
                vehicle_type_id: formData.vehicle_type_id || null,
                vehicle_type_label: previewVehicleLabel || null,
                vehicle_serial_number: formData.vehicle_serial_number?.trim() || null,
                part_code: formData.part_code?.trim() || null,
                tank_type: formData.tank_type,
                test_result: formData.test_result,
                leak_count: formData.test_result === 'Kaçak Var' ? Number(formData.leak_count) : 0,
            };

            let savedRow = null;

            if (isEditMode && record?.id) {
                const { data, error } = await supabase
                    .from('leak_test_records')
                    .update(payload)
                    .eq('id', record.id)
                    .select('*')
                    .single();

                if (error) throw error;
                savedRow = data;

                toast({ title: 'Kayıt güncellendi', description: `${payload.record_number} başarıyla güncellendi.` });
            } else {
                const { data, error } = await supabase
                    .from('leak_test_records')
                    .insert([{ ...payload, created_by: user?.id || null }])
                    .select('*')
                    .single();

                if (error) throw error;
                savedRow = data;

                toast({ title: 'Kayıt oluşturuldu', description: `${payload.record_number} başarıyla kaydedildi.` });
            }

            try {
                await syncLeakTestNonconformity({ supabase, leakTestRecord: savedRow, userId: user?.id || null });
            } catch (syncError) {
                toast({
                    variant: 'destructive',
                    title: 'Uygunsuzluk senkronu',
                    description: syncError?.message || 'Kayıt kaydedildi ancak uygunsuzluk aktarımında hata oluştu.',
                });
            }

            setIsOpen(false);
            onSuccess?.();
        } catch (error) {
            if (isTankTypeConstraintError(error)) {
                applyTankTypeMode('legacy');
                toast({
                    variant: 'destructive',
                    title: 'Sızdırmazlık parçası desteklenmiyor',
                    description: 'Sunucuda yeni tank/parça tipleri henüz aktif değil.',
                });
                return;
            }

            toast({
                variant: 'destructive',
                title: 'Kayıt işlemi başarısız',
                description: error.message || 'Sızdırmazlık testi kaydedilemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const batchSummary = isBatchMode ? {
        total: batchItems.length,
        accepted: batchItems.filter((i) => i.test_result === 'Kabul').length,
        leaked: batchItems.filter((i) => i.test_result === 'Kaçak Var').length,
    } : null;

    const rightPanel = (
        <div className="p-4 space-y-3">
            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-700">Kayıt Özeti</p>
                        {isBatchMode ? (
                            <p className="mt-0.5 text-lg font-bold text-slate-900">{batchSummary.total} test satırı</p>
                        ) : (
                            <p className="mt-0.5 text-lg font-bold text-slate-900">{formData.record_number || '-'}</p>
                        )}
                    </div>
                    {isBatchMode ? (
                        <div className="flex gap-1">
                            <Badge variant="success">{batchSummary.accepted}</Badge>
                            {batchSummary.leaked > 0 && <Badge variant="destructive">{batchSummary.leaked}</Badge>}
                        </div>
                    ) : (
                        <Badge variant={previewResultVariant}>{formData.test_result || '-'}</Badge>
                    )}
                </div>
                {!isBatchMode && (
                    <>
                        <p className="mt-2 text-sm text-slate-700">{previewVehicleLabel || '-'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formData.tank_type || 'Sızdırmazlık parçası seçilmedi'}</p>
                        {formData.part_code?.trim() ? (
                            <p className="mt-0.5 text-xs font-medium text-slate-600">Parça kodu: {formData.part_code.trim()}</p>
                        ) : null}
                    </>
                )}
            </div>

            <div className="rounded-lg border bg-background p-3 space-y-2.5">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Test Tarihi</p>
                    <p className="text-sm font-medium text-foreground">{formatTestDate(formData.test_date)}</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Başlangıç / Bitiş</p>
                    <p className="text-sm font-medium text-foreground">
                        {formData.test_start_time || '-'} / {computedEndTime}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Test Süresi</p>
                    <p className="text-sm font-medium text-foreground">{formatDuration(formData.test_duration_minutes)}</p>
                </div>
                {!isBatchMode && (
                    <>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Araç Seri No</p>
                            <p className="text-sm font-medium text-foreground">{formData.vehicle_serial_number || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kaçak Adedi</p>
                            <p className={`text-sm font-semibold ${formData.test_result === 'Kaçak Var' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formData.test_result === 'Kaçak Var' ? `${formData.leak_count || 0} adet` : 'Kaçak yok'}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Testi Yapan</p>
                    <p className="text-sm font-medium text-foreground">{previewTesterName}</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {formData.welding_at_supplier ? 'Kaynak tedarikçi' : 'Ürünü kaynatan'}
                    </p>
                    <p className="text-sm font-medium text-foreground">{previewWelderOrSupplier}</p>
                </div>
            </div>

            {formData.notes && (
                <div className="rounded-lg border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notlar</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">{formData.notes}</p>
                </div>
            )}
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title={
                isViewMode
                    ? 'Sızdırmazlık Kaydını Görüntüle'
                    : isEditMode
                        ? 'Sızdırmazlık Kaydını Düzenle'
                        : 'Yeni Sızdırmazlık Kaydı'
            }
            subtitle="Girdi ve Üretim Kalite"
            icon={<Droplets className="h-5 w-5 text-white" />}
            badge={isViewMode ? null : isEditMode ? 'Düzenleme' : isBatchMode ? `${batchItems.length} satır` : 'Yeni'}
            onCancel={() => setIsOpen(false)}
            onSubmit={isViewMode ? () => setIsOpen(false) : handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel={
                isViewMode ? 'Kapat'
                    : isEditMode ? 'Güncelle'
                        : isBatchMode ? `${batchItems.length} Kayıt Oluştur`
                            : 'Kaydet'
            }
            cancelLabel={isViewMode ? 'Geri' : 'İptal'}
            formId="leak-test-form"
            footerDate={formData.test_date}
            rightPanel={rightPanel}
            maxWidth="sm:max-w-7xl"
        >
            <form id="leak-test-form" onSubmit={handleSubmit} className="p-5 space-y-5">
                {isSetupMissing && !setupLoading && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Formun tam çalışması için <strong>Ayarlar &gt; Personel</strong> bölümünde aktif personel ve
                        <strong> Ayarlar &gt; Ürünler</strong> bölümünde araç tipleri tanımlı olmalıdır.
                    </div>
                )}

                {/* Common: date, time, duration */}
                <section>
                    <ModalSectionHeader>Kayıt Bilgisi</ModalSectionHeader>
                    <div className={`grid grid-cols-1 gap-4 ${isBatchMode ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                        {!isBatchMode && (
                            <ModalField label="Kayıt No" required>
                                <LeadingIconField icon={FileText}>
                                    <Input
                                        value={formData.record_number}
                                        readOnly
                                        className="bg-muted/30"
                                        style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                                    />
                                </LeadingIconField>
                            </ModalField>
                        )}

                        <ModalField label="Test Tarihi" required>
                            <LeadingIconField icon={CalendarDays}>
                                <Input
                                    type="date"
                                    value={formData.test_date}
                                    onChange={(event) => handleDateChange(event.target.value)}
                                    style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                                    disabled={isViewMode}
                                    required
                                />
                            </LeadingIconField>
                        </ModalField>

                        <ModalField label="Test Başlama Saati" required>
                            <LeadingIconField icon={Clock3}>
                                <Input
                                    type="time"
                                    value={formData.test_start_time}
                                    onChange={(event) => handleInputChange('test_start_time', event.target.value)}
                                    style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                                    disabled={isViewMode}
                                    required
                                />
                            </LeadingIconField>
                        </ModalField>

                        <ModalField label="Test Süresi (dk)" required>
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                value={formData.test_duration_minutes}
                                onChange={(event) => handleInputChange('test_duration_minutes', event.target.value)}
                                disabled={isViewMode}
                                required
                            />
                        </ModalField>
                    </div>
                </section>

                {/* Batch mode: item rows */}
                {isBatchMode ? (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Test Satırları</h3>
                                <span className="text-[10px] text-muted-foreground">
                                    (her satır ayrı kayıt oluşturur)
                                </span>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addBatchItem}>
                                <Plus className="mr-1 h-3 w-3" />
                                Satır Ekle
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {batchItems.map((item, index) => (
                                <BatchItemRow
                                    key={item._key}
                                    item={item}
                                    index={index}
                                    vehicleTypeOptions={vehicleTypeOptions}
                                    tankTypeOptions={availableTankTypeOptions}
                                    isViewMode={isViewMode}
                                    onChange={handleBatchItemChange}
                                    onRemove={removeBatchItem}
                                    onDuplicate={duplicateBatchItem}
                                    canRemove={batchItems.length > 1}
                                />
                            ))}
                        </div>
                    </section>
                ) : (
                    /* Single record mode: vehicle/tank/result fields inline */
                    <section>
                        <ModalSectionHeader>Ürün ve Sonuç</ModalSectionHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                    Araç Tipi <span className="text-destructive">*</span>
                                </Label>
                                {isViewMode ? (
                                    <Input value={previewVehicleLabel || '-'} readOnly className="bg-muted/30" />
                                ) : (
                                    <SearchableSelectDialog
                                        options={vehicleTypeOptions}
                                        value={formData.vehicle_type_id}
                                        onChange={(value) => handleInputChange('vehicle_type_id', value)}
                                        triggerPlaceholder={setupLoading ? 'Araç tipleri yükleniyor...' : 'Araç tipi seçin...'}
                                        dialogTitle="Araç Tipi Seç"
                                        searchPlaceholder="Araç tipi ara..."
                                        notFoundText="Araç tipi bulunamadı."
                                    />
                                )}
                            </div>

                            <ModalField label="Sızdırmazlık Parçası" required>
                                <Select value={formData.tank_type} onValueChange={(value) => handleInputChange('tank_type', value)} disabled={isViewMode}>
                                    <SelectTrigger><SelectValue placeholder="Parça seçin" /></SelectTrigger>
                                    <SelectContent>
                                        {availableTankTypeOptions.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </ModalField>

                            <ModalField label="Parça kodu">
                                <LeadingIconField icon={Package}>
                                    <Input
                                        value={formData.part_code}
                                        onChange={(event) => handleInputChange('part_code', event.target.value)}
                                        style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                                        placeholder="Örn: ABC-12345"
                                        disabled={isViewMode}
                                    />
                                </LeadingIconField>
                            </ModalField>

                            <ModalField label="Araç Seri Numarası">
                                <LeadingIconField icon={Hash}>
                                    <Input
                                        value={formData.vehicle_serial_number}
                                        onChange={(event) => handleInputChange('vehicle_serial_number', event.target.value)}
                                        style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                                        placeholder="Örn: ARC-2026-0148"
                                        disabled={isViewMode}
                                    />
                                </LeadingIconField>
                            </ModalField>

                            <ModalField label="Test Sonucu" required>
                                <Select value={formData.test_result} onValueChange={handleResultChange} disabled={isViewMode}>
                                    <SelectTrigger><SelectValue placeholder="Sonuç seçin" /></SelectTrigger>
                                    <SelectContent>
                                        {TEST_RESULT_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </ModalField>

                            <ModalField label="Kaçak Adedi">
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.leak_count}
                                    onChange={(event) => handleLeakCountChange(event.target.value)}
                                    disabled={isViewMode}
                                />
                            </ModalField>
                        </div>

                        {isLegacyTankTypeMode && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Sunucuda genişletilmiş sızdırmazlık parçası listesi henüz aktif değil.
                            </div>
                        )}
                    </section>
                )}

                {/* Welding source */}
                <section>
                    <ModalSectionHeader>Kaynak ortamı</ModalSectionHeader>
                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    Kaynak tedarikçide yapıldı
                                </div>
                                <p className="text-xs text-muted-foreground max-w-xl">
                                    Ürün kaynağı fabrika dışında (tedarikçi tesisinde) yapıldıysa bu seçeneği açın ve tedarikçiyi seçin.
                                </p>
                            </div>
                            <Switch
                                checked={!!formData.welding_at_supplier}
                                onCheckedChange={handleWeldingAtSupplierChange}
                                disabled={isViewMode}
                                aria-label="Kaynak tedarikçide yapıldı"
                            />
                        </div>
                        {formData.welding_at_supplier && (
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                    Kaynağı yapan tedarikçi <span className="text-destructive">*</span>
                                </Label>
                                {isViewMode ? (
                                    <Input value={formData.supplier_name || '-'} readOnly className="bg-muted/30" />
                                ) : (
                                    <SearchableSelectDialog
                                        options={supplierOptions}
                                        value={formData.supplier_id}
                                        onChange={handleSupplierChange}
                                        triggerPlaceholder={setupLoading ? 'Tedarikçiler yükleniyor...' : 'Tedarikçi seçin...'}
                                        dialogTitle="Tedarikçi seç"
                                        searchPlaceholder="Tedarikçi ara..."
                                        notFoundText="Tedarikçi bulunamadı."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Personnel */}
                <section>
                    <ModalSectionHeader>Sorumlular</ModalSectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                Testi Yapan <span className="text-destructive">*</span>
                            </Label>
                            {isViewMode ? (
                                <Input value={previewTesterName} readOnly className="bg-muted/30" />
                            ) : (
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.tested_by_personnel_id}
                                    onChange={(value) => handleInputChange('tested_by_personnel_id', value)}
                                    triggerPlaceholder={setupLoading ? 'Personel yükleniyor...' : 'Personel seçin...'}
                                    dialogTitle="Testi Yapan Personeli Seç"
                                    searchPlaceholder="Personel ara..."
                                    notFoundText="Personel bulunamadı."
                                />
                            )}
                        </div>

                        {!formData.welding_at_supplier && (
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                    Ürünü Kaynatan <span className="text-destructive">*</span>
                                </Label>
                                {isViewMode ? (
                                    <Input value={previewWelderName} readOnly className="bg-muted/30" />
                                ) : (
                                    <SearchableSelectDialog
                                        options={personnelOptions}
                                        value={formData.welded_by_personnel_id}
                                        onChange={(value) => handleInputChange('welded_by_personnel_id', value)}
                                        triggerPlaceholder={setupLoading ? 'Personel yükleniyor...' : 'Personel seçin...'}
                                        dialogTitle="Ürünü Kaynatan Personeli Seç"
                                        searchPlaceholder="Personel ara..."
                                        notFoundText="Personel bulunamadı."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Notes */}
                <section>
                    <ModalSectionHeader>Ek Not</ModalSectionHeader>
                    <ModalField label="Açıklama">
                        <Textarea
                            value={formData.notes}
                            onChange={(event) => handleInputChange('notes', event.target.value)}
                            disabled={isViewMode}
                            rows={3}
                            placeholder="Teste ilişkin ek bilgi, gözlem veya aksiyon notunu yazabilirsiniz."
                        />
                    </ModalField>
                </section>

                {isBatchMode && isLegacyTankTypeMode && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Sunucuda genişletilmiş sızdırmazlık parçası listesi henüz aktif değil.
                    </div>
                )}

                {!isBatchMode && (
                    <div className="rounded-lg border bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>
                                Sonuç <strong>Kabul</strong> → kaçak adedi 0 olur. Kaçak adedi &gt; 0 → sonuç <strong>Kaçak Var</strong> olur.
                            </span>
                        </div>
                    </div>
                )}
            </form>
        </ModernModalLayout>
    );
};

export default LeakTestFormModal;
