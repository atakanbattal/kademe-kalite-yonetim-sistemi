import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, FileText, List, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BalanceRecordsList from './BalanceRecordsList';
import BalanceRecordFormModal from './BalanceRecordFormModal';
import BalanceDashboard from './BalanceDashboard';
import FanProductsManager from './FanProductsManager';
import { openPrintableReport } from '@/lib/reportUtils';

const DynamicBalanceModule = () => {
    const { toast } = useToast();
    const [balanceRecords, setBalanceRecords] = useState([]);
    const [fanProducts, setFanProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [activeTab, setActiveTab] = useState('list');

    // Verileri çek
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Balans kayıtlarını çek (ürün bilgisi ile birlikte)
            const { data: recordsData, error: recordsError } = await supabase
                .from('fan_balance_records')
                .select('*, fan_products(product_code, product_name)')
                .order('test_date', { ascending: false });

            if (recordsError) throw recordsError;

            // Fan ürünlerini çek
            const { data: productsData, error: productsError } = await supabase
                .from('fan_products')
                .select('*')
                .eq('is_active', true)
                .order('product_code', { ascending: true });

            if (productsError) throw productsError;

            setBalanceRecords(recordsData || []);
            setFanProducts(productsData || []);
        } catch (error) {
            console.error('Veri çekme hatası:', error);
            toast({
                variant: "destructive",
                title: "Hata!",
                description: "Veriler yüklenirken bir hata oluştu: " + error.message
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

    const handleDownloadPDF = useCallback((record) => {
        openPrintableReport(record, 'dynamic_balance', false);
    }, []);

    return (
        <>
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Dinamik Balans Kalite Kontrol</h1>
                        <p className="text-muted-foreground mt-1">
                            ISO 21940-11:2016 standardına göre fan balans kayıtlarını yönetin ve raporlayın.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleAddNew}>
                            <Plus className="w-4 h-4 mr-2" /> Yeni Kayıt
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 gap-1">
                        <TabsTrigger value="list">
                            <List className="w-4 h-4 mr-2" />
                            Kayıt Listesi
                        </TabsTrigger>
                        <TabsTrigger value="dashboard">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Genel Bakış
                        </TabsTrigger>
                        <TabsTrigger value="products">
                            <FileText className="w-4 h-4 mr-2" />
                            Ürün Tanımları
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <BalanceRecordsList
                                records={balanceRecords}
                                loading={loading}
                                onEdit={handleEdit}
                                onView={handleView}
                                onDelete={fetchData}
                                onDownloadPDF={handleDownloadPDF}
                            />
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="dashboard" className="mt-6">
                        <BalanceDashboard
                            records={balanceRecords}
                            loading={loading}
                        />
                    </TabsContent>

                    <TabsContent value="products" className="mt-6">
                        <FanProductsManager />
                    </TabsContent>
                </Tabs>

                <BalanceRecordFormModal
                    isOpen={isFormModalOpen}
                    setIsOpen={setFormModalOpen}
                    record={selectedRecord}
                    fanProducts={fanProducts}
                    onSuccess={handleFormClose}
                    isViewMode={isViewMode}
                    onDownloadPDF={handleDownloadPDF}
                />
            </div>
        </>
    );
};

export default DynamicBalanceModule;

