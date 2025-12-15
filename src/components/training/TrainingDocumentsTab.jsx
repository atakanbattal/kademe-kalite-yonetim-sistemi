import React, { useState, useEffect, useCallback } from 'react';
    import { useDropzone } from 'react-dropzone';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { UploadCloud, FileText, Trash2 } from 'lucide-react';
    import { sanitizeFileName } from '@/lib/utils';
    import { v4 as uuidv4 } from 'uuid';

    const TrainingDocumentsTab = ({ onOpenPdfViewer }) => {
        const { toast } = useToast();
        const [trainings, setTrainings] = useState([]);
        const [selectedTrainingId, setSelectedTrainingId] = useState('');
        const [documents, setDocuments] = useState([]);
        const [loading, setLoading] = useState(false);
        const [filesToUpload, setFilesToUpload] = useState([]);

        useEffect(() => {
            const fetchTrainings = async () => {
                const { data, error } = await supabase.from('trainings').select('id, title, training_code').order('title');
                if (!error) setTrainings(data);
            };
            fetchTrainings();
        }, []);

        const fetchDocuments = useCallback(async () => {
            if (!selectedTrainingId) {
                setDocuments([]);
                return;
            }
            setLoading(true);
            const { data, error } = await supabase.from('training_documents').select('*').eq('training_id', selectedTrainingId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Dokümanlar getirilemedi.' });
            } else {
                setDocuments(data);
            }
            setLoading(false);
        }, [selectedTrainingId, toast]);

        useEffect(() => {
            fetchDocuments();
        }, [fetchDocuments]);

        const onDrop = useCallback((acceptedFiles) => {
            setFilesToUpload(prev => [...prev, ...acceptedFiles.map(file => Object.assign(file))]);
        }, []);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

        const handleUpload = async () => {
            if (filesToUpload.length === 0 || !selectedTrainingId) return;
            setLoading(true);

            const uploadPromises = filesToUpload.map(async (file) => {
                const fileName = sanitizeFileName(file.name);
                const filePath = `${selectedTrainingId}/${uuidv4()}-${fileName}`;
                const { error: uploadError } = await supabase.storage.from('training_documents').upload(filePath, file);
                if (uploadError) throw uploadError;
                return {
                    training_id: selectedTrainingId,
                    file_name: fileName,
                    file_path: filePath,
                    file_type: file.type,
                };
            });

            try {
                const newDocuments = await Promise.all(uploadPromises);
                const { error: insertError } = await supabase.from('training_documents').insert(newDocuments);
                if (insertError) throw insertError;
                toast({ title: 'Başarılı', description: `${filesToUpload.length} doküman yüklendi.` });
                setFilesToUpload([]);
                fetchDocuments();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Yükleme başarısız: ${error.message}` });
            } finally {
                setLoading(false);
            }
        };

        const handleDelete = async (docId, filePath) => {
            const { error: storageError } = await supabase.storage.from('training_documents').remove([filePath]);
            if (storageError) {
                toast({ variant: 'destructive', title: 'Hata', description: `Dosya silinemedi: ${storageError.message}` });
                return;
            }
            const { error: dbError } = await supabase.from('training_documents').delete().eq('id', docId);
            if (dbError) {
                toast({ variant: 'destructive', title: 'Hata', description: `Veritabanı kaydı silinemedi: ${dbError.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Doküman silindi.' });
                fetchDocuments();
            }
        };

        const handleView = async (filePath, fileName) => {
            try {
                const { data, error } = await supabase.storage.from('training_documents').createSignedUrl(filePath, 3600);
                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Dosya açılamadı: ${error.message}` });
                    return;
                }
                if (/\.pdf$/i.test(fileName)) {
                    onOpenPdfViewer(data.signedUrl, fileName);
                } else {
                    window.open(data.signedUrl, '_blank');
                }
            } catch (err) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Dosya açılırken hata oluştu.' });
                console.error('File view error:', err);
            }
        };

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Select onValueChange={setSelectedTrainingId} value={selectedTrainingId}>
                        <SelectTrigger className="w-[300px]"><SelectValue placeholder="Eğitim Seçin..." /></SelectTrigger>
                        <SelectContent>{trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.training_code} - {t.title}</SelectItem>)}</SelectContent>
                    </Select>
                </div>

                {selectedTrainingId && (
                    <>
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'} cursor-pointer`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="mt-4 text-muted-foreground">Dosyaları buraya sürükleyin veya seçmek için tıklayın</p>
                        </div>

                        {filesToUpload.length > 0 && (
                            <div className="space-y-2">
                                {filesToUpload.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                                        <FileText className="h-5 w-5" />
                                        <span className="flex-grow">{file.name}</span>
                                        <Button variant="ghost" size="icon" onClick={() => setFilesToUpload(filesToUpload.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                ))}
                                <Button onClick={handleUpload} disabled={loading}>{loading ? 'Yükleniyor...' : 'Tümünü Yükle'}</Button>
                            </div>
                        )}

                        <div className="rounded-md border mt-4">
                            <Table>
                                <TableHeader><TableRow><TableHead>Doküman Adı</TableHead><TableHead>Yüklenme Tarihi</TableHead><TableHead className="sticky right-0 bg-card text-right z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {loading ? <TableRow><TableCell colSpan="3" className="text-center">Yükleniyor...</TableCell></TableRow> :
                                    documents.map(doc => (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium">{doc.file_name}</TableCell>
                                            <TableCell>{new Date(doc.created_at).toLocaleDateString('tr-TR')}</TableCell>
                                            <TableCell className="sticky right-0 bg-card border-l border-border z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)] text-right">
                                                <Button variant="outline" size="sm" onClick={() => handleView(doc.file_path, doc.file_name)}>Görüntüle</Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id, doc.file_path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        );
    };

    export default TrainingDocumentsTab;