import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Switch } from '@/components/ui/switch';
    import { COST_TYPES, MEASUREMENT_UNITS, COST_SUBTYPES, SHARED_COST_CATEGORIES, INDIRECT_COST_CATEGORIES } from './constants';
    import { Zap, Trash2, Plus, Wrench, Briefcase, AlertCircle, Search, CheckCircle, PieChart, DollarSign, FileText, Upload, X, Info, Clock, Calculator, Package, Truck, TrendingDown, GripVertical } from 'lucide-react';
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
    const SearchableSelect = ({ value, onValueChange, placeholder, items, searchPlaceholder = "Ara...", disabled = false }) => {
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
                    disabled={disabled}
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        const [costAllocations, setCostAllocations] = useState([]);
        const [pendingDocuments, setPendingDocuments] = useState([]);
        
        // Kalem ve ek maliyet state'leri (her zaman aktif)
        const [lineItems, setLineItems] = useState([]);
        const [sharedCosts, setSharedCosts] = useState([]);
        const [indirectCosts, setIndirectCosts] = useState([]);
        
        // Drag and drop ref
        const dropZoneRef = useRef(null);
        const [isDragging, setIsDragging] = useState(false);

        const materialTypes = materialCostSettings.map(m => m.material_name);
        const departments = [...new Set([...unitCostSettings.map(u => u.unit_name), 'Tedarikçi'])];
        
        // Araç tiplerini products tablosundan çek
        const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
        const vehicleTypes = (products || [])
            .filter(p => p.category_id === vehicleTypeCategory?.id)
            .map(p => p.product_name);

        // Tedarikçi listesi (select için)
        const supplierOptionsForLineItems = suppliers.map(s => ({ value: s.value, label: typeof s.label === 'string' ? s.label : s.label?.props?.children?.[0]?.props?.children || 'Tedarikçi' }));

        const getInitialFormData = useCallback(() => ({
            cost_type: '', unit: '', vehicle_type: '', part_code: '', part_name: '',
            material_type: '', part_location: '', amount: '', cost_date: new Date().toISOString().slice(0, 10),
            description: '', rework_duration: '', scrap_weight: '', responsible_personnel_id: null,
            quantity: '', measurement_unit: '', affected_units: [],
            additional_labor_cost: 0,
            unit_cost: '',
            supplier_id: null,
            is_supplier_nc: false,
            is_reflected_to_supplier: false,
            invoice_number: '',
            customer_name: '',
        }), []);

        // Müşteri listesi
        const [customers, setCustomers] = useState([]);

        // Tedarikçileri ve müşterileri yükle
        useEffect(() => {
            const fetchSuppliers = async () => {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('id, name, status');
                if (!error) {
                    setSuppliers(data.map(s => ({ value: s.id, label: s.name, status: s.status })));
                }
            };
            const fetchCustomers = async () => {
                const { data, error } = await supabase
                    .from('customers')
                    .select('id, name, customer_name')
                    .order('name');
                if (!error) {
                    setCustomers(data.map(c => c.name || c.customer_name).filter(Boolean));
                }
            };
            if (open) {
                fetchSuppliers();
                fetchCustomers();
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
            const affectedUnitsWithIds = (costData.affected_units || []).map(au => ({
                ...au,
                id: au.id || uuidv4()
            }));
            setAffectedUnits(affectedUnitsWithIds);
            setAddLaborToScrap(!!costData.additional_labor_cost && costData.additional_labor_cost > 0);
            setIsSupplierNC(!!costData.is_supplier_nc);
            setIsReflectedToSupplier(!!costData.is_reflected_to_supplier);
            const allocs = costData.cost_allocations || [];
            setUseAllocation(Array.isArray(allocs) && allocs.length > 0);
            setCostAllocations((Array.isArray(allocs) ? allocs : []).map(a => ({
                id: uuidv4(),
                type: a.type || 'unit', // 'unit' veya 'supplier'
                unit: a.unit || '',
                supplier_id: a.supplier_id || null,
                percentage: a.percentage ?? 0
            })));

            // Kalem ve ek maliyet state'leri (her zaman aktif)
            const existingLineItems = costData.cost_line_items || [];
            const existingSharedCosts = costData.shared_costs || [];
            const existingIndirectCosts = costData.indirect_costs || [];
            
            const isCalcType = ['Hurda Maliyeti', 'Fire Maliyeti', 'Yeniden İşlem Maliyeti'].includes(costData.cost_type);
            
            if (Array.isArray(existingLineItems) && existingLineItems.length > 0) {
                // Mevcut kalemler varsa onları yükle
                setLineItems(existingLineItems.map(li => ({ ...li, id: li.id || uuidv4() })));
            } else if (isEditMode && !isCalcType) {
                // Eski tip kalem tabanlı kayıt - ana alanlardan bir kalem oluştur
                setLineItems([{
                    id: uuidv4(),
                    part_code: costData.part_code || '',
                    part_name: costData.part_name || '',
                    responsible_type: costData.unit ? 'unit' : 'unit',
                    responsible_unit: costData.unit || '',
                    responsible_supplier_id: null,
                    cost_subtype: '',
                    amount: costData.amount || '',
                    quantity: costData.quantity || '',
                    unit_cost: costData.unit_cost || '',
                    measurement_unit: costData.measurement_unit || 'Adet',
                    description: ''
                }]);
            } else if (!isCalcType) {
                // Yeni kalem tabanlı kayıt - bir boş kalem ile başla
                setLineItems([{
                    id: uuidv4(),
                    part_code: '', part_name: '', responsible_type: 'unit', responsible_unit: '',
                    responsible_supplier_id: null, cost_subtype: '', amount: '',
                    quantity: '', unit_cost: '', measurement_unit: 'Adet', description: ''
                }]);
            } else {
                // Hesaplayıcı türler - kalem boş başla
                setLineItems([]);
            }
            setSharedCosts(Array.isArray(existingSharedCosts) ? existingSharedCosts.map(sc => ({ ...sc, id: sc.id || uuidv4() })) : []);
            setIndirectCosts(Array.isArray(existingIndirectCosts) ? existingIndirectCosts.map(ic => ({ ...ic, id: ic.id || uuidv4() })) : []);

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
            
            // Maliyet türü değiştiğinde line items'ı güncelle
            if (id === 'cost_type') {
                const calcTypes = ['Hurda Maliyeti', 'Fire Maliyeti', 'Yeniden İşlem Maliyeti'];
                const isNewCalcType = calcTypes.includes(value);
                const wasCalcType = calcTypes.includes(formData.cost_type);
                
                if (!isNewCalcType && wasCalcType && lineItems.length === 0) {
                    // Hesaplayıcı türden kalem tabanlı türe geçiş - bir boş kalem oluştur
                    setLineItems([{
                        id: uuidv4(),
                        part_code: '', part_name: '', responsible_type: 'unit', responsible_unit: '',
                        responsible_supplier_id: null, cost_subtype: '', amount: '',
                        quantity: '', unit_cost: '', measurement_unit: 'Adet', description: ''
                    }]);
                } else if (isNewCalcType && !wasCalcType) {
                    // Kalem tabanlı türden hesaplayıcıya geçiş - kalemleri boşalt (sadece boşlarsa)
                    const hasFilledItems = lineItems.some(li => li.part_code || li.part_name || (parseFloat(li.amount) > 0));
                    if (!hasFilledItems) setLineItems([]);
                }
                
                // Tab'ı ayarla
                if (isNewCalcType) {
                    setActiveTab('shared'); // Hesaplayıcıda varsayılan olarak shared/indirect/documents tab
                }
            }
        };
        
        const handleAffectedUnitChange = (id, field, value) => {
            setAffectedUnits(units => {
                const updated = units.map(u => {
                    if (u.id === id) {
                        const newUnit = { ...u, [field]: value };
                        if (field === 'unit') {
                            const existingUnit = units.find(u2 => u2.id !== id && u2.unit === value);
                            if (existingUnit) {
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
                const newUnit = { id: uuidv4(), unit: '', duration: '' };
                return [...units, newUnit];
            });
        };

        const removeAffectedUnit = (id) => {
            setAffectedUnits(units => units.filter(u => u.id !== id));
        };

        // === Fatura Kalemi İşlemleri ===
        const addLineItem = () => {
            setLineItems(prev => [...prev, {
                id: uuidv4(),
                part_code: '',
                part_name: '',
                responsible_type: 'unit', // 'unit' veya 'supplier'
                responsible_unit: '',
                responsible_supplier_id: null,
                cost_subtype: '',
                amount: '',
                quantity: '',
                unit_cost: '',
                measurement_unit: 'Adet',
                description: ''
            }]);
        };

        const removeLineItem = (id) => {
            setLineItems(prev => prev.filter(li => li.id !== id));
        };

        const updateLineItem = (id, field, value) => {
            setLineItems(prev => prev.map(li => {
                if (li.id !== id) return li;
                const updated = { ...li, [field]: value };
                // Auto-calculate amount from quantity * unit_cost
                if (field === 'quantity' || field === 'unit_cost') {
                    const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
                    const uc = parseFloat(field === 'unit_cost' ? value : updated.unit_cost) || 0;
                    if (qty > 0 && uc > 0) {
                        updated.amount = qty * uc;
                    }
                }
                // responsible_type değiştiğinde diğer alanları temizle
                if (field === 'responsible_type') {
                    if (value === 'unit') {
                        updated.responsible_supplier_id = null;
                    } else {
                        updated.responsible_unit = '';
                    }
                }
                return updated;
            }));
        };

        // === Ortak Maliyet İşlemleri ===
        const addSharedCost = () => {
            setSharedCosts(prev => [...prev, {
                id: uuidv4(),
                category: '',
                amount: '',
                description: '',
                measurement_unit: 'TRY',
                measurement_value: ''
            }]);
        };

        const removeSharedCost = (id) => {
            setSharedCosts(prev => prev.filter(sc => sc.id !== id));
        };

        const updateSharedCost = (id, field, value) => {
            setSharedCosts(prev => prev.map(sc => sc.id === id ? { ...sc, [field]: value } : sc));
        };

        // === Dolaylı Maliyet İşlemleri ===
        const addIndirectCost = () => {
            setIndirectCosts(prev => [...prev, {
                id: uuidv4(),
                category: '',
                amount: '',
                description: ''
            }]);
        };

        const removeIndirectCost = (id) => {
            setIndirectCosts(prev => prev.filter(ic => ic.id !== id));
        };

        const updateIndirectCost = (id, field, value) => {
            setIndirectCosts(prev => prev.map(ic => ic.id === id ? { ...ic, [field]: value } : ic));
        };

        // === Dağılım İşlemleri (Tedarikçi desteği ile) ===
        const addAllocationRow = () => setCostAllocations(prev => [...prev, { id: uuidv4(), type: 'unit', unit: '', supplier_id: null, percentage: 0 }]);
        const removeAllocationRow = (id) => setCostAllocations(prev => prev.filter(a => a.id !== id));
        const updateAllocation = (id, field, value) => {
            setCostAllocations(prev => prev.map(a => {
                if (a.id !== id) return a;
                const updated = { ...a, [field]: field === 'percentage' ? (parseFloat(value) || 0) : value };
                if (field === 'type') {
                    if (value === 'unit') {
                        updated.supplier_id = null;
                    } else {
                        updated.unit = '';
                    }
                }
                return updated;
            }));
        };
        const allocationTotal = costAllocations.reduce((s, a) => s + (parseFloat(a.percentage) || 0), 0);

        // === Toplam Hesaplamaları ===
        const lineItemsTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
        const sharedCostsTotal = sharedCosts.reduce((sum, sc) => sum + (parseFloat(sc.amount) || 0), 0);
        const indirectCostsTotal = indirectCosts.reduce((sum, ic) => sum + (parseFloat(ic.amount) || 0), 0);
        
        const isCalculatorType = ['Hurda Maliyeti', 'Fire Maliyeti', 'Yeniden İşlem Maliyeti'].includes(formData.cost_type);
        
        const totalAmount = isCalculatorType 
            ? (parseFloat(formData.amount) || 0) + sharedCostsTotal + indirectCostsTotal
            : lineItemsTotal + sharedCostsTotal + indirectCostsTotal;

        const allocationAmounts = costAllocations.map(a => ({
            ...a,
            amount: totalAmount * (parseFloat(a.percentage) || 0) / 100
        }));

        // Fatura modunda nakliye dağılımı hesaplama (kalemlerin yüzdelik payına göre)
        const getSharedCostDistribution = useCallback(() => {
            if (lineItems.length === 0 || sharedCostsTotal === 0) return [];
            
            const distributions = [];
            lineItems.forEach(li => {
                const liAmount = parseFloat(li.amount) || 0;
                const percentage = lineItemsTotal > 0 ? (liAmount / lineItemsTotal) * 100 : 0;
                const sharedShare = sharedCostsTotal * (percentage / 100);
                distributions.push({
                    lineItemId: li.id,
                    part_code: li.part_code,
                    part_name: li.part_name,
                    responsible: li.responsible_type === 'supplier' 
                        ? suppliers.find(s => s.value === li.responsible_supplier_id)?.label || 'Tedarikçi'
                        : li.responsible_unit || '-',
                    baseAmount: liAmount,
                    percentage: percentage,
                    sharedShare: sharedShare,
                    totalWithShared: liAmount + sharedShare
                });
            });
            return distributions;
        }, [lineItems, lineItemsTotal, sharedCostsTotal, suppliers]);

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
            
            const quantity = parseFloat(formData.quantity) || 1;
            totalCost = totalCost * quantity;
            
            return totalCost;
        }, [formData.rework_duration, formData.unit, formData.quantity, affectedUnits, unitCostSettings]);


        // Hesaplayıcı türler (Hurda/Fire/Yeniden İşlem): direkt formData.amount'a yaz
        useEffect(() => {
            if (!autoCalculate || !isCalculatorType) return;

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
        }, [formData.cost_type, formData.unit, formData.rework_duration, formData.material_type, formData.scrap_weight, formData.quantity, formData.unit_cost, affectedUnits, autoCalculate, addLaborToScrap, unitCostSettings, calculateScrapOrWasteCost, calculateReworkCost, isCalculatorType]);

        // Kalem tabanlı türler için toplam tutarı güncelle
        useEffect(() => {
            if (isCalculatorType) return;
            const newTotal = lineItemsTotal + sharedCostsTotal + indirectCostsTotal;
            setFormData(prev => {
                if (parseFloat(prev.amount) !== newTotal) {
                    return { ...prev, amount: newTotal };
                }
                return prev;
            });
        }, [lineItemsTotal, sharedCostsTotal, indirectCostsTotal, isCalculatorType]);

        // === Drag & Drop Handlers ===
        const handleDragOver = useCallback((e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        }, []);

        const handleDragLeave = useCallback((e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
        }, []);

        const handleDrop = useCallback((e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length > 0) {
                setPendingDocuments(prev => [...prev, ...files.map(f => ({ id: uuidv4(), file: f, docType: 'Fatura', description: '' }))]);
            }
        }, []);

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            // Tedarikçi doğrulama
            if (isSupplierNC && !formData.supplier_id) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tedarikçi kaynaklı maliyet için tedarikçi seçmelisiniz.' });
                return;
            }

            // Temel zorunlu alan kontrolü
            if (!formData.cost_type || !formData.cost_date) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen Maliyet Türü ve Tarih alanlarını doldurun.' });
                return;
            }
            
            const isRework = formData.cost_type === 'Yeniden İşlem Maliyeti';
            const isScrap = formData.cost_type === 'Hurda Maliyeti';
            const isWaste = formData.cost_type === 'Fire Maliyeti';
            
            const isCalcType = isScrap || isWaste || isRework;
            
            // Hesaplayıcı türler için ek kontroller
            if (isScrap || isWaste) {
                if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Hurda/Fire maliyeti için adet girmek zorunludur.' });
                    return;
                }
                if (formData.amount === '' || parseFloat(formData.amount) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tutar hesaplanamadı. Malzeme türü ve ağırlık/adet bilgilerini kontrol edin.' });
                    return;
                }
            } else if (isRework) {
                if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Yeniden işlem maliyeti için adet girmek zorunludur.' });
                    return;
                }
                if (formData.amount === '' || parseFloat(formData.amount) <= 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tutar hesaplanamadı. İşlem süresi ve birim bilgilerini kontrol edin.' });
                    return;
                }
            }

            // Kalem tabanlı türler için kalem doğrulama
            if (!isCalcType) {
                if (lineItems.length === 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'En az bir maliyet kalemi eklemelisiniz.' });
                    return;
                }
                const invalidItems = lineItems.filter(li => !(parseFloat(li.amount) > 0));
                if (invalidItems.length > 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tüm kalemlerin tutarı girilmelidir.' });
                    return;
                }
            }
            
            // Dolaylı maliyetlerde tutar zorunlu
            const invalidIndirect = indirectCosts.filter(ic => !ic.category || !(parseFloat(ic.amount) > 0));
            if (indirectCosts.length > 0 && invalidIndirect.length > 0) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Dolaylı maliyetlerde kategori ve tutar zorunludur.' });
                return;
            }

            // Dış Hata Maliyeti için müşteri adı zorunlu
            if (formData.cost_type === 'Dış Hata Maliyeti' && !formData.customer_name) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Dış Hata Maliyeti için müşteri adı zorunludur. Hangi müşteriden dönüş olduğunu belirtin.' });
                return;
            }

            // Dağılım kontrolü
            if (useAllocation) {
                const validAllocs = costAllocations.filter(a => (a.unit || a.supplier_id) && (parseFloat(a.percentage) || 0) > 0);
                const totalPct = validAllocs.reduce((s, a) => s + (parseFloat(a.percentage) || 0), 0);
                if (validAllocs.length === 0) {
                    toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Maliyet dağılımı için en az bir birim/tedarikçi ve yüzde girin.' });
                    return;
                }
                if (Math.abs(totalPct - 100) > 0.01) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Dağılım toplamı %100 olmalı. Şu an: %${totalPct.toFixed(1)}` });
                    return;
                }
            }

            let submissionData = { ...formData };
            // Etkilenen birimleri temizle ve filtrele
            const cleanedAffectedUnits = affectedUnits
                .map(({ id, ...rest }) => rest)
                .filter(au => au.unit && parseFloat(au.duration) > 0);
            
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

            // Dağılım verilerini hazırla
            submissionData.cost_allocations = null;
            submissionData.unit = submissionData.unit || null;

            // Kalem ve ek maliyet verilerini hazırla
            const isCalcTypeSubmit = isScrap || isWaste || isRework;
            
            if (isCalcTypeSubmit) {
                // Hesaplayıcı türler: formData.amount zaten hesaplanmış, kalemler opsiyonel
                submissionData.cost_line_items = lineItems.length > 0 
                    ? lineItems.map(({ id, ...rest }) => {
                        const base = { ...rest, amount: parseFloat(rest.amount) || 0, quantity: parseFloat(rest.quantity) || 0, unit_cost: parseFloat(rest.unit_cost) || 0 };
                        if (rest.responsible_type === 'supplier' && rest.responsible_supplier_id) {
                            base.responsible_supplier_name = suppliers.find(s => s.value === rest.responsible_supplier_id)?.label || null;
                        }
                        return base;
                    })
                    : null;
                // amount zaten formData'dan geliyor (auto-calc)
            } else {
                // Kalem tabanlı türler: kalemlerden toplam hesapla
                submissionData.cost_line_items = lineItems.map(({ id, ...rest }) => {
                    const base = { ...rest, amount: parseFloat(rest.amount) || 0, quantity: parseFloat(rest.quantity) || 0, unit_cost: parseFloat(rest.unit_cost) || 0 };
                    if (rest.responsible_type === 'supplier' && rest.responsible_supplier_id) {
                        base.responsible_supplier_name = suppliers.find(s => s.value === rest.responsible_supplier_id)?.label || null;
                    }
                    return base;
                });
                submissionData.amount = totalAmount;
                
                // İlk kalemin parça bilgisini ana alanlara yaz (geriye uyumluluk)
                if (lineItems.length > 0) {
                    const firstItem = lineItems[0];
                    if (!submissionData.part_code && firstItem.part_code) submissionData.part_code = firstItem.part_code;
                    if (!submissionData.part_name && firstItem.part_name) submissionData.part_name = firstItem.part_name;
                    if (!submissionData.unit && firstItem.responsible_unit) submissionData.unit = firstItem.responsible_unit;
                }
            }
            
            submissionData.shared_costs = sharedCosts.filter(sc => sc.category && (parseFloat(sc.amount) || 0) > 0).map(({ id, ...rest }) => ({
                ...rest,
                amount: parseFloat(rest.amount) || 0
            }));
            submissionData.indirect_costs = indirectCosts.filter(ic => ic.category && (parseFloat(ic.amount) || 0) > 0).map(({ id, ...rest }) => ({
                ...rest,
                amount: parseFloat(rest.amount) || 0
            }));
            
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
                submissionData.additional_labor_cost = submissionData.additional_labor_cost || 0;
            }
            
            if (!submissionData.is_supplier_nc) {
                submissionData.supplier_id = null;
                submissionData.is_reflected_to_supplier = false;
            }

            // Müşteri adı sadece Dış Hata Maliyeti için geçerli
            if (submissionData.cost_type !== 'Dış Hata Maliyeti') {
                submissionData.customer_name = null;
            }
            
            submissionData.is_reflected_to_supplier = isReflectedToSupplier;
            
            if (isReflectedToSupplier && submissionData.is_supplier_nc && !submissionData.cost_allocations) {
                submissionData.unit = 'Tedarikçi';
            }
            
            if (submissionData.responsible_personnel_id === '') {
                submissionData.responsible_personnel_id = null;
            }

            const quality_control_duration_backup = submissionData.quality_control_duration;
            
            delete submissionData.quality_control_duration;
            submissionData.unit_cost = (submissionData.unit_cost !== '' && submissionData.unit_cost != null) ? parseFloat(submissionData.unit_cost) : null;

            delete submissionData.responsible_personnel;
            delete submissionData.non_conformities;
            delete submissionData.suppliers;
            delete submissionData.supplier;
            
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
        const isVehicleTypeRequired = !(isWasteCost);

        const supplierOptions = suppliers.map(s => ({
            ...s,
            label: (
                <div className="flex items-center justify-between w-full">
                    <span>{typeof s.label === 'string' ? s.label : s.label}</span>
                    <Badge variant={getStatusBadgeVariant(s.status)}>{s.status}</Badge>
                </div>
            )
        }));

        const [activeTab, setActiveTab] = React.useState('details');

        // Summary helpers
        const unitCostPerItem = totalAmount && (parseFloat(formData.quantity) || 0) > 0 ? totalAmount / parseFloat(formData.quantity) : 0;

        // Nakliye dağılımı
        const sharedDistribution = getSharedCostDistribution();

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
                        {/* Kalem sayısı göstergesi */}
                        {lineItems.length > 1 && (
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-white/30 text-white/90 text-[10px]">{lineItems.length} kalem</Badge>
                            </div>
                        )}
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
                                    {/* Dış Hata Maliyeti seçildiğinde müşteri adı alanı */}
                                    {formData.cost_type === 'Dış Hata Maliyeti' && (
                                        <div className="grid grid-cols-3 gap-4 mt-4">
                                            <div className="col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Müşteri Adı <span className="text-destructive">*</span></label>
                                                <SearchableSelect value={formData.customer_name || ''} onValueChange={(v) => handleSelectChange('customer_name', v)} placeholder="Müşteri seçin veya yazın..." items={customers.length > 0 ? customers : ['Müşteri listesi yükleniyor...']} searchPlaceholder="Müşteri ara..." />
                                            </div>
                                            <div className="flex items-end pb-0.5">
                                                <p className="text-[10px] text-muted-foreground leading-tight">Hangi müşteriden dönüş olduğunu belirtin.</p>
                                            </div>
                                        </div>
                                    )}
                                    {/* Hesaplayıcı türler için parça ve birim bilgileri */}
                                    {isCalculatorType && (
                                        <div className="grid grid-cols-3 gap-4 mt-4">
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Parça Kodu</label><Input id="part_code" value={formData.part_code || ''} onChange={handleInputChange} placeholder="Parça kodu" /></div>
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Parça Adı</label><Input id="part_name" value={formData.part_name || ''} onChange={handleInputChange} placeholder="Parça adı" /></div>
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Birim (Kaynak)</label><SearchableSelect value={formData.unit || ''} onValueChange={(v) => handleSelectChange('unit', v)} placeholder="Birim seçin..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                        </div>
                                    )}
                                    {/* Kalem tabanlı türler için ek bilgiler - kalem varsa ana birim yok, her kalem kendi birimine sahip */}
                                    {!isCalculatorType && (
                                        <div className={`grid gap-4 mt-4 ${lineItems.length > 0 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                            <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Fatura/Referans No</label><Input id="invoice_number" value={formData.invoice_number || ''} onChange={handleInputChange} placeholder="Fatura numarası (opsiyonel)" /></div>
                                            {lineItems.length === 0 && (
                                                <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ana Birim</label><SearchableSelect value={formData.unit || ''} onValueChange={(v) => handleSelectChange('unit', v)} placeholder="Birim seçin..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Hesaplama Aracı (Hurda/Fire/Yeniden İşlem için) */}
                                {(isScrapCost || isWasteCost) && (
                                    <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest flex items-center gap-2"><Calculator className="w-4 h-4" /> Hesaplama Aracı</h3>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setAutoCalculate(!autoCalculate)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${autoCalculate ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-muted border-border text-muted-foreground'}`}><Zap className="w-3.5 h-3.5" /> Oto. Hesapla</button>
                                                {isScrapCost && <button type="button" onClick={() => setAddLaborToScrap(!addLaborToScrap)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${addLaborToScrap ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-muted border-border text-muted-foreground'}`}><Wrench className="w-3.5 h-3.5" /> İşçilik %50</button>}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground uppercase">Malzeme Türü <span className="text-destructive">*</span></label><SearchableSelect value={formData.material_type || ''} onValueChange={(v) => handleSelectChange('material_type', v)} placeholder="Malzeme seçin..." items={materialTypes} searchPlaceholder="Malzeme ara..." /></div>
                                            <div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground uppercase">Ağırlık (kg)</label><Input id="scrap_weight" type="number" value={formData.scrap_weight || ''} onChange={handleInputChange} placeholder="Ağırlık" className="h-8 text-sm" /></div>
                                            <div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground uppercase">Adet <span className="text-destructive">*</span></label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} placeholder="Adet" className="h-8 text-sm" /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200 dark:border-amber-700">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Hesaplanan Tutar (₺)</label>
                                                <Input id="amount" type="number" className="font-bold text-base bg-white dark:bg-background" value={formData.amount || ''} onChange={handleInputChange} readOnly={autoCalculate} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Açıklama</label>
                                                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Maliyet açıklaması..." rows={4} className="min-h-[88px] text-sm resize-y" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isReworkCost && (
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest flex items-center gap-2"><Calculator className="w-4 h-4" /> Süre Hesaplama Aracı</h3>
                                            <button type="button" onClick={() => setAutoCalculate(!autoCalculate)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${autoCalculate ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-muted border-border text-muted-foreground'}`}><Zap className="w-3.5 h-3.5" /> Oto. Hesapla</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground uppercase">Ana İşlem Süresi (dk)</label><Input id="rework_duration" type="number" value={formData.rework_duration || ''} onChange={handleInputChange} className="h-8 text-sm" /></div>
                                            <div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground uppercase">Adet <span className="text-destructive">*</span></label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleInputChange} placeholder="Adet" className="h-8 text-sm" /></div>
                                        </div>
                                        {/* Etkilenen Birimler */}
                                        <div className="space-y-2 mt-2">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Etkilenen Birimler</h4>
                                                <button type="button" onClick={addAffectedUnit} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Birim Ekle</button>
                                            </div>
                                            {affectedUnits.map((unit) => (
                                                <div key={unit.id} className="flex gap-2 items-center">
                                                    <div className="flex-1"><SearchableSelect value={unit.unit} onValueChange={(v) => handleAffectedUnitChange(unit.id, 'unit', v)} placeholder="Birim seç..." items={departments} searchPlaceholder="Birim ara..." /></div>
                                                    <div className="w-28"><Input type="number" placeholder="Süre (dk)" value={unit.duration} onChange={(e) => handleAffectedUnitChange(unit.id, 'duration', e.target.value)} className="h-8 text-sm" /></div>
                                                    <button type="button" onClick={() => removeAffectedUnit(unit.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200 dark:border-blue-700">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">Hesaplanan Tutar (₺)</label>
                                                <Input id="amount" type="number" className="font-bold text-base bg-white dark:bg-background" value={formData.amount || ''} onChange={handleInputChange} readOnly={autoCalculate} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Açıklama</label>
                                                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Maliyet açıklaması..." rows={4} className="min-h-[88px] text-sm resize-y" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div>
                                    <div className="flex border-b border-border overflow-x-auto">
                                        {!isCalculatorType && (
                                            <button type="button" onClick={() => setActiveTab('details')} className={`px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Package className="w-3.5 h-3.5" /> Maliyet Kalemleri {lineItems.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{lineItems.length}</span>}
                                            </button>
                                        )}
                                        {isCalculatorType && (
                                            <button type="button" onClick={() => setActiveTab('details')} className={`px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Package className="w-3.5 h-3.5" /> Ek Kalemler <span className="text-[9px] text-muted-foreground">(Opsiyonel)</span> {lineItems.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{lineItems.length}</span>}
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setActiveTab('shared')} className={`px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'shared' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                            <Truck className="w-3.5 h-3.5" /> Ortak Maliyetler {sharedCosts.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{sharedCosts.length}</span>}
                                        </button>
                                        <button type="button" onClick={() => setActiveTab('indirect')} className={`px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'indirect' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                            <TrendingDown className="w-3.5 h-3.5" /> Dolaylı Maliyetler {indirectCosts.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{indirectCosts.length}</span>}
                                        </button>
                                        <button type="button" onClick={() => setActiveTab('documents')} className={`px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Ekler {pendingDocuments.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">{pendingDocuments.length}</span>}</button>
                                    </div>

                                    {/* Tab: Maliyet Kalemleri (her zaman aktif) */}
                                    {activeTab === 'details' && (
                                        <div className="py-5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4" /> Maliyet Kalemleri</h3>
                                                <button type="button" onClick={addLineItem} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Kalem Ekle</button>
                                            </div>
                                            
                                            {lineItems.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-xs">Henüz kalem eklenmedi. "Kalem Ekle" butonuna tıklayın.</p>
                                                </div>
                                            )}

                                            {lineItems.map((item, idx) => (
                                                <div key={item.id} className="bg-muted/30 rounded-xl p-4 border border-border space-y-3 relative">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Kalem #{idx + 1}</span>
                                                        <button type="button" onClick={() => removeLineItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Parça Kodu</label>
                                                            <Input value={item.part_code || ''} onChange={(e) => updateLineItem(item.id, 'part_code', e.target.value)} placeholder="Parça kodu" className="h-8 text-sm" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Parça Adı</label>
                                                            <Input value={item.part_name || ''} onChange={(e) => updateLineItem(item.id, 'part_name', e.target.value)} placeholder="Parça adı" className="h-8 text-sm" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Maliyet Alt Türü</label>
                                                            <SearchableSelect value={item.cost_subtype || ''} onValueChange={(v) => updateLineItem(item.id, 'cost_subtype', v)} placeholder="Tür seçin..." items={COST_SUBTYPES} searchPlaceholder="Alt tür ara..." />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Sorumlu Tipi</label>
                                                            <div className="flex p-0.5 bg-muted rounded-md">
                                                                <button type="button" onClick={() => updateLineItem(item.id, 'responsible_type', 'unit')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded transition-all ${item.responsible_type === 'unit' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Birim</button>
                                                                <button type="button" onClick={() => updateLineItem(item.id, 'responsible_type', 'supplier')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded transition-all ${item.responsible_type === 'supplier' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Tedarikçi</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                {item.responsible_type === 'supplier' ? 'Tedarikçi' : 'Birim'}
                                                            </label>
                                                            {item.responsible_type === 'supplier' ? (
                                                                <SearchableSelectDialog
                                                                    options={supplierOptions}
                                                                    value={item.responsible_supplier_id}
                                                                    onChange={(value) => updateLineItem(item.id, 'responsible_supplier_id', value)}
                                                                    triggerPlaceholder="Tedarikçi seçin..."
                                                                    dialogTitle="Tedarikçi Seç"
                                                                    searchPlaceholder="Tedarikçi ara..."
                                                                    notFoundText="Tedarikçi bulunamadı."
                                                                />
                                                            ) : (
                                                                <SearchableSelect value={item.responsible_unit || ''} onValueChange={(v) => updateLineItem(item.id, 'responsible_unit', v)} placeholder="Birim seçin..." items={departments} searchPlaceholder="Birim ara..." />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Miktar</label>
                                                            <Input type="number" value={item.quantity || ''} onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)} placeholder="Miktar" className="h-8 text-sm" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Birim Fiyat (₺)</label>
                                                            <Input type="number" step="0.01" value={item.unit_cost || ''} onChange={(e) => updateLineItem(item.id, 'unit_cost', e.target.value)} placeholder="Birim fiyat" className="h-8 text-sm" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Ölçü Birimi</label>
                                                            <SearchableSelect value={item.measurement_unit || ''} onValueChange={(v) => updateLineItem(item.id, 'measurement_unit', v)} placeholder="Birim..." items={MEASUREMENT_UNITS} searchPlaceholder="Birim ara..." />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Tutar (₺) <span className="text-destructive">*</span></label>
                                                            <Input type="number" step="0.01" value={item.amount || ''} onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)} placeholder="Tutar" className="h-8 text-sm font-semibold" readOnly={((parseFloat(item.quantity) || 0) > 0 && (parseFloat(item.unit_cost) || 0) > 0) || (isCalculatorType && autoCalculate && idx === 0)} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Açıklama</label>
                                                        <Input autoFormat={false} value={item.description || ''} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder="Kalem açıklaması..." className="h-8 text-sm" />
                                                    </div>
                                                </div>
                                            ))}

                                            {lineItems.length > 0 && (
                                                <div className="flex justify-end pt-2 border-t border-border">
                                                    <div className="text-sm font-semibold">Kalem Toplamı: <span className="text-primary">{formatCurrency(lineItemsTotal)}</span></div>
                                                </div>
                                            )}

                                            <div className="space-y-1.5 mt-4">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Genel Açıklama</label>
                                                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} rows={2} placeholder="Fatura/maliyet kaydı ile ilgili genel açıklama..." className="resize-none" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab: Ortak Maliyetler (Nakliye, Konaklama vb.) */}
                                    {activeTab === 'shared' && (
                                        <div className="py-5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Truck className="w-4 h-4" /> Ortak Maliyetler</h3>
                                                <button type="button" onClick={addSharedCost} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ekle</button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">Nakliye, konaklama, yol gibi ortak maliyetler, kalemlerin yüzdelik payına göre otomatik olarak dağıtılır.</p>

                                            {sharedCosts.length === 0 && (
                                                <div className="text-center py-6 text-muted-foreground">
                                                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-xs">Ortak maliyet eklenmedi.</p>
                                                </div>
                                            )}

                                            {sharedCosts.map((sc, idx) => (
                                                <div key={sc.id} className="flex gap-3 items-start bg-muted/30 rounded-lg p-3 border border-border">
                                                    <div className="flex-1 grid grid-cols-4 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Kategori <span className="text-destructive">*</span></label>
                                                            <SearchableSelect value={sc.category || ''} onValueChange={(v) => updateSharedCost(sc.id, 'category', v)} placeholder="Seçiniz..." items={SHARED_COST_CATEGORIES} searchPlaceholder="Kategori ara..." />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Tutar (₺) <span className="text-destructive">*</span></label>
                                                            <Input type="number" step="0.01" value={sc.amount || ''} onChange={(e) => updateSharedCost(sc.id, 'amount', e.target.value)} placeholder="Tutar" className="h-8 text-sm font-semibold" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Ölçü Birimi</label>
                                                            <SearchableSelect value={sc.measurement_unit || 'TRY'} onValueChange={(v) => updateSharedCost(sc.id, 'measurement_unit', v)} placeholder="Birim..." items={MEASUREMENT_UNITS} searchPlaceholder="Birim ara..." />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Açıklama</label>
                                                            <Input autoFormat={false} value={sc.description || ''} onChange={(e) => updateSharedCost(sc.id, 'description', e.target.value)} placeholder="Açıklama..." className="h-8 text-sm" />
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => removeSharedCost(sc.id)} className="text-muted-foreground hover:text-destructive transition-colors mt-5"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}

                                            {sharedCosts.length > 0 && (
                                                <div className="flex justify-end pt-2 border-t border-border">
                                                    <div className="text-sm font-semibold">Ortak Maliyet Toplamı: <span className="text-amber-600">{formatCurrency(sharedCostsTotal)}</span></div>
                                                </div>
                                            )}

                                            {/* Nakliye dağılım önizlemesi */}
                                            {sharedDistribution.length > 0 && sharedCostsTotal > 0 && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 space-y-2">
                                                    <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest">Dağılım Önizlemesi</h4>
                                                    {sharedDistribution.map((dist) => (
                                                        <div key={dist.lineItemId} className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">{dist.part_code || dist.part_name || 'Kalem'} ({dist.responsible})</span>
                                                            <span className="font-semibold">%{dist.percentage.toFixed(1)} → {formatCurrency(dist.sharedShare)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab: Dolaylı Maliyetler */}
                                    {activeTab === 'indirect' && (
                                        <div className="py-5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Dolaylı Maliyetler</h3>
                                                <button type="button" onClick={addIndirectCost} className="text-primary text-xs font-bold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ekle</button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">Referans kaybı, fırsat maliyeti, itibar kaybı gibi ölçülmesi zor dolaylı maliyetleri ekleyin. Tutar zorunludur.</p>

                                            {indirectCosts.length === 0 && (
                                                <div className="text-center py-6 text-muted-foreground">
                                                    <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-xs">Dolaylı maliyet eklenmedi.</p>
                                                </div>
                                            )}

                                            {indirectCosts.map((ic) => (
                                                <div key={ic.id} className="flex gap-3 items-start bg-muted/30 rounded-lg p-3 border border-border">
                                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Kategori <span className="text-destructive">*</span></label>
                                                            <SearchableSelect value={ic.category || ''} onValueChange={(v) => updateIndirectCost(ic.id, 'category', v)} placeholder="Seçiniz..." items={INDIRECT_COST_CATEGORIES} searchPlaceholder="Kategori ara..." />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Tutar (₺) <span className="text-destructive">*</span></label>
                                                            <Input type="number" step="0.01" value={ic.amount || ''} onChange={(e) => updateIndirectCost(ic.id, 'amount', e.target.value)} placeholder="Tutar" className="h-8 text-sm font-semibold" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Açıklama</label>
                                                            <Input autoFormat={false} value={ic.description || ''} onChange={(e) => updateIndirectCost(ic.id, 'description', e.target.value)} placeholder="Detaylı açıklama..." className="h-8 text-sm" />
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => removeIndirectCost(ic.id)} className="text-muted-foreground hover:text-destructive transition-colors mt-5"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}

                                            {indirectCosts.length > 0 && (
                                                <div className="flex justify-end pt-2 border-t border-border">
                                                    <div className="text-sm font-semibold">Dolaylı Maliyet Toplamı: <span className="text-red-600">{formatCurrency(indirectCostsTotal)}</span></div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab: Ekler (Drag & Drop desteği ile) */}
                                    {activeTab === 'documents' && (
                                        <div className="py-5 space-y-4">
                                            <div>
                                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Dosya Ekleri</h3>
                                                <label 
                                                    ref={dropZoneRef}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer group block ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'}`}
                                                >
                                                    <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-primary'}`} />
                                                    <p className="text-sm text-muted-foreground">
                                                        <span className="font-semibold text-primary">Yüklemek için tıklayın</span> veya sürükleyip bırakın
                                                    </p>
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

                                {/* Maliyet kırılımları */}
                                {((isCalculatorType ? (parseFloat(formData.amount) || 0) > 0 : lineItemsTotal > 0) || sharedCostsTotal > 0 || indirectCostsTotal > 0) && (
                                    <div className="space-y-2 bg-background rounded-lg p-3 border border-border">
                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Maliyet Kırılımı</h3>
                                        {isCalculatorType && (parseFloat(formData.amount) || 0) > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1"><Calculator className="w-3 h-3" /> Hesaplanan Tutar</span>
                                                <span className="font-semibold text-foreground">{formatCurrency(parseFloat(formData.amount) || 0)}</span>
                                            </div>
                                        )}
                                        {!isCalculatorType && lineItemsTotal > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Kalemler ({lineItems.length})</span>
                                                <span className="font-semibold text-foreground">{formatCurrency(lineItemsTotal)}</span>
                                            </div>
                                        )}
                                        {sharedCostsTotal > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Ortak Maliyetler</span>
                                                <span className="font-semibold text-amber-600">{formatCurrency(sharedCostsTotal)}</span>
                                            </div>
                                        )}
                                        {indirectCostsTotal > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Dolaylı Maliyetler</span>
                                                <span className="font-semibold text-red-600">{formatCurrency(indirectCostsTotal)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Kalem detayları */}
                                {lineItems.length > 0 && lineItems.some(li => (parseFloat(li.amount) || 0) > 0) && (
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kalem Detayları</h3>
                                        {lineItems.filter(li => (parseFloat(li.amount) || 0) > 0).map((li, idx) => {
                                            const liAmt = parseFloat(li.amount) || 0;
                                            const responsible = li.responsible_type === 'supplier'
                                                ? suppliers.find(s => s.value === li.responsible_supplier_id)?.label || 'Tedarikçi'
                                                : li.responsible_unit || '-';
                                            return (
                                                <div key={li.id} className="bg-background rounded-lg p-2.5 border border-border space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-medium text-foreground truncate">{li.part_code || li.part_name || `Kalem #${idx + 1}`}</span>
                                                        <span className="font-bold text-primary ml-2 whitespace-nowrap">{formatCurrency(liAmt)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>{li.cost_subtype || '-'}</span>
                                                        <span className={li.responsible_type === 'supplier' ? 'text-amber-600' : ''}>{responsible}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Ortak maliyet dağılım detayları */}
                                {sharedDistribution.length > 0 && sharedCostsTotal > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nakliye Dağılımı</h3>
                                        {sharedDistribution.map((dist) => (
                                            <div key={dist.lineItemId} className="space-y-1">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-muted-foreground truncate">{dist.part_code || dist.part_name || 'Kalem'}</span>
                                                    <span className="text-foreground whitespace-nowrap">{formatCurrency(dist.totalWithShared)}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(dist.percentage, 100)}%` }} />
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Kalem: {formatCurrency(dist.baseAmount)} + Ortak: {formatCurrency(dist.sharedShare)} (%{dist.percentage.toFixed(1)})
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Dolaylı maliyet detayları */}
                                {indirectCosts.filter(ic => ic.category && (parseFloat(ic.amount) || 0) > 0).length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dolaylı Maliyetler</h3>
                                        {indirectCosts.filter(ic => ic.category && (parseFloat(ic.amount) || 0) > 0).map((ic) => (
                                            <div key={ic.id} className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">{ic.category}</span>
                                                <span className="font-semibold text-red-600">{formatCurrency(parseFloat(ic.amount) || 0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Genel bilgiler */}
                                <div className="pt-4 border-t border-border space-y-2.5">
                                    {formData.cost_type && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Maliyet Türü:</span><span className="font-semibold text-foreground">{formData.cost_type}</span></div>
                                    )}
                                    {formData.vehicle_type && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Araç Tipi:</span><span className="font-semibold text-foreground">{formData.vehicle_type}</span></div>
                                    )}
                                    {formData.unit && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">{isCalculatorType ? 'Birim:' : 'Ana Birim:'}</span><span className="font-semibold text-foreground">{formData.unit}</span></div>
                                    )}
                                    {isCalculatorType && (formData.part_code || formData.part_name) && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Parça:</span><span className="font-semibold text-foreground truncate ml-2">{[formData.part_code, formData.part_name].filter(Boolean).join(' - ')}</span></div>
                                    )}
                                    {isCalculatorType && formData.material_type && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Malzeme:</span><span className="font-semibold text-foreground">{formData.material_type}</span></div>
                                    )}
                                    {isCalculatorType && (parseFloat(formData.quantity) || 0) > 0 && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Adet:</span><span className="font-semibold text-foreground">{formData.quantity}</span></div>
                                    )}
                                    {formData.invoice_number && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Fatura No:</span><span className="font-semibold text-foreground">{formData.invoice_number}</span></div>
                                    )}
                                    {formData.customer_name && formData.cost_type === 'Dış Hata Maliyeti' && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Müşteri:</span><span className="font-semibold text-blue-600">{formData.customer_name}</span></div>
                                    )}
                                    {isSupplierNC && formData.supplier_id && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tedarikçi:</span><span className="font-semibold text-amber-600">{suppliers.find(s => s.value === formData.supplier_id)?.label || '-'}</span></div>
                                    )}
                                    {pendingDocuments.length > 0 && (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Dokümanlar:</span><span className="font-semibold text-foreground">{pendingDocuments.length} dosya</span></div>
                                    )}
                                </div>

                                {/* Info Alert */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2.5 border border-blue-100 dark:border-blue-800">
                                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                                        {isCalculatorType 
                                            ? 'Tutar, ayarlardaki malzeme/birim fiyatlarından otomatik hesaplanır. İhtiyaç halinde ek kalemler ve dolaylı maliyetler ekleyebilirsiniz.'
                                            : lineItems.length > 1 
                                                ? 'Birden fazla kalem, ortak maliyet ve dolaylı maliyet ekleyebilirsiniz. Ortak maliyetler kalemlerin yüzdelik payına göre dağıtılır.'
                                                : 'Maliyet bilgilerini eksiksiz doldurun. Ek kalem, ortak maliyet ve dolaylı maliyet ekleyebilirsiniz.'}
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
                            {lineItems.length > 1 && <Badge variant="outline" className="ml-2 text-[10px]">{lineItems.length} Kalem</Badge>}
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
