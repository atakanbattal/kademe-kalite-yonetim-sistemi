import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/lib/customSupabaseClient';
import KaizenList from '@/components/kaizen/KaizenList';
import KaizenFormModal from '@/components/kaizen/KaizenFormModal';
import KaizenDashboard from '@/components/kaizen/KaizenDashboard';
import KaizenDetailModal from '@/components/kaizen/KaizenDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';

const KaizenManagement = () => {
    const { toast } = useToast();
    const [kaizenEntries, setKaizenEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [editingKaizen, setEditingKaizen] = useState(null);
    const [viewingKaizen, setViewingKaizen] = useState(null);
    const [activeTab, setActiveTab] = useState('vehicle_based');
    
    const [personnel, setPersonnel] = useState([]);
    const [units, setUnits] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('kaizen_entries')
            .select(`
                *,
                proposer:proposer_id ( id, full_name ),
                responsible_person:responsible_person_id ( id, full_name ),
                department:department_id ( id, unit_name, cost_per_minute ),
                supplier:supplier_id ( id, name )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Fetch error from kaizen_entries:", error);
            toast({ variant: 'destructive', title: 'Hata!', description: `Kaizen kayıtları alınamadı: ${error.message}` });
            setKaizenEntries([]);
        } else {
            setKaizenEntries(data);
        }
        setLoading(false);
    }, [toast]);

    const fetchDropdownData = useCallback(async () => {
        try {
            const [personnelResult, unitsResult, suppliersResult] = await Promise.all([
                supabase.from('personnel').select('id, full_name, department'),
                supabase.from('cost_settings').select('id, unit_name, cost_per_minute'),
                supabase.from('suppliers').select('id, name')
            ]);

            if (personnelResult.data) setPersonnel(personnelResult.data);
            if (unitsResult.data) setUnits(unitsResult.data);
            if (suppliersResult.data) setSuppliers(suppliersResult.data);

            // Only show error toast if multiple critical failures
            const errors = [personnelResult.error, unitsResult.error, suppliersResult.error].filter(Boolean);
            if (errors.length === 3) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Filtre verileri yüklenemedi.' });
            }
        } catch (error) {
            console.error('Dropdown data fetch error:', error);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
        fetchDropdownData();
    }, [fetchData, fetchDropdownData]);

    const openFormModal = (kaizen = null) => {
        setEditingKaizen(kaizen);
        setFormModalOpen(true);
    };

    const openDetailModal = async (kaizen) => {
        let team_members_profiles = [];
        if (kaizen.team_members && Array.isArray(kaizen.team_members) && kaizen.team_members.length > 0) {
            const { data: profiles, error } = await supabase
                .from('personnel')
                .select('id, full_name')
                .in('id', kaizen.team_members);
            if (error) {
                toast({ variant: 'destructive', title: 'Ekip üyeleri alınamadı.' });
            } else {
                team_members_profiles = profiles;
            }
        }
        setViewingKaizen({ ...kaizen, team_members_profiles });
        setDetailModalOpen(true);
    };

    const handleSuccess = () => {
        fetchData();
        setFormModalOpen(false);
        setEditingKaizen(null);
    };

    const handleDownloadPDF = (record) => {
        openPrintableReport(record, 'kaizen');
    };

    return (
        <>
            <Helmet>
                <title>Kaizen Yönetimi - Kalite Yönetim Sistemi</title>
                <meta name="description" content="Sürekli iyileştirme (Kaizen) faaliyetlerini yönetin, takip edin ve raporlayın." />
            </Helmet>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
            >
                {isFormModalOpen && (
                    <KaizenFormModal
                        isOpen={isFormModalOpen}
                        setIsOpen={setFormModalOpen}
                        onSuccess={handleSuccess}
                        existingKaizen={editingKaizen}
                        kaizenType={activeTab}
                        personnel={personnel}
                        units={units}
                        suppliers={suppliers}
                    />
                )}

                {isDetailModalOpen && (
                    <KaizenDetailModal
                        isOpen={isDetailModalOpen}
                        setIsOpen={setDetailModalOpen}
                        kaizen={viewingKaizen}
                        onDownloadPDF={handleDownloadPDF}
                    />
                )}

                <KaizenDashboard data={kaizenEntries} loading={loading} />

                <Tabs defaultValue="vehicle_based" className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="vehicle_based">Araç Bazlı Kaizen</TabsTrigger>
                        <TabsTrigger value="general">Genel Kaizen</TabsTrigger>
                    </TabsList>
                    <TabsContent value="vehicle_based">
                        <KaizenList 
                            type="vehicle_based" 
                            data={kaizenEntries.filter(k => k.kaizen_type === 'vehicle_based')}
                            loading={loading}
                            onEdit={openFormModal}
                            onDelete={fetchData}
                            onAdd={() => openFormModal()}
                            onView={openDetailModal}
                        />
                    </TabsContent>
                    <TabsContent value="general">
                        <KaizenList 
                            type="general"
                            data={kaizenEntries.filter(k => k.kaizen_type === 'general')}
                            loading={loading}
                            onEdit={openFormModal}
                            onDelete={fetchData}
                            onAdd={() => openFormModal()}
                            onView={openDetailModal}
                        />
                    </TabsContent>
                </Tabs>
            </motion.div>
        </>
    );
};

export default KaizenManagement;