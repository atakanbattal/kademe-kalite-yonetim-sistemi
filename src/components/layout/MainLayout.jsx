import React, { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport as openPrintableReportUtil } from '@/lib/reportUtils';
import { cn } from '@/lib/utils';

// Components (her zaman gerekli - lazy loading yok)
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import NCViewModal from '@/components/df-8d/NCViewModal';
import NCFormModal from '@/components/df-8d/NCFormModal';
import { PageLoader } from '@/components/shared/LoadingSpinner';

// Dashboard direkt yüklenir (ilk görünen sayfa)
import Dashboard from '@/components/dashboard/Dashboard';

// Modules - Lazy Loading (sadece açıldığında yüklenir, performans artışı)
const KPIModule = lazy(() => import('@/components/kpi/KPIModule'));
const QualityCostModule = lazy(() => import('@/components/quality-cost/QualityCostModule'));
const QuarantineModule = lazy(() => import('@/components/quarantine/QuarantineModule'));
const Df8dManagement = lazy(() => import('@/pages/Df8dManagement'));
const InternalAuditModule = lazy(() => import('@/components/audit/InternalAuditModule'));
const DocumentModule = lazy(() => import('@/components/document/DocumentModule'));
const SupplierQualityModule = lazy(() => import('@/components/supplier/QualityModule'));
const DeviationModule = lazy(() => import('@/components/deviation/DeviationModule'));
const EquipmentModule = lazy(() => import('@/components/equipment/EquipmentModule'));
const ProducedVehiclesModule = lazy(() => import('@/components/produced-vehicles/ProducedVehiclesModule'));
const CostSettingsModule = lazy(() => import('@/components/cost-settings/SettingsModule'));
const IncomingQualityModule = lazy(() => import('@/components/incoming-quality/IncomingQualityModule'));
const KaizenManagement = lazy(() => import('@/pages/KaizenManagement'));
const TaskModule = lazy(() => import('@/pages/TaskModule'));
const AuditLogModule = lazy(() => import('@/components/audit/LogModule'));
const SupplierLiveAudit = lazy(() => import('@/pages/SupplierLiveAudit'));
const TrainingModule = lazy(() => import('@/components/training/TrainingModule'));
const WPSModule = lazy(() => import('@/components/wps/WPSModule'));
const CustomerComplaintsModule = lazy(() => import('@/components/customer-complaints/ComplaintsModule'));
const PolyvalenceModule = lazy(() => import('@/components/polyvalence/PolyvalenceModule'));
const BenchmarkModule = lazy(() => import('@/components/benchmark/BenchmarkModule'));
const ProcessControlModule = lazy(() => import('@/components/process-control/ProcessControlModule'));
const DynamicBalanceModule = lazy(() => import('@/components/dynamic-balance/DynamicBalanceModule'));
const NonconformityModule = lazy(() => import('@/components/nonconformity/NonconformityModule'));
const FixtureModule = lazy(() => import('@/components/fixture/FixtureModule'));

// 8D adımları için varsayılan başlıklar
const getDefault8DTitle = (stepKey) => {
    const titles = {
        D1: "Ekip Oluşturma",
        D2: "Problemi Tanımlama",
        D3: "Geçici Önlemler Alma",
        D4: "Kök Neden Analizi",
        D5: "Kalıcı Düzeltici Faaliyetleri Belirleme",
        D6: "Kalıcı Düzeltici Faaliyetleri Uygulama",
        D7: "Tekrarlanmayı Önleme",
        D8: "Ekibi Takdir Etme"
    };
    return titles[stepKey] || stepKey;
};

const moduleTitles = {
    dashboard: 'Ana Panel',
    tasks: 'Görev Yönetimi',
    kpi: 'KPI Modülü',
    kaizen: 'İyileştirme (Kaizen) Modülü',
    'quality-cost': 'Kalite Maliyetleri',
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
    'process-control': 'Proses Kontrol Yönetimi',
    'dynamic-balance': 'Dinamik Balans Kalite Kontrol',
    'nonconformity': 'Uygunsuzluk Yönetimi',
    'fixture': 'Fikstür Takip Modülü',
};

const ALL_MODULES = Object.keys(moduleTitles);

const MainLayout = () => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const effectivePermissions = useMemo(() => {
        if (!user) return {};
        if (user?.email === 'atakan.battal@kademe.com.tr') return Object.fromEntries(ALL_MODULES.map(m => [m, 'full']));
        return profile?.permissions || user?.user_metadata?.permissions || {};
    }, [profile, user]);

    const PERMITTED_MODULES = useMemo(() => {
        if (user?.email === 'atakan.battal@kademe.com.tr') return ALL_MODULES;
        if (Object.keys(effectivePermissions).length > 0) {
            return ALL_MODULES.filter(module => effectivePermissions[module] && effectivePermissions[module] !== 'none');
        }
        return ['dashboard'];
    }, [effectivePermissions, user]);

    const DEFAULT_MODULE = PERMITTED_MODULES.includes('dashboard') ? 'dashboard' : PERMITTED_MODULES[0] || 'dashboard';

    const [activeModule, setActiveModule] = useState(DEFAULT_MODULE);
    // Mobilde sidebar varsayılan olarak kapalı, desktop'ta açık
    const [isSidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1024;
        }
        return true;
    });
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
            // Yetkisiz toast: sadece profile yüklendiyse ve kesin yetkisizse göster (loading sırasında gösterme)
            const perm = effectivePermissions[path];
            if (profile !== null && moduleTitles[path] && (perm === undefined || perm === 'none')) {
                toast({ variant: 'destructive', title: 'Yetkisiz Erişim', description: `"${moduleTitles[path] || path}" modülüne erişim izniniz yok.` });
            }
        } else if (location.pathname === '/') {
            navigate(`/${DEFAULT_MODULE}`, { replace: true });
        }
    }, [location.pathname, DEFAULT_MODULE, navigate, PERMITTED_MODULES, toast, profile, effectivePermissions]);

    const handleModuleChange = (module) => {
        if (PERMITTED_MODULES.includes(module)) {
            setActiveModule(module);
            navigate(`/${module}`);
        } else if (profile !== null) {
            const perm = effectivePermissions[module];
            if (perm === undefined || perm === 'none') {
                toast({ variant: 'destructive', title: 'Yetkisiz Erişim', description: 'Bu modüle erişim izniniz yok.' });
            }
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
                    // Safari uyumluluğu için dosyayı ArrayBuffer olarak oku
                    const arrayBuffer = await file.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

                    const { data, error } = await supabase.storage
                        .from('df_attachments')
                        .upload(filePath, blob, {
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

        const { id, created_at, updated_at, nc_number: old_nc_number, personnel, unit, department_name, responsible_person_name, is_supplier_nc, opening_date, due_date, closing_date, responsible_person_details, requesting_person_details, supplier_name, ...dbData } = formData;

        dbData.attachments = uploadedFilePaths;
        const fieldsToNullify = ['cost_date', 'measurement_unit', 'part_location', 'quantity', 'scrap_weight', 'rework_duration', 'quality_control_duration'];
        fieldsToNullify.forEach(field => {
            if (dbData[field] === '' || dbData[field] === undefined) dbData[field] = null;
        });

        // Kök neden analizlerini kaydet (eğer varsa ve boş değilse)
        if (formData.five_why_analysis && Object.keys(formData.five_why_analysis).length > 0 && Object.values(formData.five_why_analysis).some(v => v && v.toString().trim() !== '')) {
            dbData.five_why_analysis = formData.five_why_analysis;
        } else {
            dbData.five_why_analysis = null;
        }

        if (formData.five_n1k_analysis && Object.keys(formData.five_n1k_analysis).length > 0 && Object.values(formData.five_n1k_analysis).some(v => v && v.toString().trim() !== '')) {
            dbData.five_n1k_analysis = formData.five_n1k_analysis;
        } else {
            dbData.five_n1k_analysis = null;
        }

        if (formData.ishikawa_analysis && Object.keys(formData.ishikawa_analysis).length > 0 && Object.values(formData.ishikawa_analysis).some(v => v && v.toString().trim() !== '')) {
            dbData.ishikawa_analysis = formData.ishikawa_analysis;
        } else {
            dbData.ishikawa_analysis = null;
        }

        if (formData.fta_analysis && Object.keys(formData.fta_analysis).length > 0 && Object.values(formData.fta_analysis).some(v => v && v.toString().trim() !== '')) {
            dbData.fta_analysis = formData.fta_analysis;
        } else {
            dbData.fta_analysis = null;
        }

        // Geçerli non_conformities tablosu kolonlarını tanımla
        const validColumns = new Set([
            'nc_number', 'audit_title', 'title', 'description', 'category', 'department',
            'requesting_person', 'requesting_unit', 'responsible_person', 'status', 'type',
            'opening_date', 'due_date', 'closed_at', 'rejected_at', 'rejection_reason',
            'rejection_notes', 'related_vehicle_id', 'source_cost_id', 'source_finding_id',
            'source_inspection_id', 'source_quarantine_id', 'source_supplier_nc_id',
            'source_inspection_fault_id', 'audit_id', 'created_by', 'updated_by', 'priority',
            'problem_definition', 'closing_notes', 'closing_attachments', 'eight_d_steps',
            'mdi_no', 'attachments', 'part_name', 'part_code', 'production_batch', 'vehicle_type', 'affected_units',
            'amount', 'cost_date', 'cost_type', 'material_type', 'measurement_unit',
            'part_location', 'quantity', 'scrap_weight', 'rework_duration',
            'quality_control_duration', 'responsible_personnel_id', 'chassis_no',
            'supplier_id', 'shipment_impact', 'df_opened_at', 'status_entered_at',
            'due_at', 'reopened_at', 'forwarded_to', 'forwarded_to_personnel_id',
            'forwarded_unit', 'eight_d_progress', 'five_why_analysis', 'five_n1k_analysis',
            'ishikawa_analysis', 'fta_analysis'
        ]);

        // Undefined key'leri ve geçersiz kolonları temizle
        for (const key in dbData) {
            if (dbData[key] === undefined || key === 'undefined' || !validColumns.has(key)) {
                delete dbData[key];
            }
        }

        if (dbData.type !== '8D') {
            dbData.eight_d_steps = null;
            dbData.eight_d_progress = null;
        } else {
            // 8D tipi için eight_d_progress ve eight_d_steps'i senkronize et
            // Eğer eight_d_progress varsa, onu kullan ve eight_d_steps'i güncelle
            if (dbData.eight_d_progress) {
                // eight_d_progress'ten eight_d_steps oluştur (geriye dönük uyumluluk için)
                dbData.eight_d_steps = Object.keys(dbData.eight_d_progress).reduce((acc, key) => {
                    const progress = dbData.eight_d_progress[key];
                    acc[key] = {
                        title: dbData.eight_d_steps?.[key]?.title || getDefault8DTitle(key),
                        completed: progress.completed || false,
                        responsible: progress.responsible || null,
                        completionDate: progress.completionDate || null,
                        description: progress.description || null,
                        evidenceFiles: progress.evidenceFiles || []
                    };
                    return acc;
                }, {});
            }
            // Eğer eight_d_progress yoksa ama eight_d_steps varsa, eight_d_progress oluştur
            else if (dbData.eight_d_steps) {
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
                toast({ variant: 'warning', title: 'Entegrasyon Uyarısı', description: `Tedarikçi NC kontrol edilirken hata: ${fetchError.message}` });
            } else if (!existingSupplierNC) {
                const { error: supplierNCError } = await supabase.from('supplier_non_conformities').insert({ supplier_id: mainNCData.supplier_id, title: mainNCData.title, description: mainNCData.description, status: 'Açık', source_nc_id: mainNCData.id });
                if (supplierNCError) toast({ variant: 'warning', title: 'Entegrasyon Uyarısı', description: `Ana uygunsuzluk açıldı ancak tedarikçi modülüne otomatik yansıtılamadı: ${supplierNCError.message}` });
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

        // Dashboard lazy loading kullanmaz (ilk görünen sayfa)
        if (module === 'dashboard') {
            return <Dashboard setActiveModule={handleModuleChange} onOpenNCView={handleOpenNCView} />;
        }

        // Diğer modüller Suspense ile lazy yüklenir
        const getModuleComponent = () => {
            switch (module) {
                case 'tasks': return <TaskModule />;
                case 'kpi': return <KPIModule />;
                case 'kaizen': return <KaizenManagement />;
                case 'quality-cost': return <QualityCostModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
                case 'quarantine': return <QuarantineModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
                case 'df-8d': return <Df8dManagement onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onDownloadPDF={handleDownloadPDF} />;
                case 'internal-audit': return <InternalAuditModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
                case 'document': return <DocumentModule />;
                case 'supplier-quality': return <SupplierQualityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onOpenPdfViewer={handleOpenPdfViewer} />;
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
                case 'process-control': return <ProcessControlModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
                case 'dynamic-balance': return <DynamicBalanceModule />;
                case 'nonconformity': return <NonconformityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />;
                case 'fixture': return <FixtureModule />;
                default: return <Navigate to={`/${DEFAULT_MODULE}`} replace />;
            }
        };

        return (
            <Suspense fallback={<PageLoader />}>
                {getModuleComponent()}
            </Suspense>
        );
    };

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleOverlayClick = () => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    };

    return (
        <>
            <NCFormModal isOpen={ncFormState.isOpen} setIsOpen={(open) => setNcFormState(s => ({ ...s, isOpen: open }))} record={ncFormState.record} onSave={handleSaveNC} onSaveSuccess={onGlobalSaveSuccess} />
            <NCViewModal isOpen={ncViewState.isOpen} setIsOpen={(open) => setNcViewState(s => ({ ...s, isOpen: open }))} record={ncViewState.record} onEdit={handleOpenNCForm} onDownloadPDF={handleDownloadPDF} />
            <PdfViewerModal isOpen={pdfViewerState.isOpen} setIsOpen={(open) => setPdfViewerState(s => ({ ...s, isOpen: open }))} pdfUrl={pdfViewerState.url} title={pdfViewerState.title} />

            <div className="min-h-screen bg-secondary overflow-x-hidden">
                <div className="flex relative">
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mobile-sidebar-overlay"
                                onClick={handleOverlayClick}
                                aria-hidden="true"
                            />
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="fixed top-0 left-0 w-[280px] sm:w-64 h-screen z-40 lg:relative lg:z-auto flex-shrink-0 shadow-xl lg:shadow-none"
                            >
                                <Sidebar activeModule={activeModule} setActiveModule={handleModuleChange} permittedModules={PERMITTED_MODULES} setSidebarOpen={setSidebarOpen} moduleTitles={moduleTitles} />
                            </motion.aside>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-1 flex-col min-w-0 overflow-hidden basis-0">
                        <header className="mobile-sticky-header flex h-14 items-center gap-3 px-3 sm:px-4 md:px-6 lg:h-16 bg-card border-b border-border">
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setSidebarOpen(!isSidebarOpen)}
                                className="h-10 w-10 shrink-0"
                            >
                                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                <span className="sr-only">Menüyü Aç/Kapat</span>
                            </Button>
                            <h1 className="flex-1 text-base font-semibold sm:text-lg md:text-xl lg:text-2xl text-foreground truncate">
                                {moduleTitles[activeModule] || 'Ana Panel'}
                            </h1>
                        </header>

                        <motion.main
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="flex-1 p-3 sm:p-4 md:p-6 safe-bottom overflow-x-hidden min-w-0"
                        >
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
};

export default MainLayout;
