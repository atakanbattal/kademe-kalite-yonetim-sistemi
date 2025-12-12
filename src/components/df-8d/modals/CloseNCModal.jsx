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

    // Dosya adını normalize et ve güvenli hale getir
    const normalizeFileName = (fileName) => {
        if (!fileName) return 'file';
        
        // Türkçe karakterleri ASCII'ye çevir
        const turkishToAscii = {
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U'
        };
        
        let normalized = fileName;
        Object.keys(turkishToAscii).forEach(key => {
            normalized = normalized.replace(new RegExp(key, 'g'), turkishToAscii[key]);
        });
        
        // Dosya adını ve uzantısını ayır
        const lastDotIndex = normalized.lastIndexOf('.');
        let name = normalized;
        let ext = '';
        
        if (lastDotIndex > 0 && lastDotIndex < normalized.length - 1) {
            name = normalized.substring(0, lastDotIndex);
            ext = normalized.substring(lastDotIndex + 1);
        }
        
        // Özel karakterleri temizle ve boşlukları tire ile değiştir
        name = name
            .replace(/[^a-zA-Z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Uzantıyı temizle
        ext = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // Eğer uzantı yoksa orijinal dosyadan al
        if (!ext || ext.length === 0) {
            const originalLastDot = fileName.lastIndexOf('.');
            if (originalLastDot > 0 && originalLastDot < fileName.length - 1) {
                ext = fileName.substring(originalLastDot + 1).toLowerCase();
            }
        }
        
        if (!ext || ext.length === 0) ext = 'file';
        if (!name || name.length === 0) name = 'file';
        
        return `${name}.${ext}`;
    };

    // Güvenli dosya yolu oluştur
    const createSafeFilePath = (originalFileName, recordId) => {
        const normalizedName = normalizeFileName(originalFileName);
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const safeFileName = `${timestamp}-${randomStr}-${normalizedName}`;
        const safeRecordId = String(recordId || 'unknown').replace(/[^a-zA-Z0-9\-_]/g, '-');
        return `nc_closing_attachments/${safeRecordId}/${safeFileName}`;
    };

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
            const uploadPromises = files.map(async (file) => {
                const originalFileName = file.name || 'unnamed-file';
                const filePath = createSafeFilePath(originalFileName, record.id);
                
                try {
                    const { data, error } = await supabase.storage
                        .from('df_attachments')
                        .upload(filePath, file, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: file.type || 'application/octet-stream'
                        });
                    return { data, error };
                } catch (err) {
                    return { data: null, error: err };
                }
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
                        <Textarea id="closing_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Yapılan iyileştirmeleri ve sonucu açıklayın..." autoFormat={false} />
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