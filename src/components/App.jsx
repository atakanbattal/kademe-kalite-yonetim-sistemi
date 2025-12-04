import React, { useState, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion, AnimatePresence } from 'framer-motion';
    import Sidebar from '@/components/Sidebar';
    import Dashboard from '@/components/Dashboard';
    import KPIModule from '@/components/KPIModule';
    import QualityCostModule from '@/components/QualityCostModule';
    import QuarantineModule from '@/components/quarantine/QuarantineModule';
    import DFAnd8DModule from '@/components/DFAnd8DModule';
    import InternalAuditModule from '@/components/InternalAuditModule';
    import DocumentModule from '@/components/DocumentModule';
    import SupplierQualityModule from '@/components/SupplierQualityModule';
    import DeviationModule from '@/components/deviation/DeviationModule';
    import EquipmentModule from '@/components/EquipmentModule';
    import ProducedVehiclesModule from '@/components/produced-vehicles/ProducedVehiclesModule';
    import CostSettingsModule from '@/components/CostSettingsModule';
    import { Menu, X } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';
    import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
    import { Toaster } from '@/components/ui/toaster';
    import Login from '@/pages/Login';

    const moduleTitles = {
      dashboard: 'Ana Panel',
      kpi: 'KPI Modülü',
      'quality-cost': 'Kalitesizlik Maliyetleri',
      quarantine: 'Karantina Yönetimi',
      'df-8d': 'DF ve 8D Yönetimi',
      'internal-audit': 'İç Tetkik Yönetimi',
      document: 'Doküman Yönetimi',
      'supplier-quality': 'Tedarikçi Kalite Yönetimi',
      deviation: 'Sapma Yönetimi',
      equipment: 'Ekipman & Kalibrasyon',
      'produced-vehicles': 'Kaliteye Verilen Araçlar',
      'settings': 'Ayarlar',
    };

    const AppContent = () => {
      const { session, loading } = useAuth();
      const [activeModule, setActiveModule] = useState('dashboard');
      const [isSidebarOpen, setSidebarOpen] = useState(true);
      
      const [ncModalState, setNcModalState] = useState({ isOpen: false, type: 'DF', record: null });

      const handleOpenNCForm = useCallback((type, record) => {
        setNcModalState({ isOpen: true, type, record });
        setActiveModule('df-8d');
      }, []);

      const closeNCForm = useCallback(() => {
        setNcModalState({ isOpen: false, type: 'DF', record: null });
      }, []);


      const renderActiveModule = () => {
        switch (activeModule) {
          case 'dashboard':
            return <Dashboard setActiveModule={setActiveModule} />;
          case 'kpi':
            return <KPIModule />;
          case 'quality-cost':
            return <QualityCostModule />;
          case 'quarantine':
            return <QuarantineModule onOpenNCForm={handleOpenNCForm} />;
          case 'df-8d':
            return <DFAnd8DModule initialModalState={ncModalState} onModalClose={closeNCForm} />;
          case 'internal-audit':
            return <InternalAuditModule />;
          case 'document':
            return <DocumentModule />;
          case 'supplier-quality':
            return <SupplierQualityModule onOpenNCForm={handleOpenNCForm} />;
          case 'deviation':
            return <DeviationModule />;
          case 'equipment':
            return <EquipmentModule />;
          case 'produced-vehicles':
            return <ProducedVehiclesModule />;
          case 'settings':
            return <CostSettingsModule />;
          default:
            return <Dashboard setActiveModule={setActiveModule} />;
        }
      };

      const handleModuleChange = (module) => {
        setActiveModule(module);
      };
      
      if (loading) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-secondary">
            <div className="text-foreground">Yükleniyor...</div>
          </div>
        );
      }
      
      if (!session) {
        return <Login />;
      }

      return (
        <>
          <Helmet>
            <title>Kademe A.Ş - Kalite Yönetim Sistemi</title>
            <meta name="description" content="Kademe A.Ş için kapsamlı kalite yönetim sistemi - KPI takibi, DÖF yönetimi, araç kalite kontrolü ve daha fazlası" />
            <meta property="og:title" content="Kademe A.Ş - Kalite Yönetim Sistemi" />
            <meta property="og:description" content="Kademe A.Ş için kapsamlı kalite yönetim sistemi - KPI takibi, DÖF yönetimi, araç kalite kontrolü ve daha fazlası" />
          </Helmet>

          <div className="min-h-screen bg-secondary">
            <div className="flex">
            <AnimatePresence>
                {isSidebarOpen && (
                <motion.div
                    initial={{ x: '-100%', width: 0 }}
                    animate={{ x: 0, width: '16rem' }}
                    exit={{ x: '-100%', width: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed lg:relative z-40 h-screen"
                >
                    <Sidebar 
                    activeModule={activeModule} 
                    setActiveModule={handleModuleChange} 
                    setSidebarOpen={setSidebarOpen}
                    />
                </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <div>
                    <Button size="icon" variant="outline" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                    {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    <span className="sr-only">Menüyü Aç/Kapat</span>
                    </Button>
                </div>
                <h1 className={cn("text-xl font-semibold sm:text-2xl text-foreground", isSidebarOpen && "lg:hidden")}>
                    {moduleTitles[activeModule] || 'Ana Panel'}
                </h1>
                </header>
                
                <motion.main
                key={activeModule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex-1 p-4 sm:p-6"
                >
                {renderActiveModule()}
                </motion.main>
            </div>
            </div>
          </div>
        </>
      );
    }


    function App() {
      return (
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      );
    }

    export default App;