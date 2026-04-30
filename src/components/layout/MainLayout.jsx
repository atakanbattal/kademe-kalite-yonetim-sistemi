import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport as openPrintableReportUtil } from '@/lib/reportUtils';
import { cn } from '@/lib/utils';
import { canonicalizeDepartmentName } from '@/lib/departmentCanonicalization';
import { buildShortGirdiKaliteNcTitle, isVerboseGirdiKaliteNcTitle, condenseNonConformityTitleString } from '@/lib/df8dTextUtils';
import { getAuditNavigationAction } from '@/lib/auditDeepLink';

// Components (her zaman gerekli - lazy loading yok)
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import NCViewModal from '@/components/df-8d/NCViewModal';
import NCFormModal from '@/components/df-8d/NCFormModal';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Dashboard direkt yüklenir (ilk görünen sayfa)
import Dashboard from '@/components/dashboard/Dashboard';

// Modules — lazy + chunk hatasında bir kez yenile (eski index.html / silinmiş chunk)
const KPIModule = lazyWithRetry(() => import('@/components/kpi/KPIModule'));
const QualityCostModule = lazyWithRetry(() => import('@/components/quality-cost/QualityCostModule'));
const QuarantineModule = lazyWithRetry(() => import('@/components/quarantine/QuarantineModule'));
const Df8dManagement = lazyWithRetry(() => import('@/pages/Df8dManagement'));
const InternalAuditModule = lazyWithRetry(() => import('@/components/audit/InternalAuditModule'));
const DocumentModule = lazyWithRetry(() => import('@/components/document/DocumentModule'));
const SupplierQualityModule = lazyWithRetry(() => import('@/components/supplier/QualityModule'));
const DeviationModule = lazyWithRetry(() => import('@/components/deviation/DeviationModule'));
const EquipmentModule = lazyWithRetry(() => import('@/components/equipment/EquipmentModule'));
const ProducedVehiclesModule = lazyWithRetry(() => import('@/components/produced-vehicles/ProducedVehiclesModule'));
const CostSettingsModule = lazyWithRetry(() => import('@/components/cost-settings/SettingsModule'));
const IncomingQualityModule = lazyWithRetry(() => import('@/components/incoming-quality/IncomingQualityModule'));
const KaizenManagement = lazyWithRetry(() => import('@/pages/KaizenManagement'));
const TaskModule = lazyWithRetry(() => import('@/pages/TaskModule'));
const AuditLogModule = lazyWithRetry(() => import('@/components/audit/LogModule'));
const SupplierLiveAudit = lazyWithRetry(() => import('@/pages/SupplierLiveAudit'));
const TrainingModule = lazyWithRetry(() => import('@/components/training/TrainingModule'));
const WPSModule = lazyWithRetry(() => import('@/components/wps/WPSModule'));
const CustomerComplaintsModule = lazyWithRetry(() => import('@/components/customer-complaints/ComplaintsModule'));
const PolyvalenceModule = lazyWithRetry(() => import('@/components/polyvalence/PolyvalenceModule'));
const BenchmarkModule = lazyWithRetry(() => import('@/components/benchmark/BenchmarkModule'));
const ProcessControlModule = lazyWithRetry(() => import('@/components/process-control/ProcessControlModule'));
const DynamicBalanceModule = lazyWithRetry(() => import('@/components/dynamic-balance/DynamicBalanceModule'));
const NonconformityModule = lazyWithRetry(() => import('@/components/nonconformity/NonconformityModule'));
const FixtureModule = lazyWithRetry(() => import('@/components/fixture/FixtureModule'));
const LeakTestModule = lazyWithRetry(() => import('@/components/leak-test/LeakTestModule'));
const ExternalDocumentsModule = lazyWithRetry(() => import('@/components/external-docs/ExternalDocumentsModule'));
const FmeaModule = lazyWithRetry(() => import('@/components/fmea/FmeaModule'));
const ControlFormsModule = lazyWithRetry(() => import('@/components/control-forms/ControlFormsModule'));

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
    document: 'İç Kaynaklı Doküman Yönetimi',
    'external-docs': 'Dış Kaynaklı Doküman Yönetimi',
    'supplier-quality': 'Tedarikçi Kalite Yönetimi',
    'supplier-audit': 'Tedarikçi Denetimi',
    'customer-complaints': 'Satış Sonrası Hizmetler',
    deviation: 'Sapma Yönetimi',
    equipment: 'Ekipman & Kalibrasyon',
    'produced-vehicles': 'Kaliteye Verilen Araçlar',
    'settings': 'Ayarlar',
    'incoming-quality': 'Girdi Kalite Kontrol',
    'leak-test': 'Sızdırmazlık Kontrol',
    'wps': 'WPS Yönetimi',
    'audit-logs': 'Denetim Kayıtları',
    'training': 'Eğitim Yönetimi',
    'polyvalence': 'Polivalans Matrisi',
    'benchmark': 'Benchmark Yönetimi',
    'process-control': 'Proses Kontrol Yönetimi',
    'dynamic-balance': 'Dinamik Balans Kalite Kontrol',
    'nonconformity': 'Uygunsuzluk Yönetimi',
    'fixture': 'Fikstür Takip Modülü',
    'fmea': 'FMEA',
    'control-forms': 'Kontrol Formları',
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
        const p = { ...(profile?.permissions || user?.user_metadata?.permissions || {}) };
        if (p['external-docs'] == null && (p.document === 'read' || p.document === 'full')) {
            p['external-docs'] = p.document;
        }
        return p;
    }, [profile, user]);

    const permissionsReady = useMemo(() => {
        if (!user) return false;
        if (user.email === 'atakan.battal@kademe.com.tr') return true;
        return profile !== null || Object.keys(user.user_metadata?.permissions || {}).length > 0;
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

    const { refreshData, unitCostSettings, personnel } = useData();

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

    const handleModuleChange = useCallback((module) => {
        if (PERMITTED_MODULES.includes(module)) {
            setActiveModule(module);
            navigate(`/${module}`);
        } else if (profile !== null) {
            const perm = effectivePermissions[module];
            if (perm === undefined || perm === 'none') {
                toast({ variant: 'destructive', title: 'Yetkisiz Erişim', description: 'Bu modüle erişim izniniz yok.' });
            }
        }
    }, [PERMITTED_MODULES, navigate, profile, effectivePermissions, toast]);

    const handleOpenPdfViewer = useCallback((url, title) => {
        if (!url) {
            console.error("PDF viewer opened with no url.");
            toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya URLsi bulunamadı.' });
            return;
        }
        setPdfViewerState({ isOpen: true, url, title });
    }, [toast]);

    const handleOpenNCForm = useCallback((record, onSaveSuccessCallback) => setNcFormState({ isOpen: true, record, onSaveSuccess: onSaveSuccessCallback }), []);

    // Çok hızlı ardışık tıklamalarda Supabase cevaplarının sırasız dönmesi hâlinde
    // eski isteklerin yeni tıklamanın state'ini ezmesini engelliyoruz.
    const ncViewRequestIdRef = useRef(0);

    const handleOpenNCView = useCallback(async (record) => {
        if (!record?.id) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk kaydı için geçerli bir ID bulunamadı.' });
            return;
        }
        const requestedId = record.id;
        const myRequestId = ++ncViewRequestIdRef.current;
        // Önceki modal'da kalmış kaydın içeriğinin sızmasını önlemek için state'i hemen temizle.
        setNcViewState({ isOpen: false, record: null });
        console.debug('[handleOpenNCView] requested', { requestedId, nc_number: record.nc_number || record.mdi_no });

        try {
            const { data: fullRecord, error: fetchError } = await supabase
                .from('non_conformities')
                .select('*')
                .eq('id', requestedId)
                .single();

            if (fetchError) {
                if (ncViewRequestIdRef.current === myRequestId) {
                    setNcViewState({ isOpen: false, record: null });
                    toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk detayları alınamadı.' });
                }
                return;
            }

            if (fullRecord?.id !== requestedId) {
                console.error('[handleOpenNCView] ID mismatch', { requestedId, returnedId: fullRecord?.id });
                if (ncViewRequestIdRef.current === myRequestId) {
                    setNcViewState({ isOpen: false, record: null });
                    toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk kaydı eşleşmedi. Sayfayı yenileyip tekrar deneyin.' });
                }
                return;
            }

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

            const enrichedRecord = {
                ...fullRecord,
                audit_title: auditData?.title || fullRecord.audit_title || null
            };

            if (ncViewRequestIdRef.current !== myRequestId) {
                console.debug('[handleOpenNCView] stale response ignored', { requestedId, current: ncViewRequestIdRef.current, mine: myRequestId });
                return;
            }
            console.debug('[handleOpenNCView] applying', { id: enrichedRecord.id, nc_number: enrichedRecord.nc_number || enrichedRecord.mdi_no });
            setNcViewState({ isOpen: true, record: enrichedRecord });
        } catch (err) {
            console.error('Error opening NC view:', err);
            if (ncViewRequestIdRef.current === myRequestId) {
                setNcViewState({ isOpen: false, record: null });
                toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk açılırken hata oluştu.' });
            }
        }
    }, [toast]);

    const handleCloseNCView = useCallback(() => {
        // Modal kapatılırken request counter'ı ilerlet: bu sayede yarıda kalmış fetch'ler
        // kapalı bir modal'ı tekrar açamaz.
        ncViewRequestIdRef.current += 1;
        setNcViewState({ isOpen: false, record: null });
    }, []);

    const handleNcRecordUpdated = useCallback(
        async (recordId) => {
            refreshData();
            if (!recordId) return;
            try {
                const { data: fullRecord, error: fetchError } = await supabase
                    .from('non_conformities')
                    .select('*')
                    .eq('id', recordId)
                    .single();

                if (fetchError || !fullRecord || fullRecord.id !== recordId) return;

                let auditData = null;
                if (fullRecord.source_audit_id) {
                    const { data: audit, error: auditError } = await supabase
                        .from('audits')
                        .select('id, report_number, title, audit_date')
                        .eq('id', fullRecord.source_audit_id)
                        .single();
                    if (!auditError && audit) auditData = audit;
                }

                const enrichedRecord = {
                    ...fullRecord,
                    audit_title: auditData?.title || fullRecord.audit_title || null,
                };

                setNcViewState((s) => {
                    if (!s.isOpen || s.record?.id !== recordId) return s;
                    return { ...s, record: enrichedRecord };
                });
            } catch (err) {
                console.error('handleNcRecordUpdated:', err);
            }
        },
        [refreshData]
    );

    const handleAuditDeepLink = useCallback(
        async (log) => {
            const action = getAuditNavigationAction(log);
            if (action.kind === 'none') return;
            if (action.kind === 'openNcView') {
                await handleOpenNCView({ id: action.recordId });
                return;
            }
            if (action.kind === 'navigate') {
                if (!PERMITTED_MODULES.includes(action.module)) {
                    toast({
                        variant: 'destructive',
                        title: 'Yetkisiz Erişim',
                        description: 'Bu kayda ait modüle erişim izniniz yok.',
                    });
                    return;
                }
                const q = new URLSearchParams(action.query);
                navigate(`/${action.module}?${q.toString()}`);
            }
        },
        [handleOpenNCView, navigate, PERMITTED_MODULES, toast]
    );

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
        const isSourceTemplate = Boolean(
            !formData?.created_at &&
            !formData?.nc_number &&
            !formData?.mdi_no &&
            (
                formData?.source_cost_id ||
                formData?.source_quarantine_id ||
                formData?.source_supplier_nc_id ||
                formData?.source_inspection_id ||
                formData?.source_finding_id ||
                formData?.source_inspection_fault_id ||
                formData?.source_kpi_id
            )
        );
        const isEditMode = !!formData.id && !isSourceTemplate;
        let uploadedFilePaths = formData.attachments || [];
        /** İlk kayıtta dosya yolu `formData.id klasörü/...`; insert satırı aynı id ile yapılmalı (aksi halde klasör ile row.id kayar). */
        let uploadFolderId = formData.id ?? null;

        if (files && files.length > 0) {
            if (!uploadFolderId) {
                uploadFolderId = uuidv4();
            }
            const recordId = uploadFolderId;
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

        const { id, created_at, updated_at, nc_number: old_nc_number, personnel: _omitFormPersonnel, unit, department_name, responsible_person_name, is_supplier_nc, opening_date, due_date, closing_date, responsible_person_details, requesting_person_details, supplier_name, ...dbData } = formData;

        if (dbData.source_inspection_id && isVerboseGirdiKaliteNcTitle(dbData.title)) {
            dbData.title = buildShortGirdiKaliteNcTitle({
                supplierName: supplier_name,
                partName: dbData.part_name,
                partCode: dbData.part_code,
            });
        }
        if (dbData.title && typeof dbData.title === 'string') {
            dbData.title = condenseNonConformityTitleString(dbData.title);
        }

        const deptCanonCtx = { unitCostSettings: unitCostSettings || [], personnel: personnel || [] };
        if (dbData.department) dbData.department = canonicalizeDepartmentName(dbData.department, deptCanonCtx);
        if (dbData.requesting_unit) dbData.requesting_unit = canonicalizeDepartmentName(dbData.requesting_unit, deptCanonCtx);
        if (dbData.forwarded_unit) dbData.forwarded_unit = canonicalizeDepartmentName(dbData.forwarded_unit, deptCanonCtx);

        dbData.attachments = uploadedFilePaths;
        // Yeni kayıtta dosyalar uploadFolderId klasörüne yüklenir; satır id'si buna eşit olmalı.
        // formData.id şablon/kopya kalıntısı dolu olsa bile (!id) diye atlamak, INSERT'in başka uuid
        // üretmesine ve kanıtların yanlış kayda görünmesine yol açar.
        if (!isEditMode && uploadFolderId && files && files.length > 0) {
            dbData.id = uploadFolderId;
        }
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
            'id',
            'nc_number', 'audit_title', 'title', 'description', 'category', 'department',
            'requesting_person', 'requesting_unit', 'responsible_person', 'status', 'type',
            'opening_date', 'due_date', 'closed_at', 'rejected_at', 'rejection_reason',
            'rejection_notes', 'related_vehicle_id', 'source_cost_id', 'source_finding_id',
            'source_inspection_id', 'source_quarantine_id', 'source_supplier_nc_id',
            'source_inspection_fault_id', 'source_kpi_id', 'source_kpi_year', 'source_kpi_month',
            'audit_id', 'created_by', 'updated_by', 'priority',
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

        // Yarış / kayıt-arası sızıntı koruması (savunma katmanı):
        // EvidenceUploader'daki async upload bittiğinde başka kayda geçilmiş olsaydı,
        // dosya yolu `nc-evidence/{eski-id}/...` olduğu hâlde yeni kaydın
        // eight_d_progress JSONB'sine yazılabilirdi. Burada güncel kaydın id'sine
        // ait olmayan kanıt yollarını kaydetmeden önce ayıkla. attachments için de
        // aynısını uygula. Yenilenen kayıtlarda (insert) henüz id netleşmediği için
        // sadece edit yolunda doğrulama yapıyoruz.
        const expectedRecordId = isEditMode ? id : (dbData.id || null);
        if (expectedRecordId) {
            const dropped = [];
            const evidencePrefix = `nc-evidence/${expectedRecordId}/`;
            const attachmentPrefix = `${expectedRecordId}/`;

            // attachments: `{recordId}/...` formatında olmalı
            if (Array.isArray(dbData.attachments)) {
                const before = dbData.attachments.length;
                dbData.attachments = dbData.attachments.filter((entry) => {
                    const p = typeof entry === 'string' ? entry : entry?.path;
                    if (!p) return true; // tipi anlaşılmıyorsa dokunma
                    if (p.startsWith(attachmentPrefix)) return true;
                    // Mevcut kayıtlardaki "klasör id farklı" durumlar (tarihsel) için:
                    // kökünde uuid bulunmayan eski yolları (legacy) silme.
                    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(p)) return true;
                    dropped.push({ kind: 'attachment', path: p });
                    return false;
                });
                if (before !== dbData.attachments.length) {
                    uploadedFilePaths = dbData.attachments;
                }
            }
            if (Array.isArray(dbData.closing_attachments)) {
                dbData.closing_attachments = dbData.closing_attachments.filter((entry) => {
                    const p = typeof entry === 'string' ? entry : entry?.path;
                    if (!p) return true;
                    // Kapanış ekleri bucket'ı 'nc_closing_attachments/{recordId}/...' biçimindedir
                    if (p.startsWith(attachmentPrefix)) return true;
                    if (p.startsWith(`nc_closing_attachments/${expectedRecordId}/`)) return true;
                    if (!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(p)) return true;
                    dropped.push({ kind: 'closing_attachment', path: p });
                    return false;
                });
            }

            // eight_d_progress[stepKey].evidenceFiles: yol `nc-evidence/{recordId}/...`
            if (dbData.eight_d_progress && typeof dbData.eight_d_progress === 'object') {
                Object.keys(dbData.eight_d_progress).forEach((stepKey) => {
                    const step = dbData.eight_d_progress[stepKey];
                    if (!step || !Array.isArray(step.evidenceFiles)) return;
                    step.evidenceFiles = step.evidenceFiles.filter((f) => {
                        const p = typeof f === 'string' ? f : f?.path;
                        if (!p) return true;
                        if (p.startsWith(evidencePrefix)) return true;
                        // Eski 'nc-evidence/unknown/...' yollarını koru (yeni kayıttan gelmiş olabilir)
                        if (p.startsWith('nc-evidence/unknown/')) return true;
                        // UUID içermeyen tarihsel yollar dokunma
                        if (!/nc-evidence\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(p)) return true;
                        dropped.push({ kind: 'evidence', stepKey, path: p });
                        return false;
                    });
                });
                // eight_d_steps senkron tutulduğu için onu da yeniden üret
                if (dbData.eight_d_steps && typeof dbData.eight_d_steps === 'object') {
                    Object.keys(dbData.eight_d_progress).forEach((stepKey) => {
                        if (dbData.eight_d_steps[stepKey]) {
                            dbData.eight_d_steps[stepKey].evidenceFiles =
                                dbData.eight_d_progress[stepKey]?.evidenceFiles || [];
                        }
                    });
                }
            }

            if (dropped.length > 0) {
                console.warn('[handleSaveNC] yabancı kayıt id\'sine ait dosya yolları kaydetmeden önce ayıklandı', {
                    expectedRecordId,
                    dropped,
                });
                toast({
                    variant: 'warning',
                    title: 'Uyarı',
                    description: `${dropped.length} adet kanıt/dosya bağlantısı bu kayda ait olmadığı için temizlendi. (Detay konsolda)`,
                });
            }
        }

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
        // nonconformity: her zaman /print üzerinden id ile DB'den tam kayıt (localStorage kotası / sekme sorunu önlenir)
        const useUrlParams = ['incoming_inspection', 'deviation', 'kaizen', 'quarantine', 'sheet_metal_entry'].includes(type);
        return openPrintableReportUtil(record, type, useUrlParams);
    };

    // Modül bileşenlerini stable referanslarla map'liyoruz; her render'da yeni JSX
    // (yeni element identity) oluşmasın diye memoize ediyoruz. Aksi takdirde
    // <Routes> her render'da modülü yeniden mount ediyor — sayfa geçişi takılıyordu.
    const moduleElements = useMemo(() => ({
        dashboard: <Dashboard setActiveModule={handleModuleChange} onOpenNCView={handleOpenNCView} />,
        tasks: <TaskModule />,
        kpi: <KPIModule onOpenNCForm={handleOpenNCForm} />,
        kaizen: <KaizenManagement />,
        'quality-cost': <QualityCostModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        quarantine: <QuarantineModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        'df-8d': <Df8dManagement onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onDownloadPDF={handleDownloadPDF} />,
        'internal-audit': <InternalAuditModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        document: <DocumentModule />,
        'external-docs': <ExternalDocumentsModule />,
        'supplier-quality': <SupplierQualityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} onOpenPdfViewer={handleOpenPdfViewer} />,
        'customer-complaints': <CustomerComplaintsModule />,
        'supplier-audit': <SupplierLiveAudit onOpenNCForm={handleOpenNCForm} />,
        deviation: <DeviationModule />,
        equipment: <EquipmentModule />,
        'produced-vehicles': <ProducedVehiclesModule onOpenNCForm={handleOpenNCForm} />,
        settings: <CostSettingsModule />,
        'incoming-quality': <IncomingQualityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        'leak-test': <LeakTestModule />,
        wps: <WPSModule />,
        'audit-logs': <AuditLogModule onOpenRelatedRecord={handleAuditDeepLink} />,
        training: <TrainingModule onOpenPdfViewer={handleOpenPdfViewer} />,
        polyvalence: <PolyvalenceModule />,
        benchmark: <BenchmarkModule />,
        'process-control': <ProcessControlModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        'dynamic-balance': <DynamicBalanceModule />,
        nonconformity: <NonconformityModule onOpenNCForm={handleOpenNCForm} onOpenNCView={handleOpenNCView} />,
        fixture: <FixtureModule />,
        fmea: <FmeaModule />,
        'control-forms': <ControlFormsModule />,
    }), [handleAuditDeepLink, handleOpenNCForm, handleOpenNCView, handleOpenPdfViewer]);

    const renderModule = (modulePath) => {
        const [module] = modulePath.split('/');
        if (!PERMITTED_MODULES.includes(module)) {
            return <Navigate to={`/${DEFAULT_MODULE}`} replace />;
        }
        if (module === 'dashboard') {
            return moduleElements.dashboard;
        }
        const element = moduleElements[module];
        if (!element) return <Navigate to={`/${DEFAULT_MODULE}`} replace />;
        return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
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

    if (!permissionsReady) {
        return <PageLoader />;
    }

    return (
        <>
            <NCFormModal isOpen={ncFormState.isOpen} setIsOpen={(open) => setNcFormState(s => ({ ...s, isOpen: open }))} record={ncFormState.record} onSave={handleSaveNC} onSaveSuccess={onGlobalSaveSuccess} />
            <NCViewModal isOpen={ncViewState.isOpen} setIsOpen={(open) => { if (!open) handleCloseNCView(); else setNcViewState(s => ({ ...s, isOpen: true })); }} record={ncViewState.record} onEdit={handleOpenNCForm} onDownloadPDF={handleDownloadPDF} onNcRecordUpdated={handleNcRecordUpdated} />
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

                        {/* `key={location.pathname}` eklenmemeli — yoksa her sayfa geçişinde
                            tüm içerik unmount/remount oluyor (Suspense fallback yeniden
                            tetikleniyor, lazy modül yeniden yükleniyor, modal/filtre
                            state'i sıfırlanıyor). Animasyonu kaldırıp doğal route geçişini
                            kullanmak hem akıcı hem ucuz. */}
                        <main className="flex-1 p-3 sm:p-4 md:p-6 safe-bottom overflow-x-hidden min-w-0">
                            <Routes>
                                {PERMITTED_MODULES.map(mod => <Route key={mod} path={mod} element={renderModule(mod)} />)}
                                <Route path="supplier-audit/:auditId" element={renderModule('supplier-audit/:auditId')} />
                                <Route path="/" element={<Navigate to={`/${DEFAULT_MODULE}`} replace />} />
                                <Route path="*" element={<Navigate to={`/${DEFAULT_MODULE}`} replace />} />
                            </Routes>
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MainLayout;
