
import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, Download } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import IncomingInspectionList from '@/components/incoming-quality/IncomingInspectionList';
import IncomingQualityDashboard from '@/components/incoming-quality/IncomingQualityDashboard';
import { openPrintableReport } from '@/lib/reportUtils';
import { useData } from '@/contexts/DataContext';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import {
  normalizeIncomingPartCode,
  buildControlPlanNormalizedKeySet,
} from '@/lib/incomingQualityPartCodes';
import IncomingQualityFolderDownloadModal from '@/components/incoming-quality/IncomingQualityFolderDownloadModal';

const ControlPlanManagement = lazy(() => import('@/components/incoming-quality/ControlPlanManagement'));
const InkrManagement = lazy(() => import('@/components/incoming-quality/InkrManagement'));
const SheetMetalManagement = lazy(() => import('@/components/incoming-quality/SheetMetalManagement'));
const StockRiskControlList = lazy(() => import('@/components/incoming-quality/StockRiskControlList'));
const IncomingInspectionFormModal = lazy(() => import('@/components/incoming-quality/IncomingInspectionFormModal'));
const IncomingInspectionDecisionModal = lazy(() => import('@/components/incoming-quality/IncomingInspectionDecisionModal'));
const StockRiskControlModal = lazy(() => import('@/components/incoming-quality/StockRiskControlModal'));
const ControlPlanDetailModal = lazy(() => import('@/components/incoming-quality/ControlPlanDetailModal'));
const InkrDetailModal = lazy(() => import('@/components/incoming-quality/InkrDetailModal'));
const StockRiskDetailModal = lazy(() => import('@/components/incoming-quality/StockRiskDetailModal'));

const PAGE_SIZE = 20;
const DASHBOARD_FETCH_LIMIT = 1000;

const TabFallback = () => (
    <div className="flex items-center justify-center py-12 text-muted-foreground">Yükleniyor...</div>
);

const IncomingQualityModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const { suppliers, incomingControlPlans, inkrReports, refreshData: globalRefresh, refreshEquipment, characteristics, equipment } = useData();

    const activeIncomingControlPlans = useMemo(
        () => (incomingControlPlans || []).filter((p) => p.is_current !== false),
        [incomingControlPlans]
    );

    const controlPlansRef = useRef(activeIncomingControlPlans);
    const inkrReportsRef = useRef(inkrReports);
    useEffect(() => { controlPlansRef.current = activeIncomingControlPlans; }, [activeIncomingControlPlans]);
    useEffect(() => { inkrReportsRef.current = inkrReports; }, [inkrReports]);

    const controlPlanKeys = useMemo(
        () => buildControlPlanNormalizedKeySet(activeIncomingControlPlans),
        [activeIncomingControlPlans]
    );
    const inkrKeys = useMemo(
        () => buildControlPlanNormalizedKeySet(inkrReports),
        [inkrReports]
    );

    useEffect(() => {
        refreshEquipment?.();
    }, [refreshEquipment]);
    
    const [inspections, setInspections] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [inkrMissingCount, setInkrMissingCount] = useState(0);
    const [controlPlanMissingCount, setControlPlanMissingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [activeTab, setActiveTab] = useState('inspections');
    const mountedTabsRef = useRef(new Set(['inspections']));

    const [isFormOpen, setFormOpen] = useState(false);
    const [isDecisionModalOpen, setDecisionModalOpen] = useState(false);
    const [stockRiskData, setStockRiskData] = useState(null);
    const [stockRiskModalOpen, setStockRiskModalOpen] = useState(false);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: '', title: '' });
    const [selectedControlPlan, setSelectedControlPlan] = useState(null);
    const [isControlPlanDetailOpen, setIsControlPlanDetailOpen] = useState(false);
    const [selectedInkr, setSelectedInkr] = useState(null);
    const [isInkrDetailOpen, setIsInkrDetailOpen] = useState(false);
    const [selectedStockRisk, setSelectedStockRisk] = useState(null);
    const [isStockRiskDetailOpen, setIsStockRiskDetailOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isReportSelectionModalOpen, setIsReportSelectionModalOpen] = useState(false);
    const [isFolderDownloadOpen, setIsFolderDownloadOpen] = useState(false);

    const [filters, setFilters] = useState({
        searchTerm: '',
        dateRange: null,
        decision: 'all',
        supplier: 'all',
        controlPlanStatus: 'all',
        inkrStatus: 'all',
    });

    const searchDebounceRef = useRef(null);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    useEffect(() => {
        const hasSearchChange = filters.searchTerm !== debouncedFilters.searchTerm;
        const otherFiltersChanged =
            filters.dateRange !== debouncedFilters.dateRange ||
            filters.decision !== debouncedFilters.decision ||
            filters.supplier !== debouncedFilters.supplier ||
            filters.controlPlanStatus !== debouncedFilters.controlPlanStatus ||
            filters.inkrStatus !== debouncedFilters.inkrStatus;

        if (otherFiltersChanged) {
            clearTimeout(searchDebounceRef.current);
            setDebouncedFilters(filters);
            return;
        }

        if (hasSearchChange) {
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
                setDebouncedFilters(filters);
            }, 400);
            return () => clearTimeout(searchDebounceRef.current);
        }
    }, [filters]);

    const hasClientSideFilter = useCallback((currentFilters) => {
        return currentFilters.controlPlanStatus !== 'all' || currentFilters.inkrStatus !== 'all';
    }, []);

    const buildFilterQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm && currentFilters.searchTerm.trim()) {
            const searchTerm = currentFilters.searchTerm.trim();
            try {
                query = query.or(`part_name.ilike.%${searchTerm}%,part_code.ilike.%${searchTerm}%,record_no.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%`);
            } catch (error) {
                console.error('Search query oluşturma hatası:', error);
            }
        }
        if (currentFilters.dateRange && currentFilters.dateRange.from) {
            query = query.gte('inspection_date', currentFilters.dateRange.from.toISOString());
        }
        if (currentFilters.dateRange && currentFilters.dateRange.to) {
            query = query.lte('inspection_date', currentFilters.dateRange.to.toISOString());
        }
        if (currentFilters.decision !== 'all') {
            query = query.eq('decision', currentFilters.decision);
        }
        if (currentFilters.supplier !== 'all' && currentFilters.supplier) {
            query = query.eq('supplier_id', currentFilters.supplier);
        }
        return query;
    }, []);

    const applyClientSideStatusFilter = useCallback((rows, currentFilters) => {
        let result = rows;
        if (currentFilters.controlPlanStatus !== 'all') {
            result = result.filter((r) => r.control_plan_status === currentFilters.controlPlanStatus);
        }
        if (currentFilters.inkrStatus !== 'all') {
            result = result.filter((r) => r.inkr_status === currentFilters.inkrStatus);
        }
        return result;
    }, []);

    const addStatuses = useCallback((rows) => {
        const cpKeys = controlPlanKeys;
        const irKeys = inkrKeys;
        return rows.map((inspection) => ({
            ...inspection,
            supplier_name: inspection.supplier_name || '-',
            control_plan_status: cpKeys.has(normalizeIncomingPartCode(inspection.part_code)) ? 'Mevcut' : 'Mevcut Değil',
            inkr_status: irKeys.has(normalizeIncomingPartCode(inspection.part_code)) ? 'Mevcut' : 'Mevcut Değil',
        }));
    }, [controlPlanKeys, inkrKeys]);

    const fetchDashboardAndKpis = useCallback(async (currentFilters) => {
        setDashboardLoading(true);
        try {
            let allInspections = [];
            let page = 0;
            let hasMore = true;
    
            while(hasMore) {
                const from = page * DASHBOARD_FETCH_LIMIT;
                const to = from + DASHBOARD_FETCH_LIMIT - 1;

                let baseQuery = supabase.from('incoming_inspections_with_supplier').select('id, decision, quantity_received, quantity_rejected, part_code, supplier_name');
                baseQuery = buildFilterQuery(baseQuery, currentFilters);
                
                const { data, error } = await baseQuery.range(from, to);

                if (error) throw error;
                
                if (data.length > 0) {
                    allInspections = allInspections.concat(data);
                }
                
                if (data.length < DASHBOARD_FETCH_LIMIT) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            const cpKeys = controlPlanKeys;
            const irKeys = inkrKeys;

            let inspectionsWithPlanStatus = allInspections.map(inspection => ({
                ...inspection,
                control_plan_status: cpKeys.has(normalizeIncomingPartCode(inspection.part_code)) ? 'Mevcut' : 'Mevcut Değil',
                inkr_status: irKeys.has(normalizeIncomingPartCode(inspection.part_code)) ? 'Mevcut' : 'Mevcut Değil',
            }));

            inspectionsWithPlanStatus = applyClientSideStatusFilter(inspectionsWithPlanStatus, currentFilters);

            setDashboardData(inspectionsWithPlanStatus);

        } catch (error) {
            if (error.code !== 'PGRST116') {
                toast({ variant: 'destructive', title: 'Hata', description: `Dashboard verileri alınamadı: ${error.message}` });
            }
            setDashboardData([]);
        } finally {
            setDashboardLoading(false);
        }
    }, [toast, buildFilterQuery, applyClientSideStatusFilter, controlPlanKeys, inkrKeys]);

    const fetchInspections = useCallback(async (page, currentFilters) => {
        setLoading(true);
        try {
            if (hasClientSideFilter(currentFilters)) {
                const CHUNK = 1000;
                let all = [];
                let from = 0;
                for (;;) {
                    let q = supabase
                        .from('incoming_inspections_with_supplier')
                        .select('*')
                        .order('inspection_date', { ascending: false })
                        .order('created_at', { ascending: false })
                        .range(from, from + CHUNK - 1);
                    q = buildFilterQuery(q, currentFilters);
                    const { data, error } = await q;
                    if (error) throw error;
                    if (data?.length) all.push(...data);
                    if (!data?.length || data.length < CHUNK) break;
                    from += CHUNK;
                }
                let enriched = addStatuses(all);
                enriched = applyClientSideStatusFilter(enriched, currentFilters);
                setTotalCount(enriched.length);
                const start = page * PAGE_SIZE;
                setInspections(enriched.slice(start, start + PAGE_SIZE));
            } else {
                const from = page * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;
                let query = supabase
                    .from('incoming_inspections_with_supplier')
                    .select('*', { count: 'exact' })
                    .range(from, to)
                    .order('inspection_date', { ascending: false })
                    .order('created_at', { ascending: false });
                query = buildFilterQuery(query, currentFilters);
                const { data, error, count } = await query;
                if (error) throw error;
                setInspections(addStatuses(data || []));
                setTotalCount(count || 0);
            }
        } catch (error) {
            if (error.code !== 'PGRST116') {
                toast({ variant: 'destructive', title: 'Hata', description: `Muayene kayıtları alınamadı: ${error.message}` });
            }
            setInspections([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [toast, buildFilterQuery, hasClientSideFilter, applyClientSideStatusFilter, addStatuses]);

    const fetchAbortRef = useRef(0);

    useEffect(() => {
        const fetchId = ++fetchAbortRef.current;
        const run = async () => {
            await Promise.all([
                fetchInspections(currentPage, debouncedFilters),
                fetchDashboardAndKpis(debouncedFilters),
            ]);
        };
        if (fetchAbortRef.current === fetchId) {
            run();
        }
    }, [currentPage, debouncedFilters, fetchInspections, fetchDashboardAndKpis]);

    const refreshIncomingQualityKpis = useCallback(async () => {
        const cpKeys = controlPlanKeys;
        const irKeys = inkrKeys;

        try {
            const KPAGE = 1000;
            let allInspections = [];
            let pg = 0;
            let more = true;
            while (more) {
                const from = pg * KPAGE;
                const to = from + KPAGE - 1;
                const { data, error } = await supabase
                    .from('incoming_inspections_with_supplier')
                    .select('part_code')
                    .not('part_code', 'is', null)
                    .not('part_code', 'eq', '')
                    .order('id', { ascending: true })
                    .range(from, to);
                if (error) { console.error('KPI hesaplama hatası:', error); return; }
                if (data?.length) allInspections = allInspections.concat(data);
                if (!data || data.length < KPAGE) more = false;
                else pg++;
            }

            const uniquePartCodes = new Set();
            allInspections.forEach((i) => {
                const n = normalizeIncomingPartCode(i.part_code);
                if (n) uniquePartCodes.add(n);
            });

            let missingPlan = 0;
            let missingInkr = 0;
            uniquePartCodes.forEach((pc) => {
                if (!cpKeys.has(pc)) missingPlan++;
                if (!irKeys.has(pc)) missingInkr++;
            });

            setControlPlanMissingCount(missingPlan);
            setInkrMissingCount(missingInkr);
        } catch (err) {
            console.error('Girdi kalite KPI hesaplama:', err);
        }
    }, [controlPlanKeys, inkrKeys]);

    useEffect(() => {
        if (controlPlanKeys.size > 0 || inkrKeys.size > 0) {
            refreshIncomingQualityKpis();
        }
    }, [controlPlanKeys, inkrKeys, refreshIncomingQualityKpis]);

    const handleSuccess = useCallback(() => {
        setFormOpen(false);
        setSelectedInspection(null);
        fetchInspections(currentPage, debouncedFilters);
        fetchDashboardAndKpis(debouncedFilters);
        refreshIncomingQualityKpis();
    }, [currentPage, debouncedFilters, fetchInspections, fetchDashboardAndKpis, refreshIncomingQualityKpis]);

    const fetchFullInspectionData = async (inspectionId) => {
        const { data, error } = await supabase
            .from('incoming_inspections')
            .select('*, supplier:suppliers(id, name), attachments:incoming_inspection_attachments(*), non_conformity:non_conformities!non_conformities_source_inspection_id_fkey(id, nc_number), defects:incoming_inspection_defects(*), results:incoming_inspection_results(*)')
            .eq('id', inspectionId)
            .single();
        
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Muayene detayları alınamadı.' });
            return null;
        }
        return data;
    };
    
    const handleOpenStockRiskModal = (sourceInspection, riskyStock) => {
        setStockRiskData({ sourceInspection, riskyStock });
        setStockRiskModalOpen(true);
    };

    const handleOpenForm = async (inspection = null, viewMode = false) => {
        if (inspection) {
            const fullData = await fetchFullInspectionData(inspection.id);
            if (fullData) {
                setSelectedInspection(fullData);
                setIsViewMode(viewMode);
                setFormOpen(true);
            }
        } else {
            setSelectedInspection(null);
            setIsViewMode(viewMode);
            setFormOpen(true);
        }
    };

    const handleOpenDecisionModal = (inspection) => {
        setSelectedInspection(inspection);
        setDecisionModalOpen(true);
    };

    const handleDownloadPDF = (record, type) => {
        if (type === 'incoming_inspection') {
            openPrintableReport(record, type, true);
        } else {
            openPrintableReport(record, type || 'incoming_inspection');
        }
    };

    const handleViewPdf = async (path, bucket = 'incoming_control') => {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'PDF görüntülenemedi: ' + error.message });
        } else {
            setPdfViewerState({ isOpen: true, url: data.signedUrl, title: path.split('/').pop() });
        }
    };

    const [inkrInitialFilter, setInkrInitialFilter] = useState(null);

    const handleCardClick = (filter) => {
        const { _switchTab, ...rest } = filter;
        if (_switchTab) {
            setActiveTab(_switchTab);
            mountedTabsRef.current.add(_switchTab);
            if (_switchTab === 'inkr' && rest.inkrStatus) {
                setInkrInitialFilter(rest.inkrStatus);
            }
            return;
        }
        if (activeTab !== 'inspections') {
            setActiveTab('inspections');
            mountedTabsRef.current.add('inspections');
        }
        setFilters(prev => ({
            ...prev,
            decision: 'all',
            controlPlanStatus: 'all',
            inkrStatus: 'all',
            ...rest
        }));
        setCurrentPage(0);
    };
    
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const filteredInspections = useMemo(() => {
        return dashboardData || [];
    }, [dashboardData]);

    const dateRange = useMemo(() => {
        if (!filters.dateRange || !filters.dateRange.from || !filters.dateRange.to) {
            return { label: 'Tüm Zamanlar', startDate: null, endDate: null };
        }
        const from = filters.dateRange.from;
        const to = filters.dateRange.to;
        return {
            label: `${format(from, 'dd.MM.yyyy', { locale: tr })} - ${format(to, 'dd.MM.yyyy', { locale: tr })}`,
            startDate: from,
            endDate: to
        };
    }, [filters.dateRange]);

    /** Dashboard verisiyle aynı filtre (özellikle tarih aralığı) — ret oranı kartındaki dönem etiketi */
    const dashboardPeriodLabel = useMemo(() => {
        if (!debouncedFilters.dateRange || !debouncedFilters.dateRange.from || !debouncedFilters.dateRange.to) {
            return 'Tüm Zamanlar';
        }
        const from = debouncedFilters.dateRange.from;
        const to = debouncedFilters.dateRange.to;
        return `${format(from, 'dd.MM.yyyy', { locale: tr })} - ${format(to, 'dd.MM.yyyy', { locale: tr })}`;
    }, [debouncedFilters.dateRange]);

    const handleOpenReportModal = useCallback(() => {
        if (filteredInspections.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturmak için en az bir muayene kaydı olmalıdır.',
            });
            return;
        }
        setIsReportSelectionModalOpen(true);
    }, [filteredInspections, toast]);

    const handleGenerateExecutiveReport = useCallback(async () => {
        if (filteredInspections.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturmak için en az bir muayene kaydı olmalıdır.',
            });
            return;
        }

        const formatDate = (dateInput) => {
            if (!dateInput) return '-';
            try {
                const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
                if (isNaN(dateObj.getTime())) return '-';
                return format(dateObj, 'dd.MM.yyyy', { locale: tr });
            } catch {
                return '-';
            }
        };

        try {
            const inspectionIds = filteredInspections
                .map(i => i.id)
                .filter(id => id && typeof id === 'string' && id.length > 0);
            
            if (inspectionIds.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Geçerli muayene kaydı bulunamadı.',
                });
                return;
            }
            
            let fullInspections = [];
            const BATCH_SIZE = 100;
            
            for (let i = 0; i < inspectionIds.length; i += BATCH_SIZE) {
                const batchIds = inspectionIds.slice(i, i + BATCH_SIZE);
                const { data: batchData, error: batchError } = await supabase
                    .from('incoming_inspections')
                    .select('*, supplier:suppliers(id, name)')
                    .in('id', batchIds);
                
                if (batchError) throw batchError;
                if (batchData) fullInspections = [...fullInspections, ...batchData];
            }

            const reportSupplierIds = [...new Set(fullInspections
                .map(inv => inv.supplier?.id || inv.supplier_id)
                .filter(Boolean))];

            let deviationsQuery = supabase
                .from('non_conformities')
                .select('*, supplier:suppliers(id, name)')
                .not('supplier_id', 'is', null);
            
            if (dateRange.startDate) {
                deviationsQuery = deviationsQuery.gte('created_at', dateRange.startDate.toISOString());
            }
            if (dateRange.endDate) {
                deviationsQuery = deviationsQuery.lte('created_at', dateRange.endDate.toISOString());
            }
            
            if (reportSupplierIds.length > 0) {
                deviationsQuery = deviationsQuery.in('supplier_id', reportSupplierIds);
            }

            const { data: deviations, error: devError } = await deviationsQuery;
            
            if (devError) {
                console.error('DF kayıtları çekilirken hata:', devError);
            }

            const dfBySupplier = {};
            const dfBySupplierNormalized = {};
            
            (deviations || []).forEach(dev => {
                if (dev.supplier_id && dev.supplier?.name) {
                    const supplierName = dev.supplier.name;
                    const normalizedName = supplierName.toLowerCase().trim().replace(/\s+/g, ' ');
                    
                    if (!dfBySupplier[supplierName]) {
                        dfBySupplier[supplierName] = { count: 0, total: 0 };
                    }
                    dfBySupplier[supplierName].count += 1;
                    
                    if (!dfBySupplierNormalized[normalizedName]) {
                        dfBySupplierNormalized[normalizedName] = { count: 0, originalName: supplierName };
                    }
                    dfBySupplierNormalized[normalizedName].count += 1;
                }
            });
            
            const getDfCount = (supplierName) => {
                if (dfBySupplier[supplierName]) {
                    return dfBySupplier[supplierName].count;
                }
                const normalizedName = supplierName.toLowerCase().trim().replace(/\s+/g, ' ');
                if (dfBySupplierNormalized[normalizedName]) {
                    return dfBySupplierNormalized[normalizedName].count;
                }
                return 0;
            };

            const totalInspections = filteredInspections.length;
            const totalProductsInspected = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_received || 0), 0);
            const totalProductsRejected = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_rejected || 0), 0);
            const totalProductsConditional = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_conditional || 0), 0);
            const totalProductsAccepted = totalProductsInspected - totalProductsRejected - totalProductsConditional;

            const decisions = {
                'Kabul': { count: 0, quantity: 0 },
                'Şartlı Kabul': { count: 0, quantity: 0 },
                'Ret': { count: 0, quantity: 0 },
                'Beklemede': { count: 0, quantity: 0 }
            };

            filteredInspections.forEach(inv => {
                const decision = inv.decision || 'Beklemede';
                if (decisions[decision]) {
                    decisions[decision].count += 1;
                    decisions[decision].quantity += inv.quantity_received || 0;
                }
            });

            const bySupplier = {};
            filteredInspections.forEach(inv => {
                const supplierName = inv.supplier_name || 'Belirtilmemiş';
                if (!bySupplier[supplierName]) {
                    const dfCount = getDfCount(supplierName);
                    bySupplier[supplierName] = {
                        count: 0,
                        totalReceived: 0,
                        totalRejected: 0,
                        totalConditional: 0,
                        decisions: { 'Kabul': 0, 'Şartlı Kabul': 0, 'Ret': 0, 'Beklemede': 0 },
                        dfCount: dfCount
                    };
                }
                bySupplier[supplierName].count += 1;
                bySupplier[supplierName].totalReceived += inv.quantity_received || 0;
                bySupplier[supplierName].totalRejected += inv.quantity_rejected || 0;
                bySupplier[supplierName].totalConditional += inv.quantity_conditional || 0;
                const decision = inv.decision || 'Beklemede';
                if (bySupplier[supplierName].decisions[decision] !== undefined) {
                    bySupplier[supplierName].decisions[decision] += 1;
                }
            });

            const topSuppliers = Object.entries(bySupplier)
                .map(([name, data]) => ({
                    name,
                    count: data.count,
                    totalReceived: data.totalReceived,
                    totalRejected: data.totalRejected,
                    totalConditional: data.totalConditional,
                    rejectionRate: data.totalReceived > 0 ? ((data.totalRejected / data.totalReceived) * 100) : 0,
                    conditionalRate: data.totalReceived > 0 ? ((data.totalConditional / data.totalReceived) * 100) : 0,
                    decisions: data.decisions,
                    dfCount: data.dfCount
                }))
                .sort((a, b) => b.totalRejected - a.totalRejected)
                .slice(0, 10);

            const byPart = {};
            filteredInspections.forEach(inv => {
                const partCode = inv.part_code || 'Belirtilmemiş';
                const partName = inv.part_name || '-';
                if (!byPart[partCode]) {
                    byPart[partCode] = {
                        partName,
                        count: 0,
                        totalReceived: 0,
                        totalRejected: 0,
                        totalConditional: 0
                    };
                }
                byPart[partCode].count += 1;
                byPart[partCode].totalReceived += inv.quantity_received || 0;
                byPart[partCode].totalRejected += inv.quantity_rejected || 0;
                byPart[partCode].totalConditional += inv.quantity_conditional || 0;
            });

            const topParts = Object.entries(byPart)
                .map(([code, data]) => ({
                    partCode: code,
                    partName: data.partName,
                    count: data.count,
                    totalReceived: data.totalReceived,
                    totalRejected: data.totalRejected,
                    totalConditional: data.totalConditional,
                    rejectionRate: data.totalReceived > 0 ? ((data.totalRejected / data.totalReceived) * 100) : 0
                }))
                .sort((a, b) => b.totalRejected - a.totalRejected)
                .slice(0, 10);

            const monthlyTrends = {};
            filteredInspections.forEach(inv => {
                if (!inv.inspection_date) return;
                try {
                    const inspectionDate = new Date(inv.inspection_date);
                    if (isNaN(inspectionDate.getTime())) return;
                    const monthKey = format(inspectionDate, 'yyyy-MM', { locale: tr });
                    if (!monthlyTrends[monthKey]) {
                        monthlyTrends[monthKey] = {
                            count: 0,
                            totalReceived: 0,
                            totalRejected: 0,
                            totalConditional: 0
                        };
                    }
                    monthlyTrends[monthKey].count += 1;
                    monthlyTrends[monthKey].totalReceived += inv.quantity_received || 0;
                    monthlyTrends[monthKey].totalRejected += inv.quantity_rejected || 0;
                    monthlyTrends[monthKey].totalConditional += inv.quantity_conditional || 0;
                } catch {
                    return;
                }
            });

            const monthlyData = Object.entries(monthlyTrends)
                .map(([month, data]) => ({
                    month: format(new Date(month + '-01'), 'MMMM yyyy', { locale: tr }),
                    monthKey: month,
                    count: data.count,
                    totalReceived: data.totalReceived,
                    totalRejected: data.totalRejected,
                    totalConditional: data.totalConditional,
                    rejectionRate: data.totalReceived > 0 ? ((data.totalRejected / data.totalReceived) * 100) : 0
                }))
                .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                .slice(-12);

            const rejectedSuppliers = Object.entries(bySupplier)
                .filter(([, data]) => data.totalRejected > 0)
                .map(([name, data]) => ({
                    name,
                    rejectionCount: data.decisions['Ret'] || 0,
                    totalRejected: data.totalRejected,
                    dfCount: data.dfCount
                }))
                .sort((a, b) => b.totalRejected - a.totalRejected)
                .slice(0, 10);

            const reportData = {
                id: `incoming-quality-executive-${Date.now()}`,
                period: dateRange.label || 'Tüm Zamanlar',
                periodStart: dateRange.startDate ? formatDate(dateRange.startDate) : null,
                periodEnd: dateRange.endDate ? formatDate(dateRange.endDate) : null,
                totalInspections,
                totalProductsInspected,
                totalProductsAccepted,
                totalProductsRejected,
                totalProductsConditional,
                rejectionRate: totalProductsInspected > 0 ? ((totalProductsRejected / totalProductsInspected) * 100) : 0,
                conditionalRate: totalProductsInspected > 0 ? ((totalProductsConditional / totalProductsInspected) * 100) : 0,
                acceptanceRate: totalProductsInspected > 0 ? ((totalProductsAccepted / totalProductsInspected) * 100) : 0,
                decisions,
                topSuppliers,
                topParts,
                rejectedSuppliers,
                monthlyData,
                totalDFs: Object.values(dfBySupplier).reduce((sum, data) => sum + data.count, 0),
                reportDate: formatDate(new Date())
            };

            openPrintableReport(reportData, 'incoming_quality_executive_summary', true);

            toast({
                title: 'Başarılı',
                description: 'Yönetici özeti raporu oluşturuldu.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Rapor oluşturulurken hata oluştu: ${error.message}`,
            });
        }
    }, [filteredInspections, dateRange, toast]);

    const handleSelectReportType = useCallback((type) => {
        setIsReportSelectionModalOpen(false);
        if (type === 'executive') {
            handleGenerateExecutiveReport();
        }
    }, [handleGenerateExecutiveReport]);

    const handleTabChange = useCallback((value) => {
        setActiveTab(value);
        mountedTabsRef.current.add(value);
    }, []);

    const shouldRenderTab = useCallback((tabName) => {
        return mountedTabsRef.current.has(tabName);
    }, []);

    return (
        <div className="space-y-6">
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
                <meta name="description" content="Gelen malzeme kalite kontrol süreçlerini yönetin." />
            </Helmet>

            <IncomingQualityDashboard inspections={dashboardData} loading={dashboardLoading} onCardClick={handleCardClick} inkrReports={inkrReports} inkrMissingCount={inkrMissingCount} controlPlanMissingCount={controlPlanMissingCount} periodLabel={dashboardPeriodLabel} />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <Button type="button" variant="outline" className="gap-2 sm:self-end" onClick={() => setIsFolderDownloadOpen(true)}>
                    <Download className="h-4 w-4" />
                    Klasör İndir
                </Button>
            </div>

            <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="inspections">Muayene Kayıtları</TabsTrigger>
                    <TabsTrigger value="sheet-metal">Sac Malzemeler</TabsTrigger>
                    <TabsTrigger value="control-plans">Kontrol Planları</TabsTrigger>
                    <TabsTrigger value="inkr">INKR Yönetimi</TabsTrigger>
                    <TabsTrigger value="stock-risk">Stok Risk Kontrolleri</TabsTrigger>
                </TabsList>
                <TabsContent value="inspections">
                    <IncomingInspectionList
                        inspections={inspections}
                        loading={loading}
                        onAdd={() => handleOpenForm(null, false)}
                        onEdit={(record) => handleOpenForm(record, false)}
                        onView={(record) => handleOpenForm(record, true)}
                        onDecide={handleOpenDecisionModal}
                        onOpenNCForm={onOpenNCForm}
                        onOpenNCView={onOpenNCView}
                        onDownloadPDF={(record) => handleDownloadPDF(record, 'incoming_inspection')}
                        onGenerateReport={handleOpenReportModal}
                        refreshData={() => {
                            fetchInspections(currentPage, debouncedFilters);
                            fetchDashboardAndKpis(debouncedFilters);
                        }}
                        suppliers={suppliers}
                        filters={filters}
                        setFilters={setFilters}
                        page={currentPage}
                        setPage={handlePageChange}
                        totalCount={totalCount}
                        pageSize={PAGE_SIZE}
                        onOpenStockRiskModal={handleOpenStockRiskModal}
                    />
                </TabsContent>
                <TabsContent value="sheet-metal">
                    {shouldRenderTab('sheet-metal') && (
                        <Suspense fallback={<TabFallback />}>
                            <SheetMetalManagement 
                                onDownloadPDF={(record) => handleDownloadPDF(record, 'sheet_metal_entry')} 
                                onViewPdf={handleViewPdf}
                            />
                        </Suspense>
                    )}
                </TabsContent>
                <TabsContent value="control-plans">
                    {shouldRenderTab('control-plans') && (
                        <Suspense fallback={<TabFallback />}>
                            <ControlPlanManagement onViewPdf={(path) => handleViewPdf(path, 'incoming_control')} />
                        </Suspense>
                    )}
                </TabsContent>
                <TabsContent value="inkr">
                    {shouldRenderTab('inkr') && (
                        <Suspense fallback={<TabFallback />}>
                            <InkrManagement
                                onViewPdf={(path, bucket = 'inkr_attachments') => handleViewPdf(path, bucket)}
                                initialStatusFilter={inkrInitialFilter}
                                onInitialFilterConsumed={() => setInkrInitialFilter(null)}
                            />
                        </Suspense>
                    )}
                </TabsContent>
                <TabsContent value="stock-risk">
                    {shouldRenderTab('stock-risk') && (
                        <Suspense fallback={<TabFallback />}>
                            <StockRiskControlList />
                        </Suspense>
                    )}
                </TabsContent>
            </Tabs>

            {isFormOpen && (
                <Suspense fallback={null}>
                    <IncomingInspectionFormModal
                        isOpen={isFormOpen}
                        setIsOpen={setFormOpen}
                        refreshData={handleSuccess}
                        existingInspection={selectedInspection}
                        isViewMode={isViewMode}
                        onOpenStockRiskModal={handleOpenStockRiskModal}
                    />
                </Suspense>
            )}
            
            {stockRiskModalOpen && (
                <Suspense fallback={null}>
                    <StockRiskControlModal
                        isOpen={stockRiskModalOpen}
                        setIsOpen={setStockRiskModalOpen}
                        stockRiskData={stockRiskData}
                        refreshData={handleSuccess}
                    />
                </Suspense>
            )}

            {isDecisionModalOpen && (
                <Suspense fallback={null}>
                    <IncomingInspectionDecisionModal
                        isOpen={isDecisionModalOpen}
                        setIsOpen={setDecisionModalOpen}
                        inspection={selectedInspection}
                        refreshData={() => {
                            fetchInspections(currentPage, debouncedFilters);
                            fetchDashboardAndKpis(debouncedFilters);
                        }}
                        onOpenNCForm={onOpenNCForm}
                    />
                </Suspense>
            )}

            <PdfViewerModal
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(open) => setPdfViewerState(s => ({ ...s, isOpen: open }))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />

            <IncomingQualityFolderDownloadModal isOpen={isFolderDownloadOpen} setIsOpen={setIsFolderDownloadOpen} />

            <Dialog open={isReportSelectionModalOpen} onOpenChange={setIsReportSelectionModalOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Rapor Türü Seçin
                        </DialogTitle>
                        <DialogDescription>
                            Oluşturmak istediğiniz rapor türünü seçin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <button
                            onClick={() => handleSelectReportType('executive')}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-1 text-foreground">Yönetici Özeti Raporu</h3>
                                <p className="text-sm text-muted-foreground">
                                    Kontrol sayıları, ürün sayıları, ret oranları, tedarikçi analizi, DF açılan tedarikçiler ve trend analizi içeren kapsamlı özet rapor.
                                </p>
                            </div>
                        </button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReportSelectionModalOpen(false)}>
                            İptal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default IncomingQualityModule;
