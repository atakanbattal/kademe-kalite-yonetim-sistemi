import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
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
import DMAICProjectFormModal from './DMAICProjectFormModal';

const DMAICProjectsList = () => {
    const { toast } = useToast();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingProject, setDeletingProject] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('dmaic_projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'dmaic_projects tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-dmaic-module.sql script\'ini çalıştırın.'
                    });
                    setProjects([]);
                    return;
                }
                throw error;
            }
            setProjects(data || []);
        } catch (error) {
            console.error('Projects loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Projeler yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const getPhaseProgress = (project) => {
        const phases = ['define', 'measure', 'analyze', 'improve', 'control'];
        const completed = phases.filter(p => project[`${p}_status`] === 'Completed').length;
        return (completed / phases.length) * 100;
    };

    const handleDelete = async () => {
        if (!deletingProject) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('dmaic_projects')
                .delete()
                .eq('id', deletingProject.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'DMAIC projesi silindi.'
            });
            
            setDeletingProject(null);
            loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Proje silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const openFormModal = (project = null) => {
        setEditingProject(project);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingProject(null);
        setFormModalOpen(false);
        loadProjects();
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>DMAIC Projeleri</CardTitle>
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Proje
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz DMAIC projesi oluşturulmamış.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projects.map((project) => (
                                <div key={project.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold">{project.project_name}</h4>
                                            <p className="text-sm text-muted-foreground font-mono">
                                                {project.project_number}
                                            </p>
                                        </div>
                                        <Badge>{project.overall_status}</Badge>
                                    </div>
                                    <p className="text-sm mb-2">{project.problem_statement}</p>
                                    <div className="text-xs text-muted-foreground">
                                        İlerleme: %{Math.round(getPhaseProgress(project))}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(project)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeletingProject(project)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Sil
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Projeyi Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingProject?.project_name}" DMAIC projesini silmek istediğinizden emin misiniz?
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

            <DMAICProjectFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingProject(null);
                    }
                }}
                existingProject={editingProject}
                onSuccess={closeFormModal}
            />
        </div>
    );
};

export default DMAICProjectsList;

