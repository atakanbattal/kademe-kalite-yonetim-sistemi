import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, File as FileIcon, X as XIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const CloseNCModal = ({ isOpen, setIsOpen, record, onSave }) => {
    const { toast } = useToast();
    const [notes, setNotes] = useState('');
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles.map(file => Object.assign(file, {
            preview: URL.createObjectURL(file)
        }))]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.png', '.jpg'],
            'application/pdf': ['.pdf'],
        }
    });
    
    const removeFile = (fileToRemove) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };

    const handleCloseRecord = async () => {
        if (!notes) {
            toast({ variant: 'destructive', title: 'Açıklama Gerekli', description: 'Lütfen kaydı kapatmak için bir açıklama girin.' });
            return;
        }

        setIsSubmitting(true);
        let closing_attachments = record.closing_attachments || [];

        if (files.length > 0) {
            const uploadPromises = files.map(file => {
                const filePath = `nc_closing_attachments/${record.id}/${uuidv4()}-${file.name}`;
                return supabase.storage.from('df_attachments').upload(filePath, file);
            });
            const uploadResults = await Promise.all(uploadPromises);

            const newPaths = uploadResults.map(res => {
                if (res.error) {
                    toast({ variant: 'destructive', title: 'Dosya Yükleme Hatası!', description: res.error.message });
                    return null;
                }
                return res.data.path;
            }).filter(Boolean);

            if (newPaths.length !== files.length) {
                setIsSubmitting(false);
                return;
            }
            closing_attachments.push(...newPaths);
        }
        
        const { error } = await supabase
            .from('non_conformities')
            .update({ status: 'Kapatıldı', closed_at: new Date().toISOString(), closing_notes: notes, closing_attachments })
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt kapatılamadı: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kayıt başarıyla kapatıldı.' });
            if (onSave) onSave();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    useEffect(() => {
        if (isOpen) {
          setNotes(record?.closing_notes || '');
        } else {
          setNotes('');
          setFiles([]);
        }
        return () => files.forEach(file => URL.revokeObjectURL(file.preview));
    }, [isOpen, record, files]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!isSubmitting) setIsOpen(open);
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Uygunsuzluğu Kapat: {record?.nc_number}</DialogTitle>
                    <DialogDescription>Kapatma işlemini tamamlamak için lütfen açıklama girin. Doküman eklemek opsiyoneldir.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="closing_notes">Kapatma Açıklaması <span className="text-red-500">*</span></Label>
                        <Textarea id="closing_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Yapılan iyileştirmeleri ve sonucu açıklayın..." />
                    </div>
                    <div>
                        <Label>Kanıt Dokümanları (Opsiyonel)</Label>
                        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Dokümanları buraya sürükleyin veya seçmek için tıklayın.</p>
                        </div>
                        {files.length > 0 && (
                             <div className="mt-2 space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                                        <div className="flex items-center gap-2"><FileIcon className="w-4 h-4" /><span className="text-sm">{file.name}</span></div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file)}><XIcon className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button onClick={handleCloseRecord} disabled={isSubmitting || !notes}> {isSubmitting ? 'Kapatılıyor...' : 'Kaydı Kapat'} </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CloseNCModal;