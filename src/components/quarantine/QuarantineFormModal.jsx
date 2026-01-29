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
    const [personnel, setPersonnel] = useState([]);
    const textareaRef = useRef(null);

    useEffect(() => {
        const fetchSettingsData = async () => {
            try {
                // Fetch departments from cost_settings
                const { data: deptData, error: deptError } = await supabase
                    .from('cost_settings')
                    .select('unit_name')
                    .order('unit_name');
                
                if (deptError) throw deptError;
                setDepartments(deptData.map(d => d.unit_name));
                
                // Fetch active personnel
                const { data: personnelData, error: personnelError } = await supabase
                    .from('personnel')
                    .select('id, full_name')
                    .eq('is_active', true)
                    .order('full_name');
                
                if (personnelError) throw personnelError;
                setPersonnel(personnelData || []);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Ayarlar yüklenemedi.' });
            }
        };
        
        if(isOpen) {
            fetchSettingsData();
        }
    }, [isOpen, toast]);

    // Modal açıldığında ve mode/existingRecord değiştiğinde form verilerini güncelle
    useEffect(() => {
        if (!isOpen) {
            // Modal kapalıyken form'u sıfırla
            setFormData({
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
            });
            return;
        }
        
        // Modal açıkken
        if (mode === 'edit' && existingRecord) {
            // Düzenleme modunda mevcut kayıt verilerini yükle
            console.log('📝 Karantina düzenleme modu - Mevcut kayıt:', existingRecord);
            setFormData({
                lot_no: existingRecord.lot_no || '',
                part_code: existingRecord.part_code || '',
                part_name: existingRecord.part_name || '',
                quantity: existingRecord.quantity || '',
                unit: existingRecord.unit || 'Adet',
                source_department: existingRecord.source_department || '',
                requesting_department: existingRecord.requesting_department || '',
                requesting_person_name: existingRecord.requesting_person_name || '',
                description: existingRecord.description || '',
                quarantine_date: existingRecord.quarantine_date 
                    ? new Date(existingRecord.quarantine_date).toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10),
                status: existingRecord.status || 'Karantinada'
            });
        } else {
            // Yeni kayıt modunda başlangıç değerleri
            console.log('📝 Karantina yeni kayıt modu');
            setFormData({
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
            });
        }
    }, [isOpen, mode, existingRecord?.id]); // existingRecord.id kullanarak referans sorunlarını önle

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
        
        // Düzenleme modunda quantity değişikliğini kontrol et
        const newQuantity = parseInt(rest.quantity, 10);
        console.log('📝 Karantina güncelleme - Form quantity:', rest.quantity, '→ parseInt:', newQuantity);
        console.log('📝 Karantina güncelleme - Mevcut kayıt:', existingRecord);
        console.log('📝 Karantina güncelleme - isEditMode:', isEditMode, 'mode:', mode);
        
        const submissionData = {
          ...rest,
          quantity: newQuantity,
          // Düzenleme modunda initial_quantity'yi koruyalım
          // Yeni kayıt için initial_quantity = quantity
          ...(isEditMode ? {} : { initial_quantity: newQuantity }),
        };

        // Remove api view only fields before submitting to the actual table
        delete submissionData.id;
        delete submissionData.created_at;
        delete submissionData.updated_at;
        // initial_quantity düzenleme modunda güncellenmemeli
        if (isEditMode) {
            delete submissionData.initial_quantity;
        }

        // Undefined key'leri ve geçersiz kolonları temizle
        const cleanedData = {};
        for (const key in submissionData) {
            if (submissionData[key] !== undefined && key !== 'undefined') {
                cleanedData[key] = submissionData[key];
            }
        }

        console.log('📝 Karantina güncelleme - cleanedData:', cleanedData);

        let error;
        let result;

        if (isEditMode) {
            console.log('📝 Karantina UPDATE çalışıyor, ID:', existingRecord.id);
            const { data, error: updateError } = await supabase
                .from('quarantine_records')
                .update(cleanedData)
                .eq('id', existingRecord.id)
                .select();
            error = updateError;
            result = data;
            console.log('📝 Karantina UPDATE sonucu:', { data, error: updateError });
        } else {
            const { data, error: insertError } = await supabase
                .from('quarantine_records')
                .insert([cleanedData])
                .select();
            error = insertError;
            result = data;
            console.log('📝 Karantina INSERT sonucu:', { data, error: insertError });
        }

        if (error) {
            console.error('❌ Karantina kayıt hatası:', error);
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}` });
        } else {
            console.log('✅ Karantina kaydı başarılı:', result);
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

                    <div>
                        <Label>Talebi Yapan Kişi</Label>
                        <Select
                            value={formData.requesting_person_name || ''}
                            onValueChange={(value) => handleSelectChange('requesting_person_name', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Kişi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {personnel.map((person) => (
                                    <SelectItem key={person.id} value={person.full_name}>
                                        {person.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

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