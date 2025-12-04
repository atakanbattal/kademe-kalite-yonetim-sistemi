import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, FileText, CheckCircle2, Clock, AlertCircle,
    BarChart3, Target, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PPAPProjectsList from './PPAPProjectsList';
import PPAPDocuments from './PPAPDocuments';
import PPAPSubmissions from './PPAPSubmissions';
import RunAtRateStudies from './RunAtRateStudies';

const PPAPModule = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('projects');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('apqp_projects')
                .select(`
                    *,
                    customer:customer_id(customer_name, customer_code),
                    project_manager:project_manager_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('PPAP projeleri yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Projeler yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const stats = useMemo(() => {
        const total = projects.length;
        const inProgress = projects.filter(p => 
            ['Planning', 'Design', 'Process Development', 'Product Validation', 'Feedback & Corrective Action'].includes(p.status)
        ).length;
        const approved = projects.filter(p => p.status === 'Approved').length;
        const rejected = projects.filter(p => p.status === 'Rejected').length;

        return { total, inProgress, approved, rejected };
    }, [projects]);

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
                        <FileText className="w-8 h-8" />
                        PPAP/APQP Yönetimi
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Production Part Approval Process / Advanced Product Quality Planning
                    </p>
                </div>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam Proje
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
                            Devam Eden
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Onaylanan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Reddedilen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="projects">
                        <Target className="w-4 h-4 mr-2" />
                        APQP Projeleri
                    </TabsTrigger>
                    <TabsTrigger value="documents">
                        <FileText className="w-4 h-4 mr-2" />
                        PPAP Dokümanları
                    </TabsTrigger>
                    <TabsTrigger value="submissions">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        PPAP Submissions
                    </TabsTrigger>
                    <TabsTrigger value="run-at-rate">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Run-at-Rate
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="projects" className="mt-6">
                    <PPAPProjectsList 
                        projects={projects}
                        loading={loading}
                        onRefresh={loadProjects}
                    />
                </TabsContent>

                <TabsContent value="documents" className="mt-6">
                    <PPAPDocuments projects={projects} />
                </TabsContent>

                <TabsContent value="submissions" className="mt-6">
                    <PPAPSubmissions projects={projects} />
                </TabsContent>

                <TabsContent value="run-at-rate" className="mt-6">
                    <RunAtRateStudies projects={projects} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default PPAPModule;

