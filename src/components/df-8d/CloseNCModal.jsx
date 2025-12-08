import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { sanitizeFileName } from '@/lib/utils';

const CloseNCModal = ({ isOpen, setIsOpen, record, refreshData }) => {
    const { toast } = useToast();
    const [notes, setNotes] = useState('');
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const onDrop = (acceptedFiles) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    };
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const removeFile = (fileToRemove) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };

    const handleCloseRecord = async () => {
        if (!notes) {
            toast({
                variant: 'destructive',
                title: 'Açıklama Gerekli',
                description: 'Lütfen kaydı kapatmak için bir açıklama girin.',
            });
            return;
        }

        setIsSubmitting(true);
        let uploadedFilePaths = [];

        if (files.length > 0) {
            for (const file of files) {
                const sanitizedFileName = sanitizeFileName(file.name);
                const filePath = `closing_attachments/${record.id}/${uuidv4()}-${sanitizedFileName}`;
                const { data, error } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream'
                    });

                if (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Dosya Yükleme Hatası',
                        description: `Dosya yüklenemedi: ${error.message}`,
                    });
                    setIsSubmitting(false);
                    return;
                }
                uploadedFilePaths.push({ path: data.path, name: file.name, type: file.type, size: file.size });
            }
        }
        
        const { error } = await supabase
            .from('non_conformities')
            .update({
                status: 'Kapatıldı',
                closed_at: new Date().toISOString(),
                closing_notes: notes,
                closing_attachments: uploadedFilePaths,
            })
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt kapatılamadı: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kayıt başarıyla kapatıldı.' });
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kaydı Kapat: {record.nc_number}</DialogTitle>
                    <DialogDescription>
                        Kapatma işlemini tamamlamak için lütfen aşağıdaki bilgileri girin.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="closing_notes">Kapatma Açıklaması</Label>
                        <Textarea
                            id="closing_notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Kapatma nedenini ve yapılan işlemleri detaylandırın..."
                            rows={4}
                        />
                    </div>
                    <div>
                        <Label>Kanıt Dokümanları</Label>
                        <div {...getRootProps()} className={`mt-2 flex justify-center rounded-lg border border-dashed border-border px-6 py-10 transition-colors ${isDragActive ? 'border-primary bg-primary/10' : ''}`}>
                            <div className="text-center">
                                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Dosyaları buraya sürükleyin veya <span className="font-semibold text-primary">seçmek için tıklayın</span>
                                </p>
                                <p className="text-xs text-muted-foreground">PNG, JPG, PDF, vb.</p>
                            </div>
                            <input {...getInputProps()} />
                        </div>
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="font-semibold text-sm">Seçilen dosyalar:</p>
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm bg-secondary p-2 rounded-md">
                                       <div className="flex items-center gap-2">
                                         <FileIcon className="h-4 w-4 text-muted-foreground" />
                                         <span>{file.name}</span>
                                       </div>
                                       <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(file)} className="h-6 w-6">
                                            <X className="h-4 w-4" />
                                       </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button onClick={handleCloseRecord} disabled={isSubmitting}>
                        {isSubmitting ? 'Kapatılıyor...' : 'Kaydı Kapat'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CloseNCModal;