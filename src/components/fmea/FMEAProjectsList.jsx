import React, { useState } from 'react';
import { Plus, Edit, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
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
import FMEAProjectFormModal from './FMEAProjectFormModal';

const STATUS_COLORS = {
    'Draft': 'default',
    'In Review': 'warning',
    'Approved': 'success',
    'Active': 'default',
    'Obsolete': 'secondary'
};

const TYPE_COLORS = {
    'DFMEA': 'blue',
    'PFMEA': 'green'
};

const FMEAProjectsList = ({ projects, loading, onRefresh, onSelectProject }) => {
    const { toast } = useToast();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [deletingProject, setDeletingProject] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const openFormModal = (project = null) => {
        setEditingProject(project);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingProject(null);
        setFormModalOpen(false);
        onRefresh();
    };

    const handleDelete = async () => {
        if (!deletingProject) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('fmea_projects')
                .delete()
                .eq('id', deletingProject.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'FMEA projesi silindi.'
            });
            
            setDeletingProject(null);
            onRefresh();
        } catch (error) {
            console.error('Error deleting FMEA project:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'FMEA projesi silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        Yükleniyor...
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">FMEA Projeleri</h3>
                    <p className="text-sm text-muted-foreground">
                        DFMEA ve PFMEA projelerini yönetin
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => openFormModal()} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni DFMEA
                    </Button>
                    <Button onClick={() => openFormModal()} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni PFMEA
                    </Button>
                </div>
            </div>

            {projects.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz FMEA projesi tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => (
                        <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelectProject(project)}>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{project.fmea_name}</h4>
                                        <p className="text-sm text-muted-foreground font-mono">
                                            {project.fmea_number}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant={TYPE_COLORS[project.fmea_type] || 'default'}>
                                            {project.fmea_type}
                                        </Badge>
                                        <Badge variant={STATUS_COLORS[project.status] || 'default'}>
                                            {project.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {project.part_name && (
                                        <div>
                                            <span className="text-muted-foreground">Parça: </span>
                                            <span className="font-medium">{project.part_name}</span>
                                        </div>
                                    )}
                                    {project.process_name && (
                                        <div>
                                            <span className="text-muted-foreground">Proses: </span>
                                            <span className="font-medium">{project.process_name}</span>
                                        </div>
                                    )}
                                    {project.team_leader && (
                                        <div>
                                            <span className="text-muted-foreground">Takım Lideri: </span>
                                            <span className="font-medium">{project.team_leader.full_name}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">Revizyon: </span>
                                        <span className="font-medium">{project.revision_number}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openFormModal(project);
                                        }}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectProject(project);
                                        }}
                                        className="flex-1"
                                    >
                                        <Eye className="w-4 h-4 mr-1" />
                                        Görüntüle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingProject(project);
                                        }}
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

            <FMEAProjectFormModal
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

            <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>FMEA Projesini Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingProject?.fmea_name}" FMEA projesini silmek istediğinizden emin misiniz?
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

export default FMEAProjectsList;

