
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
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
import ControlPlanDetailModal from '@/components/incoming-quality/ControlPlanDetailModal';
import InkrDetailModal from '@/components/incoming-quality/InkrDetailModal';
import StockRiskDetailModal from '@/components/incoming-quality/StockRiskDetailModal';

const PAGE_SIZE = 20;
const DASHBOARD_FETCH_LIMIT = 1000;

const IncomingQualityModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const { suppliers, incomingControlPlans, inkrReports, refreshData: globalRefresh, refreshEquipment, characteristics, equipment } = useData();

    useEffect(() => {
        refreshEquipment?.();
    }, [refreshEquipment]);
    
    const [inspections, setInspections] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [inkrMissingCount, setInkrMissingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);

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

    const [filters, setFilters] = useState({
        searchTerm: '',
        dateRange: null, // Başlangıçta null olarak ayarlandı (tüm zamanlar)
        decision: 'all',
        supplier: 'all',
        controlPlanStatus: 'all',
        inkrStatus: 'all',
    });

    const buildFilterQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm && currentFilters.searchTerm.trim()) {
            const searchTerm = currentFilters.searchTerm.trim();
            // Kapsamlı arama: sadece view'de mevcut olduğunu bildiğimiz kolonlar
            // View kolonları: id, record_no, inspection_date, part_code, part_name, supplier_id, supplier_name, decision, quantity_received, quantity_rejected, vb.
            try {
                // Supabase .or() syntax: column1.ilike.%value%,column2.ilike.%value%
                // EquipmentModule.jsx'teki gibi % karakterlerini direkt string içinde kullan
                // searchTerm değişkeni sadece değer olmalı, % karakterleri .or() içinde eklenmeli
                query = query.or(`part_name.ilike.%${searchTerm}%,part_code.ilike.%${searchTerm}%,record_no.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%`);
            } catch (error) {
                console.error('❌ Search query oluşturma hatası:', error);
                console.error('❌ Hata detayları:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    searchTerm: searchTerm
                });
                // Hata durumunda arama yapmadan devam et
            }
        }
        // Tarih filtresi: null ise tüm zamanlar, from/to varsa filtre uygula
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
        if (currentFilters.controlPlanStatus !== 'all') {
            const partCodesWithPlan = (incomingControlPlans || []).map(p => p.part_code);
            if (currentFilters.controlPlanStatus === 'Mevcut') {
                if (partCodesWithPlan.length > 0) {
                    query = query.in('part_code', partCodesWithPlan);
                } else {
                    // Hiç kontrol planı yoksa hiçbir kayıt döndürme
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            } else if (currentFilters.controlPlanStatus === 'Mevcut Değil') {
                // Kontrol planı olmayan kayıtları getir
                if (partCodesWithPlan.length > 0) {
                    // Supabase'de NOT IN için doğru syntax
                    query = query.not('part_code', 'in', `(${partCodesWithPlan.join(',')})`);
                }
                // Eğer hiç kontrol planı yoksa, tüm kayıtlar "Mevcut Değil" demektir, filtre eklemeye gerek yok
            }
        }
        if (currentFilters.inkrStatus !== 'all') {
            const partCodesWithInkr = (inkrReports || []).map(r => r.part_code);
            if (currentFilters.inkrStatus === 'Mevcut') {
                if (partCodesWithInkr.length > 0) {
                    query = query.in('part_code', partCodesWithInkr);
                } else {
                    // Hiç INKR yoksa hiçbir kayıt döndürme
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            } else if (currentFilters.inkrStatus === 'Mevcut Değil') {
                // INKR olmayan kayıtları getir
                if (partCodesWithInkr.length > 0) {
                    // Supabase'de NOT IN için doğru syntax
                    query = query.not('part_code', 'in', `(${partCodesWithInkr.join(',')})`);
                }
                // Eğer hiç INKR yoksa, tüm kayıtlar "Mevcut Değil" demektir, filtre eklemeye gerek yok
            }
        }
        return query;
    }, [incomingControlPlans, inkrReports]);

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
            const inkrMap = new Map((inkrReports || []).map(r => [r.part_code, true]));
            const inspectionsWithPlanStatus = allInspections.map(inspection => ({
                ...inspection,
                control_plan_status: controlPlanMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
                inkr_status: inkrMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
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
    }, [toast, buildFilterQuery, incomingControlPlans, inkrReports]);

    const fetchInspections = useCallback(async (page, currentFilters) => {
        setLoading(true);
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // incoming_inspections_with_supplier view kullanarak supplier_name'e direkt erişim sağla
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
            const inkrMap = new Map((inkrReports || []).map(r => [r.part_code, true]));
            const dataWithPlanStatus = data.map(inspection => ({
                ...inspection,
                supplier_name: inspection.supplier_name || '-',
                control_plan_status: controlPlanMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
                inkr_status: inkrMap.has(inspection.part_code) ? 'Mevcut' : 'Mevcut Değil',
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

    // INKR eksik sayısını tüm parça kodları üzerinden hesapla (filtresiz)
    useEffect(() => {
        const calculateInkrMissing = async () => {
            try {
                // Supabase varsayılan 1000 kayıt limiti var - tüm verileri almak için pagination yapıyoruz
                let allInspections = [];
                let page = 0;
                const PAGE_SIZE = 1000;
                let hasMore = true;

                while (hasMore) {
                    const from = page * PAGE_SIZE;
                    const to = from + PAGE_SIZE - 1;

                    const { data: inspections, error } = await supabase
                        .from('incoming_inspections_with_supplier')
                        .select('part_code')
                        .not('part_code', 'is', null)
                        .not('part_code', 'eq', '')
                        .range(from, to);

                    if (error) {
                        console.error('INKR hesaplama hatası:', error);
                        return;
                    }

                    if (inspections && inspections.length > 0) {
                        allInspections = allInspections.concat(inspections);
                    }

                    if (!inspections || inspections.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }

                console.log('📥 INKR Hesaplama - Toplam inspection kaydı çekildi:', allInspections.length);

                // Normalize fonksiyonu
                const normalizePartCode = (code) => code ? code.toString().trim().toLowerCase() : '';

                // Benzersiz parça kodları
                const uniquePartCodes = new Set();
                (allInspections || []).forEach(i => {
                    if (i.part_code) {
                        const normalized = normalizePartCode(i.part_code);
                        if (normalized) uniquePartCodes.add(normalized);
                    }
                });

                // INKR mevcut parça kodları
                const inkrPartCodes = new Set(
                    (inkrReports || [])
                        .map(r => normalizePartCode(r.part_code))
                        .filter(pc => pc !== '')
                );

                // INKR eksik sayısı
                const missingCount = Array.from(uniquePartCodes).filter(pc => !inkrPartCodes.has(pc)).length;
                
                console.log('📊 INKR Eksik Hesaplama (Module):', {
                    toplamBenzersizParcaKodu: uniquePartCodes.size,
                    inkrMevcutParcaKodu: inkrPartCodes.size,
                    inkrEksikSayisi: missingCount
                });

                setInkrMissingCount(missingCount);
            } catch (err) {
                console.error('INKR hesaplama hatası:', err);
            }
        };

        calculateInkrMissing();
    }, [inkrReports]);

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
        // incoming_inspection için URL parametreleriyle veri gönder (imza alanları, ölçümler, vs)
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

    const handleCardClick = (filter) => {
        setFilters(prev => ({
            ...prev,
            decision: 'all',
            controlPlanStatus: 'all',
            inkrStatus: 'all',
            ...filter
        }));
        setCurrentPage(0);
    };
    
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    // Filtrelenmiş muayene verilerini al
    const filteredInspections = useMemo(() => {
        return dashboardData || [];
    }, [dashboardData]);

    // Tarih aralığı bilgisi
    const dateRange = useMemo(() => {
        // dateRange null ise veya from/to yoksa tüm zamanlar
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
                // Date objesi ise direkt kullan, string ise Date'e çevir
                const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
                if (isNaN(dateObj.getTime())) return '-'; // Geçersiz tarih kontrolü
                return format(dateObj, 'dd.MM.yyyy', { locale: tr });
            } catch {
                return '-';
            }
        };

        try {
            // Tüm muayene kayıtlarını detaylı olarak çek
            // Geçersiz ID'leri filtrele ve URL sınırlarını aşmamak için batch olarak çek
            const inspectionIds = filteredInspections
                .map(i => i.id)
                .filter(id => id && typeof id === 'string' && id.length > 0);
            
            console.log('📊 Rapor oluşturuluyor, muayene sayısı:', inspectionIds.length);
            
            if (inspectionIds.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Geçerli muayene kaydı bulunamadı.',
                });
                return;
            }
            
            // Çok fazla ID varsa batch olarak çek (URL sınırlarını aşmamak için)
            let fullInspections = [];
            const BATCH_SIZE = 100;
            
            for (let i = 0; i < inspectionIds.length; i += BATCH_SIZE) {
                const batchIds = inspectionIds.slice(i, i + BATCH_SIZE);
                const { data: batchData, error: batchError } = await supabase
                    .from('incoming_inspections')
                    .select('*, supplier:suppliers(id, name)')
                    .in('id', batchIds);
                
                if (batchError) {
                    console.error('❌ Batch fetch hatası:', batchError);
                    throw batchError;
                }
                
                if (batchData) {
                    fullInspections = [...fullInspections, ...batchData];
                }
            }
            
            console.log('✅ Detaylı muayene verileri çekildi:', fullInspections.length);

            // Raporda bulunan tedarikçileri belirle
            const reportSupplierIds = [...new Set(fullInspections
                .map(inv => inv.supplier?.id || inv.supplier_id)
                .filter(Boolean))];
            
            console.log('📊 Rapordaki tedarikçi ID\'leri:', reportSupplierIds);

            // DF/8D kayıtlarını çek - sadece rapordaki tedarikçilere ait ve tarih aralığında olanlar
            let deviationsQuery = supabase
                .from('non_conformities')
                .select('*, supplier:suppliers(id, name)')
                .not('supplier_id', 'is', null);
            
            // Tarih filtresi uygula (seçilen dönem için)
            if (dateRange.startDate) {
                deviationsQuery = deviationsQuery.gte('created_at', dateRange.startDate.toISOString());
            }
            if (dateRange.endDate) {
                deviationsQuery = deviationsQuery.lte('created_at', dateRange.endDate.toISOString());
            }
            
            // Sadece rapordaki tedarikçilerin DF'lerini çek
            if (reportSupplierIds.length > 0) {
                deviationsQuery = deviationsQuery.in('supplier_id', reportSupplierIds);
            }

            const { data: deviations, error: devError } = await deviationsQuery;

            console.log('📊 DF/8D kayıtları çekildi (filtrelenmiş):', deviations?.length || 0);
            
            if (devError) {
                console.error('❌ DF kayıtları çekilirken hata:', devError);
            }

            // Tedarikçi bazlı DF sayıları - tedarikçi adını normalize et
            const dfBySupplier = {};
            const dfBySupplierNormalized = {}; // Normalize edilmiş isimler için
            
            (deviations || []).forEach(dev => {
                if (dev.supplier_id && dev.supplier?.name) {
                    const supplierName = dev.supplier.name;
                    // Normalize edilmiş isim (küçük harf, trim, fazla boşlukları temizle)
                    const normalizedName = supplierName.toLowerCase().trim().replace(/\s+/g, ' ');
                    
                    if (!dfBySupplier[supplierName]) {
                        dfBySupplier[supplierName] = { count: 0, total: 0 };
                    }
                    dfBySupplier[supplierName].count += 1;
                    
                    // Normalize edilmiş isim için de kaydet
                    if (!dfBySupplierNormalized[normalizedName]) {
                        dfBySupplierNormalized[normalizedName] = { count: 0, originalName: supplierName };
                    }
                    dfBySupplierNormalized[normalizedName].count += 1;
                }
            });
            
            console.log('📊 Tedarikçi bazlı DF sayıları:', dfBySupplier);
            
            // DF sayısını bulmak için helper fonksiyon (normalize edilmiş eşleştirme)
            const getDfCount = (supplierName) => {
                // Önce tam eşleşme dene
                if (dfBySupplier[supplierName]) {
                    return dfBySupplier[supplierName].count;
                }
                // Normalize edilmiş eşleşme dene
                const normalizedName = supplierName.toLowerCase().trim().replace(/\s+/g, ' ');
                if (dfBySupplierNormalized[normalizedName]) {
                    return dfBySupplierNormalized[normalizedName].count;
                }
                return 0;
            };

            // Genel istatistikler
            const totalInspections = filteredInspections.length;
            const totalProductsInspected = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_received || 0), 0);
            const totalProductsRejected = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_rejected || 0), 0);
            const totalProductsConditional = filteredInspections.reduce((sum, inv) => sum + (inv.quantity_conditional || 0), 0);
            const totalProductsAccepted = totalProductsInspected - totalProductsRejected - totalProductsConditional;

            // Karar bazlı analiz
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

            // Tedarikçi bazlı analiz
            const bySupplier = {};
            filteredInspections.forEach(inv => {
                const supplierName = inv.supplier_name || 'Belirtilmemiş';
                if (!bySupplier[supplierName]) {
                    // getDfCount fonksiyonunu kullanarak normalize edilmiş eşleştirme yap
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

            // Parça bazlı analiz
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

            // Aylık trend analizi
            const monthlyTrends = {};
            filteredInspections.forEach(inv => {
                if (!inv.inspection_date) return; // Geçersiz tarih kontrolü
                try {
                    const inspectionDate = new Date(inv.inspection_date);
                    if (isNaN(inspectionDate.getTime())) return; // Geçersiz tarih kontrolü
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
                } catch (error) {
                    console.warn('Geçersiz tarih:', inv.inspection_date, error);
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
                .slice(-12); // Son 12 ay

            // Ret veren tedarikçiler
            const rejectedSuppliers = Object.entries(bySupplier)
                .filter(([name, data]) => data.totalRejected > 0)
                .map(([name, data]) => ({
                    name,
                    rejectionCount: data.decisions['Ret'] || 0,
                    totalRejected: data.totalRejected,
                    dfCount: data.dfCount
                }))
                .sort((a, b) => b.totalRejected - a.totalRejected)
                .slice(0, 10);

            // Rapor verisi
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

    return (
        <div className="space-y-6">
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
                <meta name="description" content="Gelen malzeme kalite kontrol süreçlerini yönetin." />
            </Helmet>

            <h1 className="text-3xl font-bold text-foreground">Girdi Kalite Kontrol</h1>

            <IncomingQualityDashboard inspections={dashboardData} loading={dashboardLoading} onCardClick={handleCardClick} inkrReports={inkrReports} inkrMissingCount={inkrMissingCount} />

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
                        onOpenNCView={onOpenNCView}
                        onDownloadPDF={(record) => handleDownloadPDF(record, 'incoming_inspection')}
                        onGenerateReport={handleOpenReportModal}
                        refreshData={() => {
                            fetchInspections(currentPage, filters);
                            fetchDashboardData(filters);
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
                    <SheetMetalManagement 
                        onDownloadPDF={(record) => handleDownloadPDF(record, 'sheet_metal_entry')} 
                        onViewPdf={handleViewPdf}
                    />
                </TabsContent>
                <TabsContent value="control-plans">
                    <ControlPlanManagement onViewPdf={(path) => handleViewPdf(path, 'incoming_control')} />
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
            
            {stockRiskModalOpen && (
                <StockRiskControlModal
                    isOpen={stockRiskModalOpen}
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

            {/* Rapor Seçim Modalı */}
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
