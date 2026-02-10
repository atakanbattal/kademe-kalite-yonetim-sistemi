import React, { useState, useEffect, useCallback } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Switch } from '@/components/ui/switch';
    // Tabs and Card imports removed - using custom tab UI now
    import { COST_TYPES, MEASUREMENT_UNITS } from './constants';
    import { Zap, Trash2, Plus, Wrench, Briefcase, AlertCircle, Search, CheckCircle, PieChart, DollarSign, FileText, Upload, X, Info, Clock, Calculator } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Badge } from '@/components/ui/badge';
    import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { sanitizeFileName } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DOCUMENT_TYPES = ['Fatura', 'Teklif', 'Rapor', 'Fotoğraf', 'Test Sonucu', 'Garanti Belgesi', '8D Raporu', 'Diğer'];
const BUCKET_NAME = 'quality_costs';

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
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

    export const CostFormModal = ({ open, setOpen, refreshCosts, unitCostSettings, materialCostSettings, personnelList, existingCost, onCostCreated }) => {
        const { toast } = useToast();
        const { user } = useAuth();
        const { products, productCategories, refreshData, refreshProducedVehicles, refreshQualityCosts } = useData();
        const isEditMode = !!existingCost;
        const [formData, setFormData] = useState({});
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [autoCalculate, setAutoCalculate] = useState(true);
        const [addLaborToScrap, setAddLaborToScrap] = useState(false);
        const [totalReworkCost, setTotalReworkCost] = useState(0);
        const [affectedUnits, setAffectedUnits] = useState([]);
        const [isSupplierNC, setIsSupplierNC] = useState(false);
        const [isReflectedToSupplier, setIsReflectedToSupplier] = useState(false);
        const [suppliers, setSuppliers] = useState([]);
        const [selectedSupplierStatus, setSelectedSupplierStatus] = useState(null);
        const [useAllocation, setUseAllocation] = useState(false);
        const [costAllocations, setCostAllocations] = useState([]); // [{id, unit, percentage}]
        const [pendingDocuments, setPendingDocuments] = useState([]); // [{id, file, docType, description}]

        const materialTypes = materialCostSettings.map(m => m.material_name);
        const departments = [...new Set([...unitCostSettings.map(u => u.unit_name), 'Tedarikçi'])];
        
        // Araç tiplerini products tablosundan çek
        const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
        const vehicleTypes = (products || [])
            .filter(p => p.category_id === vehicleTypeCategory?.id)
            .map(p => p.product_name);

        const getInitialFormData = useCallback(() => ({
            cost_type: '', unit: '', vehicle_type: '', part_code: '', part_name: '',
            material_type: '', part_location: '', amount: '', cost_date: new Date().toISOString().slice(0, 10),
            description: '', rework_duration: '', scrap_weight: '', responsible_personnel_id: null,
            quantity: '', measurement_unit: '', affected_units: [],
            additional_labor_cost: 0,
            unit_cost: '', // Birim başına maliyet (₺) - Toplam = Miktar × Birim Maliyet
            supplier_id: null,
            is_supplier_nc: false,
            is_reflected_to_supplier: false,
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
            // affected_units array'ini yükle ve her birim için id ekle (eğer yoksa)
            const affectedUnitsWithIds = (costData.affected_units || []).map(au => ({
                ...au,
                id: au.id || uuidv4() // Eğer id yoksa yeni bir id oluştur
            }));
            setAffectedUnits(affectedUnitsWithIds);
            setAddLaborToScrap(!!costData.additional_labor_cost && costData.additional_labor_cost > 0);
            setIsSupplierNC(!!costData.is_supplier_nc);
            setIsReflectedToSupplier(!!costData.is_reflected_to_supplier);
            const allocs = costData.cost_allocations || [];
            setUseAllocation(Array.isArray(allocs) && allocs.length > 0);
            setCostAllocations((Array.isArray(allocs) ? allocs : []).map(a => ({
                id: uuidv4(),
                unit: a.unit || '',
                percentage: a.percentage ?? 0
            })));

            if (isEditMode) {
              setAutoCalculate(true);
            } else {
              setAutoCalculate(true);
              setTotalReworkCost(0);
            }
            setPendingDocuments([]);
        }, [existingCost, isEditMode, open, getInitialFormData]);


        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (id, value) => {
            setFormData(prev => ({ ...prev, [id]: value }));
        };
        
        const handleAffectedUnitChange = (id, field, value) => {
            setAffectedUnits(units => {
                const updated = units.map(u => {
                    if (u.id === id) {
                        const newUnit = { ...u, [field]: value };
                        // Eğer birim değiştirildiyse ve bu birim zaten başka bir kayıtta varsa, süreyi koru
                        if (field === 'unit') {
                            // Aynı birim başka bir kayıtta var mı kontrol et
                            const existingUnit = units.find(u2 => u2.id !== id && u2.unit === value);
                            if (existingUnit) {
                                // Mevcut birimin süresini kullan
                                newUnit.duration = existingUnit.duration || '';
                            }
                        }
                        return newUnit;
                    }
                    return u;
                });
                return updated;
            });
        };

        const addAffectedUnit = () => {
            setAffectedUnits(units => {
                // Yeni birim eklerken, aynı birimin zaten eklenip eklenmediğini kontrol et
                const newUnit = { id: uuidv4(), unit: '', duration: '' };
                return [...units, newUnit];
            });
        };

        const removeAffectedUnit = (id) => {
            setAffectedUnits(units => units.filter(u => u.id !== id));
        };

        const addAllocationRow = () => setCostAllocations(prev => [...prev, { id: uuidv4(), unit: '', percentage: 0 }]);
        const removeAllocationRow = (id) => setCostAllocations(prev => prev.filter(a => a.id !== id));
        const updateAllocation = (id, field, value) => {
            setCostAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: field === 'percentage' ? (parseFloat(value) || 0) : value } : a));
        };
        const allocationTotal = costAllocations.reduce((s, a) => s + (parseFloat(a.percentage) || 0), 0);
        const totalAmount = parseFloat(formData.amount) || 0;
        const allocationAmounts = costAllocations.map(a => ({
            ...a,
            amount: totalAmount * (parseFloat(a.percentage) || 0) / 100
        }));

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
                } else if (['Dış Hata Maliyeti', 'Final Hataları Maliyeti', 'Önleme Maliyeti'].includes(currentFormData.cost_type)) {
                    // Miktar × Birim Maliyet = Toplam
                    const qty = parseFloat(currentFormData.quantity) || 0;
                    const uc = parseFloat(currentFormData.unit_cost) || 0;
                    if (qty > 0 && uc > 0) {
                        newAmount = qty * uc;
                    }
                }
                
                if (newAmount !== currentFormData.amount) {
                    return { ...currentFormData, amount: newAmount };
                }
                return currentFormData;
            });
        }, [formData.cost_type, formData.unit, formData.rework_duration, formData.material_type, formData.scrap_weight, formData.quantity, formData.unit_cost, affectedUnits, autoCalculate, addLaborToScrap, unitCostSettings, calculateScrapOrWasteCost, calculateReworkCost]);


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
                // Süre zorunluluğu kaldırıldı - kullanıcı isterse boş bırakabilir
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
                // Birim opsiyonel - hesaplama malzeme/agırlık ile yapılıyor
                if (!formData.cost_type || !formData.vehicle_type || formData.amount === '' || !formData.cost_date) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen yıldızlı zorunlu alanları doldurun.' });
                    return;
                }
            } else {
                if (!formData.cost_type || formData.amount === '' || !formData.cost_date) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen Maliyet Türü, Tutar ve Tarih alanlarını doldurun.' });
                    return;
                }
            }

            if (useAllocation) {
                const validAllocs = costAllocations.filter(a => a.unit && (parseFloat(a.percentage) || 0) > 0);
                const totalPct = validAllocs.reduce((s, a) => s + (parseFloat(a.percentage) || 0), 0);
                if (validAllocs.length === 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Maliyet dağılımı için en az bir birim ve yüzde girin.' });
                    return;
                }
                if (Math.abs(totalPct - 100) > 0.01) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Dağılım toplamı %100 olmalı. Şu an: %${totalPct.toFixed(1)}` });
                    return;
                }
            }

            let submissionData = { ...formData };
            // Etkilenen birimleri temizle ve filtrele - aynı birimden birden fazla kayıt varsa birleştir
            const cleanedAffectedUnits = affectedUnits
                .map(({ id, ...rest }) => rest)
                .filter(au => au.unit && parseFloat(au.duration) > 0);
            
            // Aynı birimden birden fazla kayıt varsa, süreleri topla
            const mergedAffectedUnits = cleanedAffectedUnits.reduce((acc, au) => {
                const existing = acc.find(a => a.unit === au.unit);
                if (existing) {
                    existing.duration = (parseFloat(existing.duration) || 0) + (parseFloat(au.duration) || 0);
                } else {
                    acc.push({ ...au, duration: parseFloat(au.duration) || 0 });
                }
                return acc;
            }, []);
            
            submissionData.affected_units = mergedAffectedUnits.length > 0 ? mergedAffectedUnits : null;
            if (useAllocation && costAllocations.length > 0) {
                const totalAmt = parseFloat(submissionData.amount) || 0;
                const validAllocs = costAllocations.filter(a => a.unit && (parseFloat(a.percentage) || 0) > 0);
                submissionData.cost_allocations = validAllocs.map(a => ({
                    unit: a.unit,
                    percentage: parseFloat(a.percentage) || 0,
                    amount: totalAmt * (parseFloat(a.percentage) || 0) / 100
                }));
                submissionData.unit = null;
            } else {
                submissionData.cost_allocations = null;
                submissionData.unit = submissionData.unit || null;
            }
            
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
                submissionData.is_reflected_to_supplier = false;
            }
            
            // Tedarikçiye yansıtma durumunu ekle
            submissionData.is_reflected_to_supplier = isReflectedToSupplier;
            
            if (isReflectedToSupplier && submissionData.is_supplier_nc && !submissionData.cost_allocations) {
                submissionData.unit = 'Tedarikçi';
            }
            
            // Sorumlu personel boşsa null yap
            if (submissionData.responsible_personnel_id === '') {
                submissionData.responsible_personnel_id = null;
            }

            // quality_control_duration'ı yedekle (NC için gerekli)
            const quality_control_duration_backup = submissionData.quality_control_duration;
            
            delete submissionData.quality_control_duration;
            submissionData.unit_cost = (submissionData.unit_cost !== '' && submissionData.unit_cost != null) ? parseFloat(submissionData.unit_cost) : null;

            // İlişkili verileri temizle (sadece ID'ler gönderilmeli - join edilmiş objeler)
            delete submissionData.responsible_personnel;
            delete submissionData.non_conformities;
            delete submissionData.suppliers;
            delete submissionData.supplier; // Join edilmiş supplier objesi
            
            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in submissionData) {
                if (submissionData[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = submissionData[key];
                }
            }
            
            if (isEditMode) {
                const { error } = await supabase.from('quality_costs').update(cleanedData).eq('id', existingCost.id);
                if (error) {
                     toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet güncellenemedi: ${error.message}` });
                } else {
                    if (pendingDocuments.length > 0) {
                        try {
                            for (const doc of pendingDocuments) {
                                const sanitizedFileName = sanitizeFileName(doc.file.name);
                                const timestamp = Date.now();
                                const randomStr = Math.random().toString(36).substring(2, 9);
                                const filePath = `docs/${existingCost.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                                const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, doc.file, { cacheControl: '3600', upsert: false, contentType: doc.file.type || 'application/octet-stream' });
                                if (uploadError) throw uploadError;
                                const fileExt = doc.file.name.split('.').pop();
                                await supabase.from('quality_cost_documents').insert({
                                    quality_cost_id: existingCost.id,
                                    document_type: doc.docType,
                                    document_name: doc.file.name,
                                    document_description: doc.description || null,
                                    file_path: filePath,
                                    file_type: fileExt,
                                    file_size: doc.file.size,
                                    uploaded_by: user?.id
                                });
                            }
                            toast({ title: 'Başarılı!', description: `Maliyet kaydı güncellendi ve ${pendingDocuments.length} doküman eklendi.` });
                        } catch (uploadErr) {
                            toast({ title: 'Maliyet güncellendi!', variant: 'warning', description: `Doküman yükleme hatası: ${uploadErr.message}. Dokümanları kayda tıklayarak sonradan ekleyebilirsiniz.` });
                        }
                    } else {
                        toast({ title: 'Başarılı!', description: 'Maliyet kaydı güncellendi.' });
                    }
                    await refreshCosts();
                    
                    // Eğer bu kayıt produced_vehicle kaynaklıysa, produced-vehicles modülünü de yenile
                    if (existingCost.source_type === 'produced_vehicle_final_faults' || cleanedData.source_type === 'produced_vehicle_final_faults' ||
                        existingCost.source_type === 'produced_vehicle_manual' || cleanedData.source_type === 'produced_vehicle_manual') {
                        if (refreshProducedVehicles) {
                            await refreshProducedVehicles();
                        }
                    }
                    
                    setOpen(false);
                }
            } else {
                delete cleanedData.id;
                const { data: insertedCost, error } = await supabase
                    .from('quality_costs')
                    .insert([cleanedData])
                    .select()
                    .single();
                    
                 if (error) {
                    toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet eklenemedi: ${error.message}` });
                } else {
                    if (pendingDocuments.length > 0) {
                        try {
                            for (const doc of pendingDocuments) {
                                const sanitizedFileName = sanitizeFileName(doc.file.name);
                                const timestamp = Date.now();
                                const randomStr = Math.random().toString(36).substring(2, 9);
                                const filePath = `docs/${insertedCost.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                                const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, doc.file, { cacheControl: '3600', upsert: false, contentType: doc.file.type || 'application/octet-stream' });
                                if (uploadError) throw uploadError;
                                const fileExt = doc.file.name.split('.').pop();
                                await supabase.from('quality_cost_documents').insert({
                                    quality_cost_id: insertedCost.id,
                                    document_type: doc.docType,
                                    document_name: doc.file.name,
                                    document_description: doc.description || null,
                                    file_path: filePath,
                                    file_type: fileExt,
                                    file_size: doc.file.size,
                                    uploaded_by: user?.id
                                });
                            }
                            toast({ title: 'Başarılı!', description: `Maliyet kaydı ve ${pendingDocuments.length} doküman eklendi.` });
                        } catch (uploadErr) {
                            toast({ title: 'Maliyet kaydedildi!', variant: 'warning', description: `Doküman yükleme hatası: ${uploadErr.message}. Dokümanları kayda tıklayarak sonradan ekleyebilirsiniz.` });
                        }
                    } else {
                        toast({ title: 'Başarılı!', description: 'Maliyet kaydı eklendi.' });
                    }
                    await refreshCosts();
                    setOpen(false);
                    onCostCreated?.(insertedCost);
                }
            }
            setIsSubmitting(false);
        };

        const isReworkCost = formData.cost_type === 'Yeniden İşlem Maliyeti';
        const isScrapCost = formData.cost_type === 'Hurda Maliyeti';
        const isWasteCost = formData.cost_type === 'Fire Maliyeti';
        const showQuantityFields = formData.cost_type && !isReworkCost && !isScrapCost && !isWasteCost;
        const showQuantityForReworkAndScrap = isReworkCost || isScrapCost || isWasteCost;
        const isAmountAutoFromQtyUnitCost = showQuantityFields && (parseFloat(formData.quantity) || 0) > 0 && (parseFloat(formData.unit_cost) || 0) > 0;
        const isAmountReadOnly = ((isScrapCost || isReworkCost || isWasteCost) && autoCalculate) || isAmountAutoFromQtyUnitCost;
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

        const [activeTab, setActiveTab] = React.useState('details');

        // Summary helpers
        const unitCostPerItem = totalAmount && (parseFloat(formData.quantity) || 0) > 0 ? totalAmount / parseFloat(formData.quantity) : 0;

        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    {/* Header */}
                    <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-lg"><DollarSign className="h-5 w-5 text-white" /></div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Maliyet Kaydını Düzenle' : 'Maliyet Kaydı'}</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Kalite Yönetim Sistemi</p>
                            </div>
                            {!isEditMode && <span className="ml-2 px-3 py-1 bg-green-400/20 border border-green-400/30 text-green-100 text-[10px] font-bold rounded-full uppercase tracking-wider">Yeni</span>}
                            {isEditMode && <span className="ml-2 px-3 py-1 bg-amber-400/20 border border-amber-400/30 text-amber-100 text-[10px] font-bold rounded-full uppercase tracking-wider">Düzenleme</span>}
                        </div>
                    </header>

                    {/* Two Column Layout */}
                    <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">
                        {/* LEFT: Form (scrollable) */}
                        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4" style={{ scrollbarWidth: 'thin' }}>
                            <div className="p-6 space-y-6 pb-12">

                                {/* Kaynak Tipi */}
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Kaynak Bilgileri</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Kaynak Tipi</label>
                                            <div className="flex p-1 bg-muted rounded-lg">
                                                <button type="button" onClick={() => handleSupplierToggle(false)} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${!isSupplierNC ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Dahili</button>
                                                <button type="button" onClick={() => handleSupplierToggle(true)} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${isSupplierNC ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Tedarikçi</button>
                                            </div>
                                        </div>
                                        {isSupplierNC && (
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tedarikçi <span className="text-destructive">*</span></label>
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
                                    </div>
                                    {isSupplierNC && (
                                        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                            <Switch id="is_reflected_to_supplier" checked={isReflectedToSupplier} onCheckedChange={(checked) => { setIsReflectedToSupplier(checked); if (checked) setFormData(prev => ({ ...prev, unit: 'Tedarikçi' })); }} />
                                            <Label htmlFor="is_reflected_to_supplier" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-green-700 dark:text-green-300"><CheckCircle className="w-4 h-4" /> Tedarikçiye Yansıtıldı</Label>
                                        </div>
                                    )}
                                    {selectedSupplierStatus && selectedSupplierStatus !== 'Onaylı' && isSupplierNC && (
                                        <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-700">Bu tedarikçi <strong>"{selectedSupplierStatus}"</strong> statüsündedir.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Genel Bilgiler */}
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Genel Bilgiler</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Maliyet Türü <span className="text-destructive">*</span></label>
                                            <SearchableSelect value={formData.cost_type || ''} onValueChange={(v) => handleSelectChange('cost_type', v)} placeholder="Seçiniz..." items={COST_TYPES} searchPlaceholder="Maliyet türü ara..." />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Araç Tipi {isVehicleTypeRequired && <span className="text-destructive">*</span>}</label>
                                            <SearchableSelect value={formData.vehicle_type || ''} onValueChange={(v) => handleSelectChange('vehicle_type', v)} placeholder="Seçiniz..." items={vehicleTypes} searchPlaceholder="Araç türü ara..." />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tarih <span className="text-destructive">*</span></label>
                                            <Input id="cost_date" type="date" value={formData.cost_date || ''} onChange={handleInputChange} required className="h-[38px]" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-4">
                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Parça Kodu</label><Input id="part_code" value={formData.part_code || ''} onChange={handleInputChange} placeholder="Parça kodu" /></div>
                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Parça Adı</label><Input id="part_name" value={formData.part_name || ''} onChange={handleInputChange} placeholder="Parça adı" /></div>
                                        {!useAllocation && (
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Birim (Kaynak)</label><SearchableSelect value={formData.unit || ''} onValueChange={(v) => handleSelectChange('unit', v)} placeholder="Birim seçin..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                        )}
                                        {useAllocation && (
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sorumlu Personel</label><PersonnelSearchableSelect value={formData.responsible_personnel_id || ''} onValueChange={(v) => handleSelectChange('responsible_personnel_id', v)} placeholder="Personel seçin..." items={personnelList} searchPlaceholder="Personel ara..." /></div>
                                        )}
                                    </div>
                                </div>

                                {/* Hesaplama Ayarları */}
                                {(isScrapCost || isReworkCost || isWasteCost) && (
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => setAutoCalculate(!autoCalculate)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${autoCalculate ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-muted border-border text-muted-foreground'}`}><Zap className="w-3.5 h-3.5" /> Oto. Hesapla</button>
                                        {isScrapCost && <button type="button" onClick={() => setAddLaborToScrap(!addLaborToScrap)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${addLaborToScrap ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-muted border-border text-muted-foreground'}`}><Wrench className="w-3.5 h-3.5" /> İşçilik %50</button>}
                                    </div>
                                )}

                                {/* Tabs */}
                                <div>
                                    <div className="flex border-b border-border">
                                        <button type="button" onClick={() => setActiveTab('details')} className={`px-5 py-3 text-xs font-semibold transition-colors ${activeTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Maliyet Detayları</button>
                                        <button type="button" onClick={() => setActiveTab('allocation')} className={`px-5 py-3 text-xs font-semibold transition-colors ${activeTab === 'allocation' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Dağılımlar</button>
                                        <button type="button" onClick={() => setActiveTab('documents')} className={`px-5 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Ekler {pendingDocuments.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{pendingDocuments.length}</span>}</button>
                                    </div>

                                    {/* Tab: Maliyet Detayları */}
                                    {activeTab === 'details' && (
                                        <div className="py-5 space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                {isReworkCost && (
                                                    <>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ana İşlem Süresi (dk)</label><Input id="rework_duration" type="number" value={formData.rework_duration || ''} onChange={handleInputChange} /></div>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sorumlu Personel</label><PersonnelSearchableSelect value={formData.responsible_personnel_id || ''} onValueChange={(v) => handleSelectChange('responsible_personnel_id', v)} placeholder="Personel seçin..." items={personnelList} searchPlaceholder="Personel ara..." /></div>
                                                    </>
                                                )}
                                                {(isScrapCost || isWasteCost) && (
                                                    <>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Malzeme Türü <span className="text-destructive">*</span></label><SearchableSelect value={formData.material_type || ''} onValueChange={(v) => handleSelectChange('material_type', v)} placeholder="Malzeme seçin..." items={materialTypes} searchPlaceholder="Malzeme ara..." /></div>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ağırlık (kg)</label><Input id="scrap_weight" type="number" value={formData.scrap_weight || ''} onChange={handleInputChange} placeholder="Ağırlık" /></div>
                                                    </>
                                                )}
                                                {showQuantityForReworkAndScrap && (
                                                    <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Adet <span className="text-destructive">*</span></label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} placeholder="Adet" required /></div>
                                                )}
                                                {showQuantityFields && (
                                                    <>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Miktar</label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} placeholder="Adet" /></div>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Birim Maliyet (₺)</label><Input id="unit_cost" type="number" step="0.01" value={formData.unit_cost || ''} onChange={handleInputChange} placeholder="Birim başına" /></div>
                                                        <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ölçü Birimi</label><SearchableSelect value={formData.measurement_unit || ''} onValueChange={(v) => handleSelectChange('measurement_unit', v)} placeholder="Birim seçin..." items={MEASUREMENT_UNITS} searchPlaceholder="Birim ara..." /></div>
                                                    </>
                                                )}
                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tutar (₺) <span className="text-destructive">*</span></label>
                                                    <Input id="amount" type="number" className="font-semibold text-base" value={formData.amount || ''} onChange={handleInputChange} required readOnly={isAmountReadOnly} />
                                                </div>
                                            </div>

                                            {isReworkCost && (
                                                <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Etkilenen Birimler</h3>
                                                        <button type="button" onClick={addAffectedUnit} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Satır Ekle</button>
                                                    </div>
                                                    {affectedUnits.map((unit) => (
                                                        <div key={unit.id} className="flex gap-2 items-center">
                                                            <div className="flex-1"><SearchableSelect value={unit.unit} onValueChange={(v) => handleAffectedUnitChange(unit.id, 'unit', v)} placeholder="Birim seç..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                                            <div className="w-28"><Input type="number" placeholder="Süre (dk)" value={unit.duration} onChange={(e) => handleAffectedUnitChange(unit.id, 'duration', e.target.value)} /></div>
                                                            <button type="button" onClick={() => removeAffectedUnit(unit.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Açıklama</label>
                                                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} rows={3} placeholder="Maliyet kaydı ile ilgili detaylı açıklama..." className="resize-none" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab: Dağılımlar */}
                                    {activeTab === 'allocation' && (
                                        <div className="py-5 space-y-4">
                                            <div className="bg-muted/50 rounded-xl p-4 border border-border">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Departman Dağılımı</h3>
                                                        <Switch id="use-allocation-tab" checked={useAllocation} onCheckedChange={(checked) => { setUseAllocation(checked); if (checked && costAllocations.length === 0) addAllocationRow(); }} />
                                                    </div>
                                                    {useAllocation && <button type="button" onClick={addAllocationRow} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Satır Ekle</button>}
                                                </div>
                                                {useAllocation && (
                                                    <>
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border">
                                                                    <th className="pb-2.5 px-2">Departman</th>
                                                                    <th className="pb-2.5 px-2 w-24 text-center">Yüzde (%)</th>
                                                                    <th className="pb-2.5 px-2 text-right">Tutar</th>
                                                                    <th className="pb-2.5 px-2 w-10"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="text-sm">
                                                                {costAllocations.map((alloc) => (
                                                                    <tr key={alloc.id} className="border-b border-border/50">
                                                                        <td className="py-2.5 px-2"><SearchableSelect value={alloc.unit} onValueChange={(v) => updateAllocation(alloc.id, 'unit', v)} placeholder="Birim seç..." items={departments} searchPlaceholder="Birim ara..." /></td>
                                                                        <td className="py-2.5 px-2"><Input type="number" min="0" max="100" step="0.5" className="text-center bg-transparent border-none h-8 p-0 focus-visible:ring-0" placeholder="%" value={alloc.percentage || ''} onChange={(e) => updateAllocation(alloc.id, 'percentage', e.target.value)} /></td>
                                                                        <td className="py-2.5 px-2 text-right font-semibold text-muted-foreground">{formatCurrency(totalAmount * (parseFloat(alloc.percentage) || 0) / 100)}</td>
                                                                        <td className="py-2.5 px-2 text-center"><button type="button" onClick={() => removeAllocationRow(alloc.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                                                            <span className="text-xs font-medium text-muted-foreground">Toplam: {formatCurrency(totalAmount)}</span>
                                                            <Badge variant={Math.abs(allocationTotal - 100) < 0.01 ? 'default' : 'destructive'} className="text-xs">%{allocationTotal.toFixed(1)}</Badge>
                                                        </div>
                                                    </>
                                                )}
                                                {!useAllocation && (
                                                    <div className="text-center py-6 text-muted-foreground">
                                                        <PieChart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                        <p className="text-xs">Maliyeti birden fazla birime dağıtmak için toggle'ı aktif edin.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab: Ekler */}
                                    {activeTab === 'documents' && (
                                        <div className="py-5 space-y-4">
                                            <div>
                                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Dosya Ekleri</h3>
                                                <label className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer group block">
                                                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                                    <p className="text-sm text-muted-foreground"><span className="font-semibold text-primary">Yüklemek için tıklayın</span> veya sürükleyip bırakın</p>
                                                    <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase">PDF, PNG, JPG, DOCX, XLSX (Maks. 10MB)</p>
                                                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => {
                                                        const files = Array.from(e.target.files || []);
                                                        if (files.length) setPendingDocuments(prev => [...prev, ...files.map(f => ({ id: uuidv4(), file: f, docType: 'Fatura', description: '' }))]);
                                                        e.target.value = '';
                                                    }} />
                                                </label>
                                            </div>
                                            {pendingDocuments.length > 0 && (
                                                <div className="space-y-2">
                                                    {pendingDocuments.map((doc) => (
                                                        <div key={doc.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                <FileText className="w-4 h-4 text-destructive shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold truncate">{doc.file.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{(doc.file.size / 1024).toFixed(1)} KB</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Select value={doc.docType} onValueChange={(v) => setPendingDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, docType: v } : d))}>
                                                                    <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                                <button type="button" onClick={() => setPendingDocuments(prev => prev.filter(d => d.id !== doc.id))} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Summary (sticky) */}
                        <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4" style={{ scrollbarWidth: 'thin' }}>
                            <div className="p-5 space-y-5">
                                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Maliyet Özeti</h2>

                                {/* Total Card */}
                                <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
                                    <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none"><DollarSign className="w-20 h-20" /></div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Toplam Tutar</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-foreground">{totalAmount > 0 ? totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
                                        <span className="text-base font-semibold text-primary">TRY</span>
                                    </div>
                                </div>

                                {/* Allocation Breakdown */}
                                {useAllocation && costAllocations.some(a => a.unit && (parseFloat(a.percentage) || 0) > 0) && (
                                    <div className="space-y-3">
                                        {costAllocations.filter(a => a.unit && (parseFloat(a.percentage) || 0) > 0).map((a) => {
                                            const pct = parseFloat(a.percentage) || 0;
                                            const amt = totalAmount * pct / 100;
                                            return (
                                                <div key={a.id} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-medium">
                                                        <span className="text-muted-foreground">{a.unit}</span>
                                                        <span className="text-foreground">{formatCurrency(amt)} ({pct.toFixed(0)}%)</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Detail Items */}
                                <div className="pt-4 border-t border-border space-y-2.5">
                                    {formData.cost_type && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Maliyet Türü:</span><span className="font-semibold text-foreground">{formData.cost_type}</span></div>
                                    )}
                                    {(parseFloat(formData.quantity) || 0) > 0 && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Miktar:</span><span className="font-semibold text-foreground">{formData.quantity} {formData.measurement_unit || 'adet'}</span></div>
                                    )}
                                    {unitCostPerItem > 0 && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Birim Fiyat:</span><span className="font-semibold text-foreground">{formatCurrency(unitCostPerItem)}</span></div>
                                    )}
                                    {formData.vehicle_type && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Araç Tipi:</span><span className="font-semibold text-foreground">{formData.vehicle_type}</span></div>
                                    )}
                                    {(formData.part_code || formData.part_name) && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Parça:</span><span className="font-semibold text-foreground truncate ml-2">{formData.part_code || formData.part_name}</span></div>
                                    )}
                                    {isSupplierNC && formData.supplier_id && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tedarikçi:</span><span className="font-semibold text-amber-600">{suppliers.find(s => s.value === formData.supplier_id)?.label || '-'}</span></div>
                                    )}
                                </div>

                                {/* Info Alert */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2.5 border border-blue-100 dark:border-blue-800">
                                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                                        {useAllocation ? 'Dağılım toplamı %100 olmalıdır. Kayıt sonrası her birime payı kadar maliyet yansıtılır.' : 'Maliyet bilgilerini eksiksiz doldurun. Dağılım sekmesinden birden fazla birime paylaştırabilirsiniz.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <footer className="bg-background px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
                        <div className="flex items-center text-muted-foreground">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            <span className="text-[11px] font-medium">{formData.cost_date ? new Date(formData.cost_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-sm font-semibold">İptal Et</Button>
                            <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="text-sm font-bold shadow-lg shadow-primary/20">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {isSubmitting ? 'Kaydediliyor...' : 'Kaydı Tamamla'}
                            </Button>
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
        );
    };