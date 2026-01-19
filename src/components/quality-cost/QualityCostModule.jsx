import React, { useState, useMemo, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, BarChart3 } from 'lucide-react';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const QualityCostModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const { profile } = useAuth();
    const { qualityCosts, personnel, unitCostSettings, materialCostSettings, producedVehicles, loading, refreshData } = useData();

    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState(null);
    const [dateRange, setDateRange] = useState({ key: 'all', startDate: null, endDate: null, label: 'Tüm Zamanlar' });
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalContent, setDetailModalContent] = useState({ title: '', costs: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'produced_vehicle', 'manual', vb.
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportSelectionModalOpen, setIsReportSelectionModalOpen] = useState(false);
    const [isCreateNCModalOpen, setIsCreateNCModalOpen] = useState(false);
    const [costForNC, setCostForNC] = useState(null);
    const [selectedNCType, setSelectedNCType] = useState('DF');
    const [sortConfig, setSortConfig] = useState({ key: 'cost_date', direction: 'desc' });

    const hasNCAccess = useMemo(() => {
        return profile?.role === 'admin';
    }, [profile]);

    const filteredCosts = useMemo(() => {
        let costs = [...qualityCosts];

        if (dateRange.startDate && dateRange.endDate) {
            costs = costs.filter(cost => {
                const costDate = new Date(cost.cost_date);
                return costDate >= new Date(dateRange.startDate) && costDate <= new Date(dateRange.endDate);
            });
        }

        if (unitFilter !== 'all') {
            costs = costs.filter(cost => cost.unit === unitFilter);
        }

        if (sourceFilter !== 'all') {
            if (sourceFilter === 'produced_vehicle') {
                // produced_vehicle, produced_vehicle_final_faults ve produced_vehicle_manual'u birlikte göster
                costs = costs.filter(cost =>
                    cost.source_type === 'produced_vehicle' ||
                    cost.source_type === 'produced_vehicle_final_faults' ||
                    cost.source_type === 'produced_vehicle_manual'
                );
            } else {
                costs = costs.filter(cost => cost.source_type === sourceFilter);
            }
        }

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            costs = costs.filter(cost => {
                return Object.values(cost).some(value =>
                    String(value).toLowerCase().includes(lowercasedFilter)
                );
            });
        }

        // Sıralama
        costs.sort((a, b) => {
            let aVal, bVal;

            switch (sortConfig.key) {
                case 'cost_date':
                    aVal = new Date(a.cost_date);
                    bVal = new Date(b.cost_date);
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
                    aVal = a[sortConfig.key];
                    bVal = b[sortConfig.key];
            }

            if (aVal === bVal) return 0;

            const comparison = aVal < bVal ? -1 : 1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return costs;
    }, [qualityCosts, dateRange, unitFilter, sourceFilter, searchTerm, sortConfig]);

    const handleOpenFormModal = (cost = null) => {
        setSelectedCost(cost);
        setFormModalOpen(true);
    };

    const handleOpenViewModal = (cost) => {
        setSelectedCost(cost);
        setIsViewModalOpen(true);
    };

    const handleCreateNC = (cost) => {
        if (!onOpenNCForm) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Uygunsuzluk formu açılamadı.',
            });
            return;
        }
        setCostForNC(cost);
        setSelectedNCType('DF'); // Varsayılan olarak DF seçili
        setIsCreateNCModalOpen(true);
    };

    const handleConfirmCreateNC = (ncType) => {
        if (!costForNC || !onOpenNCForm) return;

        const recordForNC = {
            id: costForNC.id, // NCFormContext için gerekli
            source: 'cost', // NCFormContext'te source === 'cost' kontrolü var
            source_cost_id: costForNC.id,
            cost_type: costForNC.cost_type,
            cost_date: costForNC.cost_date,
            unit: costForNC.unit,
            amount: costForNC.amount,
            part_name: costForNC.part_name,
            part_code: costForNC.part_code,
            vehicle_type: costForNC.vehicle_type,
            description: costForNC.description,
            quantity: costForNC.quantity,
            measurement_unit: costForNC.measurement_unit,
            scrap_weight: costForNC.scrap_weight,
            rework_duration: costForNC.rework_duration,
            quality_control_duration: costForNC.quality_control_duration,
            affected_units: costForNC.affected_units,
            responsible_personnel_id: costForNC.responsible_personnel_id,
            is_supplier_nc: costForNC.is_supplier_nc,
            supplier_id: costForNC.supplier_id,
            supplier_name: costForNC.supplier?.name,
            type: ncType, // DF, 8D veya MDI
        };

        onOpenNCForm(recordForNC);
        setIsCreateNCModalOpen(false);
        setCostForNC(null);
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
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
        const { error } = await supabase.from('quality_costs').delete().eq('id', costId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet kaydı silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Maliyet kaydı başarıyla silindi.' });
        }
    };

    const handleOpenDrillDownModal = useCallback((title, costs) => {
        setDetailModalContent({ title, costs });
        setDetailModalOpen(true);
    }, []);

    // handleCreateNC kaldırıldı - kalitesizlik maliyeti uygunsuzluktan bağımsızdır

    const uniqueUnits = useMemo(() => {
        return [...new Set(qualityCosts.map(cost => cost.unit).filter(Boolean))];
    }, [qualityCosts]);

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
            'İç Hata Maliyetleri', 'Hurda', 'Yeniden İşlem', 'İç Hata',
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

        // En çok maliyetli birimler/tedarikçiler (Top 10)
        const costsByUnit = {};
        filteredCosts.forEach(cost => {
            let unitKey;
            if (cost.is_supplier_nc && cost.supplier?.name) {
                unitKey = `Tedarikçi: ${cost.supplier.name}`;
            } else {
                unitKey = cost.unit || 'Belirtilmemiş';
            }
            if (!costsByUnit[unitKey]) {
                costsByUnit[unitKey] = { count: 0, totalAmount: 0, isSupplier: cost.is_supplier_nc || false };
            }
            costsByUnit[unitKey].count += 1;
            costsByUnit[unitKey].totalAmount += cost.amount || 0;
        });
        const topUnits = Object.entries(costsByUnit)
            .map(([unit, data]) => ({
                unit,
                count: data.count,
                totalAmount: data.totalAmount,
                percentage: totalCost > 0 ? (data.totalAmount / totalCost) * 100 : 0,
                isSupplier: data.isSupplier
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

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
            topParts,
            topVehicleTypes,
            topSuppliers,
            monthlyData,
            reportDate: formatDate(new Date())
        };

        openPrintableReport(reportData, 'quality_cost_executive_summary', true);

        toast({
            title: 'Başarılı',
            description: 'Yönetici özeti raporu oluşturuldu.',
        });
    }, [filteredCosts, dateRange, toast]);

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

        // Seçilen birimler için rapor oluştur
        selectedUnits.forEach((unit, index) => {
            const unitCosts = filteredCosts.filter(cost => cost.unit === unit);

            if (unitCosts.length === 0) {
                return;
            }

            const totalAmount = unitCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);

            // Maliyet türü bazlı gruplama
            const costsByType = {};
            unitCosts.forEach(cost => {
                const costType = cost.cost_type || 'Belirtilmemiş';
                if (!costsByType[costType]) {
                    costsByType[costType] = {
                        count: 0,
                        totalAmount: 0,
                        costs: []
                    };
                }
                costsByType[costType].count += 1;
                costsByType[costType].totalAmount += cost.amount || 0;
                costsByType[costType].costs.push(cost);
            });

            const reportData = {
                id: `quality-cost-${unit}-${Date.now()}`,
                unit: unit,
                period: dateRange.label || 'Tüm Zamanlar',
                periodStart: dateRange.startDate ? formatDate(dateRange.startDate) : null,
                periodEnd: dateRange.endDate ? formatDate(dateRange.endDate) : null,
                totalAmount: totalAmount,
                totalCount: unitCosts.length,
                items: unitCosts.map(cost => ({
                    cost_date: formatDate(cost.cost_date),
                    cost_type: cost.cost_type || '-',
                    part_name: cost.part_name || '-',
                    part_code: cost.part_code || '-',
                    vehicle_type: cost.vehicle_type || '-',
                    amount: cost.amount || 0,
                    quantity: cost.quantity || '-',
                    measurement_unit: cost.measurement_unit || '-',
                    description: cost.description || '-',
                    responsible_personnel: cost.responsible_personnel?.full_name || '-',
                    is_supplier_nc: cost.is_supplier_nc || false,
                    supplier_name: cost.supplier?.name || '-',
                })),
                costsByType: Object.entries(costsByType).map(([type, data]) => ({
                    type,
                    count: data.count,
                    totalAmount: data.totalAmount,
                    percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0
                })).sort((a, b) => b.totalAmount - a.totalAmount)
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
    }, [filteredCosts, dateRange, toast]);

    return (
        <div className="space-y-6">
            <CostFormModal
                open={isFormModalOpen}
                setOpen={setFormModalOpen}
                refreshCosts={refreshData}
                unitCostSettings={unitCostSettings}
                materialCostSettings={materialCostSettings}
                personnelList={personnel}
                existingCost={selectedCost}
            />
            {selectedCost && (
                <CostViewModal
                    isOpen={isViewModalOpen}
                    setOpen={setIsViewModalOpen}
                    cost={selectedCost}
                />
            )}
            <CostDrillDownModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                data={{
                    title: detailModalContent.title,
                    costs: detailModalContent.costs
                }}
                allCosts={qualityCosts}
            />
            <UnitReportModal
                isOpen={isReportModalOpen}
                setIsOpen={setIsReportModalOpen}
                units={uniqueUnits}
                costs={filteredCosts}
                onGenerate={handleGenerateReport}
            />

            {/* Uygunsuzluk Oluşturma Modalı */}
            <Dialog open={isCreateNCModalOpen} onOpenChange={setIsCreateNCModalOpen}>
                <DialogContent>
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
                <DialogContent className="sm:max-w-md">
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

            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Kalitesizlik Maliyeti Takibi</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Maliyetlerinizi analiz edin ve trendleri takip edin.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <CostFilters dateRange={dateRange} setDateRange={setDateRange} />
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

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Genel Bakış</span>
                        <span className="sm:hidden">Bakış</span>
                    </TabsTrigger>
                    <TabsTrigger value="copq" className="text-xs sm:text-sm">COPQ</TabsTrigger>
                    <TabsTrigger value="forecast" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">AI Tahminleme</span>
                        <span className="sm:hidden">AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="details" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Detaylı Analiz</span>
                        <span className="sm:hidden">Detay</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <div className="space-y-6">
                        <CostAnalytics costs={filteredCosts} loading={loading} onBarClick={handleOpenDrillDownModal} />
                        <div className="dashboard-widget">
                            <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
                                <h2 className="widget-title text-sm sm:text-base">Son Maliyet Kayıtları</h2>
                                <div className="flex flex-col xs:flex-row gap-2">
                                    <div className="search-box flex-1 xs:flex-none xs:w-[150px] sm:w-[200px]">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                        <input
                                            type="text"
                                            placeholder="Ara..."
                                            className="search-input w-full"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select value={unitFilter} onValueChange={setUnitFilter}>
                                        <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
                                            <SelectValue placeholder="Birim" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Birimler</SelectItem>
                                            {uniqueUnits.map(unit => (
                                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <ScrollArea className="h-[400px]">
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>S.No</th>
                                                <th
                                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                                    onClick={() => handleSort('cost_date')}
                                                >
                                                    <div className="flex items-center">
                                                        Tarih
                                                        {getSortIcon('cost_date')}
                                                    </div>
                                                </th>
                                                <th
                                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                                    onClick={() => handleSort('cost_type')}
                                                >
                                                    <div className="flex items-center">
                                                        Maliyet Türü
                                                        {getSortIcon('cost_type')}
                                                    </div>
                                                </th>
                                                <th
                                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                                    onClick={() => handleSort('unit')}
                                                >
                                                    <div className="flex items-center">
                                                        Birim
                                                        {getSortIcon('unit')}
                                                    </div>
                                                </th>
                                                <th
                                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                                    onClick={() => handleSort('amount')}
                                                >
                                                    <div className="flex items-center">
                                                        Tutar
                                                        {getSortIcon('amount')}
                                                    </div>
                                                </th>
                                                <th className="px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="6" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                                            ) : filteredCosts.length === 0 ? (
                                                <tr><td colSpan="6" className="text-center p-8 text-muted-foreground">Seçili dönem için maliyet kaydı bulunamadı.</td></tr>
                                            ) : (
                                                filteredCosts.map((cost, index) => (
                                                    <tr
                                                        key={cost.id}
                                                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                                                        onClick={(e) => {
                                                            // Dropdown menüye tıklanırsa modal açılmasın
                                                            if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) {
                                                                return;
                                                            }
                                                            handleOpenViewModal(cost);
                                                        }}
                                                        title="Detayları görüntülemek için tıklayın"
                                                    >
                                                        <td>{index + 1}</td>
                                                        <td className="text-foreground">
                                                            {new Date(cost.cost_date).toLocaleDateString('tr-TR')}
                                                            {cost.source_type === 'produced_vehicle' && (
                                                                <Badge variant="secondary" className="ml-2 text-xs">Araç</Badge>
                                                            )}
                                                            {cost.source_type === 'produced_vehicle_final_faults' && (
                                                                <Badge variant="outline" className="ml-2 text-xs bg-orange-50 text-orange-700 border-orange-200">Final</Badge>
                                                            )}
                                                            {cost.source_type === 'produced_vehicle_manual' && (
                                                                <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">Manuel</Badge>
                                                            )}
                                                        </td>
                                                        <td className="text-foreground">{cost.cost_type}</td>
                                                        <td className="text-foreground">
                                                            {cost.is_supplier_nc && cost.supplier?.name ? cost.supplier.name : cost.unit}
                                                        </td>
                                                        <td className="font-semibold text-foreground">{formatCurrency(cost.amount)}</td>
                                                        <td onClick={(e) => e.stopPropagation()}>
                                                            <AlertDialog>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                                            <span className="sr-only">Menüyü aç</span>
                                                                            <MoreHorizontal className="h-4 w-4 flex-shrink-0 text-foreground" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => handleOpenViewModal(cost)}>
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            <span>Görüntüle</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleOpenFormModal(cost)}>
                                                                            <Edit className="mr-2 h-4 w-4" />
                                                                            <span>Düzenle</span>
                                                                        </DropdownMenuItem>
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <DropdownMenuItem
                                                                                        onClick={() => handleCreateNC(cost)}
                                                                                        disabled={!hasNCAccess}
                                                                                    >
                                                                                        <LinkIcon className="mr-2 h-4 w-4" />
                                                                                        <span>Uygunsuzluk Oluştur</span>
                                                                                    </DropdownMenuItem>
                                                                                </TooltipTrigger>
                                                                                {!hasNCAccess && <TooltipContent><p>Yetkiniz yok.</p></TooltipContent>}
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                        <DropdownMenuSeparator />
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Kaydı Sil
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Bu işlem geri alınamaz. Bu maliyet kaydını kalıcı olarak silecektir.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete(cost.id)}>Sil</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="forecast" className="mt-6">
                    <CostForecaster costs={filteredCosts} />
                </TabsContent>
                <TabsContent value="copq" className="mt-6 space-y-6">
                    <COPQCalculator
                        costs={filteredCosts}
                        producedVehicles={producedVehicles}
                        loading={loading}
                        dateRange={dateRange}
                    />
                    <CostTrendAnalysis costs={filteredCosts} />
                    <PartCostLeaders
                        costs={filteredCosts}
                        onPartClick={(part) => handleOpenDrillDownModal(`Parça: ${part.partCode}`, part.costs)}
                    />
                    <UnitCostDistribution costs={filteredCosts} />
                    <CostAnomalyDetector
                        costs={filteredCosts}
                        onAnomalyClick={(anomaly) => {
                            const relatedCosts = filteredCosts.filter(c => {
                                if (anomaly.type === 'unit') {
                                    return c.unit === anomaly.unit;
                                }
                                return true;
                            });
                            handleOpenDrillDownModal(anomaly.title, relatedCosts);
                        }}
                    />
                </TabsContent>
                <TabsContent value="details" className="mt-6">
                    <VehicleCostBreakdown costs={filteredCosts} loading={loading} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default QualityCostModule;