import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, Edit, Trash2, Eye, Link as LinkIcon, Search, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CostFormModal } from '@/components/quality-cost/CostFormModal';
import CostAnalytics from '@/components/quality-cost/CostAnalytics';
import CostFilters from '@/components/quality-cost/CostFilters';
import VehicleCostBreakdown from '@/components/quality-cost/VehicleCostBreakdown';
import CostDrillDownModal from '@/components/quality-cost/CostDrillDownModal';
import CostForecaster from '@/components/quality-cost/CostForecaster';
import { CostViewModal } from '@/components/quality-cost/CostViewModal';
import COPQCalculator from '@/components/quality-cost/COPQCalculator';
import PartCostLeaders from '@/components/quality-cost/PartCostLeaders';
import CostAnomalyDetector from '@/components/quality-cost/CostAnomalyDetector';
import CostTrendAnalysis from '@/components/quality-cost/CostTrendAnalysis';
// import { CostDetailModal } from '@/components/quality-cost/CostDetailModal'; // Removed in favor of DrillDown
import UnitCostDistribution from '@/components/quality-cost/UnitCostDistribution';
import UnitReportModal from '@/components/quality-cost/UnitReportModal';
import { formatVehicleMetricValue } from '@/components/quality-cost/vehicleMetricConfig';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { openPrintableReport } from '@/lib/reportUtils';
import { filterCostsByYear, summarizeCostRows } from '@/lib/qualityCostAnalysis';
import { computeHurdaReworkDefectAnalysis } from '@/lib/qualityCostDefectAggregation';
import {
    buildCostUnitFilterKeyIndex,
    collectUnitFilterOptions,
    costMatchesUnitUsingIndex,
    createCanonicalUnitCaches,
} from '@/lib/qualityCostUnitGroups';

const parseLocalDayStart = (isoDate) => {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseLocalDayEnd = (isoDate) => {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 999);
};
import {
    PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY,
    readProcessInspectionFlow,
    clearProcessInspectionFlow,
} from '@/lib/processInspectionFlowKeys';
import { finalizeProcessInspectionResolution } from '@/lib/finalizeProcessInspectionResolution';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, BarChart3 } from 'lucide-react';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const getSharedCostsTotal = (cost) => {
    const list = Array.isArray(cost?.shared_costs) ? cost.shared_costs : [];
    return list.filter((sc) => sc?.category && (parseFloat(sc.amount) || 0) > 0)
        .reduce((s, sc) => s + (parseFloat(sc.amount) || 0), 0);
};

const getCostLineItemsTotal = (cost) => {
    const items = cost?.cost_line_items;
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
};

/** Ortak maliyeti kalem tutarlarına oranla; tek satırda toplu gösterim için */
const getAllocatedSharedForLine = (cost, lineItem, lineItems) => {
    const sharedTotal = getSharedCostsTotal(cost);
    if (sharedTotal <= 0) return 0;
    const lineTotal = getCostLineItemsTotal(cost);
    const liAmount = lineItem ? (parseFloat(lineItem.amount) || 0) : 0;
    if (lineTotal > 0) {
        return sharedTotal * (liAmount / lineTotal);
    }
    const n = Array.isArray(lineItems) ? lineItems.length : 0;
    if (n > 0 && lineItem) {
        return sharedTotal / n;
    }
    return 0;
};

/** Tabloda arama: Object.values(cost) kullanmayın — JSON/array serileştirmesi düşüşe yol açar */
const QUALITY_COST_SEARCH_FIELDS = [
    'cost_type', 'unit', 'description', 'part_code', 'part_name', 'vehicle_type',
    'invoice_number', 'customer_name', 'measurement_unit', 'reporting_unit', 'material_type', 'cost_date',
    'primary_defect_type',
];

function costMatchesSearchTerm(cost, lowercasedFilter) {
    for (const key of QUALITY_COST_SEARCH_FIELDS) {
        const v = cost[key];
        if (v != null && v !== '' && String(v).toLowerCase().includes(lowercasedFilter)) return true;
    }
    if (cost.supplier?.name && String(cost.supplier.name).toLowerCase().includes(lowercasedFilter)) return true;
    const items = cost.cost_line_items;
    if (!Array.isArray(items)) return false;
    for (const li of items) {
        const blob = `${li.part_code || ''}${li.part_name || ''}${li.description || ''}${li.responsible_unit || ''}${li.defect_type || ''}`.toLowerCase();
        if (blob.includes(lowercasedFilter)) return true;
    }
    const allocs = cost.cost_allocations;
    if (Array.isArray(allocs)) {
        for (const a of allocs) {
            const u = a?.unit;
            if (u != null && String(u).toLowerCase().includes(lowercasedFilter)) return true;
        }
    }
    return false;
}

const QualityCostModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const { profile } = useAuth();
    const { qualityCosts, personnel, unitCostSettings, materialCostSettings, producedVehicles, loading, refreshData, refreshQualityCosts } = useData();

    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState(null);
    const [costPrefill, setCostPrefill] = useState(null);
    const [processInspectionCostFlow, setProcessInspectionCostFlow] = useState(null);
    const [selectedLineItem, setSelectedLineItem] = useState(null);
    const [dateRange, setDateRange] = useState({ key: 'all', startDate: null, endDate: null, label: 'Tüm Zamanlar' });
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalContent, setDetailModalContent] = useState({
        title: '',
        costs: [],
        yearContext: null,
        vehicleContext: null,
        dateRange: null,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [costCategoryFilter, setCostCategoryFilter] = useState('all'); // 'all' | 'internal' | 'external' | 'prevention'
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportSelectionModalOpen, setIsReportSelectionModalOpen] = useState(false);
    const [isCreateNCModalOpen, setIsCreateNCModalOpen] = useState(false);
    const [costForNC, setCostForNC] = useState(null);
    const [selectedNCType, setSelectedNCType] = useState('DF');
    const [sortConfig, setSortConfig] = useState({ key: 'cost_date', direction: 'desc' });
    const [displayLimit, setDisplayLimit] = useState(100); // Tabloda gösterilecek kayıt limiti
    /** Açık sekme — Radix tüm sekmeleri DOM'da tuttuğu için yalnızca aktif sekmede ağır hesap/child mount */
    const [qualityCostTab, setQualityCostTab] = useState('overview');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [vehicleTargetsRefreshKey, setVehicleTargetsRefreshKey] = useState(0);

    const handleVehicleTargetsApplied = useCallback(() => {
        setVehicleTargetsRefreshKey((k) => k + 1);
    }, []);

    // Proses muayenesi Ret çözüm akışı: Hurda Maliyeti formunu ön-doldurulmuş aç.
    useEffect(() => {
        const flow = readProcessInspectionFlow(PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY);
        if (flow?.inspectionId) {
            setProcessInspectionCostFlow(flow);
            setCostPrefill(flow.prefill || null);
            setSelectedCost(null);
            setFormModalOpen(true);
        }
    }, []);

    const hasNCAccess = useMemo(() => {
        return profile?.role === 'admin';
    }, [profile]);

    /** Ayarlardaki cost_settings.unit_name ile aynı birim yazımı için */
    const canonicalUnitCtx = useMemo(
        () => ({ unitCostSettings: unitCostSettings || [], personnel: personnel || [] }),
        [unitCostSettings, personnel]
    );

    const canonCaches = useMemo(
        () => createCanonicalUnitCaches(canonicalUnitCtx),
        [canonicalUnitCtx]
    );

    /** Veri/canon değişince bir kez: filtre seçiminde her satırda yeniden canonicalize edilmez */
    const costUnitFilterKeyIndex = useMemo(
        () => buildCostUnitFilterKeyIndex(qualityCosts, canonCaches),
        [qualityCosts, canonCaches]
    );

    /** Filtre state anında güncellenir (Select kapanır); ağır liste hesabı `useDeferredValue` ile sonra gelir → UI bloklanmaz */
    const filterInputs = useMemo(
        () => ({
            dateRange,
            unitFilter,
            sourceFilter,
            costCategoryFilter,
            searchTerm,
            sortConfig,
        }),
        [dateRange, unitFilter, sourceFilter, costCategoryFilter, searchTerm, sortConfig]
    );
    const deferredFilterInputs = useDeferredValue(filterInputs);
    /** `filterInputs !== deferredFilterInputs` → güncellenmiş seçim yazılmış, liste/grafik hâlen eski (hesap devam ediyor) */
    const filtersStillComputing = filterInputs !== deferredFilterInputs;

    const filteredCosts = useMemo(() => {
        const dr = deferredFilterInputs.dateRange;
        const uf = deferredFilterInputs.unitFilter;
        const sf = deferredFilterInputs.sourceFilter;
        const ccf = deferredFilterInputs.costCategoryFilter;
        const st = deferredFilterInputs.searchTerm;
        const sc = deferredFilterInputs.sortConfig;

        let costs = [...qualityCosts];

        if (dr.startDate && dr.endDate) {
            const rangeStart = parseLocalDayStart(dr.startDate);
            const rangeEnd = parseLocalDayEnd(dr.endDate);
            if (rangeStart && rangeEnd) {
                costs = costs.filter((cost) => {
                    const costDate = new Date(cost.cost_date);
                    return costDate >= rangeStart && costDate <= rangeEnd;
                });
            }
        }

        if (uf !== 'all') {
            costs = costs.filter((cost) => costMatchesUnitUsingIndex(costUnitFilterKeyIndex, cost, uf, canonCaches));
        }

        if (sf !== 'all') {
            if (sf === 'produced_vehicle') {
                costs = costs.filter((cost) =>
                    cost.source_type === 'produced_vehicle' ||
                    cost.source_type === 'produced_vehicle_final_faults' ||
                    cost.source_type === 'produced_vehicle_manual'
                );
            } else {
                costs = costs.filter((cost) => cost.source_type === sf);
            }
        }

        // COQ Kategori filtresi: İç Hata, Dış Hata, Önleme, Değerlendirme
        if (ccf !== 'all') {
            const internalTypes = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti'];
            const externalTypes = ['Dış Hata Maliyeti'];
            const preventionTypes = ['Önleme Maliyeti'];
            costs = costs.filter((cost) => {
                const ct = cost.cost_type || '';
                const isSupplierCost = cost.is_supplier_nc && cost.supplier_id;
                if (ccf === 'internal') return internalTypes.includes(ct) || isSupplierCost;
                if (ccf === 'external') return externalTypes.includes(ct);
                if (ccf === 'prevention') return preventionTypes.includes(ct);
                if (ccf === 'supplier') return isSupplierCost;
                if (ccf === 'indirect') return (cost.indirect_costs && Array.isArray(cost.indirect_costs) && cost.indirect_costs.length > 0);
                if (ccf === 'invoice') return (cost.cost_line_items && Array.isArray(cost.cost_line_items) && cost.cost_line_items.length > 0);
                return true;
            });
        }

        if (st) {
            const lowercasedFilter = st.toLowerCase();
            costs = costs.filter((cost) => costMatchesSearchTerm(cost, lowercasedFilter));
        }

        costs.sort((a, b) => {
            let aVal, bVal;
            switch (sc.key) {
                case 'cost_date':
                    aVal = new Date(a.cost_date || 0).getTime();
                    bVal = new Date(b.cost_date || 0).getTime();
                    break;
                case 'amount':
                    aVal = parseFloat(a.amount) || 0;
                    bVal = parseFloat(b.amount) || 0;
                    break;
                case 'cost_type':
                    aVal = (a.cost_type || '').toLowerCase();
                    bVal = (b.cost_type || '').toLowerCase();
                    break;
                case 'unit':
                    aVal = (a.unit || '').toLowerCase();
                    bVal = (b.unit || '').toLowerCase();
                    break;
                default:
                    aVal = a[sc.key];
                    bVal = b[sc.key];
            }
            if (aVal !== bVal) {
                const comparison = aVal < bVal ? -1 : 1;
                return sc.direction === 'asc' ? comparison : -comparison;
            }
            const aCreated = new Date(a.created_at || 0).getTime();
            const bCreated = new Date(b.created_at || 0).getTime();
            return bCreated - aCreated;
        });

        return costs;
    }, [qualityCosts, deferredFilterInputs, canonCaches, costUnitFilterKeyIndex]);

    const copqYearTotals = useMemo(() => {
        const cy = new Date().getFullYear();
        const py = cy - 1;
        let totalCurrent = 0;
        let totalPrevious = 0;
        const list = filteredCosts || [];
        for (const c of list) {
            if (!c?.cost_date) continue;
            const y = new Date(c.cost_date).getFullYear();
            const amt = parseFloat(c.amount) || 0;
            if (y === cy) totalCurrent += amt;
            if (y === py) totalPrevious += amt;
        }
        return { currentYear: cy, previousYear: py, totalCurrent, totalPrevious };
    }, [filteredCosts]);

    const copqYearlyInsight = useMemo(() => {
        const cy = new Date().getFullYear();
        const py = cy - 1;
        const costs = filteredCosts || [];
        const sCurrent = summarizeCostRows(filterCostsByYear(costs, cy));
        const sPrevious = summarizeCostRows(filterCostsByYear(costs, py));
        return {
            currentYear: cy,
            previousYear: py,
            current: sCurrent,
            previous: sPrevious,
            previousMonthlyAvg: sPrevious.total / 12,
        };
    }, [filteredCosts]);

    /** Toplam kalem satırı sayısı — yalnızca Kayıtlar sekmesi açıkken (boşta tüm listeyi taramayı atla) */
    const expandedLineCountTotal = useMemo(() => {
        if (qualityCostTab !== 'records') return 0;
        let n = 0;
        for (const cost of filteredCosts) {
            const li = cost.cost_line_items;
            n += Array.isArray(li) && li.length > 0 ? li.length : 1;
        }
        return n;
    }, [filteredCosts, qualityCostTab]);

    const displayedCosts = useMemo(() => {
        if (qualityCostTab !== 'records') return [];
        const rows = [];
        let remaining = displayLimit;
        for (const cost of filteredCosts) {
            if (remaining <= 0) break;
            const lineItems = cost.cost_line_items;
            if (Array.isArray(lineItems) && lineItems.length > 0) {
                for (let idx = 0; idx < lineItems.length && remaining > 0; idx++) {
                    rows.push({ cost, lineItem: lineItems[idx], lineIndex: idx, rowType: 'line' });
                    remaining--;
                }
            } else {
                rows.push({ cost, lineItem: null, lineIndex: 0, rowType: 'line' });
                remaining--;
            }
        }
        return rows;
    }, [filteredCosts, displayLimit, qualityCostTab]);

    const hasMoreCosts = qualityCostTab === 'records' && expandedLineCountTotal > displayLimit;

    const handleLoadMore = useCallback(() => {
        setDisplayLimit(prev => prev + 100);
    }, []);

    // Filtre değiştiğinde limiti sıfırla
    useEffect(() => {
        setDisplayLimit(100);
    }, [dateRange, unitFilter, sourceFilter, costCategoryFilter, searchTerm, sortConfig]);

    const handleOpenFormModal = (cost = null) => {
        setSelectedCost(cost);
        setFormModalOpen(true);
    };

    const handleOpenViewModal = (cost, lineItem = null) => {
        setSelectedCost(cost);
        setSelectedLineItem(lineItem);
        setIsViewModalOpen(true);
    };

    /** COPQ / grafik drill-down içinde Kayıtlar sekmesi: üst modal kapanmadan ikinci modal arkada kalıyordu */
    const handleDrillRecordView = useCallback((cost) => {
        setDetailModalOpen(false);
        queueMicrotask(() => {
            setSelectedCost(cost);
            setSelectedLineItem(null);
            setIsViewModalOpen(true);
        });
    }, []);

    const handleDrillRecordEdit = useCallback((cost) => {
        setDetailModalOpen(false);
        queueMicrotask(() => {
            setSelectedCost(cost);
            setCostPrefill(null);
            setProcessInspectionCostFlow(null);
            clearProcessInspectionFlow(PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY);
            setFormModalOpen(true);
        });
    }, []);

    const handleDrillRecordDeleteRequest = useCallback((costId) => {
        setDetailModalOpen(false);
        queueMicrotask(() => setDeleteConfirmId(costId));
    }, []);

    const buildAnalysisContextDescription = useCallback((cost, context) => {
        if (!context) return cost.description;

        const lines = [
            'Arac Bazli Hedef Analizinden Otomatik Baslatildi',
            `Donem: ${context.dateRangeLabel || 'Tum Zamanlar'}`,
            `Arac Tipi: ${context.vehicleType || cost.vehicle_type || '-'}`,
            `Metrik: ${context.metricLabel || '-'}`,
        ];

        if (typeof context.totalVehicles === 'number') {
            lines.push(`Analize Giren Arac: ${context.totalVehicles}`);
        }

        if (typeof context.actualValue === 'number') {
            lines.push(`Gerceklesen: ${formatVehicleMetricValue(context.actualValue, context.metricKey)}`);
        }

        if (typeof context.targetValue === 'number' && context.targetValue > 0) {
            lines.push(`Hedef: ${formatVehicleMetricValue(context.targetValue, context.metricKey)}`);
        }

        if (typeof context.totalContribution === 'number') {
            lines.push(`Toplam Katki: ${formatVehicleMetricValue(context.totalContribution, context.metricKey, { perVehicle: false })}`);
        }

        if (cost.description) {
            lines.push('', 'Maliyet Kaydi Aciklamasi:', cost.description);
        }

        return lines.join('\n');
    }, []);

    const buildNCRecordFromCost = useCallback((cost, ncType, context = null) => ({
        id: cost.id,
        source: 'cost',
        source_cost_id: cost.id,
        cost_type: cost.cost_type,
        cost_date: cost.cost_date,
        unit: cost.unit,
        amount: cost.amount,
        part_name: cost.part_name,
        part_code: cost.part_code,
        vehicle_type: cost.vehicle_type,
        description: buildAnalysisContextDescription(cost, context),
        quantity: cost.quantity,
        measurement_unit: cost.measurement_unit,
        scrap_weight: cost.scrap_weight,
        rework_duration: cost.rework_duration,
        quality_control_duration: cost.quality_control_duration,
        affected_units: cost.affected_units,
        responsible_personnel_id: cost.responsible_personnel_id,
        is_supplier_nc: cost.is_supplier_nc,
        supplier_id: cost.supplier_id,
        supplier_name: cost.supplier?.name,
        type: ncType,
    }), [buildAnalysisContextDescription]);

    const openNCFromCost = useCallback((cost, ncType, context = null) => {
        if (!cost || !onOpenNCForm) return;
        onOpenNCForm(buildNCRecordFromCost(cost, ncType, context));
    }, [buildNCRecordFromCost, onOpenNCForm]);

    const handleCreateNC = useCallback((cost, directType = null, context = null) => {
        if (!onOpenNCForm) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Uygunsuzluk formu açılamadı.',
            });
            return;
        }

        if (directType) {
            openNCFromCost(cost, directType, context);
            return;
        }

        setCostForNC(cost);
        setSelectedNCType('DF');
        setIsCreateNCModalOpen(true);
    }, [onOpenNCForm, openNCFromCost, toast]);

    const handleConfirmCreateNC = useCallback((ncType) => {
        if (!costForNC) return;
        openNCFromCost(costForNC, ncType);
        setIsCreateNCModalOpen(false);
        setCostForNC(null);
    }, [costForNC, openNCFromCost]);

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) {
            return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-1 h-3 w-3" />
            : <ArrowDown className="ml-1 h-3 w-3" />;
    };

    const handleDelete = async (costId) => {
        setDeleteConfirmId(null);
        const { error } = await supabase.from('quality_costs').delete().eq('id', costId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet kaydı silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Maliyet kaydı başarıyla silindi.' });
            await refreshQualityCosts?.();
            setDetailModalContent((prev) => ({
                ...prev,
                costs: (prev.costs || []).filter((x) => x?.id !== costId),
            }));
        }
    };

    const handleOpenDrillDownModal = useCallback((title, costs) => {
        setDetailModalContent({
            title,
            costs: costs || [],
            yearContext: null,
            vehicleContext: null,
            dateRange: null,
        });
        setDetailModalOpen(true);
    }, []);

    const handleHurdaReworkPivotDrill = useCallback(
        ({ title, costs }) => {
            if (!costs?.length) {
                toast({
                    variant: 'destructive',
                    title: 'Kayıt bulunamadı',
                    description: 'Bu kırılıma ait seçili döneme uyan kayıt yok veya kalemlerde eşleşme oluşmadı.',
                });
                return;
            }
            handleOpenDrillDownModal(title, costs);
        },
        [handleOpenDrillDownModal, toast],
    );

    const handleYearCOPQDrillDown = useCallback(
        (year) => {
            const rows = filterCostsByYear(filteredCosts, year);
            setDetailModalContent({
                title: `${year} COPQ – yıl içi tüm kayıtlar`,
                costs: rows,
                yearContext: year,
                vehicleContext: null,
                dateRange: null,
            });
            setDetailModalOpen(true);
        },
        [filteredCosts]
    );

    const handleVehicleCOPQDrillDown = useCallback(
        (vehicleType) => {
            const rows = filteredCosts.filter((c) => c.vehicle_type === vehicleType);
            setDetailModalContent({
                title: `${vehicleType} — Araç tipi performans ve COPQ`,
                costs: rows,
                yearContext: null,
                vehicleContext: vehicleType,
                dateRange,
            });
            setDetailModalOpen(true);
        },
        [filteredCosts, dateRange]
    );

    const unitFilterOptions = useMemo(
        () => collectUnitFilterOptions(qualityCosts, canonicalUnitCtx),
        [qualityCosts, canonicalUnitCtx]
    );

    const handleOpenReportModal = useCallback(() => {
        if (filteredCosts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturmak için en az bir maliyet kaydı olmalıdır.',
            });
            return;
        }
        // Rapor seçim modalını aç
        setIsReportSelectionModalOpen(true);
    }, [filteredCosts.length, toast]);

    const handleGenerateExecutiveReport = useCallback(() => {
        if (filteredCosts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturmak için en az bir maliyet kaydı olmalıdır.',
            });
            return;
        }
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            try {
                return format(new Date(dateString), 'dd.MM.yyyy', { locale: tr });
            } catch {
                return '-';
            }
        };

        // İç ve dış hata kategorileri
        // İÇ HATA: Fabrika içinde (tedarikçi dahil girdi kontrolünde) tespit edilen hatalar
        // Tedarikçi kaynaklı maliyetler de fabrika içinde tespit edildiği için İÇ HATA'dır
        const internalCostTypes = [
            'Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti',
            'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti',
            'İç Hata Maliyeti', 'İç Hata Maliyetleri', 'Hurda', 'Yeniden İşlem', 'İç Hata',
            'Tedarikçi Hata Maliyeti' // Girdi kontrolünde tespit edilen tedarikçi hataları
        ];
        // DIŞ HATA: SADECE müşteride tespit edilen hatalar
        // Ürün müşteriye ulaştıktan sonra ortaya çıkan maliyetler
        const externalCostTypes = [
            'Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti',
            'Dış Hata Maliyeti', 'Dış Hata Maliyetleri', 'Dış Hata',
            'Müşteri Şikayeti', 'Müşteri Reklaması'
        ];
        const appraisalCostTypes = ['Değerlendirme Maliyetleri', 'Kontrol', 'Test', 'Muayene'];
        const preventionCostTypes = ['Önleme Maliyetleri', 'Önleme', 'Eğitim', 'Kalite Planlama'];

        // Genel istatistikler
        const totalCost = filteredCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
        const totalCount = filteredCosts.length;

        // İç/Dış hata analizi
        let internalCost = 0;
        let externalCost = 0;
        let appraisalCost = 0;
        let preventionCost = 0;
        const internalCosts = [];
        const externalCosts = [];

        filteredCosts.forEach(cost => {
            const isSupplierCost = cost.is_supplier_nc && cost.supplier_id;
            const costType = cost.cost_type || '';

            // DIŞ HATA: Sadece müşteride tespit edilen hatalar
            if (externalCostTypes.some(type => costType.includes(type))) {
                externalCost += cost.amount || 0;
                externalCosts.push(cost);
            }
            // İÇ HATA: Fabrika içinde tespit edilen tüm hatalar (tedarikçi kaynaklı dahil)
            // Tedarikçi kaynaklı maliyetler de iç hata olarak sayılır çünkü girdi kontrolünde tespit edilir
            else if (internalCostTypes.some(type => costType.includes(type)) || isSupplierCost) {
                internalCost += cost.amount || 0;
                internalCosts.push(cost);
            } else if (appraisalCostTypes.some(type => costType.includes(type))) {
                appraisalCost += cost.amount || 0;
            } else if (preventionCostTypes.some(type => costType.includes(type))) {
                preventionCost += cost.amount || 0;
            } else {
                // Belirtilmemiş kategoriler iç hataya dahil edilir
                internalCost += cost.amount || 0;
                internalCosts.push(cost);
            }
        });

        // En çok hata türleri (Top 10)
        const costsByType = {};
        filteredCosts.forEach(cost => {
            const costType = cost.cost_type || 'Belirtilmemiş';
            if (!costsByType[costType]) {
                costsByType[costType] = { count: 0, totalAmount: 0 };
            }
            costsByType[costType].count += 1;
            costsByType[costType].totalAmount += cost.amount || 0;
        });
        const topCostTypes = Object.entries(costsByType)
            .map(([type, data]) => ({
                type,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

        // Tüm birimler/tedarikçiler - payı olan herkes (line items dahil)
        const costsByUnit = {};
        filteredCosts.forEach(cost => {
            const lineItems = cost.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
            const hasLineItems = lineItems.length > 0;

            if (hasLineItems) {
                lineItems.forEach(li => {
                    const itemAmt = parseFloat(li.amount) || 0;
                    if (itemAmt <= 0) return;
                    const unitKey = li.responsible_type === 'supplier'
                        ? `Tedarikçi: ${li.responsible_supplier_name || cost.supplier?.name || 'Belirtilmemiş'}`
                        : canonCaches.formatOrgUnitForAggregate(li.responsible_unit);
                    if (!costsByUnit[unitKey]) costsByUnit[unitKey] = { count: 0, totalAmount: 0, isSupplier: li.responsible_type === 'supplier' };
                    costsByUnit[unitKey].count += 1;
                    costsByUnit[unitKey].totalAmount += itemAmt;
                });
            } else if (cost.is_supplier_nc && cost.supplier?.name) {
                const unitKey = `Tedarikçi: ${cost.supplier.name}`;
                if (!costsByUnit[unitKey]) costsByUnit[unitKey] = { count: 0, totalAmount: 0, isSupplier: true };
                costsByUnit[unitKey].count += 1;
                costsByUnit[unitKey].totalAmount += cost.amount || 0;
            } else if (cost.cost_allocations?.length > 0) {
                cost.cost_allocations.forEach(a => {
                    const unitKey = canonCaches.formatOrgUnitForAggregate(a.unit);
                    if (!costsByUnit[unitKey]) costsByUnit[unitKey] = { count: 0, totalAmount: 0, isSupplier: false };
                    costsByUnit[unitKey].count += 1;
                    costsByUnit[unitKey].totalAmount += (a.amount ?? (cost.amount || 0) * (parseFloat(a.percentage) / 100)) || 0;
                });
            } else {
                const unitKey = canonCaches.formatOrgUnitForAggregate(cost.unit);
                if (!costsByUnit[unitKey]) costsByUnit[unitKey] = { count: 0, totalAmount: 0, isSupplier: false };
                costsByUnit[unitKey].count += 1;
                costsByUnit[unitKey].totalAmount += cost.amount || 0;
            }
        });
        const allUnitsSorted = Object.entries(costsByUnit)
            .map(([unit, data]) => ({
                unit,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0,
                isSupplier: data.isSupplier
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount);
        const topUnits = allUnitsSorted.slice(0, 10);

        // En çok maliyetli parçalar (Top 10)
        const costsByPart = {};
        filteredCosts.forEach(cost => {
            const partCode = cost.part_code || 'Belirtilmemiş';
            if (!costsByPart[partCode]) {
                costsByPart[partCode] = { count: 0, totalAmount: 0, partName: cost.part_name || '-' };
            }
            costsByPart[partCode].count += 1;
            costsByPart[partCode].totalAmount += cost.amount || 0;
        });
        const topParts = Object.entries(costsByPart)
            .map(([partCode, data]) => ({
                partCode,
                partName: data.partName,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

        // En çok maliyetli araç tipleri (Top 10)
        const costsByVehicleType = {};
        filteredCosts.forEach(cost => {
            const vehicleType = cost.vehicle_type || 'Belirtilmemiş';
            if (!costsByVehicleType[vehicleType]) {
                costsByVehicleType[vehicleType] = { count: 0, totalAmount: 0 };
            }
            costsByVehicleType[vehicleType].count += 1;
            costsByVehicleType[vehicleType].totalAmount += cost.amount || 0;
        });
        const topVehicleTypes = Object.entries(costsByVehicleType)
            .map(([vehicleType, data]) => ({
                vehicleType,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

        // Aylık trend analizi (Son 12 ay)
        const monthlyTrends = {};
        filteredCosts.forEach(cost => {
            const costDate = new Date(cost.cost_date);
            const monthKey = format(costDate, 'yyyy-MM', { locale: tr });
            if (!monthlyTrends[monthKey]) {
                monthlyTrends[monthKey] = { count: 0, totalAmount: 0 };
            }
            monthlyTrends[monthKey].count += 1;
            monthlyTrends[monthKey].totalAmount += cost.amount || 0;
        });
        const monthlyData = Object.entries(monthlyTrends)
            .map(([month, data]) => ({
                month: format(new Date(month + '-01'), 'MMMM yyyy', { locale: tr }),
                monthKey: month,
                count: data.count,
                totalAmount: data.totalAmount
            }))
            .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
            .slice(-12); // Son 12 ay

        // Tedarikçi bazlı analiz
        const costsBySupplier = {};
        filteredCosts.filter(c => c.is_supplier_nc && c.supplier?.name).forEach(cost => {
            const supplierName = cost.supplier.name;
            if (!costsBySupplier[supplierName]) {
                costsBySupplier[supplierName] = { count: 0, totalAmount: 0 };
            }
            costsBySupplier[supplierName].count += 1;
            costsBySupplier[supplierName].totalAmount += cost.amount || 0;
        });
        const topSuppliers = Object.entries(costsBySupplier)
            .map(([supplier, data]) => ({
                supplier,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

        const copqTotalForHurda = internalCost + externalCost + appraisalCost + preventionCost;
        const hurdaReworkReport = computeHurdaReworkDefectAnalysis(filteredCosts, {
            totalCopq: copqTotalForHurda,
            canonicalUnitCtx,
        });

        // Rapor verisi
        const reportData = {
            id: `quality-cost-executive-${Date.now()}`,
            period: dateRange.label || 'Tüm Zamanlar',
            periodStart: dateRange.startDate ? formatDate(dateRange.startDate) : null,
            periodEnd: dateRange.endDate ? formatDate(dateRange.endDate) : null,
            totalCost,
            totalCount,
            internalCost,
            externalCost,
            appraisalCost,
            preventionCost,
            internalPercentage: totalCost > 0 ? (internalCost / totalCost) * 100 : 0,
            externalPercentage: totalCost > 0 ? (externalCost / totalCost) * 100 : 0,
            appraisalPercentage: totalCost > 0 ? (appraisalCost / totalCost) * 100 : 0,
            preventionPercentage: totalCost > 0 ? (preventionCost / totalCost) * 100 : 0,
            topCostTypes,
            topUnits,
            allUnits: allUnitsSorted,
            topParts,
            topVehicleTypes,
            topSuppliers,
            monthlyData,
            reportDate: formatDate(new Date()),
            unit: unitFilter !== 'all' ? unitFilter : null,
            hurdaReworkReport,
        };

        openPrintableReport(reportData, 'quality_cost_executive_summary', true);

        toast({
            title: 'Başarılı',
            description: unitFilter !== 'all' 
                ? `${unitFilter} birimi için yönetici özeti raporu oluşturuldu.`
                : 'Yönetici özeti raporu oluşturuldu.',
        });
    }, [filteredCosts, dateRange, unitFilter, toast, canonCaches, canonicalUnitCtx]);

    const handleSelectReportType = useCallback((reportType) => {
        setIsReportSelectionModalOpen(false);
        if (reportType === 'unit') {
            // Birim bazlı rapor için UnitReportModal'ı aç
            setIsReportModalOpen(true);
        } else if (reportType === 'executive') {
            // Yönetici özeti raporu oluştur
            handleGenerateExecutiveReport();
        }
    }, [handleGenerateExecutiveReport]);

    const handleGenerateReport = useCallback((selectedUnits) => {
        if (!selectedUnits || selectedUnits.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen en az bir birim seçin.',
            });
            return;
        }

        const formatDate = (dateString) => {
            if (!dateString) return '-';
            try {
                return format(new Date(dateString), 'dd.MM.yyyy', { locale: tr });
            } catch {
                return '-';
            }
        };

        // Seçilen birim grubu için rapor oluştur (birleştirilmiş birim anahtarı + cost_allocations / satır kalemi)
        selectedUnits.forEach((filterKey, index) => {
            const unitLabel =
                unitFilterOptions.find((o) => o.key === filterKey)?.label ?? filterKey;
            const reportItems = [];
            let totalAmount = 0;

            filteredCosts.forEach(cost => {
                const lineItems = cost.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
                const hasLineItems = lineItems.length > 0;

                const costFkMatchesUnit = costMatchesUnitUsingIndex(costUnitFilterKeyIndex, cost, filterKey, canonCaches);

                if (!costFkMatchesUnit) return;

                if (hasLineItems) {
                    // Kalem varsa: her kalemi ayrı satır (birim/tedarikçi eşleşenleri)
                    lineItems.forEach(li => {
                        const lineRaw = li.responsible_type === 'supplier' ? 'Tedarikçi' : (li.responsible_unit || '');
                        if (!canonCaches.stringMatchesFilterKey(lineRaw, filterKey)) return;
                        const itemAmount = parseFloat(li.amount) || 0;
                        if (itemAmount <= 0) return;
                        totalAmount += itemAmount;
                        reportItems.push({
                            cost_date: formatDate(cost.cost_date),
                            cost_type: cost.cost_type || '-',
                            part_name: li.part_name || cost.part_name || '-',
                            part_code: li.part_code || cost.part_code || '-',
                            vehicle_type: cost.vehicle_type || '-',
                            amount: itemAmount,
                            quantity: li.quantity || cost.quantity || '-',
                            measurement_unit: li.measurement_unit || cost.measurement_unit || '-',
                            description: li.description || cost.description || '-',
                            unit: li.responsible_type === 'supplier' ? '' : (li.responsible_unit || '-'),
                            customer_name: cost.customer_name || '',
                            is_supplier_nc: li.responsible_type === 'supplier',
                            supplier_name: li.responsible_supplier_name || cost.supplier?.name || '-',
                            is_allocated: false,
                            cost_allocations: [],
                            total_amount: cost.amount,
                        });
                    });
                } else {
                    let itemAmount = 0;
                    if (canonCaches.stringMatchesFilterKey(cost.unit, filterKey)) {
                        itemAmount = cost.amount || 0;
                    } else if (cost.cost_allocations?.length) {
                        const alloc = cost.cost_allocations.find((a) =>
                            canonCaches.stringMatchesFilterKey(a.unit, filterKey)
                        );
                        if (alloc) itemAmount = alloc.amount ?? (cost.amount || 0) * (parseFloat(alloc.percentage) / 100);
                    }
                    if (itemAmount > 0) {
                        totalAmount += itemAmount;
                        reportItems.push({
                            cost_date: formatDate(cost.cost_date),
                            cost_type: cost.cost_type || '-',
                            part_name: cost.part_name || '-',
                            part_code: cost.part_code || '-',
                            vehicle_type: cost.vehicle_type || '-',
                            amount: itemAmount,
                            quantity: cost.quantity || '-',
                            measurement_unit: cost.measurement_unit || '-',
                            description: cost.description || '-',
                            unit: cost.unit || '-',
                            customer_name: cost.customer_name || '',
                            is_supplier_nc: cost.is_supplier_nc || false,
                            supplier_name: cost.supplier?.name || '-',
                            is_allocated: cost.cost_allocations?.length > 0,
                            cost_allocations: cost.cost_allocations || [],
                            total_amount: cost.amount,
                        });
                    }
                }
            });

            if (reportItems.length === 0) return;

            const hurdaReworkReport = computeHurdaReworkDefectAnalysis(filteredCosts, {
                totalCopq: totalAmount,
                canonicalUnitCtx,
                includeMonetaryRow: (row) =>
                    canonCaches.stringMatchesFilterKey(row.unit_label || '', filterKey),
            });

            const costsByType = {};
            reportItems.forEach(item => {
                const costType = item.cost_type || 'Belirtilmemiş';
                if (!costsByType[costType]) costsByType[costType] = { count: 0, totalAmount: 0 };
                costsByType[costType].count += 1;
                costsByType[costType].totalAmount += item.amount || 0;
            });

            const reportData = {
                id: `quality-cost-${filterKey}-${Date.now()}`,
                unit: unitLabel,
                period: dateRange.label || 'Tüm Zamanlar',
                periodStart: dateRange.startDate ? formatDate(dateRange.startDate) : null,
                periodEnd: dateRange.endDate ? formatDate(dateRange.endDate) : null,
                totalAmount: totalAmount,
                totalCount: reportItems.length,
                items: reportItems,
                costsByType: Object.entries(costsByType).map(([type, data]) => ({
                    type,
                    count: data.count,
                    totalAmount: data.totalAmount,
                    percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0
                })).sort((a, b) => b.totalAmount - a.totalAmount),
                hurdaReworkReport,
            };

            // Her birim için ayrı rapor aç (500ms arayla)
            setTimeout(() => {
                openPrintableReport(reportData, 'quality_cost_list', true);
            }, index * 500);
        });

        toast({
            title: 'Başarılı',
            description: `${selectedUnits.length} birim için rapor oluşturuldu.`,
        });
    }, [filteredCosts, dateRange, toast, unitFilterOptions, canonCaches, costUnitFilterKeyIndex, canonicalUnitCtx]);

    return (
        <div className="space-y-6" aria-busy={filtersStillComputing}>
            {filtersStillComputing && (
                <div
                    className="fixed top-0 left-0 right-0 z-[70] h-0.5 bg-primary animate-pulse pointer-events-none"
                    role="progressbar"
                    aria-label="Filtre hesaplanıyor"
                />
            )}
            <CostFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    if (!open) {
                        setCostPrefill(null);
                        setProcessInspectionCostFlow(null);
                        clearProcessInspectionFlow(PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY);
                    }
                    setFormModalOpen(open);
                }}
                refreshCosts={refreshQualityCosts}
                unitCostSettings={unitCostSettings}
                materialCostSettings={materialCostSettings}
                personnelList={personnel}
                existingCost={selectedCost}
                prefillData={costPrefill}
                onCostCreated={async (newCost) => {
                    setSelectedCost(newCost);
                    setSelectedLineItem(null);
                    setIsViewModalOpen(true);

                    if (processInspectionCostFlow?.inspectionId) {
                        const ok = await finalizeProcessInspectionResolution({
                            inspectionId: processInspectionCostFlow.inspectionId,
                            resolutionType: 'Hurda',
                            linkedRecordNo: newCost?.id ? String(newCost.id).slice(0, 8) : undefined,
                            linkedRecordLabel: 'Hurda Maliyet Kaydı',
                            notes: 'Hurda maliyet kaydı oluşturuldu ve bu ret kaydına bağlandı.',
                        });
                        if (ok) {
                            toast({
                                title: 'Proses muayene güncellendi',
                                description:
                                    'İlgili ret kaydı "Çözüldü" (Hurda) olarak işaretlendi.',
                            });
                        }
                        setProcessInspectionCostFlow(null);
                        setCostPrefill(null);
                        clearProcessInspectionFlow(PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY);
                    }
                }}
            />
            {selectedCost && (
                <CostViewModal
                    isOpen={isViewModalOpen}
                    setOpen={setIsViewModalOpen}
                    cost={selectedCost}
                    selectedLineItem={selectedLineItem}
                    onRefresh={refreshQualityCosts}
                />
            )}
            <CostDrillDownModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                data={{
                    title: detailModalContent.title,
                    costs: detailModalContent.costs,
                    yearContext: detailModalContent.yearContext,
                    vehicleContext: detailModalContent.vehicleContext,
                    dateRange: detailModalContent.dateRange,
                }}
                allCosts={filteredCosts}
                onVehicleTargetsApplied={handleVehicleTargetsApplied}
                onCreateNC={handleCreateNC}
                onOpenNCView={onOpenNCView}
                hasNCAccess={hasNCAccess}
                recordDrillActions={{
                    onView: handleDrillRecordView,
                    onEdit: handleDrillRecordEdit,
                    onRequestDelete: handleDrillRecordDeleteRequest,
                }}
            />
            <UnitReportModal
                isOpen={isReportModalOpen}
                setIsOpen={setIsReportModalOpen}
                unitOptions={unitFilterOptions}
                costs={filteredCosts}
                canonicalUnitCtx={canonicalUnitCtx}
                onGenerate={handleGenerateReport}
            />

            {/* Uygunsuzluk Oluşturma Modalı */}
            <Dialog open={isCreateNCModalOpen} onOpenChange={setIsCreateNCModalOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                    <DialogHeader>
                        <DialogTitle>Uygunsuzluk Kaydı Oluştur</DialogTitle>
                        <DialogDescription>
                            {costForNC && (
                                <>
                                    <b>{costForNC.cost_type}</b> maliyeti için uygunsuzluk türünü seçin.
                                    <br />
                                    <span className="text-xs text-muted-foreground mt-2 block">
                                        Seçiminize göre form, maliyet bilgileriyle önceden doldurulmuş olarak açılacaktır.
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="nc-type-select">Uygunsuzluk Türü</Label>
                            <Select value={selectedNCType} onValueChange={setSelectedNCType}>
                                <SelectTrigger id="nc-type-select">
                                    <SelectValue placeholder="Tür seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DF">DF (Düzeltici Faaliyet)</SelectItem>
                                    <SelectItem value="8D">8D Raporu</SelectItem>
                                    <SelectItem value="MDI">MDI (Mini Düzeltici İyileştirme)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsCreateNCModalOpen(false);
                            setCostForNC(null);
                            setSelectedNCType('DF');
                        }}>
                            İptal
                        </Button>
                        <Button onClick={() => {
                            if (costForNC) {
                                handleConfirmCreateNC(selectedNCType);
                            }
                        }}>
                            Devam Et
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rapor Seçim Modalı */}
            <Dialog open={isReportSelectionModalOpen} onOpenChange={setIsReportSelectionModalOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Rapor Türü Seçin
                        </DialogTitle>
                        <DialogDescription>
                            Oluşturmak istediğiniz rapor türünü seçin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <button
                            onClick={() => handleSelectReportType('unit')}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-1 text-foreground">Birim Bazlı Rapor</h3>
                                <p className="text-sm text-muted-foreground">
                                    Seçtiğiniz birimler için detaylı maliyet raporu oluşturun. Birden fazla birim seçebilirsiniz.
                                </p>
                            </div>
                        </button>
                        <button
                            onClick={() => handleSelectReportType('executive')}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-1 text-foreground">Yönetici Özeti Raporu</h3>
                                <p className="text-sm text-muted-foreground">
                                    İç/dış hata analizi, en çok hata türleri, en maliyetli birimler/parçalar ve trend analizi içeren kapsamlı özet rapor.
                                </p>
                            </div>
                        </button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReportSelectionModalOpen(false)}>
                            İptal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
                <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        İç/dış hata, önleme ve değerlendirme maliyetlerini analiz edin. Aşağıdaki süzgeçler tüm sekmelere uygulanır.
                    </p>
                </div>
                <div className="flex flex-col xl:flex-row xl:flex-wrap gap-2 xl:items-center">
                    <CostFilters dateRange={dateRange} setDateRange={setDateRange} />
                    <Select value={costCategoryFilter} onValueChange={setCostCategoryFilter}>
                        <SelectTrigger className="w-full min-[400px]:w-[160px]">
                            <SelectValue placeholder="Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kategoriler</SelectItem>
                            <SelectItem value="internal">İç Hata</SelectItem>
                            <SelectItem value="external">Dış Hata</SelectItem>
                            <SelectItem value="prevention">Önleme</SelectItem>
                            <SelectItem value="supplier">Tedarikçi Kaynaklı</SelectItem>
                            <SelectItem value="indirect">Dolaylı Maliyetler</SelectItem>
                            <SelectItem value="invoice">Faturalı Kayıtlar</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={unitFilter} onValueChange={setUnitFilter}>
                        <SelectTrigger className="w-full min-[400px]:w-[170px]">
                            <SelectValue placeholder="Birim (birleşik)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Birimler</SelectItem>
                            {unitFilterOptions.map(({ key, label }) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                        <SelectTrigger className="w-full min-[400px]:w-[160px]">
                            <SelectValue placeholder="Kaynak" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                            <SelectItem value="manual">Manuel</SelectItem>
                            <SelectItem value="produced_vehicle">Üretilen Araç</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="search-box flex-1 min-w-[160px] max-w-xl">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Tabloda ara: tür, parça, açıklama..."
                            className="search-input w-full text-sm h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <Button onClick={handleOpenReportModal} variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <FileText className="w-4 h-4 mr-1.5 sm:mr-2" />
                            <span className="hidden xs:inline">Rapor Al</span>
                            <span className="xs:hidden">Rapor</span>
                        </Button>
                        <Button onClick={() => handleOpenFormModal()} size="sm" className="flex-1 sm:flex-none">
                            <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
                            <span className="hidden xs:inline">Yeni Maliyet Kaydı</span>
                            <span className="xs:hidden">Ekle</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs value={qualityCostTab} onValueChange={setQualityCostTab} className="w-full">
                <TabsList className="inline-flex gap-1 p-1 h-auto">
                    <TabsTrigger value="overview" className="text-xs">Genel Bakış</TabsTrigger>
                    <TabsTrigger value="records" className="text-xs">Kayıtlar</TabsTrigger>
                    <TabsTrigger value="copq" className="text-xs">COPQ</TabsTrigger>
                    <TabsTrigger value="forecast" className="text-xs">AI Tahmin</TabsTrigger>
                    <TabsTrigger value="details" className="text-xs">Detaylı Analiz</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    {qualityCostTab === 'overview' && (
                    <CostAnalytics
                        costs={filteredCosts}
                        loading={loading}
                        onBarClick={handleOpenDrillDownModal}
                        copqYearTotals={copqYearTotals}
                        copqYearlyInsight={copqYearlyInsight}
                        onYearCOPQClick={handleYearCOPQDrillDown}
                        canonicalUnitCtx={canonicalUnitCtx}
                    />
                    )}
                </TabsContent>
                <TabsContent value="records" className="mt-6">
                    {qualityCostTab === 'records' && (
                    <div className="dashboard-widget">
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                                <span>Listede üstteki süzgeçlere uygun kayıtlar gösterilir.</span>
                                <span>
                                    {filteredCosts.length} kayıt
                                    {filteredCosts.length > 0 && (
                                        <>
                                            {' '}
                                            · Toplam: {formatCurrency(filteredCosts.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0))}
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="border rounded-lg overflow-auto max-h-[min(60vh,600px)]" style={{ minHeight: 320 }}>
                            <table className="data-table data-table-wide-actions min-w-full">
                                    <thead>
                                        <tr>
                                            <th className="w-10">#</th>
                                            <th className="cursor-pointer hover:bg-secondary/50 select-none min-w-[90px]" onClick={() => handleSort('cost_date')}>
                                                <div className="flex items-center">Tarih{getSortIcon('cost_date')}</div>
                                            </th>
                                            <th className="cursor-pointer hover:bg-secondary/50 select-none min-w-[140px]" onClick={() => handleSort('cost_type')}>
                                                <div className="flex items-center">Tür{getSortIcon('cost_type')}</div>
                                            </th>
                                            <th className="cursor-pointer hover:bg-secondary/50 select-none min-w-[100px]" onClick={() => handleSort('unit')}>
                                                <div className="flex items-center">Birim / Müşteri {getSortIcon('unit')}</div>
                                            </th>
                                            <th className="min-w-[80px]">Parça</th>
                                            <th className="cursor-pointer hover:bg-secondary/50 select-none min-w-[100px]" onClick={() => handleSort('amount')}>
                                                <div className="flex items-center">Tutar{getSortIcon('amount')}</div>
                                            </th>
                                            <th className="w-12 px-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                                        ) : filteredCosts.length === 0 ? (
                                            <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Filtrelere uygun kayıt bulunamadı.</td></tr>
                                        ) : (
                                            displayedCosts.map((row, index) => {
                                                const { cost, lineItem } = row;
                                                const lineItems = cost.cost_line_items;
                                                const partDisplay = lineItem
                                                    ? (lineItem.part_code || lineItem.part_name || '-')
                                                    : (cost.part_code || cost.part_name || '-');
                                                const ul = (raw) => {
                                                    if (raw == null || String(raw).trim() === '') return null;
                                                    return canonCaches.getLabel(String(raw).trim());
                                                };
                                                const allocationSummary = cost.cost_allocations?.length
                                                    ? `Dağıtılmış (${cost.cost_allocations.map((a) => `${canonCaches.formatOrgUnitForAggregate(a.unit)} %${parseFloat(a.percentage).toFixed(0)}`).join(', ')})`
                                                    : null;
                                                const unitDisplay = cost.cost_type === 'Dış Hata Maliyeti' && cost.customer_name
                                                    ? <span className="text-xs"><span className="text-blue-600 font-medium">Müşteri: {cost.customer_name}</span>{lineItem && (lineItem.responsible_type === 'supplier'
                                                        ? (lineItem.responsible_supplier_name || cost.supplier?.name)
                                                        : ul(lineItem.responsible_unit)) && <><br /><span className="text-amber-600 font-medium">{lineItem.responsible_type === 'supplier'
                                                            ? (lineItem.responsible_supplier_name || cost.supplier?.name)
                                                            : ul(lineItem.responsible_unit)}</span></>}</span>
                                                    : lineItem?.responsible_type === 'supplier'
                                                        ? <span className="text-amber-600 font-medium" title="Tedarikçi">{(lineItem.responsible_supplier_name || cost.supplier?.name) || '-'}</span>
                                                        : lineItem?.responsible_unit
                                                            ? <span className="text-sm">{ul(lineItem.responsible_unit) || '-'}</span>
                                                            : cost.is_supplier_nc && cost.supplier?.name
                                                                ? cost.supplier.name
                                                                : (allocationSummary || ul(cost.unit) || '-');
                                                const baseAmount = lineItem
                                                    ? (parseFloat(lineItem.amount) || 0)
                                                    : (parseFloat(cost.amount) || 0);
                                                const sharedTotal = getSharedCostsTotal(cost);
                                                const lineItemsTotal = getCostLineItemsTotal(cost);
                                                const allocatedShared = lineItem
                                                    ? getAllocatedSharedForLine(cost, lineItem, lineItems)
                                                    : sharedTotal;
                                                const amountDisplay = baseAmount + allocatedShared;
                                                const sharedPctOfPool =
                                                    sharedTotal > 0 && lineItemsTotal > 0 && lineItem
                                                        ? ((parseFloat(lineItem.amount) || 0) / lineItemsTotal) * 100
                                                        : sharedTotal > 0 && !lineItem
                                                            ? 100
                                                            : 0;
                                                return (
                                                <tr
                                                    key={`${cost.id}-${row.lineIndex}`}
                                                    className="group cursor-pointer hover:bg-accent/50 transition-colors"
                                                    onClick={(e) => {
                                                        if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) return;
                                                        handleOpenViewModal(cost, lineItem);
                                                    }}
                                                >
                                                    <td className="text-muted-foreground text-sm">{index + 1}</td>
                                                    <td className="text-sm">
                                                        {new Date(cost.cost_date).toLocaleDateString('tr-TR')}
                                                        {cost.source_type === 'produced_vehicle_final_faults' && <Badge variant="outline" className="ml-1 text-[10px]">Final</Badge>}
                                                        {cost.source_type === 'produced_vehicle_manual' && <Badge variant="outline" className="ml-1 text-[10px]">Manuel</Badge>}
                                                    </td>
                                                    <td className="text-sm">{cost.cost_type}</td>
                                                    <td className="text-sm">{unitDisplay}</td>
                                                    <td className="text-sm truncate max-w-[120px]" title={typeof partDisplay === 'string' ? partDisplay : undefined}>
                                                        {partDisplay}
                                                    </td>
                                                    <td className="text-sm font-semibold align-top">
                                                        <div>{formatCurrency(amountDisplay)}</div>
                                                        {allocatedShared > 0 && (
                                                            <div className="text-[10px] font-normal text-muted-foreground mt-0.5 leading-tight">
                                                                Kalem {formatCurrency(baseAmount)}
                                                                {' · '}
                                                                ortak pay {formatCurrency(allocatedShared)}
                                                                {sharedPctOfPool > 0 && lineItem && (
                                                                    <span> ({sharedPctOfPool.toFixed(1)}% kalem payı)</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleOpenViewModal(cost, lineItem)}><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleOpenFormModal(cost)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <DropdownMenuItem onClick={() => handleCreateNC(cost)} disabled={!hasNCAccess}><LinkIcon className="mr-2 h-4 w-4" />Uygunsuzluk</DropdownMenuItem>
                                                                        </TooltipTrigger>
                                                                        {!hasNCAccess && <TooltipContent><p>Yetkiniz yok.</p></TooltipContent>}
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setDeleteConfirmId(cost.id); }}><Trash2 className="mr-2 h-4 w-4" />Sil</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                            })
                                        )}
                                    </tbody>
                                </table>
                        </div>
                        {filteredCosts.length > 0 && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm">
                                <span className="text-muted-foreground">{displayedCosts.length} / {expandedLineCountTotal} kayıt</span>
                                {hasMoreCosts && (
                                    <Button variant="outline" size="sm" onClick={handleLoadMore}>+100 Yükle</Button>
                                )}
                            </div>
                        )}
                    </div>
                    )}
                </TabsContent>
                <TabsContent value="forecast" className="mt-6">
                    {qualityCostTab === 'forecast' && (
                    <CostForecaster costs={filteredCosts} copqYearTotals={copqYearTotals} />
                    )}
                </TabsContent>
                <TabsContent value="copq" className="mt-6 space-y-6">
                    {qualityCostTab === 'copq' && (
                    <>
                    <COPQCalculator
                        costs={filteredCosts}
                        producedVehicles={producedVehicles}
                        loading={loading}
                        dateRange={dateRange}
                        canonicalUnitCtx={canonicalUnitCtx}
                        onHurdaReworkPivotDrill={handleHurdaReworkPivotDrill}
                    />
                    <CostTrendAnalysis costs={filteredCosts} />
                    <PartCostLeaders
                        costs={filteredCosts}
                        onPartClick={(part) => handleOpenDrillDownModal(`Parça: ${part.partCode}`, part.costs)}
                    />
                    <UnitCostDistribution costs={filteredCosts} canonicalUnitCtx={canonicalUnitCtx} />
                    <CostAnomalyDetector
                        costs={filteredCosts}
                        canonicalUnitCtx={canonicalUnitCtx}
                        onAnomalyClick={(anomaly) => {
                            const relatedCosts = filteredCosts.filter((c) => {
                                if (anomaly.type === 'unit') {
                                    const raw = (c.unit || '').trim();
                                    const label = raw ? canonCaches.getLabel(raw) : 'Bilinmeyen';
                                    return label === anomaly.unit;
                                }
                                return true;
                            });
                            handleOpenDrillDownModal(anomaly.title, relatedCosts);
                        }}
                    />
                    </>
                    )}
                </TabsContent>
                <TabsContent value="details" className="mt-6">
                    {qualityCostTab === 'details' && (
                    <VehicleCostBreakdown
                        key={vehicleTargetsRefreshKey}
                        costs={filteredCosts}
                        loading={loading}
                        dateRange={dateRange}
                        onCreateNC={handleCreateNC}
                        onOpenNCView={onOpenNCView}
                        hasNCAccess={hasNCAccess}
                        onVehicleCOPQClick={handleVehicleCOPQDrillDown}
                    />
                    )}
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı silmek istediğinize emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default QualityCostModule;
