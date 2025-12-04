import React, { useState, useCallback } from 'react';
import { Plus, Upload, Download, Eye, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';

const PPAP_DOCUMENT_TYPES = [
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
    'PSW (Part Submission Warrant)',
    'Other'
];

const DOCUMENT_STATUS_COLORS = {
    'Draft': 'default',
    'Submitted': 'warning',
    'Approved': 'success',
    'Rejected': 'destructive',
    'Under Review': 'default'
};

const PPAPDocuments = ({ projects }) => {
    const { toast } = useToast();
    const [selectedProject, setSelectedProject] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(null);

    const loadDocuments = useCallback(async (projectId) => {
        if (!projectId) {
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
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'ppap_documents tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-ppap-apqp-module.sql script\'ini çalıştırın.'
                    });
                    setDocuments([]);
                    return;
                }
                throw error;
            }
            setDocuments(data || []);
        } catch (error) {
            console.error('Documents loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dokümanlar yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedProject) {
            loadDocuments(selectedProject);
        }
    }, [selectedProject, loadDocuments]);

    const onDrop = useCallback(async (acceptedFiles) => {
        if (!selectedProject || acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setUploadingFile(file);

        try {
            const fileName = `${uuidv4()}-${sanitizeFileName(file.name)}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('ppap_documents')
                .upload(fileName, file, { contentType: file.type || 'application/octet-stream' });

            if (uploadError) throw uploadError;

            const { error: insertError } = await supabase
                .from('ppap_documents')
                .insert([{
                    project_id: selectedProject,
                    document_type: 'Other',
                    document_name: file.name,
                    file_path: uploadData.path,
                    file_name: file.name,
                    file_size: file.size,
                    document_status: 'Draft'
                }]);

            if (insertError) throw insertError;

            toast({
                title: 'Başarılı',
                description: 'Doküman yüklendi.'
            });

            loadDocuments(selectedProject);
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Dosya yüklenirken hata oluştu.'
            });
        } finally {
            setUploadingFile(null);
            setUploadModalOpen(false);
        }
    }, [selectedProject, loadDocuments, toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'image/*': ['.png', '.jpg', '.jpeg']
        }
    });

    const handleDownload = async (document) => {
        try {
            const { data, error } = await supabase.storage
                .from('ppap_documents')
                .download(document.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = document.file_name;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya indirilirken hata oluştu.'
            });
        }
    };

    const activeProjects = projects.filter(p => 
        ['Planning', 'Design', 'Process Development', 'Product Validation', 'Feedback & Corrective Action'].includes(p.status)
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>PPAP Dokümanları</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            PPAP paketi dokümanlarını yönetin (18 doküman listesi)
                        </p>
                    </div>
                    {selectedProject && (
                        <Button onClick={() => setUploadModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Doküman Yükle
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
                ) : documents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Bu proje için henüz doküman yüklenmemiş.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <Card key={doc.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-semibold">{doc.document_name}</h4>
                                                <Badge variant={DOCUMENT_STATUS_COLORS[doc.document_status] || 'default'}>
                                                    {doc.document_status}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {doc.document_type}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {doc.document_version && `Versiyon: ${doc.document_version} | `}
                                                {doc.file_size && `Boyut: ${(doc.file_size / 1024).toFixed(2)} KB | `}
                                                Yükleyen: {doc.uploaded_by_user?.email || 'Bilinmiyor'} | 
                                                {new Date(doc.uploaded_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(doc)}
                                            >
                                                <Download className="w-4 h-4 mr-1" />
                                                İndir
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('Bu dokümanı silmek istediğinize emin misiniz?')) {
                                                        try {
                                                            // Storage'dan dosyayı sil
                                                            if (doc.file_path) {
                                                                const { error: storageError } = await supabase.storage
                                                                    .from('ppap_documents')
                                                                    .remove([doc.file_path]);
                                                                if (storageError) console.error('Storage delete error:', storageError);
                                                            }
                                                            // Veritabanından kaydı sil
                                                            const { error } = await supabase
                                                                .from('ppap_documents')
                                                                .delete()
                                                                .eq('id', doc.id);
                                                            if (error) throw error;
                                                            toast({
                                                                title: 'Başarılı',
                                                                description: 'Doküman silindi.'
                                                            });
                                                            loadDocuments(selectedProject);
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
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Upload Modal */}
                {isUploadModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md">
                            <CardHeader>
                                <CardTitle>Doküman Yükle</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                    <input {...getInputProps()} />
                                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-sm text-muted-foreground">
                                        {isDragActive ? 'Dosyayı buraya bırakın' : 'Dosyayı buraya sürükleyin veya seçmek için tıklayın'}
                                    </p>
                                    {uploadingFile && (
                                        <p className="text-sm text-primary mt-2">Yükleniyor: {uploadingFile.name}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setUploadModalOpen(false)}>
                                        İptal
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default PPAPDocuments;
