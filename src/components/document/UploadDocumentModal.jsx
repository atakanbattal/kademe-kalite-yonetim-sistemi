import React, { useState, useCallback, useEffect, useRef } from 'react';
    import { useDropzone } from 'react-dropzone';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Textarea } from '@/components/ui/textarea';
    import { UploadCloud, File, X } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { sanitizeFileName } from '@/lib/utils';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';

    const BUCKET_NAME = 'documents';

    const UploadDocumentModal = ({ isOpen, setIsOpen, refreshDocuments, existingDocument, categories, preselectedCategory }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const { personnel: personnelList } = useData();
        const isEditMode = !!existingDocument;

        const [formData, setFormData] = useState({});
        const [file, setFile] = useState(null);
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const initialLoadRef = useRef(true);

        useEffect(() => {
            if (isOpen) {
                if (initialLoadRef.current) {
                    const initialData = {
                        title: '', 
                        document_type: preselectedCategory || '', 
                        revision_number: '1', 
                        publish_date: new Date().toISOString().slice(0, 10), 
                        personnel_id: null,
                        revision_reason: 'İlk Yayın',
                        valid_until: '',
                        status: 'Yayınlandı',
                        department: profile?.department || '',
                    };

                    if (isEditMode && existingDocument) {
                         const revision = existingDocument.document_revisions;
                         setFormData({
                            id: existingDocument.id,
                            title: existingDocument.title || '',
                            document_type: existingDocument.document_type || '',
                            personnel_id: existingDocument.personnel_id || null,
                            valid_until: existingDocument.valid_until ? new Date(existingDocument.valid_until).toISOString().slice(0, 10) : '',
                            revision_number: revision?.revision_number || '1',
                            publish_date: revision?.publish_date ? new Date(revision.publish_date).toISOString().slice(0, 10) : '',
                            revision_reason: revision?.revision_reason || '',
                            file_name: revision?.attachments?.[0]?.name,
                         });
                    } else {
                        setFormData(initialData);
                    }
                    setFile(null);
                    initialLoadRef.current = false;
                }
            } else {
                initialLoadRef.current = true;
            }
        }, [isOpen, existingDocument, isEditMode, preselectedCategory, profile]);

        const onDrop = useCallback(acceptedFiles => {
            if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0]);
            }
        }, []);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop,
            accept: { 'application/pdf': ['.pdf'] },
            maxFiles: 1
        });

        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (id, value) => {
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!isEditMode && !file) {
                toast({ variant: 'destructive', title: 'Dosya Eksik', description: 'Lütfen bir PDF dosyası seçin.' });
                return;
            }
            if (!formData.title || !formData.document_type || !formData.publish_date) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm zorunlu alanları doldurun.' });
                return;
            }
            setIsSubmitting(true);

            try {
                const currentUserPersonnelRecord = personnelList.find(p => p.email === user.email);
                if (!currentUserPersonnelRecord) {
                    throw new Error("Mevcut kullanıcı için personel kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.");
                }

                const documentId = isEditMode ? existingDocument.id : uuidv4();
                let attachmentData = null;

                if (file) {
                    if (isEditMode && existingDocument.current_revision_id) {
                         const { data: rev } = await supabase.from('document_revisions').select('attachments').eq('id', existingDocument.current_revision_id).single();
                         if (rev?.attachments?.[0]?.path) {
                            await supabase.storage.from(BUCKET_NAME).remove([rev.attachments[0].path]);
                         }
                    }
                    const sanitizedFileName = sanitizeFileName(file.name);
                    const filePath = `${user.id}/${documentId}-${sanitizedFileName}`;
                    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
                    if (uploadError) throw uploadError;

                    attachmentData = {
                        path: filePath,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    };
                }
                
                const documentPayload = {
                    title: formData.title,
                    document_type: formData.document_type,
                    status: 'Yayınlandı',
                    department: formData.department,
                    personnel_id: formData.document_type === 'Personel Sertifikaları' ? formData.personnel_id : null,
                    valid_until: formData.valid_until || null,
                    user_id: user.id,
                };

                const revisionPayload = {
                    revision_number: parseInt(formData.revision_number, 10) || 1,
                    revision_reason: formData.revision_reason,
                    publish_date: formData.publish_date,
                    prepared_by_id: currentUserPersonnelRecord.id,
                    user_id: user.id,
                    attachments: attachmentData ? [attachmentData] : (isEditMode ? existingDocument.document_revisions?.attachments : null),
                };
                
                if (isEditMode) {
                    const { data: docUpdateData, error: docUpdateError } = await supabase
                        .from('documents')
                        .update(documentPayload)
                        .eq('id', documentId)
                        .select('id')
                        .single();
                    if (docUpdateError) throw docUpdateError;
                    
                    const { error: revUpdateError } = await supabase
                        .from('document_revisions')
                        .update(revisionPayload)
                        .eq('document_id', documentId);
                     if (revUpdateError) throw revUpdateError;
                } else {
                    const { data: docData, error: docError } = await supabase
                        .from('documents')
                        .insert({ ...documentPayload, id: documentId })
                        .select('id, document_number')
                        .single();
                    if (docError) throw docError;

                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...revisionPayload, document_id: docData.id })
                        .select('id')
                        .single();
                    if (revError) throw revError;

                    const { error: updateDocError } = await supabase
                        .from('documents')
                        .update({ current_revision_id: revData.id })
                        .eq('id', docData.id);
                    if (updateDocError) throw updateDocError;
                }

                toast({ title: 'Başarılı!', description: `Doküman başarıyla ${isEditMode ? 'güncellendi' : 'yüklendi'}.` });
                refreshDocuments();
                setIsOpen(false);
            } catch (error) {
                console.error("Submit Error:", error);
                toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{isEditMode ? 'Dokümanı Düzenle' : 'Yeni Doküman Yükle'}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">{isEditMode ? 'Mevcut doküman bilgilerini güncelleyin.' : 'Sisteme yeni bir doküman ekleyin.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="md:col-span-2">
                            <Label htmlFor="title">Doküman Adı <span className="text-red-500">*</span></Label>
                            <Input id="title" value={formData.title || ''} onChange={handleInputChange} required />
                        </div>

                        <div>
                            <Label htmlFor="document_type">Kategori <span className="text-red-500">*</span></Label>
                            <Select value={formData.document_type || ''} onValueChange={(v) => handleSelectChange('document_type', v)} required>
                                <SelectTrigger><SelectValue placeholder="Kategori seçin..." /></SelectTrigger>
                                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        {formData.document_type === 'Personel Sertifikaları' && (
                             <div>
                                <Label htmlFor="personnel_id">Personel</Label>
                                 <Select
                                    value={formData.personnel_id || ''}
                                    onValueChange={(value) => handleSelectChange('personnel_id', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Personel seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {personnelList.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        <div>
                            <Label htmlFor="revision_number">Versiyon</Label>
                            <Input id="revision_number" value={formData.revision_number || ''} onChange={handleInputChange} />
                        </div>

                        <div>
                            <Label htmlFor="publish_date">Yayın Tarihi <span className="text-red-500">*</span></Label>
                            <Input id="publish_date" type="date" value={formData.publish_date || ''} onChange={handleInputChange} required />
                        </div>

                        <div>
                            <Label htmlFor="valid_until">Geçerlilik Süresi</Label>
                            <Input id="valid_until" type="date" value={formData.valid_until || ''} onChange={handleInputChange} />
                        </div>
                        
                        <div className="md:col-span-2">
                            <Label htmlFor="revision_reason">Revizyon Nedeni</Label>
                            <Textarea id="revision_reason" value={formData.revision_reason || ''} onChange={handleInputChange} rows={3} />
                        </div>

                        <div className="md:col-span-2">
                            <Label>Dosya (PDF)</Label>
                            <div {...getRootProps()} className={`mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}>
                                <input {...getInputProps()} />
                                <div className="text-center">
                                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                        {isDragActive ? 'Dosyayı buraya bırakın...' : 'Dosyayı sürükleyin veya seçmek için tıklayın'}
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">Sadece PDF dosyaları kabul edilir.</p>
                                </div>
                            </div>
                             {(file || (isEditMode && formData.file_name)) && (
                                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary p-3">
                                    <div className="flex items-center gap-2">
                                        <File className="h-5 w-5 text-primary" />
                                        <span className="text-sm font-medium text-foreground">{file?.name || formData.file_name}</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setFile(null); setFormData(prev => ({...prev, file_name: null})); }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                         <DialogFooter className="md:col-span-2 mt-4">
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Dokümanı Kaydet')}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default UploadDocumentModal;