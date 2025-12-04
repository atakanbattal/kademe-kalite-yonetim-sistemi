import React, { useState } from 'react';
import { Plus, Edit, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PPAPProjectFormModal from './PPAPProjectFormModal';

const STATUS_COLORS = {
    'Planning': 'default',
    'Design': 'default',
    'Process Development': 'default',
    'Product Validation': 'warning',
    'Feedback & Corrective Action': 'warning',
    'Approved': 'success',
    'Rejected': 'destructive'
};

const PPAPProjectsList = ({ projects, loading, onRefresh }) => {
    const { toast } = useToast();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    const openFormModal = (project = null) => {
        setEditingProject(project);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingProject(null);
        setFormModalOpen(false);
        onRefresh();
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
                    <h3 className="text-lg font-semibold">APQP Projeleri</h3>
                    <p className="text-sm text-muted-foreground">
                        Advanced Product Quality Planning projelerini yönetin
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Proje
                </Button>
            </div>

            {projects.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz proje tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => (
                        <Card key={project.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{project.project_name}</h4>
                                        <p className="text-sm text-muted-foreground font-mono">
                                            {project.project_number}
                                        </p>
                                    </div>
                                    <Badge variant={STATUS_COLORS[project.status] || 'default'}>
                                        {project.status}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {project.customers && (
                                        <div>
                                            <span className="text-muted-foreground">Müşteri: </span>
                                            <span className="font-medium">{project.customers.customer_name}</span>
                                        </div>
                                    )}
                                    {project.part_name && (
                                        <div>
                                            <span className="text-muted-foreground">Parça: </span>
                                            <span className="font-medium">{project.part_name}</span>
                                        </div>
                                    )}
                                    {project.personnel && (
                                        <div>
                                            <span className="text-muted-foreground">Proje Yöneticisi: </span>
                                            <span className="font-medium">{project.personnel.full_name}</span>
                                        </div>
                                    )}
                                    {project.target_completion_date && (
                                        <div>
                                            <span className="text-muted-foreground">Hedef Tarih: </span>
                                            <span className="font-medium">
                                                {new Date(project.target_completion_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(project)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={async () => {
                                            if (confirm('Bu PPAP projesini silmek istediğinize emin misiniz?')) {
                                                try {
                                                    const { error } = await supabase
                                                        .from('apqp_projects')
                                                        .delete()
                                                        .eq('id', project.id);
                                                    if (error) throw error;
                                                    toast({
                                                        title: 'Başarılı',
                                                        description: 'PPAP projesi silindi.'
                                                    });
                                                    onRefresh();
                                                } catch (error) {
                                                    toast({
                                                        variant: 'destructive',
                                                        title: 'Hata',
                                                        description: error.message || 'Silme işlemi başarısız.'
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Sil
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <PPAPProjectFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingProject={editingProject}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default PPAPProjectsList;

