import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RunAtRateFormModal from './RunAtRateFormModal';

const RunAtRateStudies = ({ projects }) => {
    const { toast } = useToast();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingStudy, setEditingStudy] = useState(null);
    const [deletingStudy, setDeletingStudy] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadStudies = useCallback(async () => {
        if (!selectedProject) {
            setStudies([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('run_at_rate_studies')
                .select(`
                    *,
                    conducted_by_user:conducted_by(full_name)
                `)
                .eq('project_id', selectedProject)
                .order('study_date', { ascending: false });

            if (error) throw error;
            setStudies(data || []);
        } catch (error) {
            console.error('Run-at-Rate studies loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Run-at-Rate çalışmaları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [selectedProject, toast]);

    React.useEffect(() => {
        loadStudies();
    }, [loadStudies]);

    const openFormModal = (study = null) => {
        if (!selectedProject) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen önce bir proje seçin.'
            });
            return;
        }
        setEditingStudy(study);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingStudy(null);
        setFormModalOpen(false);
        loadStudies();
    };

    const handleDelete = async () => {
        if (!deletingStudy) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('run_at_rate_studies')
                .delete()
                .eq('id', deletingStudy.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Run-at-Rate çalışması silindi.'
            });

            setDeletingStudy(null);
            loadStudies();
        } catch (error) {
            console.error('Error deleting study:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Çalışma silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Completed') return 'success';
        if (status === 'Failed') return 'destructive';
        if (status === 'In Progress') return 'default';
        return 'secondary';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Run-at-Rate Çalışmaları</h3>
                    <p className="text-sm text-muted-foreground">
                        Üretim hızı ve kapasite doğrulama çalışmaları
                    </p>
                </div>
                <Button onClick={() => openFormModal()} disabled={!selectedProject}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Çalışma
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Proje seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(project => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.project_name} ({project.project_number})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    </CardContent>
                </Card>
            ) : !selectedProject ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Lütfen bir proje seçin.
                        </div>
                    </CardContent>
                </Card>
            ) : studies.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Bu proje için henüz Run-at-Rate çalışması oluşturulmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studies.map((study) => (
                        <Card key={study.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">
                                            {new Date(study.study_date).toLocaleDateString('tr-TR')}
                                        </h4>
                                        {study.production_line && (
                                            <p className="text-sm text-muted-foreground">
                                                {study.production_line}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant={getStatusColor(study.status)}>
                                        {study.status === 'Planned' ? 'Planlandı' :
                                         study.status === 'In Progress' ? 'Devam Eden' :
                                         study.status === 'Completed' ? 'Tamamlandı' : 'Başarısız'}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {study.target_production_rate && (
                                        <div>
                                            <span className="text-muted-foreground">Hedef Hız: </span>
                                            <span className="font-medium">{study.target_production_rate} adet/saat</span>
                                        </div>
                                    )}
                                    {study.actual_production_rate && (
                                        <div>
                                            <span className="text-muted-foreground">Gerçekleşen Hız: </span>
                                            <span className="font-medium">{study.actual_production_rate} adet/saat</span>
                                        </div>
                                    )}
                                    {study.success_rate !== null && (
                                        <div>
                                            <span className="text-muted-foreground">Başarı Oranı: </span>
                                            <span className="font-medium">{study.success_rate.toFixed(1)}%</span>
                                        </div>
                                    )}
                                    {study.production_quantity && (
                                        <div>
                                            <span className="text-muted-foreground">Üretim Miktarı: </span>
                                            <span className="font-medium">{study.production_quantity} adet</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(study)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingStudy(study)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <RunAtRateFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingStudy(null);
                    }
                }}
                existingStudy={editingStudy}
                projectId={selectedProject}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingStudy} onOpenChange={(open) => !open && setDeletingStudy(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Çalışmayı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu Run-at-Rate çalışmasını silmek istediğinizden emin misiniz?
                            Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Siliniyor...' : 'Sil'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default RunAtRateStudies;
