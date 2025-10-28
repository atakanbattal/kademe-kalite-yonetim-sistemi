import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, Edit, GitBranch, Trash2, Eye, ExternalLink } from 'lucide-react';
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

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const QualityCostModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const [allCosts, setAllCosts] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState(null);
    const [unitCostSettings, setUnitCostSettings] = useState([]);
    const [materialCostSettings, setMaterialCostSettings] = useState([]);
    const [dateRange, setDateRange] = useState({ key: 'all', startDate: null, endDate: null });
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalContent, setDetailModalContent] = useState({ title: '', costs: [] });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const costsPromise = supabase
            .from('quality_costs')
            .select('*, personnel(full_name), non_conformities(nc_number, id)')
            .order('cost_date', { ascending: false });

        const unitSettingsPromise = supabase.from('cost_settings').select('*');
        const materialSettingsPromise = supabase.from('material_costs').select('*');
        const personnelPromise = supabase.from('personnel').select('*');

        const [costsRes, unitSettingsRes, materialSettingsRes, personnelRes] = await Promise.all([costsPromise, unitSettingsPromise, materialSettingsPromise, personnelPromise]);
        
        if (costsRes.error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet verileri alınamadı: ${costsRes.error.message}` });
        } else {
            setAllCosts(costsRes.data);
        }
        
        if (unitSettingsRes.error) toast({ variant: 'destructive', title: 'Birim maliyet ayarları alınamadı.' }); else setUnitCostSettings(unitSettingsRes.data);
        if (materialSettingsRes.error) toast({ variant: 'destructive', title: 'Malzeme maliyet ayarları alınamadı.' }); else setMaterialCostSettings(materialSettingsRes.data);
        if (personnelRes.error) toast({ variant: 'destructive', title: 'Personel verisi alınamadı.' }); else setPersonnel(personnelRes.data);
        
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredCosts = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) {
            return allCosts;
        }
        return allCosts.filter(cost => {
            const costDate = new Date(cost.cost_date);
            return costDate >= new Date(dateRange.startDate) && costDate <= new Date(dateRange.endDate);
        });
    }, [allCosts, dateRange]);

    const handleOpenFormModal = (cost = null) => {
        setSelectedCost(cost);
        setFormModalOpen(true);
    };
    
    const handleOpenViewModal = (cost) => {
        setSelectedCost(cost);
        setIsViewModalOpen(true);
    };

    const handleOpenNCModal = (cost, type) => {
        const recordForNC = { ...cost, source: 'cost' };
        onOpenNCForm(type, recordForNC);
    };

    const handleOpenNC = (nc) => {
        if (nc && nc.id && onOpenNCView) {
            onOpenNCView(nc.id);
        }
    };

    const handleDelete = async (costId) => {
        const { error } = await supabase.from('quality_costs').delete().eq('id', costId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Maliyet kaydı silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Maliyet kaydı başarıyla silindi.' });
            fetchData();
        }
    };

    const handleOpenDetailModal = useCallback((title, costs) => {
        setDetailModalContent({ title, costs });
        setDetailModalOpen(true);
    }, []);

    return (
        <div className="space-y-6">
            <CostFormModal 
                open={isFormModalOpen} 
                setOpen={setFormModalOpen} 
                refreshCosts={fetchData} 
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
                            <h2 className="widget-title mb-4">Son Maliyet Kayıtları</h2>
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
                                                <th>İlişkili Uygunsuzluk</th>
                                                <th>İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                                            ) : filteredCosts.length === 0 ? (
                                                <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Seçili dönem için maliyet kaydı bulunamadı.</td></tr>
                                            ) : (
                                                filteredCosts.map((cost, index) => (
                                                    <tr key={cost.id}>
                                                        <td>{index + 1}</td>
                                                        <td className="text-foreground">{new Date(cost.cost_date).toLocaleDateString('tr-TR')}</td>
                                                        <td className="text-foreground">{cost.cost_type}</td>
                                                        <td className="text-foreground">{cost.unit}</td>
                                                        <td className="font-semibold text-foreground">{formatCurrency(cost.amount)}</td>
                                                        <td>
                                                            {cost.non_conformities?.nc_number ? (
                                                                <Button variant="link" className="p-0 h-auto" onClick={() => handleOpenNC(cost.non_conformities)}>
                                                                {cost.non_conformities.nc_number}
                                                                <ExternalLink className="w-3 h-3 ml-1" />
                                                                </Button>
                                                            ) : '-'}
                                                        </td>
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
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => handleOpenNCModal(cost, 'DF')} disabled={!!cost.non_conformities}>
                                                                            <GitBranch className="mr-2 h-4 w-4" />
                                                                            <span>DF Oluştur</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleOpenNCModal(cost, '8D')} disabled={!!cost.non_conformities}>
                                                                            <GitBranch className="mr-2 h-4 w-4" />
                                                                            <span>8D Oluştur</span>
                                                                        </DropdownMenuItem>
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
                    <VehicleCostBreakdown costs={filteredCosts} loading={loading} onCardClick={handleOpenDetailModal} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default QualityCostModule;