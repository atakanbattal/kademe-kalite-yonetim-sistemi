import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const QuarantineFormModal = ({ isOpen, setIsOpen, existingRecord, refreshData, mode }) => {
    const { toast } = useToast();
    const isEditMode = mode === 'edit';
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const textareaRef = useRef(null);

    useEffect(() => {
        const fetchDepartments = async () => {
            const { data, error } = await supabase.from('cost_settings').select('unit_name').order('unit_name');
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Birimler yüklenemedi.' });
            } else {
                setDepartments(data.map(d => d.unit_name));
            }
        };
        if(isOpen) {
            fetchDepartments();
        }
    }, [isOpen, toast]);

    const initialData = {
        lot_no: '',
        part_code: '',
        part_name: '',
        quantity: '',
        unit: 'Adet',
        source_department: '',
        requesting_department: '',
        requesting_person_name: '',
        description: '',
        quarantine_date: new Date().toISOString().slice(0, 10),
        status: 'Karantinada'
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && existingRecord) {
                setFormData({
                    ...existingRecord,
                    quarantine_date: new Date(existingRecord.quarantine_date).toISOString().slice(0, 10),
                });
            } else {
                setFormData(initialData);
            }
        }
    }, [existingRecord, isEditMode, isOpen]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [formData.description]);


    const handleInputChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.part_name || !formData.quantity || !formData.source_department) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen zorunlu alanları doldurun.' });
            return;
        }
        setIsSubmitting(true);
        
        const { non_conformity, non_conformity_id, nc_number, non_conformity_type, ...rest } = formData;
        
        const submissionData = {
          ...rest,
          quantity: parseInt(rest.quantity, 10),
        };

        // Remove api view only fields before submitting to the actual table
        delete submissionData.id;
        delete submissionData.created_at;
        delete submissionData.updated_at;


        let error;

        if (isEditMode) {
            const { error: updateError } = await supabase
                .from('quarantine_records')
                .update(submissionData)
                .eq('id', existingRecord.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('quarantine_records')
                .insert([submissionData]);
            error = insertError;
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Karantina kaydı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-foreground">{isEditMode ? 'Karantina Kaydını Düzenle' : 'Yeni Karantina Kaydı'}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditMode ? 'Mevcut kaydın detaylarını güncelleyin.' : 'Karantinaya alınan ürün için yeni bir kayıt oluşturun.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div><Label htmlFor="part_name">Parça Adı <span className="text-red-500">*</span></Label><Input id="part_name" value={formData.part_name || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required /></div>
                    <div><Label htmlFor="part_code">Parça Kodu</Label><Input id="part_code" value={formData.part_code || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} /></div>
                    <div><Label htmlFor="lot_no">Lot / Seri No</Label><Input id="lot_no" value={formData.lot_no || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-2">
                        <div><Label htmlFor="quantity">Miktar <span className="text-red-500">*</span></Label><Input id="quantity" type="number" value={formData.quantity || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required /></div>
                        <div><Label htmlFor="unit">Birim</Label><Input id="unit" value={formData.unit || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} /></div>
                    </div>
                    <div><Label htmlFor="quarantine_date">Karantina Tarihi <span className="text-red-500">*</span></Label><Input id="quarantine_date" type="date" value={formData.quarantine_date || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required /></div>
                    
                    <div>
                        <Label>Karantinaya Sebebiyet Veren Birim <span className="text-red-500">*</span></Label>
                        <Select
                            value={formData.source_department || ''}
                            onValueChange={(value) => handleSelectChange('source_department', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Birim seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept} value={dept}>
                                        {dept}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div>
                        <Label>Talebi Yapan Birim</Label>
                         <Select
                            value={formData.requesting_department || ''}
                            onValueChange={(value) => handleSelectChange('requesting_department', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Birim seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept} value={dept}>
                                        {dept}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div><Label htmlFor="requesting_person_name">Talebi Yapan Kişi</Label><Input id="requesting_person_name" value={formData.requesting_person_name || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} /></div>

                    <div className="md:col-span-2"><Label htmlFor="description">Açıklama / Detaylar</Label><Textarea ref={textareaRef} id="description" value={formData.description || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} rows={3} className="resize-none overflow-hidden" /></div>
                
                    <DialogFooter className="col-span-1 md:col-span-2 mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet')}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineFormModal;