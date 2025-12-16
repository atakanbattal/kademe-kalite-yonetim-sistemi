import React, { useState, useMemo, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, SlidersHorizontal, Search, BarChart2, List, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { normalizeTurkishForSearch } from '@/lib/utils';

    import VehicleDashboard from '@/components/produced-vehicles/VehicleDashboard';
    import VehicleTable from '@/components/produced-vehicles/VehicleTable';
    import VehicleFaultAnalytics from '@/components/produced-vehicles/VehicleFaultAnalytics';
    import VehicleQualityAnalytics from '@/components/produced-vehicles/VehicleQualityAnalytics';
    import { AddVehicleModal, EditVehicleModal, VehicleFaultsModal } from '@/components/produced-vehicles/modals';
    import VehicleDetailModal from '@/components/produced-vehicles/modals/VehicleDetailModal';
    import VehicleStatusDetailModal from '@/components/produced-vehicles/VehicleStatusDetailModal';
    import VehicleTimeDetailModal from '@/components/produced-vehicles/modals/VehicleTimeDetailModal';
    import VehicleFilterModal from '@/components/produced-vehicles/modals/VehicleFilterModal';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { createVehicleQualityCostRecord } from '@/lib/vehicleCostCalculator';

    const ProducedVehiclesModule = ({ onOpenNCForm }) => {
        const { toast } = useToast();
        const { producedVehicles, productionDepartments, loading, refreshData, refreshProducedVehicles, unitCostSettings } = useData();
        const [searchTerm, setSearchTerm] = useState('');
        const { profile } = useAuth();
        
        const [isAddModalOpen, setAddModalOpen] = useState(false);
        const [isEditModalOpen, setEditModalOpen] = useState(false);
        const [isFaultsModalOpen, setFaultsModalOpen] = useState(false);
        const [isDetailModalOpen, setDetailModalOpen] = useState(false);
        const [isTimeDetailModalOpen, setTimeDetailModalOpen] = useState(false);
        const [isStatusDetailModalOpen, setStatusDetailModalOpen] = useState(false);
        const [isFilterModalOpen, setFilterModalOpen] = useState(false);
        const [statusDetail, setStatusDetail] = useState(null);
        const [filters, setFilters] = useState({ status: [], vehicle_type: [], dateRange: null });
        const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });

        const [selectedVehicle, setSelectedVehicle] = useState(null);
        const [activeTab, setActiveTab] = useState('operations');
        
        // selectedVehicle'ı producedVehicles güncellendiğinde senkronize tut
        useEffect(() => {
            if (selectedVehicle && producedVehicles.length > 0) {
                const updatedVehicle = producedVehicles.find(v => v.id === selectedVehicle.id);
                if (updatedVehicle && JSON.stringify(updatedVehicle) !== JSON.stringify(selectedVehicle)) {
                    setSelectedVehicle(updatedVehicle);
                }
            }
        }, [producedVehicles, selectedVehicle]);

        const filteredVehicles = useMemo(() => {
            let sortedVehicles = [...producedVehicles];
            
            if (filters.status.length > 0) {
                sortedVehicles = sortedVehicles.filter(v => filters.status.includes(v.status));
            }
            if (filters.vehicle_type.length > 0) {
                sortedVehicles = sortedVehicles.filter(v => filters.vehicle_type.includes(v.vehicle_type));
            }
            if (filters.dateRange?.from && filters.dateRange?.to) {
                sortedVehicles = sortedVehicles.filter(v => {
                    const createdAt = new Date(v.created_at);
                    return createdAt >= filters.dateRange.from && createdAt <= filters.dateRange.to;
                });
            }

            if (searchTerm) {
                const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
                sortedVehicles = sortedVehicles.filter(v => 
                    normalizeTurkishForSearch(v.chassis_no).includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.vehicle_type).includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.customer_name).includes(normalizedSearchTerm)
                );
            }

            // Sıralama
            sortedVehicles.sort((a, b) => {
                let aVal, bVal;
                
                switch (sortConfig.key) {
                    case 'updated_at':
                    case 'created_at':
                        aVal = new Date(a[sortConfig.key]);
                        bVal = new Date(b[sortConfig.key]);
                        break;
                    case 'chassis_no':
                    case 'serial_no':
                    case 'vehicle_type':
                    case 'customer_name':
                    case 'status':
                        aVal = (a[sortConfig.key] || '').toLowerCase();
                        bVal = (b[sortConfig.key] || '').toLowerCase();
                        break;
                    default:
                        aVal = a[sortConfig.key];
                        bVal = b[sortConfig.key];
                }
                
                if (aVal === bVal) return 0;
                
                const comparison = aVal < bVal ? -1 : 1;
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });

            return sortedVehicles;
        }, [producedVehicles, searchTerm, filters, sortConfig]);

        const handleDeleteVehicle = async (vehicleId) => {
            const { error } = await supabase.from('quality_inspections').delete().eq('id', vehicleId);
            if (error) {
                toast({ variant: 'destructive', title: 'Silme Hatası', description: 'Araç kaydı silinemedi: ' + error.message });
            } else {
                toast({ title: 'Başarılı', description: 'Araç kaydı başarıyla silindi.' });
                // Önce özel refresh fonksiyonunu çağır (daha hızlı)
                if (refreshProducedVehicles) {
                    refreshProducedVehicles();
                }
                // Sonra genel refresh'i de çağır (fallback)
                refreshData();
            }
        };
        
        const handleUpdateStatus = async (inspectionId, eventType) => {
            try {
                const { error } = await supabase.from('vehicle_timeline_events').insert({
                    inspection_id: inspectionId,
                    event_type: eventType,
                    event_timestamp: new Date().toISOString(),
                    user_id: profile.id
                });

                if (error) throw error;
        
                toast({ title: 'Başarılı!', description: `Yeni işlem eklendi ve durum güncellendi.` });
                
                // Rework tamamlandığında otomatik kalitesizlik maliyeti kaydı oluştur
                if (eventType === 'rework_end' && unitCostSettings.length > 0) {
                    try {
                        // Araç verilerini tam olarak yükle
                        const { data: vehicleData, error: vehicleError } = await supabase
                            .from('quality_inspections')
                            .select(`
                                *,
                                quality_inspection_faults(*, department:production_departments(name)),
                                vehicle_timeline_events(*)
                            `)
                            .eq('id', inspectionId)
                            .single();
                        
                        if (!vehicleError && vehicleData) {
                            const unresolvedFaults = (vehicleData.quality_inspection_faults || []).filter(f => !f.is_resolved);
                            // Sadece çözülmemiş hatalar varsa maliyet kaydı oluştur
                            if (unresolvedFaults.length > 0) {
                                const costRecord = await createVehicleQualityCostRecord(vehicleData, unitCostSettings);
                                if (costRecord) {
                                    toast({ 
                                        title: 'Maliyet Kaydı Oluşturuldu', 
                                        description: `Rework tamamlandığı için kalitesizlik maliyeti kaydedildi: ${costRecord.amount.toFixed(2)} ₺`,
                                        duration: 5000
                                    });
                                }
                            }
                        }
                    } catch (costError) {
                        console.error('❌ Otomatik maliyet kaydı oluşturulamadı:', costError);
                        // Hata mesajı gösterme, sessizce devam et
                    }
                }
                
                // Önce özel refresh fonksiyonunu çağır (daha hızlı)
                if (refreshProducedVehicles) {
                    refreshProducedVehicles();
                }
                // Sonra genel refresh'i de çağır (fallback)
                refreshData();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `İşlem eklenemedi: ${error.message}` });
            }
        };

        const handleOpenModal = (setter, vehicle) => {
            setSelectedVehicle(vehicle);
            setter(true);
        };

        const handleStatusCardClick = (status) => {
            setStatusDetail(status);
            setStatusDetailModalOpen(true);
        };

        const memoizedVehicles = useMemo(() => filteredVehicles, [filteredVehicles]);

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

        return (
            <div className="space-y-6">
                <AddVehicleModal isOpen={isAddModalOpen} setIsOpen={setAddModalOpen} refreshVehicles={refreshData} />
                {selectedVehicle && (
                    <>
                        <EditVehicleModal isOpen={isEditModalOpen} setIsOpen={setEditModalOpen} vehicle={selectedVehicle} refreshVehicles={refreshProducedVehicles || refreshData} />
                        <VehicleFaultsModal isOpen={isFaultsModalOpen} setIsOpen={setFaultsModalOpen} vehicle={selectedVehicle} departments={productionDepartments} onUpdate={refreshProducedVehicles || refreshData} onOpenNCForm={onOpenNCForm}/>
                        <VehicleDetailModal isOpen={isDetailModalOpen} setIsOpen={setDetailModalOpen} vehicle={selectedVehicle} onUpdate={refreshProducedVehicles || refreshData} />
                        <VehicleTimeDetailModal isOpen={isTimeDetailModalOpen} setIsOpen={setTimeDetailModalOpen} vehicle={selectedVehicle} onUpdate={refreshProducedVehicles || refreshData} />
                    </>
                )}
                 <VehicleStatusDetailModal 
                    isOpen={isStatusDetailModalOpen} 
                    setIsOpen={setStatusDetailModalOpen}
                    status={statusDetail}
                    vehicles={producedVehicles}
                    loading={loading}
                    onViewDetails={(v) => handleOpenModal(setDetailModalOpen, v)}
                    onManageFaults={(v) => handleOpenModal(setFaultsModalOpen, v)}
                    onEditDuration={(v) => handleOpenModal(setTimeDetailModalOpen, v)}
                />
                <VehicleFilterModal
                    isOpen={isFilterModalOpen}
                    setIsOpen={setFilterModalOpen}
                    applyFilters={setFilters}
                    currentFilters={filters}
                    vehicles={producedVehicles}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Kaliteye Giren Araçlar</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Üretimden kalite sürecine giren araçları yönetin.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-end">
                        <TabsList className="w-full sm:w-auto overflow-x-auto">
                            <TabsTrigger value="operations" className="flex-1 sm:flex-none">
                                <List className="w-4 h-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Araç İşlemleri</span>
                                <span className="xs:hidden">İşlemler</span>
                            </TabsTrigger>
                            <TabsTrigger value="analytics" className="flex-1 sm:flex-none">
                                <BarChart2 className="w-4 h-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Hata Analizi</span>
                                <span className="xs:hidden">Hatalar</span>
                            </TabsTrigger>
                            <TabsTrigger value="quality" className="flex-1 sm:flex-none">
                                <BarChart2 className="w-4 h-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Kalite Analizi</span>
                                <span className="xs:hidden">Kalite</span>
                            </TabsTrigger>
                        </TabsList>
                        {activeTab === 'operations' && (
                            <Button onClick={() => handleOpenModal(setAddModalOpen, null)} className="w-full sm:w-auto">
                                <Plus className="w-4 h-4 mr-2" /> Yeni Araç Ekle
                            </Button>
                        )}
                    </div>

                    <TabsContent value="operations" className="mt-6">
                        <VehicleDashboard 
                            vehicles={memoizedVehicles} 
                            loading={loading} 
                            onStatusClick={handleStatusCardClick}
                        />

                        <motion.div
                            className="dashboard-widget mt-4 sm:mt-6 md:mt-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
                                <div className="search-box flex-grow">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Şasi, Tip veya Müşteri Ara..."
                                        className="search-input"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" onClick={() => setFilterModalOpen(true)} className="shrink-0">
                                    <SlidersHorizontal className="w-4 h-4 mr-2" /> Filtrele
                                </Button>
                            </div>
                             {loading ? (
                                <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
                            ) : (
                                <VehicleTable 
                                    vehicles={memoizedVehicles}
                                    onEdit={(v) => handleOpenModal(setEditModalOpen, v)}
                                    onView={(v) => handleOpenModal(setDetailModalOpen, v)}
                                    onOpenFaults={(v) => handleOpenModal(setFaultsModalOpen, v)}
                                    onUpdateStatus={handleUpdateStatus}
                                    onDelete={handleDeleteVehicle}
                                    onViewTimeDetails={(v) => handleOpenModal(setTimeDetailModalOpen, v)}
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                    getSortIcon={getSortIcon}
                                />
                            )}
                        </motion.div>
                    </TabsContent>
                    <TabsContent value="analytics" className="mt-6">
                        <VehicleFaultAnalytics />
                    </TabsContent>
                    <TabsContent value="quality" className="mt-6">
                        <VehicleQualityAnalytics />
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    export default ProducedVehiclesModule;