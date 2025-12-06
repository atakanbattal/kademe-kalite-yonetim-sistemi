import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    FileCheck, CheckCircle2, Clock, AlertCircle, Plus,
    FileText, Settings, TestTube
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ValidationPlansList from './ValidationPlansList';
import ValidationProtocols from './ValidationProtocols';

const ProcessValidationModule = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadPlans = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('validation_plans')
                .select(`
                    *,
                    equipment:equipment_id(id, name, serial_number),
                    responsible_person:responsible_person_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'validation_plans tablosu henüz oluşturulmamış.'
                    });
                    setPlans([]);
                    setLoading(false);
                    return;
                }
                throw error;
            }
            setPlans(data || []);
        } catch (error) {
            console.error('Validation plans loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Validasyon planları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    const stats = useMemo(() => {
        const total = plans.length;
        const inProgress = plans.filter(p => p.status === 'In Progress').length;
        const completed = plans.filter(p => p.status === 'Completed').length;
        const planned = plans.filter(p => p.status === 'Planned').length;

        return { total, inProgress, completed, planned };
    }, [plans]);

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
                        <FileCheck className="w-8 h-8" />
                        Proses Validasyonu
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        IQ/OQ/PQ Protokolleri ve Validasyon Planları
                    </p>
                </div>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam Plan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            Planlanan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.planned}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Settings className="w-4 h-4 text-blue-500" />
                            Devam Eden
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Tamamlanan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="plans">
                        <FileText className="w-4 h-4 mr-2" />
                        Validasyon Planları
                    </TabsTrigger>
                    <TabsTrigger value="protocols">
                        <TestTube className="w-4 h-4 mr-2" />
                        IQ/OQ/PQ Protokolleri
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="plans" className="mt-6">
                    <ValidationPlansList 
                        plans={plans}
                        loading={loading}
                        onRefresh={loadPlans}
                    />
                </TabsContent>

                <TabsContent value="protocols" className="mt-6">
                    <ValidationProtocols plans={plans} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default ProcessValidationModule;
