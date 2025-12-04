import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, Search, Filter, BarChart3, TrendingUp, 
    Target, Activity, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import SPCCharacteristicsList from './SPCCharacteristicsList';
import SPCControlCharts from './SPCControlCharts';
import SPCCapabilityAnalysis from './SPCCapabilityAnalysis';
import MSAStudies from './MSAStudies';

const SPCModule = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('characteristics');
    const [characteristics, setCharacteristics] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCharacteristics = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('spc_characteristics')
                .select(`
                    *,
                    responsible_person:responsible_person_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCharacteristics(data || []);
        } catch (error) {
            console.error('SPC karakteristikleri yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Karakteristikler yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadCharacteristics();
    }, [loadCharacteristics]);

    const stats = useMemo(() => {
        const total = characteristics.length;
        const active = characteristics.filter(c => c.is_active).length;
        const outOfControl = characteristics.filter(c => {
            // Bu bilgiyi kontrol grafiklerinden almak gerekir
            return false; // Placeholder
        }).length;
        const capable = characteristics.filter(c => {
            // Bu bilgiyi capability studies'den almak gerekir
            return false; // Placeholder
        }).length;

        return { total, active, outOfControl, capable };
    }, [characteristics]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <BarChart3 className="w-8 h-8" />
                        İstatistiksel Proses Kontrolü (SPC)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        IATF 16949 - Proses stabilitesi ve yetenek analizi
                    </p>
                </div>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam Karakteristik
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-500" />
                            Aktif Karakteristikler
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Kontrol Dışı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.outOfControl}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-500" />
                            Yetenekli Prosesler
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.capable}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="characteristics">
                        <Target className="w-4 h-4 mr-2" />
                        Kritik Karakteristikler
                    </TabsTrigger>
                    <TabsTrigger value="control-charts">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Kontrol Grafikleri
                    </TabsTrigger>
                    <TabsTrigger value="capability">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Proses Yetenek Analizi
                    </TabsTrigger>
                    <TabsTrigger value="msa">
                        <Activity className="w-4 h-4 mr-2" />
                        MSA Çalışmaları
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="characteristics" className="mt-6">
                    <SPCCharacteristicsList 
                        characteristics={characteristics}
                        loading={loading}
                        onRefresh={loadCharacteristics}
                    />
                </TabsContent>

                <TabsContent value="control-charts" className="mt-6">
                    <SPCControlCharts characteristics={characteristics} />
                </TabsContent>

                <TabsContent value="capability" className="mt-6">
                    <SPCCapabilityAnalysis characteristics={characteristics} />
                </TabsContent>

                <TabsContent value="msa" className="mt-6">
                    <MSAStudies />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default SPCModule;

