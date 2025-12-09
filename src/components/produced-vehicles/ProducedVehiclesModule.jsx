import React, { useState, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, SlidersHorizontal, Search, BarChart2, List } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

    const ProducedVehiclesModule = ({ onOpenNCForm }) => {
        const { toast } = useToast();
        const { producedVehicles, productionDepartments, loading, refreshData, refreshProducedVehicles } = useData();
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

        const [selectedVehicle, setSelectedVehicle] = useState(null);
        const [activeTab, setActiveTab] = useState('operations');

        const filteredVehicles = useMemo(() => {
            let sortedVehicles = [...producedVehicles].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            
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
                return sortedVehicles.filter(v => 
                    normalizeTurkishForSearch(v.chassis_no).includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.vehicle_type).includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.customer_name).includes(normalizedSearchTerm)
                );
            }
            return sortedVehicles;
        }, [producedVehicles, searchTerm, filters]);

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

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Kaliteye Giren Araçlar</h1>
                        <p className="text-muted-foreground mt-1">Üretimden kalite kontrol sürecine giren araçları yönetin ve analiz edin.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex justify-between items-end">
                        <TabsList>
                            <TabsTrigger value="operations"><List className="w-4 h-4 mr-2" />Araç İşlemleri</TabsTrigger>
                            <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-2" />Hata Analizi</TabsTrigger>
                            <TabsTrigger value="quality"><BarChart2 className="w-4 h-4 mr-2" />Kalite Analizi</TabsTrigger>
                        </TabsList>
                        {activeTab === 'operations' && (
                            <Button onClick={() => handleOpenModal(setAddModalOpen, null)}>
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
                            className="dashboard-widget mt-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Şasi No, Araç Tipi veya Müşteri Adı ile Ara..."
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" onClick={() => setFilterModalOpen(true)}>
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