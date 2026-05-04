import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List, Plus, FileText, FolderDown } from 'lucide-react';
import NCDashboard from '@/components/df-8d/NCDashboard';
import NCTable from '@/components/df-8d/NCTable';
import NCFilters from '@/components/df-8d/NCFilters';
import NCReportFilterModal from '@/components/df-8d/NCReportFilterModal';
import Df8dFolderDownloadModal from '@/components/df-8d/Df8dFolderDownloadModal';
import { RejectModal, ForwardNCModal, InProgressModal, UpdateDueDateModal } from '@/components/df-8d/modals/ActionModals';
import CloseNCModal from '@/components/df-8d/modals/CloseNCModal';
import RecordListModal from '@/components/df-8d/modals/RecordListModal';
import { Button } from '@/components/ui/button';
import { parseISO, format, differenceInDays, isValid } from 'date-fns';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { openPrintableReport } from '@/lib/reportUtils';
import { getNCDisplayStatus, isNCOverdue } from '@/lib/statusUtils';
import { canonicalizeNonConformityOrgFields } from '@/lib/departmentCanonicalization';
import { compareDf8dRecordsForModuleList, getNonConformityListTitle } from '@/lib/df8dTextUtils';

const getDepartmentName = (department) => {
    const value = String(department || '').trim();
    return value || 'Belirtilmemiş';
};

const getNormalizedDepartment = (department) => (
    normalizeTurkishForSearch(getDepartmentName(department).toLowerCase())
);

const getRecordPrimaryDate = (record) => {
    const rawDate = record.df_opened_at || record.created_at;
    if (!rawDate) {
        return null;
    }

    const parsedDate = parseISO(rawDate);
    return isValid(parsedDate) ? parsedDate : null;
};

const recordMatchesDateFilter = (record, filters) => {
    if (!filters.dateFrom && !filters.dateTo) {
        return true;
    }

    const recordDate = getRecordPrimaryDate(record);
    if (!recordDate) {
        return true;
    }

    if (filters.dateFrom) {
        const fromDate = parseISO(filters.dateFrom);
        if (isValid(fromDate) && recordDate < fromDate) {
            return false;
        }
    }

    if (filters.dateTo) {
        const toDate = parseISO(filters.dateTo);
        if (isValid(toDate)) {
            toDate.setHours(23, 59, 59, 999);
            if (recordDate > toDate) {
                return false;
            }
        }
    }

    return true;
};

/** 8D progress içindeki text alanlarını JSON.stringify yapmadan toplar.
    Önceki sürüm her filtre pass'inde her kayıt için JSON.stringify çağırıyordu;
    1000 kayıtta arama tuş başına milisaniyelerce takıyordu. */
const collect8dProgressText = (eightDProgress) => {
    if (!eightDProgress || typeof eightDProgress !== 'object') return '';
    const parts = [];
    for (const key in eightDProgress) {
        const step = eightDProgress[key];
        if (!step) continue;
        if (step.responsible) parts.push(step.responsible);
        if (step.description) parts.push(step.description);
        if (step.completionDate) parts.push(step.completionDate);
    }
    return parts.join(' ');
};

const buildSearchableRecordText = (record) => (
    [
        record.nc_number,
        record.mdi_no,
        record.title,
        record.description,
        record.problem_definition,
        record.department,
        record.responsible_person,
        record.supplier?.name,
        record.part_code,
        record.part_name,
        record.source,
        record.requesting_person,
        record.requesting_unit,
        record.rejection_reason,
        record.rejection_notes,
        record.closing_notes,
        record.notes,
        record.priority,
        record.status,
        collect8dProgressText(record.eight_d_progress),
    ]
        .filter(Boolean)
        .map((value) => normalizeTurkishForSearch(String(value)))
        .join(' ')
);

/** Kayıt referansından önceden hesaplanmış arama metnine zayıf ref cache.
    Aynı record nesnesi tekrar geldiğinde stringify atlanır. */
const searchTextCache = new WeakMap();
const getSearchableRecordText = (record) => {
    if (!record || typeof record !== 'object') return '';
    const cached = searchTextCache.get(record);
    if (cached !== undefined) return cached;
    const text = buildSearchableRecordText(record);
    searchTextCache.set(record, text);
    return text;
};

const filterNonConformityRecords = (records, filters, { ignoreDepartment = false } = {}) => {
    const normalizedSearchTerm = normalizeTurkishForSearch((filters.searchTerm || '').trim());
    const searchWords = normalizedSearchTerm.split(/\s+/).filter((word) => word.length > 0);

    return records
        .filter((record) => {
            if (searchWords.length > 0) {
                const searchableText = getSearchableRecordText(record);
                const matchesSearch = searchWords.every((word) => searchableText.includes(word));
                if (!matchesSearch) {
                    return false;
                }
            }

            if (filters.status !== 'all') {
                if (filters.status === 'Gecikmiş') {
                    if (!isNCOverdue(record)) {
                        return false;
                    }
                } else if (record.status !== filters.status) {
                    return false;
                }
            }

            if (filters.type !== 'all' && record.type !== filters.type) {
                return false;
            }

            if (!ignoreDepartment && filters.department && filters.department !== 'all') {
                if (getNormalizedDepartment(record.department) !== getNormalizedDepartment(filters.department)) {
                    return false;
                }
            }

            if (filters.supplierId !== 'all' && record.supplier_id !== filters.supplierId) {
                return false;
            }

            return recordMatchesDateFilter(record, filters);
        })
        .sort(compareDf8dRecordsForModuleList);
};

const buildDepartmentSelectionLabel = (selectedDepartments, availableDepartmentCount) => {
    if (!selectedDepartments || selectedDepartments.length === 0) {
        return 'Birim seçilmedi';
    }

    if (availableDepartmentCount > 0 && selectedDepartments.length === availableDepartmentCount) {
        return 'Tüm Birimler';
    }

    return selectedDepartments.join(', ');
};

const Df8dManagement = ({ onOpenNCForm, onOpenNCView, onDownloadPDF }) => {
        const { nonConformities, suppliers, refreshData, loading, unitCostSettings, personnel } = useData();

        const departmentCanonCtx = useMemo(
            () => ({ unitCostSettings: unitCostSettings || [], personnel: personnel || [] }),
            [unitCostSettings, personnel]
        );

        const normalizedNonConformities = useMemo(
            () => (nonConformities || []).map((r) => canonicalizeNonConformityOrgFields(r, departmentCanonCtx)),
            [nonConformities, departmentCanonCtx]
        );
        const { toast } = useToast();
        const [activeTab, setActiveTab] = useState('dashboard');
        const [filters, setFilters] = useState({
            searchTerm: '',
            status: 'all',
            type: 'all',
            department: 'all',
            supplierId: 'all',
            dateFrom: '',
            dateTo: '',
        });
        
        const [recordListModal, setRecordListModal] = useState({ isOpen: false, title: '', records: [] });
        const [reportModal, setReportModal] = useState({ isOpen: false, reportType: 'list' });
        const [isFolderDownloadOpen, setFolderDownloadOpen] = useState(false);

        const [actionModals, setActionModals] = useState({
            reject: { isOpen: false, record: null },
            close: { isOpen: false, record: null },
            forward: { isOpen: false, record: null },
            inProgress: { isOpen: false, record: null },
            updateDueDate: { isOpen: false, record: null },
        });

        const handleAction = (action, record) => {
            setActionModals(prev => ({ ...prev, [action]: { isOpen: true, record } }));
        };

        const handleCloseActionModal = (action) => {
            setActionModals(prev => ({ ...prev, [action]: { isOpen: false, record: null } }));
        };
        
        const handleDashboardInteraction = (title, records) => {
            setRecordListModal({ isOpen: true, title, records });
        };

        // Filtre değerleri anında uygulanmasın diye `useDeferredValue` ile
        // arka plana atılır — input/select kapanışı bloklanmaz, ağır liste
        // hesabı kullanıcı yazma duraksamasından sonra çalışır.
        const deferredFilters = useDeferredValue(filters);

        const filteredRecords = useMemo(() => {
            return filterNonConformityRecords(normalizedNonConformities, deferredFilters);
        }, [normalizedNonConformities, deferredFilters]);

        const reportableRecords = useMemo(() => (
            filterNonConformityRecords(normalizedNonConformities, deferredFilters, { ignoreDepartment: true })
        ), [normalizedNonConformities, deferredFilters]);

        const handleToggleStatus = async (record) => {
            if (record.status === 'Kapatıldı' || record.status === 'Reddedildi') {
                const { error } = await supabase
                    .from('non_conformities')
                    .update({ status: 'Açık', reopened_at: new Date().toISOString() })
                    .eq('id', record.id);
                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Durum güncellenemedi: ${error.message}` });
                } else {
                    toast({ title: 'Başarılı', description: 'Uygunsuzluk tekrar açıldı.' });
                    refreshData(); // Listeyi otomatik yenile
                }
            } else {
                handleAction('close', record);
            }
        };

        const handleDelete = async (recordId) => {
            // Önce bu NC'ye bağlı şikayetlerin related_nc_id alanını temizle (FK kısıtlaması)
            const { error: unlinkError } = await supabase
                .from('customer_complaints')
                .update({ related_nc_id: null })
                .eq('related_nc_id', recordId);

            if (unlinkError) {
                console.warn('Şikayet bağlantısı temizlenemedi (devam ediliyor):', unlinkError.message);
            }

            const { error } = await supabase.from('non_conformities').delete().eq('id', recordId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Kayıt silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Kayıt başarıyla silindi.' });
                refreshData(); // Listeyi otomatik yenile
            }
        };


        const onAddNC = () => onOpenNCForm(null, refreshData);

        const handleRecordClick = (record) => {
            onOpenNCView(record);
        };

        const handleGenerateReport = useCallback((recordsToReport = filteredRecords, reportDepartments = [], availableDepartmentCount = 0) => {
            if (recordsToReport.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturmak için en az bir kayıt olmalıdır.',
                });
                return;
            }

            const formatDate = (dateString) => {
                if (!dateString) return '-';
                try {
                    return format(parseISO(dateString), 'dd.MM.yyyy');
                } catch {
                    return '-';
                }
            };

            const reportData = {
                id: `nc-list-${Date.now()}`,
                departmentSelectionLabel: buildDepartmentSelectionLabel(reportDepartments, availableDepartmentCount),
                items: recordsToReport.map(record => ({
                    nc_number: record.nc_number || record.mdi_no || '-',
                    type: record.type || '-',
                    title: getNonConformityListTitle(record, '-'),
                    department: record.department || '-',
                    opening_date: formatDate(record.df_opened_at || record.opening_date || record.created_at),
                    closing_date: record.closed_at ? formatDate(record.closed_at) : '-',
                    due_date: record.status === 'Reddedildi' ? '-' : formatDate(record.due_at),
                    status: getNCDisplayStatus(record),
                    responsible_person: record.responsible_person || '-',
                    requesting_person: record.requesting_person || '-',
                    requesting_unit: record.requesting_unit || '-',
                })),
            };

            openPrintableReport(reportData, 'nonconformity_list', true);
        }, [filteredRecords, toast]);

        const handleGenerateExecutiveReport = useCallback((recordsToReport = filteredRecords, reportDepartments = [], availableDepartmentCount = 0) => {
            if (recordsToReport.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturmak için en az bir kayıt olmalıdır.',
                });
                return;
            }

            const formatDate = (dateString) => {
                if (!dateString) return '-';
                try {
                    return format(parseISO(dateString), 'dd.MM.yyyy');
                } catch {
                    return '-';
                }
            };

            const now = new Date();
            const counts = { DF: 0, '8D': 0, MDI: 0, open: 0, closed: 0, rejected: 0, overdue: 0 };
            const deptPerf = {};
            const requesterContrib = {};
            const statusCounts = {};
            const typeCounts = {};

            recordsToReport.forEach(rec => {
                const isClosed = rec.status === 'Kapatıldı';
                const isRejected = rec.status === 'Reddedildi';
                const isOpen = !isClosed && !isRejected;
                const displayStatus = getNCDisplayStatus(rec, now);

                if (isOpen) counts.open++;
                if (isClosed) counts.closed++;
                if (isRejected) counts.rejected++;
                if (rec.type in counts) counts[rec.type]++;

                const isOverdue = isNCOverdue(rec, now);
                if (isOverdue) counts.overdue++;

                const responsibleDept = rec.department || 'Belirtilmemiş';
                if (!deptPerf[responsibleDept]) {
                    deptPerf[responsibleDept] = { open: 0, closed: 0, overdue: 0, totalClosureDays: 0, closedCount: 0 };
                }
                if (isOpen) {
                    deptPerf[responsibleDept].open++;
                    if (isOverdue) deptPerf[responsibleDept].overdue++;
                }
                if (isClosed) {
                    deptPerf[responsibleDept].closed++;
                    const openedAtDate = rec.df_opened_at ? parseISO(rec.df_opened_at) : null;
                    const closedAtDate = parseISO(rec.closed_at);
                    if (openedAtDate && isValid(openedAtDate) && isValid(closedAtDate)) {
                        const closureDays = differenceInDays(closedAtDate, openedAtDate);
                        if (closureDays >= 0) {
                            deptPerf[responsibleDept].totalClosureDays += closureDays;
                            deptPerf[responsibleDept].closedCount++;
                        }
                    }
                }

                const requesterUnit = rec.requesting_unit || 'Belirtilmemiş';
                if (!requesterContrib[requesterUnit]) {
                    requesterContrib[requesterUnit] = { total: 0, DF: 0, '8D': 0, MDI: 0 };
                }
                requesterContrib[requesterUnit].total++;
                if (rec.type in requesterContrib[requesterUnit]) {
                    requesterContrib[requesterUnit][rec.type]++;
                }

                statusCounts[displayStatus] = (statusCounts[displayStatus] || 0) + 1;
                typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
            });

            const deptPerformance = Object.entries(deptPerf).map(([name, data]) => ({
                unit: name,
                open: data.open,
                closed: data.closed,
                overdue: data.overdue,
                avgClosureTime: data.closedCount > 0 ? (data.totalClosureDays / data.closedCount).toFixed(1) : "N/A"
            })).sort((a, b) => b.open - a.open);

            const requesterContribution = Object.entries(requesterContrib).map(([name, data]) => ({
                unit: name,
                total: data.total,
                DF: data.DF,
                '8D': data['8D'],
                MDI: data.MDI,
                contribution: recordsToReport.length > 0 ? ((data.total / recordsToReport.length) * 100).toFixed(1) : '0'
            })).sort((a, b) => b.total - a.total);

            const overdueRecords = recordsToReport.filter(record => isNCOverdue(record, now)).slice(0, 20);

            const reportData = {
                id: `nc-executive-${Date.now()}`,
                reportType: 'executive_summary',
                departmentSelectionLabel: buildDepartmentSelectionLabel(reportDepartments, availableDepartmentCount),
                totalRecords: recordsToReport.length,
                kpiStats: {
                    open: counts.open,
                    closed: counts.closed,
                    rejected: counts.rejected,
                    overdue: counts.overdue,
                    DF: counts.DF,
                    '8D': counts['8D'],
                    MDI: counts.MDI
                },
                statusDistribution: statusCounts,
                typeDistribution: typeCounts,
                deptPerformance: deptPerformance,
                requesterContribution: requesterContribution,
                overdueRecords: overdueRecords.map(record => ({
                    nc_number: record.nc_number || record.mdi_no || '-',
                    type: record.type || '-',
                    title: getNonConformityListTitle(record, '-'),
                    department: record.department || '-',
                    due_date: formatDate(record.due_at),
                    days_overdue: record.due_at ? differenceInDays(now, parseISO(record.due_at)) : 0,
                    status: getNCDisplayStatus(record, now)
                })),
                allRecords: recordsToReport.map(record => ({
                    nc_number: record.nc_number || record.mdi_no || '-',
                    type: record.type || '-',
                    title: getNonConformityListTitle(record, '-'),
                    department: record.department || '-',
                    opening_date: formatDate(record.df_opened_at || record.opening_date || record.created_at),
                    closing_date: record.closed_at ? formatDate(record.closed_at) : '-',
                    due_date: record.status === 'Reddedildi' ? '-' : formatDate(record.due_at),
                    status: getNCDisplayStatus(record, now),
                    responsible_person: record.responsible_person || '-',
                    requesting_person: record.requesting_person || '-',
                    requesting_unit: record.requesting_unit || '-',
                }))
            };

            openPrintableReport(reportData, 'nonconformity_executive', true);
        }, [filteredRecords, toast]);

        const handleOpenReportModal = useCallback(() => {
            if (reportableRecords.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturmak için en az bir kayıt olmalıdır.',
                });
                return;
            }

            setReportModal({
                isOpen: true,
                reportType: activeTab === 'dashboard' ? 'executive' : 'list',
            });
        }, [activeTab, reportableRecords.length, toast]);

        const handleOpenFolderDownloadModal = useCallback(() => {
            if (reportableRecords.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'İndirmek için en az bir kayıt olmalıdır. Filtreleri gevşetin.',
                });
                return;
            }
            setFolderDownloadOpen(true);
        }, [reportableRecords.length, toast]);

        const handleGenerateSelectedReport = useCallback(({ selectedDepartments, availableDepartmentCount }) => {
            const selectedDepartmentSet = new Set(selectedDepartments.map((department) => getDepartmentName(department)));
            const selectedRecords = reportableRecords.filter((record) => (
                selectedDepartmentSet.has(getDepartmentName(record.department))
            ));

            if (selectedRecords.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Seçilen birimlere ait raporlanacak kayıt bulunamadı.',
                });
                return;
            }

            if (reportModal.reportType === 'executive') {
                handleGenerateExecutiveReport(selectedRecords, selectedDepartments, availableDepartmentCount);
                return;
            }

            handleGenerateReport(selectedRecords, selectedDepartments, availableDepartmentCount);
        }, [handleGenerateExecutiveReport, handleGenerateReport, reportModal.reportType, reportableRecords, toast]);

        return (
            <>
                <Helmet>
                    <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
                </Helmet>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <div className="flex flex-col gap-3 sm:gap-4">
                            {/* Tabs ve Butonlar - Mobil için dikey, desktop için yatay */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <TabsList className="w-full sm:w-auto">
                                    <TabsTrigger value="dashboard" className="flex-1 sm:flex-none">
                                        <LayoutDashboard className="mr-1.5 sm:mr-2 h-4 w-4" /> 
                                        <span className="hidden xs:inline">Pano</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="list" className="flex-1 sm:flex-none">
                                        <List className="mr-1.5 sm:mr-2 h-4 w-4" /> 
                                        <span className="hidden xs:inline">Liste</span>
                                    </TabsTrigger>
                                </TabsList>
                                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                                    <Button type="button" onClick={handleOpenFolderDownloadModal} size="sm" variant="outline" className="flex-1 sm:flex-none">
                                        <FolderDown className="mr-1.5 sm:mr-2 h-4 w-4" />
                                        <span className="hidden xs:inline">Klasör İndir</span>
                                        <span className="xs:hidden">ZIP</span>
                                    </Button>
                                    <Button type="button" onClick={handleOpenReportModal} size="sm" variant="outline" className="flex-1 sm:flex-none">
                                        <FileText className="mr-1.5 sm:mr-2 h-4 w-4" />
                                        <span className="hidden xs:inline">Rapor Al</span>
                                        <span className="xs:hidden">Rapor</span>
                                    </Button>
                                    <Button type="button" onClick={onAddNC} size="sm" className="flex-1 sm:flex-none">
                                        <Plus className="mr-1.5 sm:mr-2 h-4 w-4" />
                                        <span className="hidden xs:inline">Yeni Kayıt</span>
                                        <span className="xs:hidden">Ekle</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <NCFilters filters={filters} setFilters={setFilters} suppliers={suppliers || []} />
                        <TabsContent value="dashboard">
                            <NCDashboard records={filteredRecords} loading={loading} onDashboardInteraction={handleDashboardInteraction} />
                        </TabsContent>
                        <TabsContent value="list">
                            <NCTable
                                records={filteredRecords}
                                onView={onOpenNCView}
                                onEdit={(record) => onOpenNCForm(record, refreshData)}
                                onToggleStatus={handleToggleStatus}
                                onDownloadPDF={(record, type, preOpenedWindow) =>
                                    onDownloadPDF(record, type || 'nonconformity', preOpenedWindow)}
                                onDelete={handleDelete}
                                onReject={(record) => handleAction('reject', record)}
                                onForward={(record) => handleAction('forward', record)}
                                onInProgress={(record) => handleAction('inProgress', record)}
                                onUpdateDueDate={(record) => handleAction('updateDueDate', record)}
                            />
                        </TabsContent>
                    </Tabs>
                </motion.div>

                <RecordListModal
                    isOpen={recordListModal.isOpen}
                    setIsOpen={(isOpen) => setRecordListModal(prev => ({ ...prev, isOpen }))}
                    title={recordListModal.title}
                    records={recordListModal.records}
                    onRecordClick={handleRecordClick}
                />

                <NCReportFilterModal
                    isOpen={reportModal.isOpen}
                    setIsOpen={(isOpen) => setReportModal((prev) => ({ ...prev, isOpen }))}
                    records={reportableRecords}
                    reportType={reportModal.reportType}
                    onGenerate={handleGenerateSelectedReport}
                />

                <Df8dFolderDownloadModal
                    isOpen={isFolderDownloadOpen}
                    setIsOpen={setFolderDownloadOpen}
                    records={reportableRecords}
                />

                {actionModals.reject.isOpen && (
                    <RejectModal
                        isOpen={actionModals.reject.isOpen}
                        setIsOpen={() => handleCloseActionModal('reject')}
                        onSave={() => { handleCloseActionModal('reject'); refreshData(); }}
                        record={actionModals.reject.record}
                    />
                )}
                {actionModals.close.isOpen && (
                    <CloseNCModal
                        isOpen={actionModals.close.isOpen}
                        setIsOpen={() => handleCloseActionModal('close')}
                        onSave={() => { handleCloseActionModal('close'); refreshData(); }}
                        record={actionModals.close.record}
                    />
                )}
                {actionModals.forward.isOpen && (
                    <ForwardNCModal
                        isOpen={actionModals.forward.isOpen}
                        setIsOpen={() => handleCloseActionModal('forward')}
                        onSave={() => { handleCloseActionModal('forward'); refreshData(); }}
                        record={actionModals.forward.record}
                    />
                )}
                {actionModals.inProgress.isOpen && (
                    <InProgressModal
                        isOpen={actionModals.inProgress.isOpen}
                        setIsOpen={() => handleCloseActionModal('inProgress')}
                        onSave={() => { handleCloseActionModal('inProgress'); refreshData(); }}
                        record={actionModals.inProgress.record}
                    />
                )}
                {actionModals.updateDueDate.isOpen && (
                    <UpdateDueDateModal
                        isOpen={actionModals.updateDueDate.isOpen}
                        setIsOpen={() => handleCloseActionModal('updateDueDate')}
                        onSave={() => { handleCloseActionModal('updateDueDate'); refreshData(); }}
                        record={actionModals.updateDueDate.record}
                    />
                )}
            </>
        );
    };

    export default Df8dManagement;
