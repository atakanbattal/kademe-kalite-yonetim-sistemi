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
import { generatePrintableReportHtml } from '@/lib/reportUtils';
import { normalizeTurkishForSearch } from '@/lib/utils';
import PolyvalenceMatrix from './polyvalence/PolyvalenceMatrix';
import PolyvalenceAnalytics from './polyvalence/PolyvalenceAnalytics';
import SkillManagement from './polyvalence/SkillManagement';
import TrainingNeedsAnalysis from './polyvalence/TrainingNeedsAnalysis';
import PersonnelSelectionModal from './polyvalence/PersonnelSelectionModal';
import TrainingFormModal from './training/TrainingFormModal'; // ✅ Değişti: Gelişmiş training modal

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
    const [trainingModalData, setTrainingModalData] = useState(null); // ✅ YENİ: Eğitim modal verisi

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

        // Direct HTML print for polyvalence (no route needed)
        try {
            const htmlContent = generatePrintableReportHtml(reportData, 'polyvalence_matrix');
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                // Wait for content to load then trigger print
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                };
            }
        } catch (error) {
            console.error('Rapor oluşturma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Rapor oluşturulamadı: ' + error.message
            });
        }
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

            // View'lar mevcut olmayabilir, hataları sessizce handle et
            if (alertsRes.error) {
                console.warn('certification_expiry_alerts view bulunamadı:', alertsRes.error.message);
            }
            if (summaryRes.error) {
                console.warn('polyvalence_summary view bulunamadı:', summaryRes.error.message);
            }

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

    // Filtered categories - departman bazlı
    const filteredCategories = useMemo(() => {
        if (selectedDepartment === 'all') return skillCategories;
        return skillCategories.filter(cat => {
            if (!cat.department) return true;
            const normalizedCatDept = normalizeTurkishForSearch(String(cat.department).trim().toLowerCase());
            const normalizedSelectedDept = normalizeTurkishForSearch(selectedDepartment.trim().toLowerCase());
            return normalizedCatDept === normalizedSelectedDept;
        });
    }, [skillCategories, selectedDepartment]);

    // Filtered personnel
    const filteredPersonnel = useMemo(() => {
        return personnel.filter(p => {
            const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 p.department?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesDept = true;
            if (selectedDepartment !== 'all') {
                if (!p.department) {
                    matchesDept = false;
                } else {
                    const normalizedPersonnelDept = normalizeTurkishForSearch(String(p.department).trim().toLowerCase());
                    const normalizedSelectedDept = normalizeTurkishForSearch(selectedDepartment.trim().toLowerCase());
                    matchesDept = normalizedPersonnelDept === normalizedSelectedDept;
                }
            }
            return matchesSearch && matchesDept;
        });
    }, [personnel, searchTerm, selectedDepartment]);

    // Filtered skills - departman bazlı filtreleme eklendi
    const filteredSkills = useMemo(() => {
        let result = skills;
        
        // Kategori filtresi
        if (selectedCategory !== 'all') {
            result = result.filter(s => s.category_id === selectedCategory);
        }
        
        // Departman filtresi - seçili departman varsa
        if (selectedDepartment !== 'all') {
            result = result.filter(s => {
                if (!s.department) return true;
                const normalizedSkillDept = normalizeTurkishForSearch(String(s.department).trim().toLowerCase());
                const normalizedSelectedDept = normalizeTurkishForSearch(selectedDepartment.trim().toLowerCase());
                return normalizedSkillDept === normalizedSelectedDept;
            });
        }
        
        return result;
    }, [skills, selectedCategory, selectedDepartment]);

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
        
        // ✅ Polivalans skorunu manuel hesapla (her zaman güncel verilerle)
        // View'den gelen veriler cache'lenmiş olabilir, bu yüzden her zaman manuel hesaplama yapıyoruz
        const personnelScores = filteredPersonnel.map(person => {
            const personSkills = filteredPersonnelSkills.filter(ps => ps.personnel_id === person.id);
            const totalSkillsCount = personSkills.length;
            
            if (totalSkillsCount === 0) return 0;
            
            // Seviye 3 ve üzeri yetkin kabul edilir
            // Polivalans skoru: Kişinin sahip olduğu yetkinlikler içinde seviye 3+ olanların oranı
            const proficientCount = personSkills.filter(ps => ps.current_level >= 3).length;
            
            return (proficientCount / totalSkillsCount) * 100;
        });
        
        const avgPolyvalence = personnelScores.length > 0
            ? (personnelScores.reduce((sum, score) => sum + score, 0) / personnelScores.length).toFixed(1)
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
                        <div className="search-box">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Personel veya departman ara..."
                                className="search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
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
                        {filteredCategories.map(cat => (
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
                        departments={departments}
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
                        onCreateTraining={(data) => {
                            setTrainingModalData(data);
                            setIsTrainingModalOpen(true);
                        }}
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
                setIsOpen={(open) => {
                    setIsTrainingModalOpen(open);
                    if (!open) setTrainingModalData(null);
                }}
                training={null}
                onSave={async () => {
                    await fetchData();
                    setIsTrainingModalOpen(false);
                    setTrainingModalData(null);
                    toast({
                        title: 'Eğitim Kaydedildi',
                        description: 'Eğitim başarıyla oluşturuldu.',
                    });
                }}
                polyvalenceData={trainingModalData} // ✅ Otomatik doldurma için
            />
        </motion.div>
    );
};

export default PolyvalenceModule;

