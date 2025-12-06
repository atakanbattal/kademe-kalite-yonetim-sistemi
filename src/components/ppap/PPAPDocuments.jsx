import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, FileText, Download, Upload } from 'lucide-react';
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
import PPAPDocumentFormModal from './PPAPDocumentFormModal';

const DOCUMENT_TYPES = [
    'Design Records',
    'Engineering Change Documents',
    'Customer Engineering Approval',
    'DFMEA',
    'PFMEA',
    'Control Plan',
    'MSA',
    'SPC',
    'Process Flow',
    'Dimensional Results',
    'Material Test Results',
    'Performance Test Results',
    'Initial Sample Inspection Report',
    'PSW'
];

const DOCUMENT_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Under Review'];

const PPAPDocuments = ({ projects }) => {
    const { toast } = useToast();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);
    const [deletingDocument, setDeletingDocument] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadDocuments = useCallback(async () => {
        if (!selectedProject) {
            setDocuments([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ppap_documents')
                .select(`
                    *,
                    uploaded_by_user:uploaded_by(email),
                    approved_by_user:approved_by(email)
                `)
                .eq('project_id', selectedProject)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error('Documents loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dokümanlar yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [selectedProject, toast]);

    React.useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    const openFormModal = (doc = null) => {
        if (!selectedProject) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen önce bir proje seçin.'
            });
            return;
        }
        setEditingDocument(doc);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingDocument(null);
        setFormModalOpen(false);
        loadDocuments();
    };

    const handleDelete = async () => {
        if (!deletingDocument) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('ppap_documents')
                .delete()
                .eq('id', deletingDocument.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Doküman silindi.'
            });

            setDeletingDocument(null);
            loadDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Doküman silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Approved') return 'success';
        if (status === 'Rejected') return 'destructive';
        if (status === 'Under Review') return 'warning';
        return 'default';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">PPAP Dokümanları</h3>
                    <p className="text-sm text-muted-foreground">
                        Design Records, DFMEA, PFMEA, Control Plan, MSA, SPC, PSW vb. dokümanlar
                    </p>
                </div>
                <Button onClick={() => openFormModal()} disabled={!selectedProject}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Doküman
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
            ) : documents.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Bu proje için henüz doküman eklenmemiş.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                        <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{doc.document_name}</h4>
                                        <Badge variant="outline" className="mt-1">
                                            {doc.document_type}
                                        </Badge>
                                    </div>
                                    <Badge variant={getStatusColor(doc.document_status)}>
                                        {doc.document_status === 'Draft' ? 'Taslak' :
                                         doc.document_status === 'Submitted' ? 'Gönderildi' :
                                         doc.document_status === 'Approved' ? 'Onaylandı' :
                                         doc.document_status === 'Rejected' ? 'Reddedildi' : 'İncelemede'}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {doc.document_version && (
                                        <div>
                                            <span className="text-muted-foreground">Versiyon: </span>
                                            <span className="font-medium">{doc.document_version}</span>
                                        </div>
                                    )}
                                    {doc.uploaded_by_user && (
                                        <div>
                                            <span className="text-muted-foreground">Yükleyen: </span>
                                            <span className="font-medium">{doc.uploaded_by_user.email}</span>
                                        </div>
                                    )}
                                    {doc.uploaded_at && (
                                        <div>
                                            <span className="text-muted-foreground">Yükleme Tarihi: </span>
                                            <span className="font-medium">
                                                {new Date(doc.uploaded_at).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    )}
                                    {doc.approved_by_user && (
                                        <div>
                                            <span className="text-muted-foreground">Onaylayan: </span>
                                            <span className="font-medium">{doc.approved_by_user.email}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(doc)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingDocument(doc)}
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

            <PPAPDocumentFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingDocument(null);
                    }
                }}
                existingDocument={editingDocument}
                projectId={selectedProject}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingDocument} onOpenChange={(open) => !open && setDeletingDocument(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dokümanı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingDocument?.document_name}" dokümanını silmek istediğinizden emin misiniz?
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

export default PPAPDocuments;
