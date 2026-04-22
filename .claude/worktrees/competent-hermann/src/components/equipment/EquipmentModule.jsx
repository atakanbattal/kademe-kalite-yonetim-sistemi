import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, SlidersHorizontal, Search, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

import EquipmentDashboard from '@/components/equipment/EquipmentDashboard';
import EquipmentList from '@/components/equipment/EquipmentList';
import EquipmentFormModal from '@/components/equipment/EquipmentFormModal';
import EquipmentDetailModal from '@/components/equipment/EquipmentDetailModal';
import EquipmentFilters from '@/components/equipment/EquipmentFilters';
import { openPrintableReport } from '@/lib/reportUtils';
import { normalizeTurkishForSearch } from '@/lib/utils';

const EquipmentModule = ({ onOpenPdfViewer }) => {
    const { toast } = useToast();
    const [equipments, setEquipments] = useState([]);
    const [allEquipments, setAllEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [isFiltersModalOpen, setFiltersModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 600); // Debounce süresini 600ms'ye çıkardık
    const [filters, setFilters] = useState({
        status: '',
        calibrationStatus: '',
        responsibleUnit: '',
        location: '',
        minCalibrationDays: '',
        maxCalibrationDays: ''
    });
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // İlk yüklemede sadece temel bilgileri çek, ilişkili verileri lazy load et
    const fetchEquipments = useCallback(async () => {
        setLoading(true);
        try {
            // Önce sadece temel ekipman bilgilerini çek (ilişkili veriler olmadan)
            let query = supabase
                .from('equipments')
                .select(`
                    id,
                    name,
                    serial_number,
                    brand_model,
                    responsible_unit,
                    location,
                    status,
                    description,
                    measurement_range,
                    measurement_uncertainty,
                    calibration_frequency_months,
                    created_at,
                    updated_at
                `)
                .order('created_at', { ascending: false });

            if (debouncedSearchTerm) {
                // Kapsamlı arama: ad, seri no, birim, marka/model, lokasyon, açıklama
                query = query.or(`name.ilike.%${debouncedSearchTerm}%,serial_number.ilike.%${debouncedSearchTerm}%,responsible_unit.ilike.%${debouncedSearchTerm}%,brand_model.ilike.%${debouncedSearchTerm}%,location.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
            }
            
            const { data, error } = await query;

            if (error) {
                toast({ variant: "destructive", title: "Hata!", description: "Ekipmanlar alınırken bir hata oluştu: " + error.message });
                setAllEquipments([]);
            } else {
                // İlişkili verileri ayrı sorgularla çek (daha hızlı)
                const equipmentIds = data.map(eq => eq.id);
                
                if (equipmentIds.length > 0) {
                    // Kalibrasyonları ve zimmetleri toplu olarak çek (sadece aktif olanlar)
                    // Supabase'in .in() metodu maksimum 1000 ID destekler, bu yüzden batch'ler halinde çekiyoruz
                    const batchSize = 1000;
                    const calibrationBatches = [];
                    const assignmentBatches = [];
                    
                    for (let i = 0; i < equipmentIds.length; i += batchSize) {
                        const batch = equipmentIds.slice(i, i + batchSize);
                        calibrationBatches.push(
                            supabase
                                .from('equipment_calibrations')
                                .select('*, equipment_id')
                                .in('equipment_id', batch)
                        );
                        assignmentBatches.push(
                            supabase
                                .from('equipment_assignments')
                                .select('*, equipment_id, personnel(id, full_name)')
                                .in('equipment_id', batch)
                        );
                    }

                    const [calibrationsResults, assignmentsResults] = await Promise.all([
                        Promise.all(calibrationBatches),
                        Promise.all(assignmentBatches)
                    ]);

                    // Sonuçları birleştir
                    const allCalibrations = calibrationsResults.flatMap(result => result.data || []);
                    const allAssignments = assignmentsResults.flatMap(result => result.data || []);

                    // Verileri birleştir
                    const equipmentsWithRelations = data.map(eq => ({
                        ...eq,
                        equipment_calibrations: allCalibrations.filter(cal => cal.equipment_id === eq.id),
                        equipment_assignments: allAssignments.filter(assign => assign.equipment_id === eq.id)
                    }));

                    setAllEquipments(equipmentsWithRelations);
                } else {
                    setAllEquipments([]);
                }
            }
        } catch (err) {
            console.error('Fetch error:', err);
            toast({ variant: "destructive", title: "Hata!", description: "Ekipmanlar alınırken bir hata oluştu." });
            setAllEquipments([]);
        } finally {
            setLoading(false);
        }
    }, [toast, debouncedSearchTerm]);

    const getCalibrationStatus = (calibrations, equipmentStatus) => {
        if (equipmentStatus === 'Hurdaya Ayrıldı') {
            return { text: 'Hurdaya Ayrıldı', daysLeft: null };
        }
        if (!calibrations || calibrations.length === 0) {
            return { text: 'Girilmemiş', daysLeft: null };
        }
        const activeCalibrations = calibrations.filter(cal => cal.is_active !== false);
        if (activeCalibrations.length === 0) {
            return { text: 'Pasif', daysLeft: null };
        }
        const latestCalibration = [...activeCalibrations].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
        const nextDate = new Date(latestCalibration.next_calibration_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const timeDiff = nextDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
        let text;
        if (daysLeft < 0) {
            text = 'Geçmiş';
        } else if (daysLeft <= 30) {
            text = 'Yaklaşıyor';
        } else {
            text = 'Tamam';
        }
        return { text, daysLeft };
    };

    // Filtreleme mantığını useMemo ile optimize et
    const filteredEquipments = useMemo(() => {
        if (allEquipments.length === 0) return [];

        let filtered = [...allEquipments];

        // Durum filtresi
        if (filters.status) {
            filtered = filtered.filter(eq => {
                const activeAssignment = eq.equipment_assignments?.find(a => a.is_active);
                const displayStatus = activeAssignment ? 'Zimmetli' : eq.status;
                return displayStatus === filters.status;
            });
        }

        // Kalibrasyon durumu filtresi
        if (filters.calibrationStatus) {
            filtered = filtered.filter(eq => {
                const calStatus = getCalibrationStatus(eq.equipment_calibrations, eq.status);
                return calStatus.text === filters.calibrationStatus;
            });
        }

        // Sorumlu birim filtresi - normalize edilmiş karşılaştırma
        if (filters.responsibleUnit) {
            const normalizedFilterUnit = normalizeTurkishForSearch(filters.responsibleUnit.trim().toLowerCase());
            filtered = filtered.filter(eq => {
                if (!eq.responsible_unit) return false;
                const normalizedRecordUnit = normalizeTurkishForSearch(String(eq.responsible_unit).trim().toLowerCase());
                return normalizedRecordUnit.includes(normalizedFilterUnit);
            });
        }

        // Konum filtresi
        if (filters.location) {
            const locationLower = filters.location.toLowerCase();
            filtered = filtered.filter(eq => 
                eq.location?.toLowerCase().includes(locationLower)
            );
        }

        // Kalibrasyon günü filtresi
        if (filters.minCalibrationDays !== '' || filters.maxCalibrationDays !== '') {
            const minDays = filters.minCalibrationDays !== '' ? parseInt(filters.minCalibrationDays) : -Infinity;
            const maxDays = filters.maxCalibrationDays !== '' ? parseInt(filters.maxCalibrationDays) : Infinity;
            filtered = filtered.filter(eq => {
                const calStatus = getCalibrationStatus(eq.equipment_calibrations, eq.status);
                if (calStatus.daysLeft === null) return false;
                return calStatus.daysLeft >= minDays && calStatus.daysLeft <= maxDays;
            });
        }

        // Sıralama
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortConfig.key) {
                case 'name':
                case 'serial_number':
                case 'brand_model':
                case 'responsible_unit':
                case 'location':
                case 'status':
                    aVal = (a[sortConfig.key] || '').toLowerCase();
                    bVal = (b[sortConfig.key] || '').toLowerCase();
                    break;
                case 'acquisition_date':
                    aVal = a.acquisition_date ? new Date(a.acquisition_date) : new Date(0);
                    bVal = b.acquisition_date ? new Date(b.acquisition_date) : new Date(0);
                    break;
                default:
                    aVal = a[sortConfig.key];
                    bVal = b[sortConfig.key];
            }
            
            if (aVal === bVal) return 0;
            
            const comparison = aVal < bVal ? -1 : 1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [filters, allEquipments, sortConfig]);

    useEffect(() => {
        setEquipments(filteredEquipments);
    }, [filteredEquipments]);

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
    
    // İlk yükleme ve debounced search term değiştiğinde çalış
    useEffect(() => {
        fetchEquipments();
    }, [fetchEquipments]);
    
    const handleOpenForm = (equipment = null) => {
        setSelectedEquipment(equipment);
        setFormModalOpen(true);
    };

    const handleOpenDetail = (equipment) => {
        setSelectedEquipment(equipment);
        setDetailModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error: assignError } = await supabase.from('equipment_assignments').delete().eq('equipment_id', id);
        if (assignError) {
            toast({ variant: 'destructive', title: 'Hata!', description: `İlişkili zimmet kayıtları silinemedi: ${assignError.message}` });
            return;
        }

        const { error: calibError } = await supabase.from('equipment_calibrations').delete().eq('equipment_id', id);
        if (calibError) {
            toast({ variant: 'destructive', title: 'Hata!', description: `İlişkili kalibrasyon kayıtları silinemedi: ${calibError.message}` });
            return;
        }

        const { error } = await supabase.from('equipments').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Ekipman silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Ekipman başarıyla silindi.' });
            fetchEquipments();
        }
    };

    const handleDownloadPDF = (record, type) => {
        openPrintableReport(record, type);
    };

    const handleFiltersChange = (newFilters) => {
        setFilters(newFilters);
    };

    const handleResetFilters = () => {
        setFilters({
            status: '',
            calibrationStatus: '',
            responsibleUnit: '',
            location: '',
            minCalibrationDays: '',
            maxCalibrationDays: ''
        });
    };

    return (
        <div className="space-y-6">
            <EquipmentFormModal isOpen={isFormModalOpen} setIsOpen={setFormModalOpen} refreshData={fetchEquipments} existingEquipment={selectedEquipment} />
            <EquipmentDetailModal 
                isOpen={isDetailModalOpen} 
                setIsOpen={setDetailModalOpen} 
                equipment={selectedEquipment} 
                refreshData={fetchEquipments} 
                onOpenPdfViewer={onOpenPdfViewer}
                onDownloadPDF={handleDownloadPDF} 
            />
            <EquipmentFilters 
                isOpen={isFiltersModalOpen} 
                setIsOpen={setFiltersModalOpen}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onReset={handleResetFilters}
            />


            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Ekipman ve Kalibrasyon Yönetimi</h1>
                    <p className="text-muted-foreground mt-1">Ölçüm cihazlarınızı, kalibrasyonlarını ve zimmetlerini takip edin.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => handleOpenForm()}>
                        <Plus className="w-4 h-4 mr-2" /> Yeni Ekipman Ekle
                    </Button>
                </div>
            </div>

            <EquipmentDashboard equipments={equipments} loading={loading} />

            <motion.div
                className="dashboard-widget"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="search-box flex-grow">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Ekipman Adı, Seri No veya Birim ile Ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={() => setFiltersModalOpen(true)}>
                        <SlidersHorizontal className="w-4 h-4 mr-2" /> Filtrele
                        {Object.values(filters).some(v => v !== '') && (
                            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                                {Object.values(filters).filter(v => v !== '').length}
                            </span>
                        )}
                    </Button>
                    {equipments.length > 0 && (
                        <Button 
                            variant="outline" 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const reportData = {
                                    id: `equipment-list-${Date.now()}`,
                                    items: equipments.map(eq => {
                                        // Kalibrasyon durumunu hesapla
                                        const getCalibrationStatus = (calibrations, equipmentStatus) => {
                                            if (equipmentStatus === 'Hurdaya Ayrıldı') {
                                                return { text: 'Hurdaya Ayrıldı', date: null, daysLeft: null };
                                            }
                                            if (!calibrations || calibrations.length === 0) {
                                                return { text: 'Girilmemiş', date: null, daysLeft: null };
                                            }
                                            const activeCalibrations = calibrations.filter(cal => cal.is_active !== false);
                                            if (activeCalibrations.length === 0) {
                                                return { text: 'Pasif', date: null, daysLeft: null };
                                            }
                                            const latestCalibration = [...activeCalibrations].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
                                            const nextDate = new Date(latestCalibration.next_calibration_date);
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            const timeDiff = nextDate.getTime() - today.getTime();
                                            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                            return { 
                                                text: daysLeft < 0 ? `Geçmiş (${Math.abs(daysLeft)} gün)` : daysLeft <= 30 ? `Yaklaşıyor (${daysLeft} gün)` : 'Tamam',
                                                date: nextDate.toLocaleDateString('tr-TR'),
                                                daysLeft
                                            };
                                        };
                                        const calStatus = getCalibrationStatus(eq.equipment_calibrations, eq.status);
                                        
                                        // Aktif zimmet bilgisini bul
                                        const activeAssignment = eq.equipment_assignments?.find(a => a.is_active === true);
                                        const assignedPersonnel = activeAssignment?.personnel?.full_name || '-';
                                        
                                        return {
                                            name: eq.name || '-',
                                            serial_number: eq.serial_number || '-',
                                            status: eq.status || '-',
                                            calibration_status: calStatus.text,
                                            next_calibration_date: calStatus.date || '-',
                                            brand_model: eq.brand_model || '-',
                                            model: eq.brand_model || '-', // Raporda model olarak kullanılıyor
                                            measurement_range: eq.measurement_range || '-',
                                            responsible_unit: eq.responsible_unit || '-',
                                            location: eq.location || '-',
                                            acquisition_date: eq.acquisition_date || '-',
                                            description: eq.description || '-',
                                            assigned_personnel: assignedPersonnel
                                        };
                                    }),
                                    filterInfo: searchTerm ? `Arama: "${searchTerm}"` : 'Tüm Ekipmanlar'
                                };
                                openPrintableReport(reportData, 'equipment_list', true);
                            }}
                            className="flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Rapor Al
                        </Button>
                    )}
                </div>
                {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
                ) : (
                    <EquipmentList 
                        equipments={equipments} 
                        onEdit={handleOpenForm} 
                        onView={handleOpenDetail} 
                        onDelete={handleDelete}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                        getSortIcon={getSortIcon}
                    />
                )}
            </motion.div>
        </div>
    );
};

export default EquipmentModule;