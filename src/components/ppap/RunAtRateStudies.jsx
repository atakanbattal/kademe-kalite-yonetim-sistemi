import React, { useState, useCallback } from 'react';
import { Plus, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import RunAtRateFormModal from './RunAtRateFormModal';

const RunAtRateStudies = ({ projects }) => {
    const { toast } = useToast();
    const [selectedProject, setSelectedProject] = useState(null);
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingStudy, setEditingStudy] = useState(null);

    const loadStudies = useCallback(async (projectId) => {
        if (!projectId) {
            setStudies([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('run_at_rate_studies')
                .select(`
                    *,
                    personnel!conducted_by(id, full_name)
                `)
                .eq('project_id', projectId)
                .order('study_date', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'run_at_rate_studies tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-ppap-apqp-module.sql script\'ini çalıştırın.'
                    });
                    setStudies([]);
                    return;
                }
                throw error;
            }
            setStudies(data || []);
        } catch (error) {
            console.error('Run-at-Rate studies loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Run-at-Rate çalışmaları yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setStudies([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedProject) {
            loadStudies(selectedProject);
        }
    }, [selectedProject, loadStudies]);

    const openFormModal = (study = null) => {
        setEditingStudy(study);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingStudy(null);
        setFormModalOpen(false);
        if (selectedProject) {
            loadStudies(selectedProject);
        }
    };

    const activeProjects = projects.filter(p => 
        ['Process Development', 'Product Validation'].includes(p.status)
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Run-at-Rate Çalışmaları</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Üretim hızı doğrulama çalışmaları
                        </p>
                    </div>
                    {selectedProject && (
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Çalışma
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Proje seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activeProjects.map(project => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.project_name} ({project.project_number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : !selectedProject ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Lütfen bir proje seçin.
                    </div>
                ) : studies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Bu proje için henüz Run-at-Rate çalışması bulunmuyor.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {studies.map((study) => (
                            <Card key={study.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-semibold">
                                                    {new Date(study.study_date).toLocaleDateString('tr-TR')}
                                                </h4>
                                                <Badge variant={study.status === 'Completed' ? 'success' : 
                                                               study.status === 'Failed' ? 'destructive' : 
                                                               'default'}>
                                                    {study.status}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                                                <div>
                                                    <span className="text-muted-foreground">Hedef Hız: </span>
                                                    <span className="font-semibold">{study.target_production_rate} adet/saat</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Gerçekleşen: </span>
                                                    <span className="font-semibold">{study.actual_production_rate} adet/saat</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Üretim Miktarı: </span>
                                                    <span className="font-semibold">{study.production_quantity} adet</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Başarı Oranı: </span>
                                                    <span className={`font-semibold ${study.success_rate >= 95 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {study.success_rate?.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            {study.issues_encountered && (
                                                <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                                                    <span className="font-medium">Sorunlar: </span>
                                                    {study.issues_encountered}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openFormModal(study)}
                                            >
                                                Düzenle
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {isFormModalOpen && (
                    <RunAtRateFormModal
                        open={isFormModalOpen}
                        setOpen={setFormModalOpen}
                        existingStudy={editingStudy}
                        projectId={selectedProject}
                        onSuccess={closeFormModal}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default RunAtRateStudies;
