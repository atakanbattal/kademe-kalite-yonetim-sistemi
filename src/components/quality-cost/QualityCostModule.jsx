import React, { useState, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, MoreHorizontal, Edit, Trash2, Eye, Link as LinkIcon, Search } from 'lucide-react';
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
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
    import { useData } from '@/contexts/DataContext';
    import { Input } from '@/components/ui/input';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return '-';
        return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    const QualityCostModule = ({ onOpenNCForm }) => {
        const { toast } = useToast();
        const { profile } = useAuth();
        const { qualityCosts, personnel, unitCostSettings, materialCostSettings, loading, refreshData, loadModuleData } = useData();
        
        // Modül verilerini lazy load et
        React.useEffect(() => {
            if (qualityCosts.length === 0) {
                loadModuleData('quality-cost');
            }
        }, [qualityCosts.length, loadModuleData]);

        const [isFormModalOpen, setFormModalOpen] = useState(false);
        const [isViewModalOpen, setIsViewModalOpen] = useState(false);
        const [selectedCost, setSelectedCost] = useState(null);
        const [dateRange, setDateRange] = useState({ key: 'all', startDate: null, endDate: null, label: 'Tüm Zamanlar' });
        const [isDetailModalOpen, setDetailModalOpen] = useState(false);
        const [detailModalContent, setDetailModalContent] = useState({ title: '', costs: [] });
        const [searchTerm, setSearchTerm] = useState('');
        const [unitFilter, setUnitFilter] = useState('all');

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
        
        const handleCreateNC = (cost) => {
            const ncRecord = {
                ...cost,
                source: 'cost' // Add a source identifier
            };
            onOpenNCForm('DF', ncRecord);
        };

        const uniqueUnits = useMemo(() => {
            return [...new Set(qualityCosts.map(cost => cost.unit).filter(Boolean))];
        }, [qualityCosts]);

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

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Kalitesizlik Maliyeti Takibi</h1>
                        <p className="text-muted-foreground">Maliyetlerinizi analiz edin ve trendleri takip edin.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-2">
                        <CostFilters dateRange={dateRange} setDateRange={setDateRange} />
                        <Button onClick={() => handleOpenFormModal()}><Plus className="w-4 h-4 mr-2" />Yeni Maliyet Kaydı</Button>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                        <TabsTrigger value="details">Detaylı Analiz</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                        <div className="space-y-6">
                            <CostAnalytics costs={filteredCosts} loading={loading} onBarClick={handleOpenDetailModal} />
                            <div className="dashboard-widget">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="widget-title">Son Maliyet Kayıtları</h2>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="search"
                                                placeholder="Ara..."
                                                className="pl-8 sm:w-[200px] md:w-[300px]"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <Select value={unitFilter} onValueChange={setUnitFilter}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Birime Göre Filtrele" />
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
                                                    <th>İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr><td colSpan="6" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                                                ) : filteredCosts.length === 0 ? (
                                                    <tr><td colSpan="6" className="text-center p-8 text-muted-foreground">Seçili dönem için maliyet kaydı bulunamadı.</td></tr>
                                                ) : (
                                                    filteredCosts.map((cost, index) => (
                                                        <tr key={cost.id}>
                                                            <td>{index + 1}</td>
                                                            <td className="text-foreground">{new Date(cost.cost_date).toLocaleDateString('tr-TR')}</td>
                                                            <td className="text-foreground">{cost.cost_type}</td>
                                                            <td className="text-foreground">
                                                                {cost.is_supplier_nc && cost.supplier?.name ? cost.supplier.name : cost.unit}
                                                            </td>
                                                            <td className="font-semibold text-foreground">{formatCurrency(cost.amount)}</td>
                                                            <td>
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
                                                                                            onClick={() => handleCreateNC(cost)}
                                                                                            disabled={!hasNCAccess}
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
                    <TabsContent value="details" className="mt-6">
                        <VehicleCostBreakdown costs={filteredCosts} loading={loading} />
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    export default QualityCostModule;