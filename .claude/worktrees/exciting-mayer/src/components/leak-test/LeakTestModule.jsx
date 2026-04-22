import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart3, Droplets, FileSpreadsheet, List, Plus, Presentation } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import LeakTestDashboard from './LeakTestDashboard';
import LeakTestFormModal from './LeakTestFormModal';
import LeakTestList from './LeakTestList';

const isMissingLeakTestTableError = (error) => {
    if (!error) return false;

    return error.code === '42P01'
        || error.code === 'PGRST205'
        || String(error.message || '').toLowerCase().includes('leak_test_records');
};

const LeakTestModule = () => {
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [schemaReady, setSchemaReady] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [activeTab, setActiveTab] = useState('list');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const PAGE = 1000;
            const allRows = [];
            let from = 0;
            for (;;) {
                const { data, error } = await supabase
                    .from('leak_test_records')
                    .select(`
                        id, record_number, test_date, test_start_time, test_duration_minutes,
                        test_result, leak_count, tank_type, notes, part_code,
                        vehicle_serial_number, vehicle_type_id, vehicle_type_label,
                        tested_by_personnel_id, tested_by_name,
                        welded_by_personnel_id, welded_by_name,
                        supplier_id, supplier_name, welding_at_supplier,
                        created_at, created_by, updated_at,
                        vehicle_type:vehicle_type_id(id, product_code, product_name),
                        tested_by:tested_by_personnel_id(id, full_name, department),
                        welded_by:welded_by_personnel_id(id, full_name, department),
                        supplier:supplier_id(id, name)
                    `)
                    .order('test_date', { ascending: false })
                    .order('test_start_time', { ascending: false })
                    .order('created_at', { ascending: false })
                    .range(from, from + PAGE - 1);

                if (error) throw error;
                if (data?.length) allRows.push(...data);
                if (!data?.length || data.length < PAGE) break;
                from += PAGE;
            }

            setSchemaReady(true);
            setRecords(allRows);
        } catch (error) {
            if (isMissingLeakTestTableError(error)) {
                setSchemaReady(false);
                setRecords([]);
                return;
            }

            toast({
                variant: 'destructive',
                title: 'Veriler alınamadı',
                description: error.message || 'Sızdırmazlık kayıtları yüklenirken bir hata oluştu.',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddNew = useCallback(() => {
        setSelectedRecord(null);
        setIsViewMode(false);
        setFormModalOpen(true);
    }, []);

    const handleEdit = useCallback((record) => {
        setSelectedRecord(record);
        setIsViewMode(false);
        setFormModalOpen(true);
    }, []);

    const handleView = useCallback((record) => {
        setSelectedRecord(record);
        setIsViewMode(true);
        setFormModalOpen(true);
    }, []);

    const handleFormClose = useCallback(() => {
        setFormModalOpen(false);
        setSelectedRecord(null);
        setIsViewMode(false);
        fetchData();
    }, [fetchData]);

    const handleLeakTestListReport = useCallback(() => {
        if (!records.length) {
            toast({ variant: 'destructive', title: 'Rapor', description: 'Listelenecek sızdırmazlık kaydı yok.' });
            return;
        }
        openPrintableReport(
            {
                id: `leak-test-list-${Date.now()}`,
                title: 'Sızdırmazlık Test Listesi Raporu',
                items: records.map((r) => ({
                    record_number: r.record_number,
                    test_date: r.test_date,
                    test_result: r.test_result,
                    part_code: r.part_code,
                    vehicle_serial_number: r.vehicle_serial_number,
                    tank_type: r.tank_type,
                    leak_count: r.leak_count,
                    tested_by_name: r.tested_by_name,
                    welded_by_name: r.welded_by_name,
                })),
            },
            'leak_test_list',
            true
        );
    }, [records, toast]);

    if (!schemaReady) {
        return (
            <div className="space-y-6">
                <div>
                    <p className="mt-1 text-muted-foreground">
                        Modül eklendi ancak veritabanı tablosu henüz hazır görünmüyor.
                    </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                    <h2 className="text-lg font-semibold text-amber-950">Migration gerekli</h2>
                    <p className="mt-2 text-sm text-amber-900">
                        `supabase/migrations` altına eklenen yeni migration uygulanmadan bu modül kayıt okuyamaz.
                        Veritabanı migration'ını çalıştırdıktan sonra sayfayı yenilemen yeterli.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Sızdırmazlık Kontrol | Kademe QMS</title>
            </Helmet>

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="mt-1 text-muted-foreground">
                            Araç tipi, sızdırmazlık parçası ve kaynak sorumluluğu bazında sızdırmazlık testlerini akıllı şekilde arşivleyin.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleLeakTestListReport} disabled={loading || !records.length}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Rapor Al
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/print/executive-presentation" target="_blank" rel="noopener noreferrer">
                                <Presentation className="mr-2 h-4 w-4" />
                                Yönetici özeti
                            </Link>
                        </Button>
                        <Button onClick={handleAddNew}>
                            <Plus className="mr-2 h-4 w-4" />
                            Yeni Kayıt
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 gap-1">
                        <TabsTrigger value="list">
                            <List className="mr-2 h-4 w-4" />
                            Kayıt Listesi
                        </TabsTrigger>
                        <TabsTrigger value="dashboard">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Genel Bakış
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-6">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <LeakTestList
                                records={records}
                                loading={loading}
                                onView={handleView}
                                onEdit={handleEdit}
                                onDelete={fetchData}
                            />
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="dashboard" className="mt-6">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <LeakTestDashboard records={records} loading={loading} />
                        </motion.div>
                    </TabsContent>
                </Tabs>

                <LeakTestFormModal
                    isOpen={isFormModalOpen}
                    setIsOpen={setFormModalOpen}
                    record={selectedRecord}
                    isViewMode={isViewMode}
                    onSuccess={handleFormClose}
                />
            </div>
        </>
    );
};

export default LeakTestModule;
