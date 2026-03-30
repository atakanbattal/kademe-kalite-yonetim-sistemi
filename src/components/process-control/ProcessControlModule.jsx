import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProcessControlDashboard from './ProcessControlDashboard';
import ControlPlanManagement from './ControlPlanManagement';
import ProcessInkrManagement from './ProcessInkrManagement';
import ProcessInspectionManagement from './ProcessInspectionManagement';
import ProcessControlFolderDownloadModal from './ProcessControlFolderDownloadModal';
import { Download } from 'lucide-react';
import { enrichProcessInkrReports } from './processInkrUtils';

const PROCESS_CONTROL_TABS = [
    { value: 'dashboard', label: 'Ana Ekran' },
    { value: 'inspections', label: 'Muayene Kayıtları' },
    { value: 'plans', label: 'Kontrol Planları' },
    { value: 'inkr', label: 'İlk Numune (INKR)' },
];

const ProcessControlModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const [plans, setPlans] = useState([]);
    const [inkrReports, setInkrReports] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isFolderDownloadOpen, setIsFolderDownloadOpen] = useState(false);

    const enrichedInkrReports = useMemo(
        () => enrichProcessInkrReports(inkrReports, plans),
        [inkrReports, plans]
    );

    const fetchPlans = useCallback(async () => {
        try {
            const PAGE = 1000;
            let all = [];
            let from = 0;
            for (;;) {
                const { data, error } = await supabase
                    .from('process_control_plans')
                    .select('*, process_control_equipment(equipment_code, equipment_name)')
                    .order('updated_at', { ascending: false })
                    .range(from, from + PAGE - 1);
                
                if (error) {
                    if (error.code === '42P01' || error.message.includes('does not exist')) {
                        console.warn('process_control_plans tablosu henüz oluşturulmamış');
                        setPlans([]);
                        return;
                    }
                    throw error;
                }
                if (data?.length) all.push(...data);
                if (!data?.length || data.length < PAGE) break;
                from += PAGE;
            }
            setPlans(all);
        } catch (err) {
            console.error('Kontrol planı yükleme hatası:', err);
            setPlans([]);
        }
    }, []);

    const fetchInkrReports = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_inkr_reports')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_inkr_reports tablosu henüz oluşturulmamış');
                    setInkrReports([]);
                    return;
                }
                throw error;
            }

            setInkrReports(data || []);
        } catch (err) {
            console.error('INKR yükleme hatası:', err);
            setInkrReports([]);
        }
    }, []);

    const fetchInspections = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_inspections')
                .select('*')
                .order('inspection_date', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_inspections tablosu henüz oluşturulmamış');
                    setInspections([]);
                    return;
                }
                throw error;
            }

            setInspections(data || []);
        } catch (err) {
            console.error('Muayene kayıtları yükleme hatası:', err);
            setInspections([]);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchPlans(),
                fetchInkrReports(),
                fetchInspections(),
            ]);
            setLoading(false);
        };
        loadData();
    }, [fetchPlans, fetchInkrReports, fetchInspections]);

    return (
        <>
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-muted-foreground mt-1">
                            Kontrol planları, ilk numune raporları ve proses muayene kayıtlarını yönetin.
                        </p>
                    </div>
                    <Button onClick={() => setIsFolderDownloadOpen(true)} className="sm:self-start">
                        <Download className="mr-2 h-4 w-4" />
                        Klasör İndir
                    </Button>
                </div>

                <ProcessControlFolderDownloadModal
                    isOpen={isFolderDownloadOpen}
                    setIsOpen={setIsFolderDownloadOpen}
                    plans={plans}
                    inkrReports={enrichedInkrReports}
                />

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
                        {PROCESS_CONTROL_TABS.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className="w-full min-w-0">
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="dashboard" className="mt-6">
                        <ProcessControlDashboard 
                            plans={plans}
                            inkrReports={enrichedInkrReports}
                            inspections={inspections}
                            loading={loading}
                            onTabChange={setActiveTab}
                        />
                    </TabsContent>

                    <TabsContent value="inspections" className="mt-6">
                        <ProcessInspectionManagement />
                    </TabsContent>

                    <TabsContent value="plans" className="mt-6">
                        <ControlPlanManagement 
                            plans={plans}
                            loading={loading}
                            refreshPlans={fetchPlans}
                        />
                    </TabsContent>

                    <TabsContent value="inkr" className="mt-6">
                        <ProcessInkrManagement
                            plans={plans}
                            refreshReports={fetchInkrReports}
                            refreshData={fetchInkrReports}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

export default ProcessControlModule;
