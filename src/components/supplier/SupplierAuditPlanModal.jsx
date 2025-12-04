import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '@/contexts/DataContext';

const SupplierAuditPlanModal = ({ isOpen, setIsOpen, supplier, refreshData, existingPlan }) => {
    const { toast } = useToast();
    const { suppliers } = useData();
    const [formData, setFormData] = useState({});
    const [files, setFiles] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditMode = !!existingPlan;

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setFormData({
                    ...existingPlan,
                    planned_date: existingPlan.planned_date ? new Date(existingPlan.planned_date).toISOString().split('T')[0] : '',
                    actual_date: existingPlan.actual_date ? new Date(existingPlan.actual_date).toISOString().split('T')[0] : '',
                });
                setExistingFiles(existingPlan.report_files || []);
            } else {
                setFormData({
                    supplier_id: supplier?.id || '',
                    planned_date: '',
                    actual_date: '',
                    score: '',
                    notes: '',
                    status: 'Planlandı',
                    reason_for_delay: ''
                });
                setExistingFiles([]);
            }
            setFiles([]);
        }
    }, [supplier, existingPlan, isOpen, isEditMode]);

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const removeNewFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const removeExistingFile = (filePath) => {
        setExistingFiles(existingFiles.filter(f => f.path !== filePath));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.supplier_id) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Lütfen bir tedarikçi seçin.' });
            return;
        }
        setIsSubmitting(true);
        
        let uploadedFiles = [...existingFiles];
        if (files.length > 0) {
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${uuidv4()}.${fileExt}`;
                const filePath = `${formData.supplier_id}/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('supplier_audit_reports')
                    .upload(filePath, file);

                if (uploadError) {
                    toast({ variant: 'destructive', title: 'Hata!', description: `${file.name} yüklenemedi: ${uploadError.message}` });
                    setIsSubmitting(false);
                    return;
                }
                uploadedFiles.push({ name: file.name, path: filePath });
            }
        }

        const { id, supplierName, supplier, ...planData } = formData;

        const dataToSubmit = { 
            ...planData, 
            report_files: uploadedFiles,
            score: planData.score || null,
            planned_date: planData.planned_date || null,
            actual_date: planData.actual_date || null,
        };
        
        let error;
        if (isEditMode) {
            const { error: updateError } = await supabase.from('supplier_audit_plans').update(dataToSubmit).eq('id', existingPlan.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('supplier_audit_plans').insert(dataToSubmit);
            error = insertError;
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Denetim planı ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Denetim planı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    const selectedSupplierName = suppliers.find(s => s.id === formData.supplier_id)?.name;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Denetim Planını Düzenle' : 'Yeni Tedarikçi Denetim Planı'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode || supplier ? (
                            <span className="font-semibold text-primary">{selectedSupplierName || supplier?.name}</span>
                        ) : "Bir tedarikçi seçerek denetim planı oluşturun."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    {!isEditMode && !supplier && (
                        <div>
                            <Label htmlFor="supplier_id">Tedarikçi</Label>
                            <Select value={formData.supplier_id || ''} onValueChange={(v) => handleSelectChange('supplier_id', v)}>
                                <SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="planned_date">Planlanan Tarih</Label>
                            <Input id="planned_date" type="date" value={formData.planned_date || ''} onChange={handleInputChange} />
                        </div>
                         <div>
                            <Label htmlFor="actual_date">Gerçekleşen Tarih</Label>
                            <Input id="actual_date" type="date" value={formData.actual_date || ''} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="status">Durum</Label>
                        <Select value={formData.status || 'Planlandı'} onValueChange={(v) => handleSelectChange('status', v)}>
                            <SelectTrigger><SelectValue placeholder="Durum seçin..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Planlandı">Planlandı</SelectItem>
                                <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                                <SelectItem value="Ertelendi">Ertelendi</SelectItem>
                                <SelectItem value="İptal Edildi">İptal Edildi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="score">Alınan Puan</Label>
                        <Input id="score" type="number" value={formData.score || ''} onChange={handleInputChange} />
                    </div>
                    <div>
                        <Label htmlFor="notes">Denetim Notları</Label>
                        <Textarea id="notes" value={formData.notes || ''} onChange={handleInputChange} />
                    </div>
                     <div>
                        <Label htmlFor="reason_for_delay">Gecikme/Erteleme Nedeni</Label>
                        <Textarea id="reason_for_delay" value={formData.reason_for_delay || ''} onChange={handleInputChange} />
                    </div>
                    
                    <div>
                        <Label>Denetim Dosyaları (Rapor, Fotoğraf vb.)</Label>
                        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <UploadCloud className="w-10 h-10" />
                                <p>Dosyaları buraya sürükleyin veya seçmek için tıklayın</p>
                            </div>
                        </div>
                        {(existingFiles.length > 0 || files.length > 0) && (
                            <div className="mt-4 space-y-2">
                                {existingFiles.map((file, index) => (
                                    <div key={`existing-${index}`} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                        <div className="flex items-center gap-2"><FileIcon className="w-4 h-4" /><span>{file.name}</span></div>
                                        <Button variant="ghost" size="sm" onClick={() => removeExistingFile(file.path)}><X className="w-4 h-4"/></Button>
                                    </div>
                                ))}
                                {files.map((file, index) => (
                                    <div key={`new-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                        <div className="flex items-center gap-2"><FileIcon className="w-4 h-4" /><span>{file.name}</span></div>
                                        <Button variant="ghost" size="sm" onClick={() => removeNewFile(index)}><X className="w-4 h-4"/></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </form>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierAuditPlanModal;