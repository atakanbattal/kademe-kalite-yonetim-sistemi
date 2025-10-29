import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, BarChart3 } from 'lucide-react';
import DeviationList from '@/components/deviation/DeviationList';
import DeviationFormModal from '@/components/deviation/DeviationFormModal';
import DeviationDetailModal from '@/components/deviation/DeviationDetailModal';
import DeviationDashboard from '@/components/deviation/DeviationDashboard';
import DeviationApprovalModal from '@/components/deviation/DeviationApprovalModal';
import DeviationFilters from '@/components/deviation/DeviationFilters';
import DeviationAnalytics from '@/components/deviation/DeviationAnalytics';
import CreateNCFromDeviationModal from '@/components/deviation/CreateNCFromDeviationModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { useData } from '@/contexts/DataContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseISO, isAfter, isBefore } from 'date-fns';

const DeviationModule = ({ onOpenNCForm }) => {
    const { toast } = useToast();
    const { deviations, loading, refreshData } = useData();
    const [isFormOpen, setFormOpen] = useState(false);
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [isApprovalOpen, setApprovalOpen] = useState(false);
    const [isCreateNCOpen, setCreateNCOpen] = useState(false);
    const [selectedDeviation, setSelectedDeviation] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [filters, setFilters] = useState({
        searchTerm: '',
        status: 'all',
        requestingUnit: 'all',
        source: 'all',
        dateRange: { from: null, to: null },
    });

    const filteredDeviations = useMemo(() => {
        return deviations.filter(d => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const matchesSearch =
                (d.request_no && d.request_no.toLowerCase().includes(searchTermLower)) ||
                (d.description && d.description.toLowerCase().includes(searchTermLower)) ||
                (d.requesting_person && d.requesting_person.toLowerCase().includes(searchTermLower));

            const matchesStatus = filters.status === 'all' || d.status === filters.status;
            const matchesUnit = filters.requestingUnit === 'all' || d.requesting_unit === filters.requestingUnit;
            const matchesSource = filters.source === 'all' || d.source === filters.source;

            let matchesDate = true;
            if (filters.dateRange.from && filters.dateRange.to) {
                const recordDate = parseISO(d.created_at);
                matchesDate = !isBefore(recordDate, filters.dateRange.from) && !isAfter(recordDate, filters.dateRange.to);
            } else if (filters.dateRange.from) {
                matchesDate = !isBefore(parseISO(d.created_at), filters.dateRange.from);
            } else if (filters.dateRange.to) {
                matchesDate = !isAfter(parseISO(d.created_at), filters.dateRange.to);
            }

            return matchesSearch && matchesStatus && matchesUnit && matchesSource && matchesDate;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [deviations, filters]);

    const handleOpenForm = (deviation = null) => {
        setSelectedDeviation(deviation);
        setFormOpen(true);
    };

    const handleOpenDetail = (deviation) => {
        setSelectedDeviation(deviation);
        setDetailOpen(true);
    };

    const handleOpenApproval = (deviation) => {
        setSelectedDeviation(deviation);
        setApprovalOpen(true);
    };

    const handleOpenCreateNC = (deviation) => {
        setSelectedDeviation(deviation);
        setCreateNCOpen(true);
    };

    const handleDelete = async (id) => {
        await supabase.from('deviation_approvals').delete().eq('deviation_id', id);
        await supabase.from('deviation_attachments').delete().eq('deviation_id', id);
        await supabase.from('deviation_vehicles').delete().eq('deviation_id', id);
        const { error } = await supabase.from('deviations').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Sapma kaydı silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Sapma kaydı başarıyla silindi.' });
            refreshData();
        }
    };

    return (
        <div className="space-y-6">
            <Helmet>
                <title>Sapma Yönetimi</title>
                <meta name="description" content="Üretim ve süreç sapmalarını yönetin, onay süreçlerini takip edin." />
            </Helmet>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-foreground">Sapma Yönetimi</h1>
                <Button onClick={() => handleOpenForm()}><Plus className="mr-2 h-4 w-4" /> Yeni Sapma Talebi</Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="dashboard"><LayoutGrid className="mr-2 h-4 w-4" /> Pano</TabsTrigger>
                    <TabsTrigger value="list"><List className="mr-2 h-4 w-4" /> Liste</TabsTrigger>
                    <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" /> Analiz</TabsTrigger>
                </TabsList>
                <DeviationFilters filters={filters} setFilters={setFilters} deviations={deviations} />
                <TabsContent value="dashboard">
                    <DeviationDashboard deviations={filteredDeviations} loading={loading} />
                </TabsContent>
                <TabsContent value="list">
                    <DeviationList
                        deviations={filteredDeviations}
                        loading={loading}
                        onEdit={handleOpenForm}
                        onDelete={handleDelete}
                        onView={handleOpenDetail}
                        onApprove={handleOpenApproval}
                        onCreateNC={handleOpenCreateNC}
                    />
                </TabsContent>
                <TabsContent value="analytics">
                    <DeviationAnalytics deviations={filteredDeviations} />
                </TabsContent>
            </Tabs>

            {isFormOpen && (
                <DeviationFormModal
                    isOpen={isFormOpen}
                    setIsOpen={setFormOpen}
                    refreshData={refreshData}
                    existingDeviation={selectedDeviation}
                />
            )}

            {isDetailOpen && selectedDeviation && (
                <DeviationDetailModal
                    isOpen={isDetailOpen}
                    setIsOpen={setDetailOpen}
                    deviation={selectedDeviation}
                />
            )}

            {isApprovalOpen && selectedDeviation && (
                <DeviationApprovalModal
                    isOpen={isApprovalOpen}
                    setIsOpen={setApprovalOpen}
                    deviation={selectedDeviation}
                    onRefresh={refreshData}
                />
            )}

            {isCreateNCOpen && selectedDeviation && (
                <CreateNCFromDeviationModal
                    isOpen={isCreateNCOpen}
                    setIsOpen={setCreateNCOpen}
                    deviation={selectedDeviation}
                    onOpenNCForm={onOpenNCForm}
                    refreshData={refreshData}
                />
            )}
        </div>
    );
};

export default DeviationModule;