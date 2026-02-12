import React, { useState, useMemo, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, SlidersHorizontal, Search, BarChart2, List, ArrowUpDown, ArrowUp, ArrowDown, FileText, BarChart3 } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { normalizeTurkishForSearch } from '@/lib/utils';
    import { formatDuration } from '@/lib/formatDuration';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { openPrintableReport } from '@/lib/reportUtils';

    import VehicleDashboard from '@/components/produced-vehicles/VehicleDashboard';
    import VehicleTable from '@/components/produced-vehicles/VehicleTable';
    import VehicleFaultAnalytics from '@/components/produced-vehicles/VehicleFaultAnalytics';
    import VehicleQualityAnalytics from '@/components/produced-vehicles/VehicleQualityAnalytics';
    import { AddVehicleModal, EditVehicleModal, VehicleFaultsModal, VehicleReportModal } from '@/components/produced-vehicles/modals';
    import VehicleDetailModal from '@/components/produced-vehicles/modals/VehicleDetailModal';
    import VehicleStatusDetailModal from '@/components/produced-vehicles/VehicleStatusDetailModal';
    import VehicleTimeDetailModal from '@/components/produced-vehicles/modals/VehicleTimeDetailModal';
    import VehicleFilterModal from '@/components/produced-vehicles/modals/VehicleFilterModal';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';

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
        const [isReportSelectionModalOpen, setIsReportSelectionModalOpen] = useState(false);
        const [isVehicleReportModalOpen, setIsVehicleReportModalOpen] = useState(false);
        const [statusDetail, setStatusDetail] = useState(null);
        const [filters, setFilters] = useState({ status: [], vehicle_type: [], dateRange: null, priorityOnly: false });
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
            if (filters.priorityOnly) {
                sortedVehicles = sortedVehicles.filter(v => v.is_sale_priority);
            }

            if (searchTerm) {
                const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm.trim());
                sortedVehicles = sortedVehicles.filter(v => 
                    normalizeTurkishForSearch(v.chassis_no || '').includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.serial_no || '').includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.vehicle_type || '').includes(normalizedSearchTerm) ||
                    normalizeTurkishForSearch(v.customer_name || '').includes(normalizedSearchTerm)
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
                    await refreshProducedVehicles();
                }
                // Sonra genel refresh'i de çağır (fallback)
                await refreshData();
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
                    await refreshProducedVehicles();
                }
                // Sonra genel refresh'i de çağır (fallback)
                await refreshData();
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

        // Tarih aralığı bilgisi
        const dateRange = useMemo(() => {
            const from = filters.dateRange?.from;
            const to = filters.dateRange?.to;
            if (from && to) {
                return {
                    label: `${format(from, 'dd.MM.yyyy', { locale: tr })} - ${format(to, 'dd.MM.yyyy', { locale: tr })}`,
                    startDate: from,
                    endDate: to
                };
            }
            return { label: 'Tüm Zamanlar', startDate: null, endDate: null };
        }, [filters.dateRange]);

        const handleOpenReportModal = useCallback(() => {
            if (memoizedVehicles.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturmak için en az bir araç kaydı olmalıdır.',
                });
                return;
            }
            setIsReportSelectionModalOpen(true);
        }, [memoizedVehicles, toast]);

        const handleGenerateExecutiveReport = useCallback(async () => {
            if (memoizedVehicles.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturmak için en az bir araç kaydı olmalıdır.',
                });
                return;
            }

            const formatDate = (dateInput) => {
                if (!dateInput) return '-';
                try {
                    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
                    if (isNaN(dateObj.getTime())) return '-';
                    return format(dateObj, 'dd.MM.yyyy', { locale: tr });
                } catch {
                    return '-';
                }
            };

            try {
                // Genel istatistikler
                const totalVehicles = memoizedVehicles.length;
                
                // Durum bazlı analiz
                const byStatus = {};
                memoizedVehicles.forEach(vehicle => {
                    const status = vehicle.status || 'Belirtilmemiş';
                    if (!byStatus[status]) {
                        byStatus[status] = { count: 0, vehicles: [] };
                    }
                    byStatus[status].count += 1;
                    byStatus[status].vehicles.push(vehicle);
                });

                const statusAnalysis = Object.entries(byStatus)
                    .map(([status, data]) => ({
                        status,
                        count: data.count,
                        percentage: totalVehicles > 0 ? ((data.count / totalVehicles) * 100) : 0
                    }))
                    .sort((a, b) => b.count - a.count);

                // Araç tipi bazlı analiz
                const byVehicleType = {};
                memoizedVehicles.forEach(vehicle => {
                    const vehicleType = vehicle.vehicle_type || 'Belirtilmemiş';
                    if (!byVehicleType[vehicleType]) {
                        byVehicleType[vehicleType] = { count: 0, totalFaults: 0, activeFaults: 0 };
                    }
                    byVehicleType[vehicleType].count += 1;
                    const faults = vehicle.quality_inspection_faults || [];
                    byVehicleType[vehicleType].totalFaults += faults.length;
                    byVehicleType[vehicleType].activeFaults += faults.filter(f => !f.is_resolved).length;
                });

                const topVehicleTypes = Object.entries(byVehicleType)
                    .map(([type, data]) => ({
                        vehicleType: type,
                        count: data.count,
                        percentage: totalVehicles > 0 ? ((data.count / totalVehicles) * 100) : 0,
                        totalFaults: data.totalFaults,
                        activeFaults: data.activeFaults,
                        resolvedFaults: data.totalFaults - data.activeFaults
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);

                // Müşteri bazlı analiz
                const byCustomer = {};
                memoizedVehicles.forEach(vehicle => {
                    const customer = vehicle.customer_name || 'Belirtilmemiş';
                    if (!byCustomer[customer]) {
                        byCustomer[customer] = { count: 0, totalFaults: 0, activeFaults: 0 };
                    }
                    byCustomer[customer].count += 1;
                    const faults = vehicle.quality_inspection_faults || [];
                    byCustomer[customer].totalFaults += faults.length;
                    byCustomer[customer].activeFaults += faults.filter(f => !f.is_resolved).length;
                });

                const topCustomers = Object.entries(byCustomer)
                    .map(([customer, data]) => ({
                        customer,
                        count: data.count,
                        percentage: totalVehicles > 0 ? ((data.count / totalVehicles) * 100) : 0,
                        totalFaults: data.totalFaults,
                        activeFaults: data.activeFaults
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);

                // Hata analizi
                let totalFaults = 0;
                let activeFaults = 0;
                let resolvedFaults = 0;
                memoizedVehicles.forEach(vehicle => {
                    const faults = vehicle.quality_inspection_faults || [];
                    totalFaults += faults.length;
                    activeFaults += faults.filter(f => !f.is_resolved).length;
                    resolvedFaults += faults.filter(f => f.is_resolved).length;
                });

                // En çok hata olan araçlar
                const vehiclesWithFaults = memoizedVehicles
                    .map(vehicle => {
                        const faults = vehicle.quality_inspection_faults || [];
                        return {
                            chassisNo: vehicle.chassis_no || '-',
                            vehicleType: vehicle.vehicle_type || '-',
                            customerName: vehicle.customer_name || '-',
                            status: vehicle.status || '-',
                            totalFaults: faults.length,
                            activeFaults: faults.filter(f => !f.is_resolved).length,
                            resolvedFaults: faults.filter(f => f.is_resolved).length
                        };
                    })
                    .filter(v => v.totalFaults > 0)
                    .sort((a, b) => b.totalFaults - a.totalFaults)
                    .slice(0, 10);

                // DMO durumu analizi
                const byDMOStatus = {};
                memoizedVehicles.forEach(vehicle => {
                    const dmoStatus = vehicle.dmo_status || 'Belirtilmemiş';
                    if (!byDMOStatus[dmoStatus]) {
                        byDMOStatus[dmoStatus] = { count: 0 };
                    }
                    byDMOStatus[dmoStatus].count += 1;
                });

                const dmoAnalysis = Object.entries(byDMOStatus)
                    .map(([status, data]) => ({
                        status,
                        count: data.count,
                        percentage: totalVehicles > 0 ? ((data.count / totalVehicles) * 100) : 0
                    }))
                    .sort((a, b) => b.count - a.count);

                // Aylık trend analizi
                const monthlyTrends = {};
                memoizedVehicles.forEach(vehicle => {
                    if (!vehicle.created_at) return;
                    try {
                        const monthKey = format(new Date(vehicle.created_at), 'yyyy-MM', { locale: tr });
                        if (!monthlyTrends[monthKey]) {
                            monthlyTrends[monthKey] = {
                                count: 0,
                                totalFaults: 0,
                                activeFaults: 0
                            };
                        }
                        monthlyTrends[monthKey].count += 1;
                        const faults = vehicle.quality_inspection_faults || [];
                        monthlyTrends[monthKey].totalFaults += faults.length;
                        monthlyTrends[monthKey].activeFaults += faults.filter(f => !f.is_resolved).length;
                    } catch (error) {
                        console.warn('Geçersiz tarih:', vehicle.created_at, error);
                    }
                });

                const monthlyData = Object.entries(monthlyTrends)
                    .map(([month, data]) => ({
                        month: format(new Date(month + '-01'), 'MMMM yyyy', { locale: tr }),
                        monthKey: month,
                        count: data.count,
                        totalFaults: data.totalFaults,
                        activeFaults: data.activeFaults,
                        averageFaultsPerVehicle: data.count > 0 ? (data.totalFaults / data.count) : 0
                    }))
                    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                    .slice(-12); // Son 12 ay

                // Ortalama kontrol süresi hesaplama (control_start ve control_end arasındaki süre - dinamik)
                let totalControlMillis = 0;
                let controlCount = 0;
                memoizedVehicles.forEach(vehicle => {
                    const timeline = vehicle.vehicle_timeline_events || [];
                    for (let i = 0; i < timeline.length; i++) {
                        const currentEvent = timeline[i];
                        if (currentEvent.event_type === 'control_start') {
                            const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'control_end');
                            const startTime = new Date(currentEvent.event_timestamp);
                            // Eğer control_end yoksa, şu anki zamana kadar hesapla (dinamik)
                            const endTime = nextEnd ? new Date(nextEnd.event_timestamp) : new Date();
                            totalControlMillis += (endTime - startTime);
                            controlCount++;
                        }
                    }
                });
                // Ortalama kontrol süresini saat ve dakika formatında hesapla
                const averageControlDurationMillis = controlCount > 0 
                    ? totalControlMillis / controlCount
                    : 0;
                const averageControlDuration = formatDuration(averageControlDurationMillis);

                // Ortalama yeniden işlem süresi hesaplama (dinamik - devam edenler dahil)
                let totalReworkMillis = 0;
                let reworkCount = 0;
                memoizedVehicles.forEach(vehicle => {
                    const timeline = vehicle.vehicle_timeline_events || [];
                    for (let i = 0; i < timeline.length; i++) {
                        const currentEvent = timeline[i];
                        if (currentEvent.event_type === 'rework_start') {
                            const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'rework_end');
                            const startTime = new Date(currentEvent.event_timestamp);
                            // Eğer rework_end yoksa, şu anki zamana kadar hesapla (dinamik)
                            const endTime = nextEnd ? new Date(nextEnd.event_timestamp) : new Date();
                            totalReworkMillis += (endTime - startTime);
                            reworkCount++;
                        }
                    }
                });
                const averageReworkDurationMillis = reworkCount > 0 
                    ? totalReworkMillis / reworkCount
                    : 0;
                const averageReworkDuration = formatDuration(averageReworkDurationMillis);

                // Rapor verisi
                const reportData = {
                    id: `produced-vehicles-executive-${Date.now()}`,
                    period: dateRange.label || 'Tüm Zamanlar',
                    periodStart: dateRange.startDate ? formatDate(dateRange.startDate) : null,
                    periodEnd: dateRange.endDate ? formatDate(dateRange.endDate) : null,
                    totalVehicles,
                    statusAnalysis,
                    topVehicleTypes,
                    topCustomers,
                    totalFaults,
                    activeFaults,
                    resolvedFaults,
                    faultResolutionRate: totalFaults > 0 ? ((resolvedFaults / totalFaults) * 100) : 0,
                    vehiclesWithFaults,
                    dmoAnalysis,
                    monthlyData,
                    averageControlDuration,
                    averageReworkDuration,
                    reportDate: formatDate(new Date())
                };

                openPrintableReport(reportData, 'produced_vehicles_executive_summary', true);

                toast({
                    title: 'Başarılı',
                    description: 'Yönetici özeti raporu oluşturuldu.',
                });
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: `Rapor oluşturulurken hata oluştu: ${error.message}`,
                });
            }
        }, [memoizedVehicles, dateRange, toast]);

        const handleSelectReportType = useCallback((type) => {
            setIsReportSelectionModalOpen(false);
            if (type === 'executive') {
                handleGenerateExecutiveReport();
            } else if (type === 'vehicle') {
                setIsVehicleReportModalOpen(true);
            }
        }, [handleGenerateExecutiveReport]);

        return (
            <div className="space-y-6">
                <AddVehicleModal isOpen={isAddModalOpen} setIsOpen={setAddModalOpen} refreshVehicles={refreshProducedVehicles || refreshData} />
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
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Kaliteye Verilen Araçlar</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Üretimden kalite sürecine giren araçları yönetin.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
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
                                        placeholder="Şasi No, Seri No, Tip veya Müşteri Ara..."
                                        className="search-input"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoCapitalize="off"
                                    />
                                </div>
                                <Button variant="outline" onClick={() => setFilterModalOpen(true)} className="shrink-0">
                                    <SlidersHorizontal className="w-4 h-4 mr-2" /> Filtrele
                                </Button>
                                <Button onClick={handleOpenReportModal} variant="outline" size="sm" className="shrink-0">
                                    <FileText className="w-4 h-4 mr-2" /> Rapor Al
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
                        <VehicleFaultAnalytics refreshTrigger={refreshProducedVehicles} />
                    </TabsContent>
                    <TabsContent value="quality" className="mt-6">
                        <VehicleQualityAnalytics />
                    </TabsContent>
                </Tabs>

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
                                onClick={() => handleSelectReportType('executive')}
                                className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                                    <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base mb-1 text-foreground">Yönetici Özeti Raporu</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Durum analizi, araç tipi ve müşteri bazlı analiz, hata istatistikleri, DMO durumu ve trend analizi içeren kapsamlı özet rapor.
                                    </p>
                                </div>
                            </button>
                            <button
                                onClick={() => handleSelectReportType('vehicle')}
                                className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base mb-1 text-foreground">Araç İşlemleri Raporu</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Durum ve tarih filtrelerine göre tüm araçlar için detaylı işlem raporu. Filtrelere göre tüm araçları içerir.
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

                {/* Araç İşlemleri Rapor Modalı */}
                <VehicleReportModal
                    isOpen={isVehicleReportModalOpen}
                    setIsOpen={setIsVehicleReportModalOpen}
                    vehicles={producedVehicles}
                    filters={filters}
                />
            </div>
        );
    };

    export default ProducedVehiclesModule;