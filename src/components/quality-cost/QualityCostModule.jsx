import React, { useState, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, MoreHorizontal, Edit, Trash2, Eye, Link as LinkIcon, Search, FileText } from 'lucide-react';
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
    import { CostDetailModal } from '@/components/quality-cost/CostDetailModal';
    import { CostViewModal } from '@/components/quality-cost/CostViewModal';
    import COPQCalculator from '@/components/quality-cost/COPQCalculator';
    import PartCostLeaders from '@/components/quality-cost/PartCostLeaders';
    import CostAnomalyDetector from '@/components/quality-cost/CostAnomalyDetector';
    import CostTrendAnalysis from '@/components/quality-cost/CostTrendAnalysis';
import UnitCostDistribution from '@/components/quality-cost/UnitCostDistribution';
import UnitReportModal from '@/components/quality-cost/UnitReportModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { openPrintableReport } from '@/lib/reportUtils';

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return '-';
        return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    const QualityCostModule = () => {
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

        const hasNCAccess = useMemo(() => {
            return profile?.role === 'admin';
        }, [profile]);
        
        const filteredCosts = useMemo(() => {
            let costs = qualityCosts.sort((a,b) => new Date(b.cost_date) - new Date(a.cost_date));
            
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
                    // produced_vehicle ve produced_vehicle_final_faults'u birlikte göster
                    costs = costs.filter(cost => 
                        cost.source_type === 'produced_vehicle' || 
                        cost.source_type === 'produced_vehicle_final_faults'
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

            return costs;
        }, [qualityCosts, dateRange, unitFilter, searchTerm]);

        const handleOpenFormModal = (cost = null) => {
            setSelectedCost(cost);
            setFormModalOpen(true);
        };
        
        const handleOpenViewModal = (cost) => {
            setSelectedCost(cost);
            setIsViewModalOpen(true);
        };

        const handleDelete = async (costId) => {
            const { error } = await supabase.from('quality_costs').delete().eq('id', costId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet kaydı silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Maliyet kaydı başarıyla silindi.' });
            }
        };

        const handleOpenDetailModal = useCallback((title, costs) => {
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
            setIsReportModalOpen(true);
        }, [filteredCosts.length, toast]);

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
                <CostDetailModal 
                    isOpen={isDetailModalOpen}
                    setOpen={setDetailModalOpen}
                    title={detailModalContent.title}
                    costs={detailModalContent.costs}
                />
                <UnitReportModal
                    isOpen={isReportModalOpen}
                    setIsOpen={setIsReportModalOpen}
                    units={uniqueUnits}
                    costs={filteredCosts}
                    onGenerate={handleGenerateReport}
                />

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
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Genel Bakış</span>
                            <span className="sm:hidden">Bakış</span>
                        </TabsTrigger>
                        <TabsTrigger value="copq" className="text-xs sm:text-sm">COPQ</TabsTrigger>
                        <TabsTrigger value="details" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Detaylı Analiz</span>
                            <span className="sm:hidden">Detay</span>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                        <div className="space-y-6">
                            <CostAnalytics costs={filteredCosts} loading={loading} onBarClick={handleOpenDetailModal} />
                            <div className="dashboard-widget">
                                <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
                                    <h2 className="widget-title text-sm sm:text-base">Son Maliyet Kayıtları</h2>
                                    <div className="flex flex-col xs:flex-row gap-2">
                                        <div className="relative flex-1 xs:flex-none">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="search"
                                                placeholder="Ara..."
                                                className="pl-8 w-full xs:w-[150px] sm:w-[200px]"
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
                                                    <th>Tarih</th>
                                                    <th>Maliyet Türü</th>
                                                    <th>Birim</th>
                                                    <th>Tutar</th>
                                                    <th className="sticky right-0 bg-card px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
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
                                                            </td>
                                                            <td className="text-foreground">{cost.cost_type}</td>
                                                            <td className="text-foreground">
                                                                {cost.is_supplier_nc && cost.supplier?.name ? cost.supplier.name : cost.unit}
                                                            </td>
                                                            <td className="font-semibold text-foreground">{formatCurrency(cost.amount)}</td>
                                                            <td className="sticky right-0 bg-card border-l border-border z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]" onClick={(e) => e.stopPropagation()}>
                                                                <AlertDialog>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                                <span className="sr-only">Menüyü aç</span>
                                                                                <MoreHorizontal className="h-4 w-4 text-foreground" />
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
                                                                                            onClick={() => {
                                                                                                toast({ 
                                                                                                    title: 'Bilgi', 
                                                                                                    description: 'Kalitesizlik maliyeti uygunsuzluktan bağımsızdır. İsterseniz manuel olarak uygunsuzluk oluşturabilirsiniz.' 
                                                                                                });
                                                                                            }}
                                                                                            onSelect={(e) => e.preventDefault()}
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
                                                                                    <Trash2 className="mr-2 h-4 w-4"/>
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
                            onPartClick={(part) => handleOpenDetailModal(`Parça: ${part.partCode}`, part.costs)}
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
                                handleOpenDetailModal(anomaly.title, relatedCosts);
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