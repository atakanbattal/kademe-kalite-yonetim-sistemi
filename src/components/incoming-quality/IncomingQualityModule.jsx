
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IncomingInspectionList from '@/components/incoming-quality/IncomingInspectionList';
import IncomingInspectionFormModal from '@/components/incoming-quality/IncomingInspectionFormModal';
import IncomingQualityDashboard from '@/components/incoming-quality/IncomingQualityDashboard';
import ControlPlanManagement from '@/components/incoming-quality/ControlPlanManagement';
import InkrManagement from '@/components/incoming-quality/InkrManagement';
import { openPrintableReport } from '@/lib/reportUtils';
import { useData } from '@/contexts/DataContext';
import IncomingInspectionDecisionModal from '@/components/incoming-quality/IncomingInspectionDecisionModal';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import SheetMetalManagement from '@/components/incoming-quality/SheetMetalManagement';
import StockRiskControlList from '@/components/incoming-quality/StockRiskControlList';
import StockRiskControlModal from '@/components/incoming-quality/StockRiskControlModal';

const PAGE_SIZE = 20;
const DASHBOARD_FETCH_LIMIT = 1000;

const IncomingQualityModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const { suppliers, incomingControlPlans, refreshData: globalRefresh, characteristics, equipment } = useData();
    
    const [inspections, setInspections] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);

    const [isFormOpen, setFormOpen] = useState(false);
    const [isDecisionModalOpen, setDecisionModalOpen] = useState(false);
    const [isStockRiskModalOpen, setStockRiskModalOpen] = useState(false);
    const [stockRiskData, setStockRiskData] = useState(null);
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });
    const [isControlPlanModalOpen, setControlPlanModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        searchTerm: '',
        dateRange: { from: null, to: null },
        decision: 'all',
        supplierId: 'all',
        controlPlanStatus: 'all',
    });

    const buildFilterQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm) {
            const searchTerm = `%${currentFilters.searchTerm}%`;
            query = query.or(`part_name.ilike.${searchTerm},part_code.ilike.${searchTerm},record_no.ilike.${searchTerm},supplier_name.ilike.${searchTerm}`);
        }
        if (currentFilters.dateRange.from) {
            query = query.gte('inspection_date', currentFilters.dateRange.from.toISOString());
        }
        if (currentFilters.dateRange.to) {
            query = query.lte('inspection_date', currentFilters.dateRange.to.toISOString());
        }
        if (currentFilters.decision !== 'all') {
            query = query.eq('decision', currentFilters.decision);
        }
        if (currentFilters.supplierId !== 'all') {
            query = query.eq('supplier_id', currentFilters.supplierId);
        }
        if (currentFilters.controlPlanStatus !== 'all') {
            const partCodesWithPlan = (incomingControlPlans || []).map(p => p.part_code);
            if (currentFilters.controlPlanStatus === 'Mevcut') {
                if (partCodesWithPlan.length > 0) {
                    query = query.in('part_code', partCodesWithPlan);
                } else {
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            } else { 
                if (partCodesWithPlan.length > 0) {
                    query = query.not('part_code', 'in', `(${partCodesWithPlan.map(p => `'${p}'`).join(',')})`);
                }
            }
        }
        return query;
    }, [incomingControlPlans]);

    const fetchDashboardData = useCallback(async (currentFilters) => {
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

            const controlPlanMap = new Map((incomingControlPlans || []).map(p => [p.part_code, true]));
            const inspectionsWithPlanStatus = allInspections.map(inspection => ({
                ...inspection,
                control_plan_status: controlPlanMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
            }));

            setDashboardData(inspectionsWithPlanStatus);

        } catch (error) {
            if (error.code !== 'PGRST116') {
                toast({ variant: 'destructive', title: 'Hata', description: `Dashboard verileri alınamadı: ${error.message}` });
            }
            setDashboardData([]);
        } finally {
            setDashboardLoading(false);
        }
    }, [toast, buildFilterQuery, incomingControlPlans]);

    const fetchInspections = useCallback(async (page, currentFilters) => {
        setLoading(true);
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

        if (error) {
            if (error.code !== 'PGRST116') {
                toast({ variant: 'destructive', title: 'Hata', description: `Muayene kayıtları alınamadı: ${error.message}` });
            }
            setInspections([]);
        } else {
            const controlPlanMap = new Map((incomingControlPlans || []).map(p => [p.part_code, true]));
            const dataWithPlanStatus = data.map(inspection => ({
                ...inspection,
                control_plan_status: controlPlanMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
            }));
            setInspections(dataWithPlanStatus);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [toast, buildFilterQuery, incomingControlPlans]);

    useEffect(() => {
        fetchInspections(currentPage, filters);
        fetchDashboardData(filters);
    }, [currentPage, filters, fetchInspections, fetchDashboardData]);

    const handleSuccess = () => {
        setFormOpen(false);
        setSelectedInspection(null);
        fetchInspections(currentPage, filters);
        fetchDashboardData(filters);
        globalRefresh();
    };

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
        // Incoming Inspection için yeni PDF generator'ı kullan
        if (type === 'incoming_inspection' || !type) {
            openPrintableReport(record, 'incoming_inspection_pdf');
        } else {
            openPrintableReport(record, type);
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

    const handleCardClick = (filter) => {
        setFilters(prev => ({
            ...prev,
            decision: 'all',
            controlPlanStatus: 'all',
            ...filter
        }));
        setCurrentPage(0);
    };
    
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    return (
        <div className="space-y-6">
            <Helmet>
                <title>Girdi Kalite Kontrol</title>
                <meta name="description" content="Gelen malzeme kalite kontrol süreçlerini yönetin." />
            </Helmet>

            <h1 className="text-3xl font-bold text-foreground">Girdi Kalite Kontrol</h1>

            <IncomingQualityDashboard inspections={dashboardData} loading={dashboardLoading} onCardClick={handleCardClick} />

            <Tabs defaultValue="inspections" className="w-full">
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
                        onDownloadPDF={(record) => handleDownloadPDF(record, 'incoming_inspection')}
                        refreshData={() => {
                            fetchInspections(currentPage, filters);
                            fetchDashboardData(filters);
                        }}
                        suppliers={suppliers}
                        filters={filters}
                        setFilters={setFilters}
                        onOpenControlPlanForm={() => setControlPlanModalOpen(true)}
                        page={currentPage}
                        setPage={handlePageChange}
                        totalCount={totalCount}
                        pageSize={PAGE_SIZE}
                    />
                </TabsContent>
                 <TabsContent value="sheet-metal">
                    <SheetMetalManagement 
                        onDownloadPDF={(record) => handleDownloadPDF(record, 'sheet_metal_entry')} 
                        onViewPdf={handleViewPdf}
                    />
                </TabsContent>
                <TabsContent value="control-plans">
                    <ControlPlanManagement onViewPdf={(path) => handleViewPdf(path, 'incoming_control')} isOpen={isControlPlanModalOpen} setIsOpen={setControlPlanModalOpen} />
                </TabsContent>
                <TabsContent value="inkr">
                    <InkrManagement onViewPdf={(path) => handleViewPdf(path, 'incoming_control')} />
                </TabsContent>
                 <TabsContent value="stock-risk">
                    <StockRiskControlList />
                </TabsContent>
            </Tabs>

            {isFormOpen && (
                <IncomingInspectionFormModal
                    isOpen={isFormOpen}
                    setIsOpen={setFormOpen}
                    refreshData={handleSuccess}
                    existingInspection={selectedInspection}
                    isViewMode={isViewMode}
                    onOpenStockRiskModal={handleOpenStockRiskModal}
                />
            )}
            
            {isStockRiskModalOpen && (
                <StockRiskControlModal
                    isOpen={isStockRiskModalOpen}
                    setIsOpen={setStockRiskModalOpen}
                    stockRiskData={stockRiskData}
                    refreshData={handleSuccess}
                />
            )}

            {isDecisionModalOpen && (
                <IncomingInspectionDecisionModal
                    isOpen={isDecisionModalOpen}
                    setIsOpen={setDecisionModalOpen}
                    inspection={selectedInspection}
                    refreshData={() => {
                        fetchInspections(currentPage, filters);
                        fetchDashboardData(filters);
                    }}
                    onOpenNCForm={onOpenNCForm}
                />
            )}

            <PdfViewerModal
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(open) => setPdfViewerState(s => ({ ...s, isOpen: open }))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />
        </div>
    );
};

export default IncomingQualityModule;
