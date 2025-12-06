import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, FileCheck } from 'lucide-react';
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
import PPAPSubmissionFormModal from './PPAPSubmissionFormModal';

const PPAPSubmissions = ({ projects }) => {
    const { toast } = useToast();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingSubmission, setEditingSubmission] = useState(null);
    const [deletingSubmission, setDeletingSubmission] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadSubmissions = useCallback(async () => {
        if (!selectedProject) {
            setSubmissions([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ppap_submissions')
                .select('*')
                .eq('project_id', selectedProject)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSubmissions(data || []);
        } catch (error) {
            console.error('Submissions loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Submissions yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [selectedProject, toast]);

    React.useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    const openFormModal = (sub = null) => {
        if (!selectedProject) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen önce bir proje seçin.'
            });
            return;
        }
        setEditingSubmission(sub);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingSubmission(null);
        setFormModalOpen(false);
        loadSubmissions();
    };

    const handleDelete = async () => {
        if (!deletingSubmission) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('ppap_submissions')
                .delete()
                .eq('id', deletingSubmission.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Submission silindi.'
            });

            setDeletingSubmission(null);
            loadSubmissions();
        } catch (error) {
            console.error('Error deleting submission:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Submission silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Approved') return 'success';
        if (status === 'Rejected') return 'destructive';
        if (status === 'Conditionally Approved') return 'warning';
        return 'default';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">PPAP Submissions (PSW)</h3>
                    <p className="text-sm text-muted-foreground">
                        Part Submission Warrant ve PPAP submission yönetimi
                    </p>
                </div>
                <Button onClick={() => openFormModal()} disabled={!selectedProject}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Submission
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
            ) : submissions.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Bu proje için henüz submission oluşturulmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submissions.map((sub) => (
                        <Card key={sub.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">
                                            {sub.psw_number || `PSW-${sub.id.slice(0, 8)}`}
                                        </h4>
                                        <Badge variant="outline" className="mt-1">
                                            Level {sub.submission_level}
                                        </Badge>
                                    </div>
                                    <Badge variant={getStatusColor(sub.submission_status)}>
                                        {sub.submission_status === 'Draft' ? 'Taslak' :
                                         sub.submission_status === 'Submitted' ? 'Gönderildi' :
                                         sub.submission_status === 'Approved' ? 'Onaylandı' :
                                         sub.submission_status === 'Rejected' ? 'Reddedildi' : 'Koşullu Onay'}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {sub.customer_part_number && (
                                        <div>
                                            <span className="text-muted-foreground">Müşteri Parça No: </span>
                                            <span className="font-medium">{sub.customer_part_number}</span>
                                        </div>
                                    )}
                                    {sub.reason_for_submission && (
                                        <div>
                                            <span className="text-muted-foreground">Gönderim Nedeni: </span>
                                            <span className="font-medium">{sub.reason_for_submission}</span>
                                        </div>
                                    )}
                                    {sub.date_submitted && (
                                        <div>
                                            <span className="text-muted-foreground">Gönderim Tarihi: </span>
                                            <span className="font-medium">
                                                {new Date(sub.date_submitted).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    )}
                                    {sub.customer_decision && (
                                        <div>
                                            <span className="text-muted-foreground">Müşteri Kararı: </span>
                                            <Badge variant={sub.customer_decision === 'Approved' ? 'success' : 'destructive'}>
                                                {sub.customer_decision === 'Approved' ? 'Onaylandı' :
                                                 sub.customer_decision === 'Rejected' ? 'Reddedildi' : 'Koşullu Onay'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(sub)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingSubmission(sub)}
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

            <PPAPSubmissionFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingSubmission(null);
                    }
                }}
                existingSubmission={editingSubmission}
                projectId={selectedProject}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingSubmission} onOpenChange={(open) => !open && setDeletingSubmission(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submission'ı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingSubmission?.psw_number || 'Bu submission'}" kaydını silmek istediğinizden emin misiniz?
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

export default PPAPSubmissions;
