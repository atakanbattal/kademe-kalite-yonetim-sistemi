import React, { useState, useEffect, useCallback } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Textarea } from '@/components/ui/textarea';
    import { Switch } from '@/components/ui/switch';
    import { COST_TYPES, VEHICLE_TYPES, MEASUREMENT_UNITS } from './constants';
    import { Zap, Trash2, Plus, Wrench, Briefcase, AlertCircle } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Badge } from '@/components/ui/badge';

    const formatCurrency = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '0,00 ₺';
        return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    // Basit ve Kullanışlı Aranabilir Select Componenti
    const SearchableSelect = ({ value, onValueChange, placeholder, items, searchPlaceholder = "Ara..." }) => {
        const [search, setSearch] = useState('');
        const [open, setOpen] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState(0);
        const filteredItems = items.filter(item => 
            item.toLowerCase().includes(search.toLowerCase())
        );

        const handleSelect = (item) => {
            onValueChange(item);
            setSearch('');
            setOpen(false);
            setHighlightedIndex(0);
        };

        const handleKeyDown = (e) => {
            if (!open) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems.length > 0) {
                    handleSelect(filteredItems[highlightedIndex]);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) => 
                    prev < filteredItems.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
        };

        // Eğer arama yapılıyorsa search göster, yoksa seçilen değeri göster
        const displayValue = open ? search : (search || value);

        return (
            <div className="relative">
                <input
                    type="text"
                    placeholder={!open && !value ? placeholder : searchPlaceholder}
                    value={displayValue}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                {open && filteredItems.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-input rounded-md shadow-lg z-50">
                        <div className="max-h-48 overflow-y-auto">
                            {filteredItems.map((item, index) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleSelect(item)}
                                    className={`w-full text-left px-3 py-2 transition-colors text-sm ${
                                        highlightedIndex === index 
                                            ? 'bg-accent text-accent-foreground' 
                                            : 'hover:bg-accent'
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Personel için Aranabilir Select
    const PersonnelSearchableSelect = ({ value, onValueChange, placeholder, items, searchPlaceholder = "Personel ara..." }) => {
        const [search, setSearch] = useState('');
        const [open, setOpen] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState(0);
        const filteredItems = items.filter(item =>
            item.full_name.toLowerCase().includes(search.toLowerCase())
        );
        const selectedName = items.find(p => p.id === value)?.full_name;

        const handleSelect = (item) => {
            onValueChange(item.id);
            setSearch('');
            setOpen(false);
            setHighlightedIndex(0);
        };

        const handleKeyDown = (e) => {
            if (!open) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems.length > 0) {
                    handleSelect(filteredItems[highlightedIndex]);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) => 
                    prev < filteredItems.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
        };

        // Eğer arama yapılıyorsa search göster, yoksa seçilen değeri göster
        const displayValue = open ? search : (search || selectedName || '');

        return (
            <div className="relative">
                <input
                    type="text"
                    placeholder={!open && !value ? placeholder : searchPlaceholder}
                    value={displayValue}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                {open && filteredItems.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-input rounded-md shadow-lg z-50">
                        <div className="max-h-48 overflow-y-auto">
                            {filteredItems.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelect(item)}
                                    className={`w-full text-left px-3 py-2 transition-colors text-sm ${
                                        highlightedIndex === index 
                                            ? 'bg-accent text-accent-foreground' 
                                            : 'hover:bg-accent'
                                    }`}
                                >
                                    {item.full_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getStatusBadgeVariant = (status) => {
        switch (status) {
            case 'Onaylı': return 'success';
            case 'Askıya Alınmış': return 'warning';
            case 'Red': return 'destructive';
            default: return 'secondary';
        }
    };

    export const CostFormModal = ({ open, setOpen, refreshCosts, unitCostSettings, materialCostSettings, personnelList, existingCost, onOpenNCForm }) => {
        const { toast } = useToast();
        const isEditMode = !!existingCost;
        const [formData, setFormData] = useState({});
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [autoCalculate, setAutoCalculate] = useState(true);
        const [addLaborToScrap, setAddLaborToScrap] = useState(false);
        const [totalReworkCost, setTotalReworkCost] = useState(0);
        const [affectedUnits, setAffectedUnits] = useState([]);
        const [isSupplierNC, setIsSupplierNC] = useState(false);
        const [suppliers, setSuppliers] = useState([]);
        const [selectedSupplierStatus, setSelectedSupplierStatus] = useState(null);
        const [createNC, setCreateNC] = useState(false);

        const materialTypes = materialCostSettings.map(m => m.material_name);
        const departments = unitCostSettings.map(u => u.unit_name);

        const getInitialFormData = useCallback(() => ({
            cost_type: '', unit: '', vehicle_type: '', part_code: '', part_name: '',
            material_type: '', part_location: '', amount: '', cost_date: new Date().toISOString().slice(0, 10),
            description: '', status: 'Aktif', rework_duration: '', scrap_weight: '', responsible_personnel_id: null,
            quantity: '', measurement_unit: '', affected_units: [],
            additional_labor_cost: 0,
            unit_cost: 0, // Birim başına maliyet
            supplier_id: null,
            is_supplier_nc: false,
        }), []);

        // Tedarikçileri yükle
        useEffect(() => {
            const fetchSuppliers = async () => {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('id, name, status');
                if (!error) {
                    setSuppliers(data.map(s => ({ value: s.id, label: s.name, status: s.status })));
                }
            };
            if (open) {
                fetchSuppliers();
            }
        }, [open]);

        // Tedarikçi durumunu kontrol et
        useEffect(() => {
            if (formData.supplier_id) {
                const supplier = suppliers.find(s => s.value === formData.supplier_id);
                if (supplier) {
                    setSelectedSupplierStatus(supplier.status);
                }
            } else {
                setSelectedSupplierStatus(null);
            }
        }, [formData.supplier_id, suppliers]);

        // Tedarikçi toggle durumunu senkronize et
        useEffect(() => {
            setIsSupplierNC(!!formData.is_supplier_nc);
        }, [formData.is_supplier_nc]);

        useEffect(() => {
            const initialData = getInitialFormData();
            let costData = isEditMode ? { ...initialData, ...existingCost } : initialData;
            
            // Join edilmiş objeleri temizle (sadece ID'ler kalmalı)
            if (costData.responsible_personnel) {
                delete costData.responsible_personnel;
            }
            if (costData.non_conformities) {
                delete costData.non_conformities;
            }
            if (costData.suppliers) {
                delete costData.suppliers;
            }
            if (costData.supplier) {
                delete costData.supplier;
            }
            
            if (costData.cost_date) {
                costData.cost_date = new Date(costData.cost_date).toISOString().slice(0, 10);
            }
            
            setFormData(costData);
            setAffectedUnits(costData.affected_units || []);
            setAddLaborToScrap(!!costData.additional_labor_cost && costData.additional_labor_cost > 0);
            setIsSupplierNC(!!costData.is_supplier_nc);

            if (isEditMode) {
              setAutoCalculate(true);
            } else {
              setAutoCalculate(true);
              setTotalReworkCost(0);
            }
        }, [existingCost, isEditMode, open, getInitialFormData]);


        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (id, value) => {
            setFormData(prev => ({ ...prev, [id]: value }));
        };
        
        const handleAffectedUnitChange = (id, field, value) => {
            setAffectedUnits(units => units.map(u => u.id === id ? { ...u, [field]: value } : u));
        };

        const addAffectedUnit = () => {
            setAffectedUnits(units => [...units, { id: uuidv4(), unit: '', duration: '' }]);
        };

        const removeAffectedUnit = (id) => {
            setAffectedUnits(units => units.filter(u => u.id !== id));
        };

        const handleSupplierToggle = (checked) => {
            setIsSupplierNC(checked);
            setFormData(prev => ({
                ...prev,
                is_supplier_nc: checked,
                supplier_id: checked ? prev.supplier_id : null,
            }));
        };

        const calculateScrapOrWasteCost = useCallback((data) => {
            if ((data.cost_type === 'Hurda Maliyeti' || data.cost_type === 'Fire Maliyeti') && data.material_type && data.scrap_weight > 0) {
                const materialSetting = materialCostSettings.find(m => m.material_name === data.material_type);
                if (materialSetting) {
                    const purchasePrice = parseFloat(materialSetting.purchase_price_per_kg) || 0;
                    const scrapPrice = parseFloat(materialSetting.scrap_price_per_kg) || 0;
                    const weight = parseFloat(data.scrap_weight) || 0;
                    let materialCost = (purchasePrice - scrapPrice) * weight;
                    
                    // Adet ile çarp
                    const quantity = parseFloat(data.quantity) || 1;
                    materialCost = materialCost * quantity;
                    
                    let totalCost = materialCost;

                    if (data.cost_type === 'Hurda Maliyeti' && addLaborToScrap) {
                        const laborCost = materialCost * 0.5;
                        totalCost = materialCost * 1.5;
                        setFormData(prev => ({ ...prev, additional_labor_cost: laborCost }));
                    } else {
                        setFormData(prev => ({ ...prev, additional_labor_cost: 0 }));
                    }

                    return totalCost;
                }
            }
            return null;
        }, [materialCostSettings, addLaborToScrap]);

        const calculateReworkCost = useCallback(() => {
            let totalCost = 0;

            const mainDuration = parseFloat(formData.rework_duration) || 0;
            if (formData.unit && mainDuration > 0) {
                const unitSetting = unitCostSettings.find(u => u.unit_name === formData.unit);
                if(unitSetting) {
                    totalCost += mainDuration * (parseFloat(unitSetting.cost_per_minute) || 0);
                }
            }

            affectedUnits.forEach(au => {
                const duration = parseFloat(au.duration) || 0;
                if (au.unit && duration > 0) {
                    const unitSetting = unitCostSettings.find(u => u.unit_name === au.unit);
                    if (unitSetting) {
                        totalCost += duration * (parseFloat(unitSetting.cost_per_minute) || 0);
                    }
                }
            });
            
            // Adet ile çarp (birim başına maliyet x adet)
            const quantity = parseFloat(formData.quantity) || 1;
            totalCost = totalCost * quantity;
            
            return totalCost;
        }, [formData.rework_duration, formData.unit, formData.quantity, affectedUnits, unitCostSettings]);


        useEffect(() => {
            if (!autoCalculate) return;

            setFormData(currentFormData => {
                let newAmount = currentFormData.amount;
        
                if (currentFormData.cost_type === 'Hurda Maliyeti' || currentFormData.cost_type === 'Fire Maliyeti') {
                    const autoCalculatedCost = calculateScrapOrWasteCost(currentFormData);
                    if (autoCalculatedCost !== null) {
                        newAmount = autoCalculatedCost;
                    }
                } else if (currentFormData.cost_type === 'Yeniden İşlem Maliyeti') {
                    const totalRework = calculateReworkCost();
                    setTotalReworkCost(totalRework);
                    newAmount = totalRework;
                }
                
                if (newAmount !== currentFormData.amount) {
                    return { ...currentFormData, amount: newAmount };
                }
                return currentFormData;
            });
        }, [formData.cost_type, formData.unit, formData.rework_duration, formData.material_type, formData.scrap_weight, formData.quantity, affectedUnits, autoCalculate, addLaborToScrap, unitCostSettings, calculateScrapOrWasteCost, calculateReworkCost]);


        const handleSubmit = async (e) => {
            e.preventDefault();
            
            // Tedarikçi doğrulama
            if (isSupplierNC && !formData.supplier_id) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tedarikçi kaynaklı maliyet için tedarikçi seçmelisiniz.' });
                return;
            }
            
            const isRework = formData.cost_type === 'Yeniden İşlem Maliyeti';
            const isScrap = formData.cost_type === 'Hurda Maliyeti';
            const isWaste = formData.cost_type === 'Fire Maliyeti';
            const hasMainRework = parseFloat(formData.rework_duration) > 0;
            
            if (isRework) {
                if (!hasMainRework && affectedUnits.length === 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'En az bir yeniden işlem süresi veya etkilenen birim girmelisiniz.' });
                    return;
                }
                // Birim kontrolü: Ana işlem süresi girildiğinde zorunlu
                if(hasMainRework && !formData.unit) {
                     toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Ana işlem süresi girildiğinde "Birim (Kaynak)" seçimi zorunludur.' });
                     return;
                }
                // Adet zorunlu kontrolü
                if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Yeniden işlem maliyeti için adet girmek zorunludur.' });
                    return;
                }
            } else if (isScrap || isWaste) {
                // Adet zorunlu kontrolü
                if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Hurda/Fire maliyeti için adet girmek zorunludur.' });
                    return;
                }
                // Birim kontrolü: Her durumda zorunlu (maliyet hesaplaması için)
                if (!formData.unit) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Maliyet hesaplaması için Birim (Kaynak) alanı zorunludur.' });
                    return;
                }
                if (!formData.cost_type || !formData.vehicle_type || formData.amount === '' || !formData.cost_date) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen yıldızlı zorunlu alanları doldurun.' });
                    return;
                }
            } else {
                // Diğer maliyet türleri için birim kontrolü: Her durumda zorunlu
                if (!formData.unit) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Maliyet hesaplaması için Birim (Kaynak) alanı zorunludur.' });
                    return;
                }
                if (!formData.cost_type || !formData.vehicle_type || formData.amount === '' || !formData.cost_date) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen yıldızlı zorunlu alanları doldurun.' });
                    return;
                }
            }

            let submissionData = { ...formData };
            submissionData.affected_units = affectedUnits.map(({ id, ...rest }) => rest).filter(au => au.unit && parseFloat(au.duration) > 0);
            
            setIsSubmitting(true);
            submissionData.amount = parseFloat(submissionData.amount);
            submissionData.quantity = submissionData.quantity ? parseFloat(submissionData.quantity) : null;
            submissionData.scrap_weight = submissionData.scrap_weight ? parseFloat(submissionData.scrap_weight) : null;
            submissionData.rework_duration = submissionData.rework_duration ? parseInt(submissionData.rework_duration) : null;
            
            if (submissionData.cost_type === 'Hurda Maliyeti' && addLaborToScrap) {
                const materialSetting = materialCostSettings.find(m => m.material_name === submissionData.material_type);
                if (materialSetting) {
                    const purchasePrice = parseFloat(materialSetting.purchase_price_per_kg) || 0;
                    const scrapPrice = parseFloat(materialSetting.scrap_price_per_kg) || 0;
                    const weight = parseFloat(submissionData.scrap_weight) || 0;
                    const quantity = parseFloat(submissionData.quantity) || 1;
                    const materialCost = (purchasePrice - scrapPrice) * weight * quantity;
                    submissionData.additional_labor_cost = materialCost * 0.5;
                    submissionData.amount = materialCost * 1.5;
                } else {
                    submissionData.additional_labor_cost = 0;
                }
            } else {
                submissionData.additional_labor_cost = 0;
            }
            
            // Tedarikçi değilse tedarikçi bilgilerini temizle
            if (!submissionData.is_supplier_nc) {
                submissionData.supplier_id = null;
            }
            
            // Sorumlu personel boşsa null yap
            if (submissionData.responsible_personnel_id === '') {
                submissionData.responsible_personnel_id = null;
            }

            // quality_control_duration'ı yedekle (NC için gerekli)
            const quality_control_duration_backup = submissionData.quality_control_duration;
            
            delete submissionData.quality_control_duration;
            delete submissionData.unit_cost;

            // İlişkili verileri temizle (sadece ID'ler gönderilmeli - join edilmiş objeler)
            delete submissionData.responsible_personnel;
            delete submissionData.non_conformities;
            delete submissionData.suppliers;
            delete submissionData.supplier; // Join edilmiş supplier objesi
            
            if (isEditMode) {
                const { error } = await supabase.from('quality_costs').update(submissionData).eq('id', existingCost.id);
                if (error) {
                     toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet güncellenemedi: ${error.message}` });
                } else {
                    toast({ title: 'Başarılı!', description: 'Maliyet kaydı güncellendi.' });
                    refreshCosts();
                    setOpen(false);
                }
            } else {
                delete submissionData.id;
                const { data: insertedCost, error } = await supabase
                    .from('quality_costs')
                    .insert([submissionData])
                    .select()
                    .single();
                    
                 if (error) {
                    toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet eklenemedi: ${error.message}` });
                } else {
                    toast({ title: 'Başarılı!', description: 'Maliyet kaydı eklendi.' });
                    refreshCosts();
                    setOpen(false);
                    
                    // Uygunsuzluk oluştur checkbox'ı işaretliyse
                    if (createNC && onOpenNCForm && insertedCost) {
                        console.log('📋 Kayıt sonrası uygunsuzluk oluşturuluyor:', insertedCost);
                        
                        // Comprehensive record oluştur
                        const ncRecord = {
                            id: insertedCost.id,
                            source: 'cost',
                            source_cost_id: insertedCost.id,
                            
                            // Parça/Ürün Bilgileri
                            part_name: insertedCost.part_name || '',
                            part_code: insertedCost.part_code || '',
                            vehicle_type: insertedCost.vehicle_type || '',
                            part_location: insertedCost.part_location || '',
                            
                            // Maliyet Bilgileri
                            cost_type: insertedCost.cost_type || '',
                            amount: insertedCost.amount || 0,
                            unit: insertedCost.unit || '',
                            cost_date: insertedCost.cost_date || '',
                            
                            // Miktar Bilgileri
                            quantity: insertedCost.quantity || null,
                            measurement_unit: insertedCost.measurement_unit || '',
                            scrap_weight: insertedCost.scrap_weight || null,
                            material_type: insertedCost.material_type || '',
                            affected_units: insertedCost.affected_units || null,
                            
                            // Süre Bilgileri (Yedekten al)
                            rework_duration: insertedCost.rework_duration || null,
                            quality_control_duration: quality_control_duration_backup || null,
                            
                            // Açıklama ve Sorumlu
                            description: insertedCost.description || '',
                            responsible_personnel_id: insertedCost.responsible_personnel_id || null,
                        };
                        
                        // Uygunsuzluk formunu aç
                        setTimeout(() => {
                            onOpenNCForm(ncRecord, () => {
                                refreshCosts();
                            });
                        }, 300);
                    }
                }
            }
            setIsSubmitting(false);
        };

        const isReworkCost = formData.cost_type === 'Yeniden İşlem Maliyeti';
        const isScrapCost = formData.cost_type === 'Hurda Maliyeti';
        const isWasteCost = formData.cost_type === 'Fire Maliyeti';
        const showQuantityFields = formData.cost_type && !isReworkCost && !isScrapCost && !isWasteCost;
        const showQuantityForReworkAndScrap = isReworkCost || isScrapCost || isWasteCost;
        const isAmountReadOnly = (isScrapCost || isReworkCost || isWasteCost) && autoCalculate;
        const isVehicleTypeRequired = !(isWasteCost);

        const supplierOptions = suppliers.map(s => ({
            ...s,
            label: (
                <div className="flex items-center justify-between w-full">
                    <span>{s.label}</span>
                    <Badge variant={getStatusBadgeVariant(s.status)}>{s.status}</Badge>
                </div>
            )
        }));

        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{isEditMode ? 'Maliyet Kaydını Düzenle' : 'Yeni Kalitesizlik Maliyeti Kaydı'}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">{isEditMode ? 'Mevcut maliyet kaydının detaylarını güncelleyin.' : 'Yeni bir maliyet girdisi oluşturun.'}</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-wrap gap-4">
                        {(isScrapCost || isReworkCost || isWasteCost) && (
                            <div className="flex items-center space-x-2 p-3 bg-secondary rounded-md">
                                <Switch id="auto-calculate" checked={autoCalculate} onCheckedChange={setAutoCalculate} />
                                <Label htmlFor="auto-calculate" className="flex items-center gap-2 cursor-pointer">
                                    <Zap className="w-5 h-5 text-yellow-500"/> 
                                    <span className="font-semibold">Otomatik Maliyet Hesapla</span>
                                </Label>
                            </div>
                        )}
                        {isScrapCost && (
                            <div className="flex items-center space-x-2 p-3 bg-secondary rounded-md">
                                <Switch id="add-labor-cost" checked={addLaborToScrap} onCheckedChange={setAddLaborToScrap} />
                                <Label htmlFor="add-labor-cost" className="flex items-center gap-2 cursor-pointer">
                                    <Wrench className="w-5 h-5 text-blue-500"/>
                                    <span className="font-semibold">İşçilik Maliyetini %50 Ekle</span>
                                </Label>
                            </div>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 pt-4 max-h-[65vh] overflow-y-auto pr-2">
                        
                        <div className="md:col-span-3 flex items-center space-x-2 bg-muted/50 p-3 rounded-lg">
                            <Switch id="is_supplier_nc" checked={isSupplierNC} onCheckedChange={handleSupplierToggle} />
                            <Label htmlFor="is_supplier_nc" className="flex items-center gap-2 cursor-pointer text-md font-semibold">
                                <Briefcase className="w-5 h-5 text-primary" /> Tedarikçi Kaynaklı Maliyet
                            </Label>
                        </div>

                        {isSupplierNC && (
                            <div className="md:col-span-3 space-y-2">
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Tedarikçi Modu Aktif</AlertTitle>
                                    <AlertDescription>
                                        <strong>Maliyet hesaplaması:</strong> Birim, süre ve malzeme bilgilerine göre normal şekilde yapılacak.<br/>
                                        <strong>Sorumluluk:</strong> Bu maliyet seçilen tedarikçiye atanacak ve DF/8D uygunsuzluğu oluşturulabilir.
                                    </AlertDescription>
                                </Alert>

                                {selectedSupplierStatus && selectedSupplierStatus !== 'Onaylı' && (
                                    <Alert variant="warning" className="mt-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Uyarı: Tedarikçi Statüsü</AlertTitle>
                                        <AlertDescription>
                                            Bu tedarikçi "{selectedSupplierStatus}" statüsündedir. Maliyet kaydedilebilir ancak dikkatli olunmalıdır.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Label htmlFor="supplier_id">Tedarikçi <span className="text-red-500">*</span></Label>
                                <SearchableSelectDialog
                                    options={supplierOptions}
                                    value={formData.supplier_id}
                                    onChange={(value) => handleSelectChange('supplier_id', value)}
                                    triggerPlaceholder="Tedarikçi seçin..."
                                    dialogTitle="Tedarikçi Seç"
                                    searchPlaceholder="Tedarikçi ara..."
                                    notFoundText="Tedarikçi bulunamadı."
                                />
                            </div>
                        )}
                        
                        <div><Label>Maliyet Türü <span className="text-red-500">*</span></Label><SearchableSelect value={formData.cost_type || ''} onValueChange={(v) => handleSelectChange('cost_type', v)} placeholder="Seçiniz..." items={COST_TYPES} searchPlaceholder="Maliyet türü ara..." /></div>
                        
                        {isReworkCost && (
                            <>
                                <div><Label htmlFor="rework_duration">Ana İşlem Süresi (dk)</Label><Input id="rework_duration" type="number" value={formData.rework_duration || ''} onChange={handleInputChange} /></div>
                                <div>
                                    <Label>Sorumlu Personel</Label>
                                    <PersonnelSearchableSelect value={formData.responsible_personnel_id || ''} onValueChange={(v) => handleSelectChange('responsible_personnel_id', v)} placeholder="Personel seçin..." items={personnelList} searchPlaceholder="Personel ara..." />
                                </div>
                            </>
                        )}

                         {(isScrapCost || isWasteCost) && (
                            <>
                                <div><Label>Malzeme Türü <span className="text-red-500">*</span></Label><SearchableSelect value={formData.material_type || ''} onValueChange={(v) => handleSelectChange('material_type', v)} placeholder="Malzeme seçin..." items={materialTypes} searchPlaceholder="Malzeme ara..." /></div>
                                <div><Label htmlFor="scrap_weight">Ağırlık (kg)</Label><Input id="scrap_weight" type="number" value={formData.scrap_weight || ''} onChange={handleInputChange} placeholder="Ağırlık girin..." /></div>
                            </>
                        )}
                        
                        {/* Adet Alanı - Yeniden İşlem, Hurda ve Fire için */}
                        {showQuantityForReworkAndScrap && (
                            <div><Label htmlFor="quantity">Adet <span className="text-red-500">*</span></Label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} placeholder="Adet girin..." required /></div>
                        )}
                        
                        {showQuantityFields && (
                             <>
                                <div><Label htmlFor="quantity">Miktar</Label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} /></div>
                                <div><Label>Ölçü Birimi</Label><SearchableSelect value={formData.measurement_unit || ''} onValueChange={(v) => handleSelectChange('measurement_unit', v)} placeholder="Birim seçin..." items={MEASUREMENT_UNITS} searchPlaceholder="Birim ara..." /></div>
                            </>
                        )}

                        {isReworkCost && (
                            <div className="md:col-span-3 space-y-4 p-4 border rounded-lg bg-secondary/50">
                                <Label className="text-base font-semibold">Etkilenen Birimler</Label>
                                {affectedUnits.map((unit, index) => (
                                    <div key={unit.id} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-6"><SearchableSelect value={unit.unit} onValueChange={(v) => handleAffectedUnitChange(unit.id, 'unit', v)} placeholder="Birim seç..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                        <div className="col-span-4"><Input type="number" placeholder="Süre (dk)" value={unit.duration} onChange={(e) => handleAffectedUnitChange(unit.id, 'duration', e.target.value)} /></div>
                                        <div className="col-span-2"><Button type="button" variant="destructive" size="icon" onClick={() => removeAffectedUnit(unit.id)}><Trash2 className="w-4 h-4" /></Button></div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={addAffectedUnit} className="w-full"><Plus className="w-4 h-4 mr-2"/>Etkilenen Birim Ekle</Button>
                            </div>
                        )}
                        
                        {isReworkCost && autoCalculate && (
                            <div className="md:col-span-3 bg-secondary p-4 rounded-lg space-y-2">
                                <div className="flex justify-between items-center text-lg font-bold text-primary">
                                    <span>Nihai Toplam Maliyet ({formData.quantity || 1} adet × birim maliyet)</span>
                                    <span>{formatCurrency(totalReworkCost)}</span>
                                </div>
                            </div>
                        )}

                        <div><Label htmlFor="amount">Maliyet Tutarı (₺) <span className="text-red-500">*</span></Label><Input id="amount" type="number" value={formData.amount || ''} onChange={handleInputChange} required readOnly={isAmountReadOnly} /></div>
                        
                        <div className="md:col-span-3"><hr className="my-2 border-border"/></div>

                        <div>
                            <Label>Birim (Kaynak) 
                                <span className={!isReworkCost ? "text-red-500" : (parseFloat(formData.rework_duration) > 0 ? "text-red-500" : "")}>
                                    {!isReworkCost || (parseFloat(formData.rework_duration) > 0) ? ' *' : ''}
                                </span>
                                {isSupplierNC && <span className="text-xs text-muted-foreground ml-2">(Maliyet bu birime, sorumluluk tedarikçiye)</span>}
                            </Label>
                            <SearchableSelect value={formData.unit || ''} onValueChange={(v) => handleSelectChange('unit', v)} placeholder="Birim seçin..." items={departments} searchPlaceholder="Birim ara..." />
                        </div>
                        <div><Label>Araç Türü {isVehicleTypeRequired && <span className="text-red-500">*</span>}</Label><SearchableSelect value={formData.vehicle_type || ''} onValueChange={(v) => handleSelectChange('vehicle_type', v)} placeholder="Seçiniz..." items={VEHICLE_TYPES} searchPlaceholder="Araç türü ara..." /></div>
                        <div><Label htmlFor="part_code">Parça Kodu</Label><Input id="part_code" value={formData.part_code || ''} onChange={handleInputChange} /></div>
                        <div><Label htmlFor="part_name">Parça Adı</Label><Input id="part_name" value={formData.part_name || ''} onChange={handleInputChange} /></div>
                        <div><Label htmlFor="cost_date">Tarih <span className="text-red-500">*</span></Label><Input id="cost_date" type="date" value={formData.cost_date || ''} onChange={handleInputChange} required /></div>
                        <div><Label>Durum</Label><SearchableSelect value={formData.status || 'Aktif'} onValueChange={(v) => handleSelectChange('status', v)} placeholder="Seçiniz..." items={['Aktif', 'Kapatıldı']} searchPlaceholder="Durum ara..." /></div>
                        <div className="md:col-span-3"><Label htmlFor="description">Açıklama</Label><Textarea id="description" value={formData.description || ''} onChange={handleInputChange} rows={3} placeholder="Maliyet kaydı ile ilgili detaylı açıklama yazın. Bu bilgiler uygunsuzluk kaydına otomatik aktarılacaktır." /></div>

                        {!isEditMode && onOpenNCForm && (
                            <div className="md:col-span-3 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <Switch
                                    id="create-nc"
                                    checked={createNC}
                                    onCheckedChange={setCreateNC}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="create-nc" className="cursor-pointer font-medium text-blue-900">
                                        Kayıt sonrası uygunsuzluk oluştur
                                    </Label>
                                    <p className="text-xs text-blue-700 mt-1">
                                        İşaretlerseniz, maliyet kaydı kaydedildikten sonra tüm bilgiler uygunsuzluk formuna otomatik aktarılır.
                                    </p>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="col-span-1 md:col-span-3 mt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : (createNC ? 'Kaydet ve Uygunsuzluk Oluştur' : 'Maliyet Kaydet'))}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };