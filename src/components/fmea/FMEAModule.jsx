import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, AlertTriangle, FileText, CheckCircle2, 
    TrendingUp, Target, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import FMEAProjectsList from './FMEAProjectsList';
import FMEADetailView from './FMEADetailView';

const FMEAModule = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('projects');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fmea_projects')
                .select(`
                    *,
                    customer:customer_id(customer_name, customer_code),
                    team_leader:team_leader_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('FMEA projeleri yüklenirken hata:', error);
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
        const dfmea = projects.filter(p => p.fmea_type === 'DFMEA').length;
        const pfmea = projects.filter(p => p.fmea_type === 'PFMEA').length;
        const active = projects.filter(p => p.status === 'Active').length;
        const approved = projects.filter(p => p.status === 'Approved').length;

        return { total, dfmea, pfmea, active, approved };
    }, [projects]);

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setActiveTab('detail');
    };

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
                        <AlertTriangle className="w-8 h-8" />
                        FMEA Yönetimi
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Failure Mode and Effects Analysis - DFMEA & PFMEA
                    </p>
                </div>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam FMEA
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            DFMEA
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.dfmea}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            PFMEA
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.pfmea}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Aktif
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-500" />
                            Onaylanan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="projects">
                        <FileText className="w-4 h-4 mr-2" />
                        FMEA Projeleri
                    </TabsTrigger>
                    <TabsTrigger value="detail" disabled={!selectedProject}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        FMEA Detayı
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="projects" className="mt-6">
                    <FMEAProjectsList 
                        projects={projects}
                        loading={loading}
                        onRefresh={loadProjects}
                        onSelectProject={handleProjectSelect}
                    />
                </TabsContent>

                <TabsContent value="detail" className="mt-6">
                    {selectedProject ? (
                        <FMEADetailView 
                            project={selectedProject}
                            onBack={() => {
                                setSelectedProject(null);
                                setActiveTab('projects');
                            }}
                        />
                    ) : (
                        <Card>
                            <CardContent className="py-12">
                                <div className="text-center text-muted-foreground">
                                    Lütfen bir FMEA projesi seçin.
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default FMEAModule;

