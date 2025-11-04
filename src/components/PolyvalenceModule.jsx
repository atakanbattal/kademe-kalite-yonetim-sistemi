import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Users, GraduationCap, TrendingUp, AlertTriangle, 
    Search, Plus, Filter, Download, BarChart3,
    Award, Target, BookOpen, Clock
} from 'lucide-react';
import PolyvalenceMatrix from './polyvalence/PolyvalenceMatrix';
import PolyvalenceAnalytics from './polyvalence/PolyvalenceAnalytics';
import SkillManagement from './polyvalence/SkillManagement';
import TrainingNeedsAnalysis from './polyvalence/TrainingNeedsAnalysis';
import PersonnelFormModal from './polyvalence/PersonnelFormModal';
import TrainingFormModal from './polyvalence/TrainingFormModal';

const PolyvalenceModule = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('matrix');
    
    // Data states
    const [personnel, setPersonnel] = useState([]);
    const [skills, setSkills] = useState([]);
    const [skillCategories, setSkillCategories] = useState([]);
    const [personnelSkills, setPersonnelSkills] = useState([]);
    const [certificationAlerts, setCertificationAlerts] = useState([]);
    const [polyvalenceSummary, setPolyvalenceSummary] = useState([]);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    
    // Modal states
    const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                personnelRes,
                skillsRes,
                categoriesRes,
                personnelSkillsRes,
                alertsRes,
                summaryRes
            ] = await Promise.all([
                supabase.from('personnel').select('*').order('full_name'),
                supabase.from('skills').select('*, category:skill_categories(name, color, icon)').eq('is_active', true).order('name'),
                supabase.from('skill_categories').select('*').eq('is_active', true).order('order_index'),
                supabase.from('personnel_skills').select(`
                    *,
                    personnel:personnel(id, full_name, department, position),
                    skill:skills(id, name, code, requires_certification, is_critical)
                `),
                supabase.from('certification_expiry_alerts').select('*'),
                supabase.from('polyvalence_summary').select('*')
            ]);

            if (personnelRes.error) throw personnelRes.error;
            if (skillsRes.error) throw skillsRes.error;
            if (categoriesRes.error) throw categoriesRes.error;
            if (personnelSkillsRes.error) throw personnelSkillsRes.error;

            setPersonnel(personnelRes.data || []);
            setSkills(skillsRes.data || []);
            setSkillCategories(categoriesRes.data || []);
            setPersonnelSkills(personnelSkillsRes.data || []);
            setCertificationAlerts(alertsRes.data || []);
            setPolyvalenceSummary(summaryRes.data || []);

        } catch (error) {
            console.error('Veri yükleme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Polivalans verileri yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    // Departments from personnel
    const departments = useMemo(() => {
        const depts = [...new Set(personnel.map(p => p.department).filter(Boolean))];
        return depts.sort();
    }, [personnel]);

    // Filtered personnel
    const filteredPersonnel = useMemo(() => {
        return personnel.filter(p => {
            const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 p.department?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDept = selectedDepartment === 'all' || p.department === selectedDepartment;
            return matchesSearch && matchesDept;
        });
    }, [personnel, searchTerm, selectedDepartment]);

    // Filtered skills
    const filteredSkills = useMemo(() => {
        if (selectedCategory === 'all') return skills;
        return skills.filter(s => s.category_id === selectedCategory);
    }, [skills, selectedCategory]);

    // Statistics
    const stats = useMemo(() => {
        const totalPersonnel = personnel.length;
        const totalSkills = skills.length;
        const totalCertifications = personnelSkills.filter(ps => ps.is_certified).length;
        const criticalAlerts = certificationAlerts.filter(a => 
            a.status === 'Süresi Dolmuş' || a.status === 'Kritik (30 gün içinde)'
        ).length;
        const trainingNeeds = personnelSkills.filter(ps => ps.training_required).length;
        
        const avgPolyvalence = polyvalenceSummary.length > 0
            ? (polyvalenceSummary.reduce((sum, p) => sum + (parseFloat(p.polyvalence_score) || 0), 0) / polyvalenceSummary.length).toFixed(1)
            : 0;

        return {
            totalPersonnel,
            totalSkills,
            totalCertifications,
            criticalAlerts,
            trainingNeeds,
            avgPolyvalence
        };
    }, [personnel, skills, personnelSkills, certificationAlerts, polyvalenceSummary]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Polivalans verileri yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <GraduationCap className="h-8 w-8 text-primary" />
                        Polivalans Matrisi
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Personel yetkinlik ve gelişim takip sistemi
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsPersonnelModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Personel Ekle
                    </Button>
                    <Button variant="outline" onClick={() => setIsTrainingModalOpen(true)}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Eğitim Ekle
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Yenile
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Rapor İndir
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Personel</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.totalPersonnel}</div>
                        <p className="text-xs text-muted-foreground">Aktif personel sayısı</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Yetkinlik</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.totalSkills}</div>
                        <p className="text-xs text-muted-foreground">Tanımlı yetkinlik</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sertifikalar</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{stats.totalCertifications}</div>
                        <p className="text-xs text-muted-foreground">Geçerli sertifika</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow border-red-200 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Kritik Uyarı</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
                        <p className="text-xs text-muted-foreground">Sertifika uyarısı</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Eğitim İhtiyacı</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.trainingNeeds}</div>
                        <p className="text-xs text-muted-foreground">Eğitim gereksinimi</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Polivalans Skoru</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.avgPolyvalence}%</div>
                        <p className="text-xs text-muted-foreground">Ortalama yeterlilik</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="matrix" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Polivalans Matrisi</span>
                        <span className="sm:hidden">Matris</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Analiz & Raporlar</span>
                        <span className="sm:hidden">Analiz</span>
                    </TabsTrigger>
                    <TabsTrigger value="skills" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span className="hidden sm:inline">Yetkinlik Yönetimi</span>
                        <span className="sm:hidden">Yetkinlik</span>
                    </TabsTrigger>
                    <TabsTrigger value="training" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">Eğitim İhtiyacı</span>
                        <span className="sm:hidden">Eğitim</span>
                    </TabsTrigger>
                </TabsList>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Personel veya departman ara..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="all">Tüm Departmanlar</option>
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="all">Tüm Kategoriler</option>
                                {skillCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* Tab Contents */}
                <TabsContent value="matrix" className="space-y-4">
                    <PolyvalenceMatrix
                        personnel={filteredPersonnel}
                        skills={filteredSkills}
                        personnelSkills={personnelSkills}
                        skillCategories={skillCategories}
                        onRefresh={fetchData}
                    />
                </TabsContent>

                <TabsContent value="analytics">
                    <PolyvalenceAnalytics
                        personnel={personnel}
                        skills={skills}
                        personnelSkills={personnelSkills}
                        polyvalenceSummary={polyvalenceSummary}
                        certificationAlerts={certificationAlerts}
                    />
                </TabsContent>

                <TabsContent value="skills">
                    <SkillManagement
                        skills={skills}
                        skillCategories={skillCategories}
                        onRefresh={fetchData}
                    />
                </TabsContent>

                <TabsContent value="training">
                    <TrainingNeedsAnalysis
                        personnel={personnel}
                        skills={skills}
                        personnelSkills={personnelSkills}
                        certificationAlerts={certificationAlerts}
                        onRefresh={fetchData}
                    />
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <PersonnelFormModal
                isOpen={isPersonnelModalOpen}
                onClose={() => {
                    setIsPersonnelModalOpen(false);
                    setEditingPersonnel(null);
                }}
                personnel={editingPersonnel}
                onRefresh={fetchData}
            />

            <TrainingFormModal
                isOpen={isTrainingModalOpen}
                onClose={() => setIsTrainingModalOpen(false)}
                personnel={personnel}
                skills={skills}
                onRefresh={fetchData}
            />
        </motion.div>
    );
};

export default PolyvalenceModule;

