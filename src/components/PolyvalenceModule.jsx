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
import { openPrintableReport } from '@/lib/reportUtils';
import PolyvalenceMatrix from './polyvalence/PolyvalenceMatrix';
import PolyvalenceAnalytics from './polyvalence/PolyvalenceAnalytics';
import SkillManagement from './polyvalence/SkillManagement';
import TrainingNeedsAnalysis from './polyvalence/TrainingNeedsAnalysis';
import PersonnelSelectionModal from './polyvalence/PersonnelSelectionModal';
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

    useEffect(() => {
        fetchData();
    }, []);

    const handleDownloadReport = () => {
        // Prepare polivalance matrix data for printing - WITH FILTERS
        const reportData = {
            id: 'polyvalence-' + Date.now(),
            personnel: filteredPersonnel, // FILTERED
            skills: filteredSkills, // FILTERED
            skillCategories: skillCategories,
            personnelSkills: filteredPersonnelSkills, // FILTERED
            certificationAlerts: certificationAlerts.filter(a => 
                filteredPersonnel.some(p => p.id === a.personnel_id)
            ), // FILTERED
            summary: stats, // Already filtered
            generated_at: new Date().toISOString(),
            // Add filter info to report
            filters: {
                department: selectedDepartment !== 'all' ? selectedDepartment : null,
                category: selectedCategory !== 'all' ? skillCategories.find(c => c.id === selectedCategory)?.name : null,
                searchTerm: searchTerm || null
            }
        };

        // Open printable report with localStorage
        openPrintableReport(reportData, 'polyvalence_matrix', true);
    };

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
                    personnel:personnel!personnel_skills_personnel_id_fkey(id, full_name, department, job_title),
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

    // Filtered personnel skills
    const filteredPersonnelSkills = useMemo(() => {
        const filteredPersonnelIds = filteredPersonnel.map(p => p.id);
        const filteredSkillIds = filteredSkills.map(s => s.id);
        return personnelSkills.filter(ps => 
            filteredPersonnelIds.includes(ps.personnel_id) && 
            filteredSkillIds.includes(ps.skill_id)
        );
    }, [personnelSkills, filteredPersonnel, filteredSkills]);

    // Statistics - FILTERED
    const stats = useMemo(() => {
        const totalPersonnel = filteredPersonnel.length;
        const totalSkills = filteredSkills.length;
        const totalCertifications = filteredPersonnelSkills.filter(ps => ps.is_certified).length;
        const criticalAlerts = certificationAlerts.filter(a => {
            const matchesStatus = a.status === 'Süresi Dolmuş' || a.status === 'Kritik (30 gün içinde)';
            const isInFilteredPersonnel = filteredPersonnel.some(p => p.id === a.personnel_id);
            return matchesStatus && isInFilteredPersonnel;
        }).length;
        const trainingNeeds = filteredPersonnelSkills.filter(ps => ps.training_required).length;
        
        const filteredPersonnelIds = filteredPersonnel.map(p => p.id);
        const filteredSummary = polyvalenceSummary.filter(ps => filteredPersonnelIds.includes(ps.personnel_id));
        const avgPolyvalence = filteredSummary.length > 0
            ? (filteredSummary.reduce((sum, p) => sum + (parseFloat(p.polyvalence_score) || 0), 0) / filteredSummary.length).toFixed(1)
            : 0;

        return {
            totalPersonnel,
            totalSkills,
            totalCertifications,
            criticalAlerts,
            trainingNeeds,
            avgPolyvalence
        };
    }, [filteredPersonnel, filteredSkills, filteredPersonnelSkills, certificationAlerts, polyvalenceSummary]);

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
                    <Button variant="outline" onClick={handleDownloadReport}>
                        <Download className="mr-2 h-4 w-4" />
                        Rapor İndir
                    </Button>
                </div>
            </div>

            {/* Statistics Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Toplam Personel</CardTitle>
                        <Users className="h-3 w-3 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-blue-600">{stats.totalPersonnel}</div>
                        <p className="text-[10px] text-muted-foreground">Aktif personel</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Yetkinlik</CardTitle>
                        <Target className="h-3 w-3 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-green-600">{stats.totalSkills}</div>
                        <p className="text-[10px] text-muted-foreground">Tanımlı</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Sertifikalar</CardTitle>
                        <Award className="h-3 w-3 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-purple-600">{stats.totalCertifications}</div>
                        <p className="text-[10px] text-muted-foreground">Geçerli</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-red-200 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Kritik Uyarı</CardTitle>
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-red-600">{stats.criticalAlerts}</div>
                        <p className="text-[10px] text-muted-foreground">Uyarı</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Eğitim İhtiyacı</CardTitle>
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-orange-600">{stats.trainingNeeds}</div>
                        <p className="text-[10px] text-muted-foreground">Gereksinim</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                        <CardTitle className="text-xs font-medium">Polivalans Skoru</CardTitle>
                        <BarChart3 className="h-3 w-3 text-blue-600" />
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="text-xl font-bold text-blue-600">{stats.avgPolyvalence}%</div>
                        <p className="text-[10px] text-muted-foreground">Ortalama</p>
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

                {/* Filters - Compact */}
                <div className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Personel veya departman ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 h-8 text-sm"
                            />
                        </div>
                    </div>
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="px-2 py-1 border rounded-md bg-background h-8 text-sm"
                    >
                        <option value="all">Tüm Departmanlar</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-2 py-1 border rounded-md bg-background h-8 text-sm"
                    >
                        <option value="all">Tüm Kategoriler</option>
                        {skillCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                {/* Tab Contents */}
                <TabsContent value="matrix" className="space-y-4">
                    <PolyvalenceMatrix
                        personnel={filteredPersonnel}
                        skills={filteredSkills}
                        personnelSkills={filteredPersonnelSkills}
                        skillCategories={skillCategories}
                        onRefresh={fetchData}
                    />
                </TabsContent>

                <TabsContent value="analytics">
                    <PolyvalenceAnalytics
                        personnel={filteredPersonnel}
                        skills={filteredSkills}
                        personnelSkills={filteredPersonnelSkills}
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
                        personnel={filteredPersonnel}
                        skills={filteredSkills}
                        personnelSkills={filteredPersonnelSkills}
                        certificationAlerts={certificationAlerts}
                        onRefresh={fetchData}
                    />
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <PersonnelSelectionModal
                isOpen={isPersonnelModalOpen}
                onClose={() => setIsPersonnelModalOpen(false)}
                onRefresh={fetchData}
                existingPersonnelIds={personnel.map(p => p.id)}
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

