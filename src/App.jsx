import React, { useState, useCallback, useEffect, useMemo } from 'react';
    import { HelmetProvider } from 'react-helmet-async';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
    import Sidebar from '@/components/Sidebar';
    import Dashboard from '@/components/Dashboard';
    import KPIModule from '@/components/KPIModule';
    import QualityCostModule from '@/components/quality-cost/QualityCostModule';
    import QuarantineModule from '@/components/quarantine/QuarantineModule';
    import Df8dManagement from '@/pages/Df8dManagement';
    import InternalAuditModule from '@/components/InternalAuditModule';
    import DocumentModule from '@/components/DocumentModule';
    import SupplierQualityModule from '@/components/SupplierQualityModule';
    import DeviationModule from '@/components/deviation/DeviationModule';
    import EquipmentModule from '@/components/EquipmentModule';
    import ProducedVehiclesModule from '@/components/produced-vehicles/ProducedVehiclesModule';
    import CostSettingsModule from '@/components/CostSettingsModule';
    import IncomingQualityModule from '@/components/incoming-quality/IncomingQualityModule';
    import KaizenManagement from '@/pages/KaizenManagement';
    import TaskModule from '@/pages/TaskModule';
    import AuditLogModule from '@/components/AuditLogModule';
    import SupplierLiveAudit from '@/pages/SupplierLiveAudit';
    import SupplierPortalPage from '@/pages/SupplierPortalPage';
    import PrintableReport from '@/pages/PrintableReport';
    import PrintableDashboardReport from '@/pages/PrintableDashboardReport';
    import PrintableInternalAuditDashboard from '@/pages/PrintableInternalAuditDashboard';
    import TrainingModule from '@/components/training/TrainingModule';
    import WPSModule from '@/components/wps/WPSModule';
    import CustomerComplaintsModule from '@/components/CustomerComplaintsModule';
    import PolyvalenceModule from '@/components/PolyvalenceModule';
    import BenchmarkModule from '@/components/benchmark/BenchmarkModule';
    import { Menu, X } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';
    import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
    import { DataProvider, useData } from '@/contexts/DataContext';
    import { Toaster } from '@/components/ui/toaster';
    import Login from '@/pages/Login';
    import NCViewModal from '@/components/df-8d/NCViewModal';
    import { useToast } from '@/components/ui/use-toast';
    import PdfViewerModal from '@/components/document/PdfViewerModal';
    import { NCFormProvider } from '@/contexts/NCFormContext';
    import NCFormModal from '@/components/df-8d/NCFormModal';
    import { supabase } from '@/lib/customSupabaseClient';
    import { v4 as uuidv4 } from 'uuid';
    import { openPrintableReport as openPrintableReportUtil } from '@/lib/reportUtils';

    const moduleTitles = {
      dashboard: 'Ana Panel',
      tasks: 'Görev Yönetimi',
      kpi: 'KPI Modülü',
      kaizen: 'İyileştirme (Kaizen) Modülü',
      'quality-cost': 'Kalitesizlik Maliyetleri',
      quarantine: 'Karantina Yönetimi',
      'df-8d': 'DF ve 8D Yönetimi',
      'internal-audit': 'İç Tetkik Yönetimi',
      document: 'Doküman Yönetimi',
      'supplier-quality': 'Tedarikçi Kalite Yönetimi',
      'supplier-audit': 'Tedarikçi Denetimi',
      'customer-complaints': 'Müşteri Şikayetleri',
      deviation: 'Sapma Yönetimi',
      equipment: 'Ekipman & Kalibrasyon',
      'produced-vehicles': 'Kaliteye Verilen Araçlar',
      'settings': 'Ayarlar',
      'incoming-quality': 'Girdi Kalite Kontrol',
      'wps': 'WPS Yönetimi',
      'audit-logs': 'Denetim Kayıtları',
      'training': 'Eğitim Yönetimi',
      'polyvalence': 'Polivalans Matrisi',
      'benchmark': 'Benchmark Yönetimi',
    };

    const ALL_MODULES = Object.keys(moduleTitles);

    function App() {
      return (
        <HelmetProvider>
          <AuthProvider>
            <DataProvider>
              <NCFormProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/supplier-portal" element={<SupplierPortalPage />} />
                   <Route path="/print/report/:type/:id" element={<AuthProtected><PrintableReport /></AuthProtected>} />
                  <Route path="/print/dashboard-report" element={<AuthProtected><PrintableDashboardReport /></AuthProtected>} />
                  <Route path="/print/internal-audit-dashboard" element={<AuthProtected><PrintableInternalAuditDashboard /></AuthProtected>} />
                  <Route path="/*" element={
                      <AuthProtected>
                          <MainLayout />
                      </AuthProtected>
                  } />
                </Routes>
              </NCFormProvider>
            </DataProvider>
            <Toaster />
          </AuthProvider>
        </HelmetProvider>
      );
    }

    const AuthProtected = ({ children }) => {
        const { session, loading } = useAuth();
        const navigate = useNavigate();
        const location = useLocation();

        useEffect(() => {
            if (!loading && !session) {
                navigate('/login', { state: { from: location } });
            }
        }, [session, loading, navigate, location]);

        if (loading) {
            return (
                <div className="flex items-center justify-center h-screen bg-background">
                    <p>Yükleniyor...</p>
                </div>
            );
        }
        
        if (!session) {
          return null;
        }

        return children;
    };


    const MainLayout = () => {
        const { profile, user } = useAuth();
        const { toast } = useToast();
        const location = useLocation();
        const navigate = useNavigate();
        
        const PERMITTED_MODULES = useMemo(() => {
            if (user?.email === 'atakan.battal@kademe.com.tr') return ALL_MODULES;
            if (profile?.permissions) {
                return ALL_MODULES.filter(module => profile.permissions[module] && profile.permissions[module] !== 'none');
            }
            return ['dashboard'];
        }, [profile, user]);

        const DEFAULT_MODULE = PERMITTED_MODULES.includes('dashboard') ? 'dashboard' : PERMITTED_MODULES[0] || 'dashboard';

        const [activeModule, setActiveModule] = useState(DEFAULT_MODULE);
        const [isSidebarOpen, setSidebarOpen] = useState(true);
        const [ncFormState, setNcFormState] = useState({ isOpen: false, record: null, onSaveSuccess: null });
        const [ncViewState, setNcViewState] = useState({ isOpen: false, record: null });
        const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });
        
        const { refreshData } = useData();

        useEffect(() => {
            const path = location.pathname.split('/')[1] || DEFAULT_MODULE;
            if (PERMITTED_MODULES.includes(path)) {
                setActiveModule(path);
            } else if (path !== '' && !path.startsWith('print')) {
                 navigate(`/${DEFAULT_MODULE}`, { replace: true });
                 // Only show warning if it's an actual access denial, not just restricted access
                 if(moduleTitles[path] && !profile?.permissions?.[path]) {
                    toast({ variant: 'destructive', title: 'Yetkisiz Erişim', description: `"${moduleTitles[path] || path}" modülüne erişim izniniz yok.` });
                 }
            } else if (location.pathname === '/') {
                navigate(`/${DEFAULT_MODULE}`, { replace: true });
            }
        }, [location.pathname, DEFAULT_MODULE, navigate, PERMITTED_MODULES, toast, profile?.permissions]);

        const handleModuleChange = (module) => {
            if (PERMITTED_MODULES.includes(module)) {
                setActiveModule(module);
                navigate(`/${module}`);
            } else if (!profile?.permissions?.[module]) {
                // Only show warning if module is completely denied
                toast({ variant: 'destructive', title: 'Yetkisiz Erişim', description: 'Bu modüle erişim izniniz yok.' });
            }
        };

        const handleOpenPdfViewer = useCallback((url, title) => {
             if (!url) {
                console.error("PDF viewer opened with no url.");
                toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya URLsi bulunamadı.' });
                return;
            }
            setPdfViewerState({ isOpen: true, url, title });
        }, [toast]);
        
        const handleOpenNCForm = useCallback((record, onSaveSuccessCallback) => setNcFormState({ isOpen: true, record, onSaveSuccess: onSaveSuccessCallback }), []);
        const handleOpenNCView = useCallback(async (record) => {
            try {
                // Fetch full record with all data
                const { data: fullRecord, error: fetchError } = await supabase
                    .from('non_conformities')
                    .select('*')
                    .eq('id', record.id)
                    .single();
                
                if (fetchError) {
                    toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk detayları alınamadı.' });
                    return;
                }
                
                // Fetch related audit info if exists
                let auditData = null;
                if (fullRecord?.source_audit_id) {
                    const { data: audit, error: auditError } = await supabase
                        .from('audits')
                        .select('id, report_number, title, audit_date')
                        .eq('id', fullRecord.source_audit_id)
                        .single();
                    if (!auditError && audit) {
                        auditData = audit;
                    }
                }
                
                // Enrich record with audit title
                const enrichedRecord = {
                    ...fullRecord,
                    audit_title: auditData?.title || fullRecord.audit_title || null
                };
                
                setNcViewState({ isOpen: true, record: enrichedRecord });
            } catch (err) {
                console.error('Error opening NC view:', err);
                toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk açılırken hata oluştu.' });
            }
        }, [toast]);

        // Dosya adını normalize et ve güvenli hale getir
        const normalizeFileName = (fileName) => {
            if (!fileName) return 'file';
            
            const turkishToAscii = {
                'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
                'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
            };
            
            let normalized = fileName;
            Object.keys(turkishToAscii).forEach(key => {
                normalized = normalized.replace(new RegExp(key, 'g'), turkishToAscii[key]);
            });
            
            const lastDotIndex = normalized.lastIndexOf('.');
            let name = normalized;
            let ext = '';
            
            if (lastDotIndex > 0 && lastDotIndex < normalized.length - 1) {
                name = normalized.substring(0, lastDotIndex);
                ext = normalized.substring(lastDotIndex + 1);
            }
            
            name = name.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            ext = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            
            if (!ext || ext.length === 0) {
                const originalLastDot = fileName.lastIndexOf('.');
                if (originalLastDot > 0 && originalLastDot < fileName.length - 1) {
                    ext = fileName.substring(originalLastDot + 1).toLowerCase();
                }
            }
            
            if (!ext || ext.length === 0) ext = 'file';
            if (!name || name.length === 0) name = 'file';
            
            return `${name}.${ext}`;
        };

        const createSafeFilePath = (originalFileName, recordId) => {
            const normalizedName = normalizeFileName(originalFileName);
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 9);
            const safeFileName = `${timestamp}-${randomStr}-${normalizedName}`;
            const safeRecordId = String(recordId || 'unknown').replace(/[^a-zA-Z0-9\-_]/g, '-');
            return `${safeRecordId}/${safeFileName}`;
        };

        const handleSaveNC = async (formData, files) => {
          const isEditMode = !!formData.id;
          let uploadedFilePaths = formData.attachments || [];
          if (files && files.length > 0) {
              const recordId = formData.id || uuidv4();
              const uploadPromises = files.map(async (file) => {
                  const originalFileName = file.name || 'unnamed-file';
                  const filePath = createSafeFilePath(originalFileName, recordId);
                  
                  try {
                      const { data, error } = await supabase.storage
                          .from('df_attachments')
                          .upload(filePath, file, {
                              contentType: file.type || 'application/octet-stream',
                              cacheControl: '3600',
                              upsert: false
                          });
                      return { data, error };
                  } catch (err) {
                      return { data: null, error: err };
                  }
              });
              const uploadResults = await Promise.all(uploadPromises);
              const uploadErrors = uploadResults.filter(res => res.error);
              if (uploadErrors.length > 0) {
                   return { data: null, error: { message: `Dosya yüklenemedi: ${uploadErrors[0].error.message}` } };
              }
              const newPaths = uploadResults.map(res => res.data?.path).filter(Boolean);
              uploadedFilePaths = [...(formData.attachments || []), ...newPaths];
          }
          
          const { id, created_at, updated_at, nc_number: old_nc_number, personnel, unit, department_name, responsible_person_name, is_supplier_nc, opening_date, due_date, closing_date, responsible_person_details, requesting_person_details, supplier_name, five_why_analysis, five_n1k_analysis, ishikawa_analysis, fta_analysis, ...dbData } = formData;
          
          dbData.attachments = uploadedFilePaths;
          const fieldsToNullify = ['cost_date', 'measurement_unit', 'part_location', 'quantity', 'scrap_weight', 'rework_duration', 'quality_control_duration'];
          fieldsToNullify.forEach(field => {
              if (dbData[field] === '' || dbData[field] === undefined) dbData[field] = null;
          });
          
          // Analiz kolonlarını temizle (veritabanında bu kolonlar yok)
          delete dbData.five_why_analysis;
          delete dbData.five_n1k_analysis;
          delete dbData.ishikawa_analysis;
          delete dbData.fta_analysis;
          if (dbData.type !== '8D') {
              dbData.eight_d_steps = null;
              dbData.eight_d_progress = null;
          } else {
              // 8D tipi için eight_d_progress'i de kaydet
              // Eğer eight_d_progress yoksa eight_d_steps'ten oluştur
              if (!dbData.eight_d_progress && dbData.eight_d_steps) {
                  dbData.eight_d_progress = Object.keys(dbData.eight_d_steps).reduce((acc, key) => {
                      const step = dbData.eight_d_steps[key];
                      acc[key] = {
                          completed: step.completed || !!(step.responsible && step.completionDate && step.description),
                          responsible: step.responsible || null,
                          completionDate: step.completionDate || null,
                          description: step.description || null,
                          evidenceFiles: step.evidenceFiles || []
                      };
                      return acc;
                  }, {});
              }
          }
          if (dbData.type === 'MDI') dbData.nc_number = null;
          
          let result, mainNCData;
          if (isEditMode) {
              delete dbData.user_id;
              const { data, error } = await supabase.from('non_conformities').update(dbData).eq('id', id).select().single();
              result = { data, error };
              mainNCData = data;
          } else {
              if (dbData.type !== 'MDI') {
                  const { data: rpcData, error: rpcError } = await supabase.rpc('generate_nc_number', { nc_type: dbData.type });
                  if (rpcError) return { data: null, error: rpcError };
                  dbData.nc_number = rpcData;
              }
              const { data, error } = await supabase.from('non_conformities').insert(dbData).select().single();
              result = { data, error };
              mainNCData = data;
          }
          if (!result.error && mainNCData && is_supplier_nc && mainNCData.supplier_id) {
              const { data: existingSupplierNC, error: fetchError } = await supabase.from('supplier_non_conformities').select('id').eq('source_nc_id', mainNCData.id).maybeSingle();
              if (fetchError && fetchError.code !== 'PGRST116') {
                   toast({variant: 'warning', title: 'Entegrasyon Uyarısı', description: `Tedarikçi NC kontrol edilirken hata: ${fetchError.message}`});
              } else if (!existingSupplierNC) {
                   const { error: supplierNCError } = await supabase.from('supplier_non_conformities').insert({ supplier_id: mainNCData.supplier_id, title: mainNCData.title, description: mainNCData.description, status: 'Açık', source_nc_id: mainNCData.id });
                  if (supplierNCError) toast({variant: 'warning', title: 'Entegrasyon Uyarısı', description: `Ana uygunsuzluk açıldı ancak tedarikçi modülüne otomatik yansıtılamadı: ${supplierNCError.message}`});
              }
          }
          return result;
      };

      const onGlobalSaveSuccess = (savedRecord) => {
          refreshData();
          if (ncFormState.onSaveSuccess) ncFormState.onSaveSuccess(savedRecord);
      };

      const handleDownloadPDF = (record, type) => {
          // For types that need full record data, use URL params
          const useUrlParams = ['nonconformity', 'incoming_inspection', 'deviation', 'kaizen', 'quarantine', 'sheet_metal_entry'].includes(type);
          openPrintableReportUtil(record, type, useUrlParams);
      };
      
      const renderModule = (modulePath) => {
          const [module] = modulePath.split('/');
          if (!PERMITTED_MODULES.includes(module)) {
              return <Navigate to={`/${DEFAULT_MODULE}`} replace />;
          }
          switch(module) {
              case 'dashboard': return <Dashboard setActiveModule={setActiveModule} />;
              case 'tasks': return <TaskModule />;
              case 'kpi': return <KPIModule />;
              case 'kaizen': return <KaizenManagement />;
              case 'quality-cost': return <QualityCostModule />;
              case 'quarantine': return <QuarantineModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
              case 'df-8d': return <Df8dManagement onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onDownloadPDF={handleDownloadPDF} />;
              case 'internal-audit': return <InternalAuditModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
              case 'document': return <DocumentModule />;
              case 'supplier-quality': return <SupplierQualityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onOpenPdfViewer={handleOpenPdfViewer}/>;
              case 'customer-complaints': return <CustomerComplaintsModule />;
              case 'supplier-audit': return <SupplierLiveAudit onOpenNCForm={handleOpenNCForm} />;
              case 'deviation': return <DeviationModule />;
              case 'equipment': return <EquipmentModule />;
              case 'produced-vehicles': return <ProducedVehiclesModule onOpenNCForm={handleOpenNCForm} />;
              case 'settings': return <CostSettingsModule />;
              case 'incoming-quality': return <IncomingQualityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
              case 'wps': return <WPSModule />;
              case 'audit-logs': return <AuditLogModule />;
              case 'training': return <TrainingModule onOpenPdfViewer={handleOpenPdfViewer} />;
              case 'polyvalence': return <PolyvalenceModule />;
              case 'benchmark': return <BenchmarkModule />;
              default: return <Navigate to={`/${DEFAULT_MODULE}`} replace />;
          }
      };

        return (
            <>
                <NCFormModal isOpen={ncFormState.isOpen} setIsOpen={(open) => setNcFormState(s => ({ ...s, isOpen: open }))} record={ncFormState.record} onSave={handleSaveNC} onSaveSuccess={onGlobalSaveSuccess} />
                <NCViewModal isOpen={ncViewState.isOpen} setIsOpen={(open) => setNcViewState(s => ({ ...s, isOpen: open }))} record={ncViewState.record} onEdit={handleOpenNCForm} onDownloadPDF={handleDownloadPDF} />
                <PdfViewerModal isOpen={pdfViewerState.isOpen} setIsOpen={(open) => setPdfViewerState(s => ({ ...s, isOpen: open }))} pdfUrl={pdfViewerState.url} title={pdfViewerState.title} />
                
                <div className="min-h-screen bg-secondary">
                    <div className="flex">
                        <AnimatePresence>
                            {isSidebarOpen && (
                            <motion.aside
                                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="fixed top-0 left-0 w-64 h-screen z-40 lg:relative lg:w-64 flex-shrink-0"
                            >
                                <Sidebar activeModule={activeModule} setActiveModule={handleModuleChange} permittedModules={PERMITTED_MODULES} setSidebarOpen={setSidebarOpen} />
                            </motion.aside>
                            )}
                        </AnimatePresence>
                        <div className="flex flex-1 flex-col min-w-0">
                            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                                <Button size="icon" variant="outline" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                                    {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                    <span className="sr-only">Menüyü Aç/Kapat</span>
                                </Button>
                                <h1 className={cn("text-xl font-semibold sm:text-2xl text-foreground", isSidebarOpen && "lg:hidden")}>
                                    {moduleTitles[activeModule] || 'Ana Panel'}
                                </h1>
                            </header>
                            <motion.main key={location.pathname} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex-1 p-4 sm:p-6">
                                <Routes>
                                    {PERMITTED_MODULES.map(mod => <Route key={mod} path={mod} element={renderModule(mod)} />)}
                                    <Route path="supplier-audit/:auditId" element={renderModule('supplier-audit/:auditId')} />
                                    <Route path="/" element={<Navigate to={`/${DEFAULT_MODULE}`} replace />} />
                                    <Route path="*" element={<Navigate to={`/${DEFAULT_MODULE}`} replace />} />
                                </Routes>
                            </motion.main>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    export default App;