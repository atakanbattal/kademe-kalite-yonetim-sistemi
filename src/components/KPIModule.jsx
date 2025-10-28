import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import KPICard from '@/components/kpi/KPICard';
import KPIDetailModal from '@/components/kpi/KPIDetailModal';
import AddKpiModal from '@/components/kpi/AddKpiModal';
import KpiSettingsModal from '@/components/kpi/KpiSettingsModal';
const KPIModule = () => {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const {
    toast
  } = useToast();
  const fetchKpis = useCallback(async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from('kpis').select('*').order('created_at');
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Hata!',
        description: 'KPI verileri alınamadı.'
      });
      setKpis([]);
    } else {
      setKpis(data);
    }
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);
  const handleCardClick = kpi => {
    setSelectedKpi(kpi);
    setDetailModalOpen(true);
  };
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">KPI Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Bölüm bazlı KPI hedef ve gerçekleşme oranları.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
           <Button onClick={() => setAddModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Yeni KPI Ekle</Button>
           <Button variant="outline" size="icon" onClick={() => setSettingsModalOpen(true)}><Settings className="w-4 h-4" /></Button>
        </div>
      </div>

      {loading ? <div className="text-center p-8 text-muted-foreground">Yükleniyor...</div> : kpis.length === 0 ? <div className="text-center py-10 text-muted-foreground bg-card rounded-lg">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Henüz KPI oluşturulmamış</h3>
            <p className="mt-1 text-sm text-gray-500">Başlamak için yeni bir KPI ekleyin.</p>
            <div className="mt-6">
                <Button onClick={() => setAddModalOpen(true)}>
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Yeni KPI Ekle
                </Button>
            </div>
        </div> : <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {kpis.map(kpi => <KPICard key={kpi.id} kpi={kpi} onCardClick={handleCardClick} />)}
          </AnimatePresence>
        </motion.div>}

      {selectedKpi && <KPIDetailModal kpi={selectedKpi} open={isDetailModalOpen} setOpen={setDetailModalOpen} refreshKpis={fetchKpis} />}
      <AddKpiModal open={isAddModalOpen} setOpen={setAddModalOpen} refreshKpis={fetchKpis} existingKpis={kpis} />
      <KpiSettingsModal open={isSettingsModalOpen} setOpen={setSettingsModalOpen} refreshKpis={fetchKpis} />
    </div>;
};
export default KPIModule;