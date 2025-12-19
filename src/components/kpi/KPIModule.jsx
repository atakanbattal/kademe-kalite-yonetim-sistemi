import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddKpiModal from '@/components/kpi/AddKpiModal';
import KPIDetailModalEnhanced from '@/components/kpi/KPIDetailModalEnhanced';
import KPICard from '@/components/kpi/KPICard';
import { useData } from '@/contexts/DataContext';

const KPIModule = () => {
    const { kpis, loading, refreshKpis, refreshAutoKpis } = useData();
    const { toast } = useToast();
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Sayfa açıldığında otomatik KPI'ları güncelle
    useEffect(() => {
        const updateAutoKpis = async () => {
            if (kpis.length > 0) {
                const hasAutoKpis = kpis.some(kpi => kpi.is_auto);
                if (hasAutoKpis) {
                    console.log('🔄 KPI Modülü açıldı, otomatik KPI\'lar güncelleniyor...');
                    await refreshAutoKpis();
                }
            }
        };
        updateAutoKpis();
    }, []); // Sadece sayfa ilk açıldığında çalış

    const handleAddKpi = () => {
        setAddModalOpen(true);
    };

    const handleCardClick = (kpi) => {
        setSelectedKpi(kpi);
        setDetailModalOpen(true);
    };

    // Manuel yenileme
    const handleManualRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refreshAutoKpis();
            toast({ title: 'Başarılı!', description: 'KPI değerleri güncellendi.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'KPI değerleri güncellenemedi.' });
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshAutoKpis, toast]);

    return (
        <div className="space-y-6">
            <AddKpiModal open={isAddModalOpen} setOpen={setAddModalOpen} refreshKpis={refreshKpis} existingKpis={kpis} />
            {selectedKpi && <KPIDetailModalEnhanced kpi={selectedKpi} open={isDetailModalOpen} setOpen={setDetailModalOpen} refreshKpis={refreshKpis} />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">KPI Modülü</h1>
                    <p className="text-muted-foreground mt-1">Önemli performans göstergelerinizi takip edin.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handleManualRefresh} 
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> 
                        {isRefreshing ? 'Güncelleniyor...' : 'Değerleri Güncelle'}
                    </Button>
                    <Button onClick={handleAddKpi}>
                        <Plus className="w-4 h-4 mr-2" /> Yeni KPI Ekle
                    </Button>
                </div>
            </div>
            
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
                </div>
            ) : (
                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                    }}
                >
                    {kpis.length > 0 ? (
                        kpis.map(kpi => (
                            <KPICard key={kpi.id} kpi={kpi} onCardClick={handleCardClick} />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12">
                            <p className="text-muted-foreground">Henüz KPI eklenmemiş.</p>
                            <Button className="mt-4" onClick={handleAddKpi}>İlk KPI'ınızı Ekleyin</Button>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};

export default KPIModule;