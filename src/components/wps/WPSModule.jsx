import React, { useState, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Plus } from 'lucide-react';
    import WPSFormModal from '@/components/wps/WPSFormModal';
    import WPSList from '@/components/wps/WPSList';
    import { openPrintableReport } from '@/lib/reportUtils';

    const WPSModule = () => {
        const { toast } = useToast();
        const [wpsList, setWpsList] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [selectedWPS, setSelectedWPS] = useState(null);
        const [isViewMode, setIsViewMode] = useState(false);

        const [materials, setMaterials] = useState([]);
        const [fillerMaterials, setFillerMaterials] = useState([]);
        const [shieldingGases, setShieldingGases] = useState([]);

        const fetchWPSData = useCallback(async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('wps_procedures')
                .select(`
                    *,
                    base_material_1:base_material_1_id!left(name, standard, iso_15608_group),
                    base_material_2:base_material_2_id!left(name, standard),
                    filler_material:filler_material_id!left(classification),
                    shielding_gas:shielding_gas_id!left(name),
                    created_by:created_by_id!left(full_name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: 'WPS listesi alınamadı: ' + error.message,
                });
                setWpsList([]);
            } else {
                setWpsList(data);
            }
            setLoading(false);
        }, [toast]);

        const fetchLibraryData = useCallback(async () => {
            const { data: materialsData, error: materialsError } = await supabase.from('wps_materials').select('*');
            if (materialsError) console.error("Error fetching materials", materialsError);
            else setMaterials(materialsData);

            const { data: fillerData, error: fillerError } = await supabase.from('wps_filler_materials').select('*');
            if (fillerError) console.error("Error fetching filler materials", fillerError);
            else setFillerMaterials(fillerData);

            const { data: gasData, error: gasError } = await supabase.from('wps_shielding_gases').select('*');
            if (gasError) console.error("Error fetching shielding gases", gasError);
            else setShieldingGases(gasData);
        }, []);

        useEffect(() => {
            fetchWPSData();
            fetchLibraryData();
        }, [fetchWPSData, fetchLibraryData]);

        const handleOpenModal = (wps = null, viewMode = false) => {
            setSelectedWPS(wps);
            setIsViewMode(viewMode);
            setIsModalOpen(true);
        };

        const handleSuccess = () => {
            setIsModalOpen(false);
            setSelectedWPS(null);
            fetchWPSData();
        };
        
        const handleDownloadPDF = (record) => {
            openPrintableReport(record, 'wps', true);
        };

        return (
            <div className="space-y-6">
                <Helmet>
                    <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
                    <meta name="description" content="Kaynak Prosedür Şartnamelerini (WPS) yönetin." />
                </Helmet>

                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-foreground">WPS Yönetimi</h1>
                    <Button onClick={() => handleOpenModal(null, false)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Yeni WPS Oluştur
                    </Button>
                </div>

                <WPSList
                    wpsList={wpsList}
                    loading={loading}
                    onEdit={(wps) => handleOpenModal(wps, false)}
                    onView={(wps) => handleOpenModal(wps, true)}
                    onDownloadPDF={handleDownloadPDF}
                    refreshData={fetchWPSData}
                />

                {isModalOpen && (
                    <WPSFormModal
                        isOpen={isModalOpen}
                        setIsOpen={setIsModalOpen}
                        onSuccess={handleSuccess}
                        existingWPS={selectedWPS}
                        isViewMode={isViewMode}
                        onDownloadPDF={handleDownloadPDF}
                        library={{ materials, fillerMaterials, shieldingGases }}
                    />
                )}
            </div>
        );
    };

    export default WPSModule;