import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, SlidersHorizontal, Search, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import EquipmentDashboard from '@/components/equipment/EquipmentDashboard';
import EquipmentList from '@/components/equipment/EquipmentList';
import EquipmentFormModal from '@/components/equipment/EquipmentFormModal';
import EquipmentDetailModal from '@/components/equipment/EquipmentDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';

const EquipmentModule = ({ onOpenPdfViewer }) => {
    const { toast } = useToast();
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchEquipments = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('equipments')
            .select(`
                *,
                equipment_calibrations ( * ),
                equipment_assignments ( *, personnel(full_name) )
            `)
            .order('created_at', { ascending: false });

        if (searchTerm) {
            // Kapsamlı arama: ad, seri no, birim, üretici, model, lokasyon, not
            query = query.or(`name.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%,responsible_unit.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        
        const { data, error } = await query;

        if (error) {
            toast({ variant: "destructive", title: "Hata!", description: "Ekipmanlar alınırken bir hata oluştu: " + error.message });
        } else {
            setEquipments(data);
        }
        setLoading(false);
    }, [toast, searchTerm]);
    
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchEquipments();
        }, 300);
        return () => clearTimeout(timeoutId);
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
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Ekipman Adı, Seri No veya Birim ile Ara..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline">
                        <SlidersHorizontal className="w-4 h-4 mr-2" /> Filtrele
                    </Button>
                    {equipments.length > 0 && (
                        <Button 
                            variant="outline" 
                            onClick={() => {
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
                                        return {
                                            name: eq.name || '-',
                                            serial_number: eq.serial_number || '-',
                                            status: eq.status || '-',
                                            calibration_status: calStatus.text,
                                            next_calibration_date: calStatus.date || '-',
                                            manufacturer: eq.manufacturer || '-',
                                            model: eq.model || '-',
                                            responsible_unit: eq.responsible_unit || '-',
                                            location: eq.location || '-',
                                            acquisition_date: eq.acquisition_date || '-',
                                            notes: eq.notes || '-'
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
                    <EquipmentList equipments={equipments} onEdit={handleOpenForm} onView={handleOpenDetail} onDelete={handleDelete} />
                )}
            </motion.div>
        </div>
    );
};

export default EquipmentModule;