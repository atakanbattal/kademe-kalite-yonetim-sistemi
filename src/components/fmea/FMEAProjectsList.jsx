import React, { useState } from 'react';
import { Plus, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
                                    {project.personnel && (
                                        <div>
                                            <span className="text-muted-foreground">Takım Lideri: </span>
                                            <span className="font-medium">{project.personnel.full_name}</span>
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
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <FMEAProjectFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingProject={editingProject}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default FMEAProjectsList;

