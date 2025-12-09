import React, { useState, useMemo, useCallback } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { LayoutDashboard, List, Plus, FileText } from 'lucide-react';
    import NCDashboard from '@/components/df-8d/NCDashboard';
    import NCTable from '@/components/df-8d/NCTable';
    import NCFilters from '@/components/df-8d/NCFilters';
    import { RejectModal, ForwardNCModal, InProgressModal, UpdateDueDateModal } from '@/components/df-8d/modals/ActionModals';
    import CloseNCModal from '@/components/df-8d/modals/CloseNCModal';
    import RecordListModal from '@/components/df-8d/modals/RecordListModal';
    import { Button } from '@/components/ui/button';
import { parseISO, isAfter, format } from 'date-fns';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { openPrintableReport } from '@/lib/reportUtils';

    const Df8dManagement = ({ onOpenNCForm, onOpenNCView, onDownloadPDF }) => {
        const { nonConformities, refreshData, loading } = useData();
        const { toast } = useToast();
        const [activeTab, setActiveTab] = useState('dashboard');
        const [filters, setFilters] = useState({
            searchTerm: '',
            status: 'all',
            type: 'all',
            department: 'all',
        });
        
        const [recordListModal, setRecordListModal] = useState({ isOpen: false, title: '', records: [] });

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

        const filteredRecords = useMemo(() => {
            // Boş arama terimi için tüm kayıtları göster
            if (!filters.searchTerm || filters.searchTerm.trim() === '') {
                const filtered = nonConformities.filter(record => {
                    let matchesStatus = true;
                    if (filters.status !== 'all') {
                        if (filters.status === 'Gecikmiş') {
                            const isOverdue = record.status !== 'Kapatıldı' && record.status !== 'Reddedildi' && record.due_at && isAfter(new Date(), parseISO(record.due_at));
                            matchesStatus = isOverdue;
                        } else {
                            matchesStatus = record.status === filters.status;
                        }
                    }

                const matchesType = filters.type === 'all' || record.type === filters.type;
                const matchesDepartment = filters.department === 'all' || record.department === filters.department;

                return matchesStatus && matchesType && matchesDepartment;
                });

                return filtered.sort((a, b) => {
                    const dateA = a.df_opened_at ? parseISO(a.df_opened_at) : parseISO(a.created_at);
                    const dateB = b.df_opened_at ? parseISO(b.df_opened_at) : parseISO(b.created_at);
                    
                    if (dateB - dateA !== 0) {
                        return dateB - dateA;
                    }

                    const numA = a.nc_number || a.mdi_no || '';
                    const numB = b.nc_number || b.mdi_no || '';
                    return numB.localeCompare(numA, undefined, { numeric: true });
                });
            }

            const normalizedSearchTerm = normalizeTurkishForSearch(filters.searchTerm.trim());
            // Arama terimini kelimelere böl (daha esnek arama için)
            const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);
            
            const filtered = nonConformities.filter(record => {
                // Tüm alanları birleştir ve arama yap (Türkçe karakterleri normalize et)
                const searchableText = [
                    record.nc_number,
                    record.mdi_no,
                    record.title,
                    record.description,
                    record.problem_definition,
                    record.department,
                    record.responsible_person,
                    record.supplier_name,
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
                    // JSON alanlarından da arama yap
                    record.eight_d_progress ? JSON.stringify(record.eight_d_progress) : null,
                ]
                .filter(Boolean)
                .map(val => normalizeTurkishForSearch(String(val)))
                .join(' ');

                // Tüm kelimelerin eşleşmesi gerekiyor (AND mantığı)
                const matchesSearch = searchWords.every(word => searchableText.includes(word));

                let matchesStatus = true;
                if (filters.status !== 'all') {
                    if (filters.status === 'Gecikmiş') {
                        const isOverdue = record.status !== 'Kapatıldı' && record.status !== 'Reddedildi' && record.due_at && isAfter(new Date(), parseISO(record.due_at));
                        matchesStatus = isOverdue;
                    } else {
                        matchesStatus = record.status === filters.status;
                    }
                }

                const matchesType = filters.type === 'all' || record.type === filters.type;
                const matchesDepartment = filters.department === 'all' || record.department === filters.department;

                return matchesSearch && matchesStatus && matchesType && matchesDepartment;
            });

            return filtered.sort((a, b) => {
                const dateA = a.df_opened_at ? parseISO(a.df_opened_at) : parseISO(a.created_at);
                const dateB = b.df_opened_at ? parseISO(b.df_opened_at) : parseISO(b.created_at);
                
                if (dateB - dateA !== 0) {
                    return dateB - dateA;
                }

                const numA = a.nc_number || a.mdi_no || '';
                const numB = b.nc_number || b.mdi_no || '';
                return numB.localeCompare(numA, undefined, { numeric: true });
            });
        }, [nonConformities, filters]);

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
                }
            } else {
                handleAction('close', record);
            }
        };

        const handleDelete = async (recordId) => {
            const { error } = await supabase.from('non_conformities').delete().eq('id', recordId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Kayıt silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Kayıt başarıyla silindi.' });
            }
        };

        const onAddNC = () => onOpenNCForm(null, refreshData);

        const handleRecordClick = (record) => {
            onOpenNCView(record);
        };

        const handleGenerateReport = () => {
            if (filteredRecords.length === 0) {
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
                items: filteredRecords.map(record => ({
                    nc_number: record.nc_number || record.mdi_no || '-',
                    type: record.type || '-',
                    title: record.title || '-',
                    department: record.department || '-',
                    opening_date: formatDate(record.df_opened_at || record.opening_date || record.created_at),
                    closing_date: record.closed_at ? formatDate(record.closed_at) : '-',
                    due_date: record.status === 'Reddedildi' ? '-' : formatDate(record.due_at),
                    status: record.status || '-',
                    responsible_person: record.responsible_person || '-',
                    requesting_person: record.requesting_person || '-',
                    requesting_unit: record.requesting_unit || '-',
                })),
            };

            openPrintableReport(reportData, 'nonconformity_list', true);
        };

        return (
            <>
                <Helmet>
                    <title>DF ve 8D Yönetimi - Kalite Yönetim Sistemi</title>
                </Helmet>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <TabsList>
                                <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Pano</TabsTrigger>
                                <TabsTrigger value="list"><List className="mr-2 h-4 w-4" /> Liste</TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-2">
                                {activeTab === 'list' && (
                                    <Button onClick={handleGenerateReport} size="sm" variant="outline">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Rapor Al
                                    </Button>
                                )}
                                <Button onClick={onAddNC} size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Yeni Kayıt
                                </Button>
                            </div>
                        </div>
                        <NCFilters filters={filters} setFilters={setFilters} />
                        <TabsContent value="dashboard">
                            <NCDashboard records={filteredRecords} loading={loading} onDashboardInteraction={handleDashboardInteraction} />
                        </TabsContent>
                        <TabsContent value="list">
                            <NCTable
                                records={filteredRecords}
                                onView={onOpenNCView}
                                onEdit={(record) => onOpenNCForm(record, refreshData)}
                                onToggleStatus={handleToggleStatus}
                                onDownloadPDF={(record) => onDownloadPDF(record, 'nonconformity')}
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
                        onSave={() => handleCloseActionModal('close')}
                        record={actionModals.close.record}
                    />
                )}
                {actionModals.forward.isOpen && (
                    <ForwardNCModal
                        isOpen={actionModals.forward.isOpen}
                        setIsOpen={() => handleCloseActionModal('forward')}
                        onSave={() => handleCloseActionModal('forward')}
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