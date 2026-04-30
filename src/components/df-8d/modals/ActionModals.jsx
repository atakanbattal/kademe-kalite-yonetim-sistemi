import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { UploadCloud, File as FileIcon, X as XIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const isoToDatetimeLocalValue = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Reddedilmiş DF / 8D kayıtlarında gerekçe ve reddetme tarihini günceller (durumu değiştirmez). */
export const EditRejectionDetailsModal = ({ isOpen, setIsOpen, record, onSaved }) => {
    const { toast } = useToast();
    const [reason, setReason] = useState('');
    const [rejectedAtLocal, setRejectedAtLocal] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !record) return;
        setReason(record.rejection_reason || '');
        const fallback = record.rejected_at || record.created_at || new Date().toISOString();
        setRejectedAtLocal(isoToDatetimeLocalValue(record.rejected_at) || isoToDatetimeLocalValue(fallback));
    }, [isOpen, record?.id, record?.rejection_reason, record?.rejected_at, record?.created_at]);

    const handleSave = async () => {
        const trimmed = (reason || '').trim();
        if (!trimmed) {
            toast({ variant: 'destructive', title: 'Açıklama gerekli', description: 'Reddetme gerekçesi boş bırakılamaz.' });
            return;
        }
        if (!rejectedAtLocal) {
            toast({ variant: 'destructive', title: 'Tarih gerekli', description: 'Reddetme tarihi seçin.' });
            return;
        }
        const rejectedIso = new Date(rejectedAtLocal).toISOString();
        if (Number.isNaN(new Date(rejectedIso).getTime())) {
            toast({ variant: 'destructive', title: 'Geçersiz tarih', description: 'Reddetme tarihini kontrol edin.' });
            return;
        }
        setIsSubmitting(true);
        const { data, error } = await supabase
            .from('non_conformities')
            .update({
                rejection_reason: trimmed,
                rejected_at: rejectedIso,
            })
            .eq('id', record.id)
            .eq('status', 'Reddedildi')
            .select('id, rejection_reason, rejected_at')
            .maybeSingle();

        if (error) {
            toast({ variant: 'destructive', title: 'Kaydedilemedi', description: error.message });
            setIsSubmitting(false);
            return;
        }
        if (!data) {
            toast({
                variant: 'destructive',
                title: 'Güncellenemedi',
                description: 'Kayıt reddedilmiş durumda değil veya erişim reddedildi.',
            });
            setIsSubmitting(false);
            return;
        }

        toast({ title: 'Güncellendi', description: 'Reddetme bilgileri kaydedildi.' });
        if (onSaved) onSaved({ rejection_reason: data.rejection_reason, rejected_at: data.rejected_at });
        setIsOpen(false);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Reddetme bilgilerini düzenle</DialogTitle>
                    <DialogDescription>
                        DF ve 8D kayıtlarında reddetme gerekçesi ve reddetme tarihini güncelleyin.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="edit_rejection_reason">Reddetme gerekçesi <span className="text-red-500">*</span></Label>
                        <Textarea
                            id="edit_rejection_reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reddetme nedenini açıklayın."
                            autoFormat={false}
                            rows={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit_rejected_at">Reddetme tarihi ve saati <span className="text-red-500">*</span></Label>
                        <Input
                            id="edit_rejected_at"
                            type="datetime-local"
                            value={rejectedAtLocal}
                            onChange={(e) => setRejectedAtLocal(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                        İptal
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const RejectModal = ({ isOpen, setIsOpen, record, onSave }) => {
    const { toast } = useToast();
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReject = async () => {
        if (!notes) {
            toast({ variant: 'destructive', title: 'Açıklama Gerekli', description: 'Lütfen reddetme gerekçesini girin.' });
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase
            .from('non_conformities')
            .update({
                status: 'Reddedildi',
                rejection_reason: notes,
                rejected_at: new Date().toISOString(),
                due_date: null,
                due_at: null
            })
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt reddedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kayıt başarıyla reddedildi ve termin tarihi kaldırıldı.' });
            if (onSave) onSave();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kaydı Reddet</DialogTitle>
                    <DialogDescription>Bu DF kaydını neden reddettiğinizi açıklayın.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="rejection_notes">Reddetme Gerekçesi <span className="text-red-500">*</span></Label>
                    <Textarea id="rejection_notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Örn: Bu uygunsuzluk bizim birimimizle ilgili değildir." autoFormat={false} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button variant="destructive" onClick={handleReject} disabled={isSubmitting || !notes}>{isSubmitting ? 'Reddediliyor...' : 'Reddet'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const CloseModal = ({ isOpen, setIsOpen, record, onSave }) => {
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
                    // Safari uyumluluğu için dosyayı ArrayBuffer olarak oku
                    const arrayBuffer = await file.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

                    const { data, error } = await supabase.storage
                        .from('df_attachments')
                        .upload(filePath, blob, {
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

    useLayoutEffect(() => {
        if (!isOpen) {
            setNotes('');
            setFiles([]);
            return;
        }
        setNotes(record?.closing_notes ?? '');
        setFiles([]);
    }, [isOpen, record?.id, record?.closing_notes]);

    useEffect(() => () => {
        files.forEach((file) => {
            if (file?.preview) URL.revokeObjectURL(file.preview);
        });
    }, [files]);

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

export const ForwardNCModal = ({ isOpen, setIsOpen, record, onSave }) => {
    const { toast } = useToast();
    const [targetPersonnelId, setTargetPersonnelId] = useState('');
    const [notes, setNotes] = useState('');
    const [personnel, setPersonnel] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchPersonnel = async () => {
            const { data, error } = await supabase.from('personnel').select('id, full_name, department').eq('is_active', true).order('full_name');
            if (!error) {
                setPersonnel(data);
            }
        };
        if (isOpen) {
            fetchPersonnel();
        }
    }, [isOpen]);

    const handleForward = async () => {
        if (!targetPersonnelId) {
            toast({ variant: 'destructive', title: 'Personel Seçimi Gerekli', description: 'Lütfen yönlendirilecek personeli seçin.' });
            return;
        }
        setIsSubmitting(true);

        const selectedPersonnel = personnel.find(p => p.id === targetPersonnelId);
        if (!selectedPersonnel) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Seçilen personel bulunamadı.' });
            setIsSubmitting(false);
            return;
        }

        const { error } = await supabase
            .from('non_conformities')
            .update({
                responsible_person: selectedPersonnel.full_name,
                department: selectedPersonnel.department,
                forwarded_to_personnel_id: targetPersonnelId,
                forwarded_unit: selectedPersonnel.department,
                rejection_notes: notes // Using rejection_notes for forwarding notes as an audit trail
            })
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt yönlendirilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Kayıt başarıyla ${selectedPersonnel.full_name} kişisine yönlendirildi.` });
            if (onSave) onSave();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: `${p.full_name} (${p.department})` }));

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kaydı Yönlendir: {record?.nc_number}</DialogTitle>
                    <DialogDescription>Bu kaydı başka bir personele yönlendirin. Birim otomatik olarak güncellenecektir.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="target_personnel">Yönlendirilecek Personel <span className="text-red-500">*</span></Label>
                        <SearchableSelectDialog
                            options={personnelOptions}
                            value={targetPersonnelId}
                            onChange={setTargetPersonnelId}
                            triggerPlaceholder="Personel seçin..."
                            dialogTitle="Personel Seç"
                            searchPlaceholder="Personel ara..."
                            notFoundText="Personel bulunamadı."
                        />
                    </div>
                    <div>
                        <Label htmlFor="forward_notes">Yönlendirme Notu (Opsiyonel)</Label>
                        <Textarea id="forward_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Yönlendirme nedenini açıklayabilirsiniz..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button onClick={handleForward} disabled={isSubmitting || !targetPersonnelId}>Yönlendir</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const InProgressModal = ({ isOpen, setIsOpen, record, onSave }) => {
    const { toast } = useToast();
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useLayoutEffect(() => {
        if (!isOpen) {
            setNotes('');
            return;
        }
        setNotes(record?.closing_notes ?? '');
    }, [isOpen, record?.id, record?.closing_notes]);

    const handleSetInProgress = async () => {
        setIsSubmitting(true);
        const { error } = await supabase
            .from('non_conformities')
            .update({ status: 'İşlemde', closing_notes: notes })
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt güncellenemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kayıt "İşlemde" olarak güncellendi.' });
            if (onSave) onSave();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kaydı İşleme Al</DialogTitle>
                    <DialogDescription>Bu kayıt üzerinde çalışmaya başladığınızı belirtin ve ilerleme notlarınızı ekleyin.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="in_progress_notes" className="text-base font-semibold">
                        İlerleme Notları & Yapılan Çalışmalar
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        📝 Birimlerden aldığınız dönüşleri, yapılan iyileştirmeleri ve ilerleme durumunu buraya ekleyin. Bu notlar görüntüleme ekranında gösterilecektir.
                    </p>
                    <Textarea
                        id="in_progress_notes"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Örnek: Üretim bölümü ile görüşüldü, kök neden analizi yapıldı, düzeltici faaliyet planlandı..."
                        rows={6}
                        className="resize-none"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button onClick={handleSetInProgress} disabled={isSubmitting}>{isSubmitting ? 'Güncelleniyor...' : 'İşleme Al'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const UpdateDueDateModal = ({ isOpen, setIsOpen, record, onSave }) => {
    const { toast } = useToast();
    const [dueDate, setDueDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && record) {
            // due_at varsa onu kullan, yoksa due_date'i kullan
            const dateValue = record.due_at || record.due_date;
            if (dateValue) {
                const date = new Date(dateValue);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                setDueDate(`${year}-${month}-${day}`);
            } else {
                setDueDate('');
            }
        } else {
            setDueDate('');
        }
    }, [isOpen, record]);

    const handleUpdate = async () => {
        if (!dueDate) {
            toast({ variant: 'destructive', title: 'Tarih Gerekli', description: 'Lütfen bir termin tarihi seçin.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const dueDateObj = new Date(dueDate);
            const dueDateString = dueDateObj.toISOString().split('T')[0];
            const dueAtISO = dueDateObj.toISOString();

            const { error } = await supabase
                .from('non_conformities')
                .update({
                    due_date: dueDateString,
                    due_at: dueAtISO
                })
                .eq('id', record.id);

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Termin tarihi güncellenemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Termin tarihi başarıyla güncellendi.' });
                if (onSave) onSave();
                setIsOpen(false);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Tarih işlenirken hata oluştu: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Termin Tarihi Güncelle</DialogTitle>
                    <DialogDescription>
                        {record?.nc_number || record?.mdi_no} kaydının termin tarihini güncelleyin.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="due_date">Termin Tarihi <span className="text-red-500">*</span></Label>
                    <Input
                        id="due_date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="mt-2"
                        required
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button onClick={handleUpdate} disabled={isSubmitting || !dueDate}>
                        {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};