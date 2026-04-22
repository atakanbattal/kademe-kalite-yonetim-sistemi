import React, { useState, useEffect } from 'react';
import { Plus, Download, Trash2, Upload, FileText, Image, File, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { sanitizeFileName } from '@/lib/utils';

const DOCUMENT_TYPES = ['Fatura', 'Teklif', 'Rapor', 'Fotoğraf', 'Test Sonucu', 'Garanti Belgesi', '8D Raporu', 'Diğer'];

const BUCKET_NAME = 'quality_costs';

const QualityCostDocumentsTab = ({ qualityCostId, onRefresh }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploadOpen, setUploadOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [docType, setDocType] = useState('Fatura');
    const [docDescription, setDocDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const fetchDocuments = async () => {
        if (!qualityCostId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quality_cost_documents')
            .select('*')
            .eq('quality_cost_id', qualityCostId)
            .order('upload_date', { ascending: false });
        if (!error) setDocuments(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchDocuments();
    }, [qualityCostId]);

    const handleFileSelect = (e) => {
        setSelectedFiles(Array.from(e.target.files));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast({ variant: 'destructive', title: 'Dosya seçilmedi!' });
            return;
        }

        setIsUploading(true);
        try {
            for (const file of selectedFiles) {
                const sanitizedFileName = sanitizeFileName(file.name);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 9);
                const filePath = `docs/${qualityCostId}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type || 'application/octet-stream'
                });
                if (uploadError) throw uploadError;

                const fileExt = file.name.split('.').pop();
                const { error: dbError } = await supabase.from('quality_cost_documents').insert({
                    quality_cost_id: qualityCostId,
                    document_type: docType,
                    document_name: file.name,
                    document_description: docDescription || null,
                    file_path: filePath,
                    file_type: fileExt,
                    file_size: file.size,
                    uploaded_by: user?.id
                });
                if (dbError) throw dbError;
            }

            toast({ title: 'Başarılı!', description: `${selectedFiles.length} dosya yüklendi.` });
            setSelectedFiles([]);
            setDocDescription('');
            setUploadOpen(false);
            await fetchDocuments();
            onRefresh?.();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Yükleme hatası', description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const deleteDocument = async (doc) => {
        try {
            await supabase.storage.from(BUCKET_NAME).remove([doc.file_path]);
            const { error } = await supabase.from('quality_cost_documents').delete().eq('id', doc.id);
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Doküman silindi.' });
            await fetchDocuments();
            onRefresh?.();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        }
    };

    const downloadDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(doc.file_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.document_name;
            a.click();
        } catch (error) {
            toast({ variant: 'destructive', title: 'İndirme hatası', description: error.message });
        }
    };

    const viewDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(doc.file_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            window.open(url, '_blank');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Görüntüleme hatası', description: error.message });
        }
    };

    const getFileIcon = (type) => {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type?.toLowerCase())) return <Image className="w-5 h-5" />;
        if (['pdf'].includes(type?.toLowerCase())) return <FileText className="w-5 h-5" />;
        return <File className="w-5 h-5" />;
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Dokümanlar</h3>
                    <p className="text-sm text-muted-foreground">Fatura, rapor ve diğer kanıt dokümanlarını ekleyin</p>
                </div>
                <Button onClick={() => setUploadOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Dosya Yükle
                </Button>
            </div>

            {documents.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Henüz doküman yüklenmemiş.</p>
                        <p className="text-sm mt-2">Fatura veya diğer kanıt dokümanlarını eklemek için "Dosya Yükle" butonunu kullanın.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => (
                        <Card key={doc.id}>
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {getFileIcon(doc.file_type)}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{doc.document_name}</div>
                                            <Badge variant="outline" className="mt-1">{doc.document_type}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 mt-4">
                                    <Button size="sm" variant="outline" onClick={() => viewDocument(doc)} className="w-full">
                                        <Eye className="w-4 h-4 mr-2" />
                                        Görüntüle
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)} className="flex-1">
                                            <Download className="w-4 h-4 mr-2" />
                                            İndir
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive" className="flex-1">
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Sil
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                    <AlertDialogDescription>Bu doküman kalıcı olarak silinecektir.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteDocument(doc)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                {doc.document_description && (
                                    <p className="text-sm text-muted-foreground mt-3">{doc.document_description}</p>
                                )}
                                <div className="text-xs text-muted-foreground mt-2">
                                    {new Date(doc.upload_date || doc.created_at).toLocaleDateString('tr-TR')}
                                    {doc.file_size && <> • {(doc.file_size / 1024).toFixed(1)} KB</>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isUploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Doküman Yükle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Doküman Tipi</Label>
                            <Select value={docType} onValueChange={setDocType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="file">Dosya Seç</Label>
                            <Input id="file" type="file" multiple onChange={handleFileSelect} />
                            {selectedFiles.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">{selectedFiles.length} dosya seçildi</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="description">Açıklama</Label>
                            <Textarea id="description" value={docDescription} onChange={(e) => setDocDescription(e.target.value)} rows={2} placeholder="Opsiyonel açıklama" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>İptal</Button>
                        <Button onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}>{isUploading ? 'Yükleniyor...' : 'Yükle'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default QualityCostDocumentsTab;
