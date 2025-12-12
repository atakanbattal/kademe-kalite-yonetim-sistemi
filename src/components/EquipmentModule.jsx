import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';
import EquipmentList from '@/components/equipment/EquipmentList';
import EquipmentFormModal from '@/components/equipment/EquipmentFormModal';
import EquipmentDetailModal from '@/components/equipment/EquipmentDetailModal';
import EquipmentDashboard from '@/components/equipment/EquipmentDashboard';
import { openPrintableReport } from '@/lib/reportUtils';
import { useData } from '@/contexts/DataContext';
import { normalizeTurkishForSearch } from '@/lib/utils';

const EquipmentModule = () => {
    const { toast } = useToast();
    const { equipments: allEquipments, refreshData, loading } = useData();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [calibrationFilter, setCalibrationFilter] = useState('all');

    const filteredEquipments = useMemo(() => {
        let filtered = allEquipments;

        if (searchTerm) {
            const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
            filtered = filtered.filter(eq => {
                // Temel ekipman bilgileri
                const nameMatch = normalizeTurkishForSearch(eq.name).includes(normalizedSearchTerm);
                const serialMatch = normalizeTurkishForSearch(eq.serial_number).includes(normalizedSearchTerm);
                const brandMatch = normalizeTurkishForSearch(eq.brand_model).includes(normalizedSearchTerm);
                const locationMatch = normalizeTurkishForSearch(eq.location).includes(normalizedSearchTerm);
                const unitMatch = normalizeTurkishForSearch(eq.responsible_unit).includes(normalizedSearchTerm);
                const categoryMatch = normalizeTurkishForSearch(eq.category).includes(normalizedSearchTerm);
                
                // Kalibrasyon bilgileri (sertifika no)
                const calibrationMatch = eq.equipment_calibrations?.some(cal => 
                    normalizeTurkishForSearch(cal.certificate_number).includes(normalizedSearchTerm)
                );
                
                // Personel bilgileri (zimmetli personel)
                const personnelMatch = eq.equipment_assignments?.some(assign => 
                    normalizeTurkishForSearch(assign.personnel?.full_name).includes(normalizedSearchTerm)
                );
                
                return nameMatch || serialMatch || brandMatch || locationMatch || 
                       unitMatch || categoryMatch || calibrationMatch || personnelMatch;
            });
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(eq => eq.status === statusFilter);
        }

        if (calibrationFilter !== 'all') {
            filtered = filtered.filter(eq => {
                if (!eq.equipment_calibrations || eq.equipment_calibrations.length === 0) {
                    return calibrationFilter === 'missing';
                }
                const latestCalibration = [...eq.equipment_calibrations].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
                const nextDate = new Date(latestCalibration.next_calibration_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const timeDiff = nextDate.getTime() - today.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (calibrationFilter === 'due') return daysLeft < 0;
                if (calibrationFilter === 'approaching') return daysLeft >= 0 && daysLeft <= 30;
                return false;
            });
        }

        return filtered;
    }, [allEquipments, searchTerm, statusFilter, calibrationFilter]);

    const handleFormSuccess = () => {
        setFormModalOpen(false);
        setSelectedEquipment(null);
    };

    const handleOpenForm = (equipment = null) => {
        setSelectedEquipment(equipment);
        setFormModalOpen(true);
    };

    const handleOpenDetail = (equipment) => {
        setSelectedEquipment(equipment);
        setDetailModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('equipments').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Ekipman silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Ekipman başarıyla silindi.' });
        }
    };

    const handleDownloadPDF = (record) => {
        openPrintableReport(record, 'equipment');
    };

    return (
        <div className="space-y-6">
            <Helmet>
                <title>Ekipman & Kalibrasyon Yönetimi</title>
                <meta name="description" content="Ekipmanlarınızı ve kalibrasyon süreçlerinizi yönetin." />
            </Helmet>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-foreground">Ekipman & Kalibrasyon</h1>
                <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Yeni Ekipman</Button>
            </div>

            <EquipmentDashboard equipments={allEquipments} loading={loading} />
            
            <div className="bg-card p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Ekipman, seri no, sertifika no, personel, konum vb. ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger><SelectValue placeholder="Duruma Göre Filtrele" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="Aktif">Aktif</SelectItem>
                            <SelectItem value="Zimmetli">Zimmetli</SelectItem>
                            <SelectItem value="Bakımda">Bakımda</SelectItem>
                            <SelectItem value="Kullanım Dışı">Kullanım Dışı</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={calibrationFilter} onValueChange={setCalibrationFilter}>
                        <SelectTrigger><SelectValue placeholder="Kalibrasyon Durumuna Göre Filtrele" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kalibrasyon Durumları</SelectItem>
                            <SelectItem value="due">Geçmiş</SelectItem>
                            <SelectItem value="approaching">Yaklaşan (30 gün)</SelectItem>
                            <SelectItem value="missing">Girilmemiş</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {filteredEquipments.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                const reportData = {
                                    id: `equipment-list-${Date.now()}`,
                                    items: filteredEquipments.map(eq => {
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
                                        return {
                                            name: eq.name || '-',
                                            serial_number: eq.serial_number || '-',
                                            status: eq.status || '-',
                                            calibration_status: calStatus.text,
                                            next_calibration_date: calStatus.date || '-',
                                            manufacturer: eq.manufacturer || '-',
                                            model: eq.model || eq.brand_model || '-',
                                            responsible_unit: eq.responsible_unit || '-',
                                            location: eq.location || '-',
                                            acquisition_date: eq.acquisition_date || '-',
                                            notes: eq.notes || '-'
                                        };
                                    }),
                                    filterInfo: searchTerm ? `Arama: "${searchTerm}"` : (statusFilter !== 'all' || calibrationFilter !== 'all' ? `Filtreler: ${statusFilter !== 'all' ? `Durum: ${statusFilter}` : ''} ${calibrationFilter !== 'all' ? `Kalibrasyon: ${calibrationFilter === 'due' ? 'Geçmiş' : calibrationFilter === 'approaching' ? 'Yaklaşan' : 'Girilmemiş'}` : ''}` : 'Tüm Ekipmanlar')
                                };
                                openPrintableReport(reportData, 'equipment_list', true);
                            }}
                            className="flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Rapor Al
                        </Button>
                    </div>
                )}
            </div>

            <EquipmentList
                equipments={filteredEquipments}
                loading={loading}
                onEdit={handleOpenForm}
                onDelete={handleDelete}
                onView={handleOpenDetail}
            />

            {isFormModalOpen && (
                <EquipmentFormModal
                    isOpen={isFormModalOpen}
                    setIsOpen={setFormModalOpen}
                    refreshData={handleFormSuccess}
                    existingEquipment={selectedEquipment}
                />
            )}

            {isDetailModalOpen && selectedEquipment && (
                <EquipmentDetailModal
                    isOpen={isDetailModalOpen}
                    setIsOpen={setDetailModalOpen}
                    equipment={selectedEquipment}
                    onRefresh={refreshData}
                    onDownloadPDF={handleDownloadPDF}
                />
            )}
        </div>
    );
};

export default EquipmentModule;