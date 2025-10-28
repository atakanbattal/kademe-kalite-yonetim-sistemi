import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddKpiModal from '@/components/kpi/AddKpiModal';
import KPIDetailModal from '@/components/kpi/KPIDetailModal';
import KPICard from '@/components/kpi/KPICard';
import { useData } from '@/contexts/DataContext';

const KPIModule = () => {
    const { kpis, loading, refreshData } = useData();
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);

    const handleAddKpi = () => {
        setAddModalOpen(true);
    };

    const handleCardClick = (kpi) => {
        setSelectedKpi(kpi);
        setDetailModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <AddKpiModal open={isAddModalOpen} setOpen={setAddModalOpen} refreshKpis={refreshData} existingKpis={kpis} />
            {selectedKpi && <KPIDetailModal kpi={selectedKpi} open={isDetailModalOpen} setOpen={setDetailModalOpen} refreshKpis={refreshData} />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">KPI Modülü</h1>
                    <p className="text-muted-foreground mt-1">Önemli performans göstergelerinizi takip edin.</p>
                </div>
                <Button onClick={handleAddKpi}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni KPI Ekle
                </Button>
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