import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '@/components/ui/separator';
import { sanitizeFileName } from '@/lib/utils';

const STATUS_OPTIONS = ['Aktif', 'Zimmetli', 'Bakımda', 'Kullanım Dışı', 'Kalibrasyonda'];

const EquipmentFormModal = ({ isOpen, setIsOpen, refreshData, existingEquipment }) => {
    const { toast } = useToast();
    const isEditMode = !!existingEquipment;
    const [formData, setFormData] = useState({});
    const [personnelList, setPersonnelList] = useState([]);
    const [assignedPersonnelId, setAssignedPersonnelId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [addInitialCalibration, setAddInitialCalibration] = useState(false);
    const [calibrationData, setCalibrationData] = useState({});
    const [certificateFile, setCertificateFile] = useState(null);

    const onDrop = useCallback(acceptedFiles => {
        setCertificateFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    const resetForm = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);
        const nextCalDate = new Date();
        const frequency = 12;
        nextCalDate.setMonth(nextCalDate.getMonth() + parseInt(frequency, 10));

        setCalibrationData({
            calibration_date: today,
            next_calibration_date: nextCalDate.toISOString().slice(0, 10),
            certificate_number: '',
            notes: 'İlk kalibrasyon kaydı',
        });
        setCertificateFile(null);
    }, []);

    useEffect(() => {
        const fetchPersonnel = async () => {
            const { data, error } = await supabase.from('personnel').select('id, full_name, department').eq('is_active', true).order('full_name');
            if (error) {
                toast({ variant: "destructive", title: "Hata", description: "Personel listesi alınamadı." });
            } else {
                setPersonnelList(data);
            }
        };

        if (isOpen) {
            fetchPersonnel();
        }
    }, [isOpen, toast]);

    useEffect(() => {
        const initialEqData = {
            name: '', serial_number: '', brand_model: '',
            responsible_unit: '', location: '', description: '', status: 'Aktif',
            measurement_range: '', measurement_uncertainty: '', calibration_frequency_months: 12
        };

        if (isEditMode && existingEquipment) {
            setFormData({
                ...existingEquipment,
                measurement_uncertainty: existingEquipment.measurement_uncertainty?.replace('±', '').trim() || ''
            });
            setAddInitialCalibration(false);
            const activeAssignment = existingEquipment.equipment_assignments?.find(a => a.is_active);
            setAssignedPersonnelId(activeAssignment ? activeAssignment.assigned_personnel_id : null);
        } else {
            setFormData(initialEqData);
            setAssignedPersonnelId(null);
            setAddInitialCalibration(false);
            resetForm();
        }
    }, [existingEquipment, isOpen, isEditMode, resetForm]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        let parsedValue = value;
        
        // Kalibrasyon sıklığı için sayısal dönüşüm yap
        if (id === 'calibration_frequency_months') {
            // Eğer boşsa 12 kullan, aksi halde sayıya çevir
            parsedValue = value === '' ? 12 : parseInt(value, 10);
            // Geçersiz sayı ise 12 kullan
            if (isNaN(parsedValue) || parsedValue < 1) {
                parsedValue = 12;
            }
        }
        
        setFormData(prev => ({ ...prev, [id]: parsedValue }));

        // Kalibrasyon sıklığı değiştiğinde sonraki tarihi yeniden hesapla
        if (id === 'calibration_frequency_months' && calibrationData.calibration_date) {
            const nextDate = new Date(calibrationData.calibration_date);
            nextDate.setMonth(nextDate.getMonth() + parsedValue);
            setCalibrationData(prev => ({
                ...prev,
                next_calibration_date: nextDate.toISOString().slice(0, 10)
            }));
        }
    };
    
    const handleCalibrationInputChange = (e) => {
        const { id, value } = e.target;
        const newCalData = { ...calibrationData, [id]: value };

        if (id === 'calibration_date' && formData.calibration_frequency_months) {
            const nextDate = new Date(value);
            nextDate.setMonth(nextDate.getMonth() + parseInt(formData.calibration_frequency_months, 10));
            newCalData.next_calibration_date = nextDate.toISOString().slice(0, 10);
        }
        setCalibrationData(newCalData);
    };

    const handlePersonnelChange = (personnelId) => {
        setAssignedPersonnelId(personnelId);
        const selectedPersonnel = personnelList.find(p => p.id === personnelId);
        if (selectedPersonnel) {
            setFormData(prev => ({
                ...prev,
                responsible_unit: selectedPersonnel.department || prev.responsible_unit,
                location: 'Zimmetli'
            }));
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { equipment_calibrations, equipment_assignments, ...eqData } = formData;
            if (eqData.measurement_uncertainty) eqData.measurement_uncertainty = `± ${eqData.measurement_uncertainty}`;

            const { data: equipment, error: equipmentError } = isEditMode
                ? await supabase.from('equipments').update(eqData).eq('id', existingEquipment.id).select().single()
                : await supabase.from('equipments').insert(eqData).select().single();

            if (equipmentError) throw equipmentError;

            if (assignedPersonnelId) {
                await supabase.from('equipment_assignments').update({ is_active: false, return_date: new Date().toISOString() }).eq('equipment_id', equipment.id);
                const { error: assignError } = await supabase.from('equipment_assignments').insert({
                    equipment_id: equipment.id, assigned_personnel_id: assignedPersonnelId,
                    assignment_date: new Date().toISOString(), is_active: true
                });
                if (assignError) throw assignError;

                await supabase.from('equipments').update({ status: 'Zimmetli' }).eq('id', equipment.id);
            }

            if (!isEditMode && addInitialCalibration) {
                let certificate_path = null;
                if (certificateFile) {
                    const sanitizedName = sanitizeFileName(certificateFile.name);
                    certificate_path = `${equipment.id}/${uuidv4()}-${sanitizedName}`;
                    const { error: uploadError } = await supabase.storage.from('calibration_certificates').upload(certificate_path, certificateFile);
                    if (uploadError) throw new Error(`Sertifika yüklenemedi: ${uploadError.message}`);
                }
                const { error: calError } = await supabase.from('equipment_calibrations').insert({
                    equipment_id: equipment.id,
                    last_calibration_date: calibrationData.calibration_date,
                    calibration_date: calibrationData.calibration_date,
                    next_calibration_date: calibrationData.next_calibration_date,
                    certificate_number: calibrationData.certificate_number,
                    certificate_path: certificate_path,
                    notes: calibrationData.notes,
                });
                if(calError) throw calError;
            }
            
            toast({ title: 'Başarılı!', description: `Ekipman başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            refreshData();
            setIsOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Ekipmanı Düzenle' : 'Yeni Ekipman Ekle'}</DialogTitle>
                    <DialogDescription>Ekipman bilgilerini ve özelliklerini girin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="name">Ekipman Adı *</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange} required /></div>
                        <div className="space-y-1"><Label htmlFor="serial_number">Seri Numarası *</Label><Input id="serial_number" value={formData.serial_number || ''} onChange={handleInputChange} required /></div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="brand_model">Marka/Model</Label><Input id="brand_model" value={formData.brand_model || ''} onChange={handleInputChange} /></div>
                         <div className="space-y-1"><Label htmlFor="assigned_personnel_id">Zimmetli Personel</Label>
                            <Select onValueChange={handlePersonnelChange} value={assignedPersonnelId || ''}>
                                <SelectTrigger><SelectValue placeholder="Personel seçin..." /></SelectTrigger>
                                <SelectContent>{personnelList.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="measurement_range">Ölçüm Aralığı</Label><Input id="measurement_range" value={formData.measurement_range || ''} onChange={handleInputChange} /></div>
                         <div className="space-y-1">
                            <Label htmlFor="measurement_uncertainty">Ölçüm Belirsizliği</Label>
                            <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">±</span><Input id="measurement_uncertainty" className="pl-8" value={formData.measurement_uncertainty || ''} onChange={handleInputChange} /></div>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="responsible_unit">Sorumlu Birim *</Label><Input id="responsible_unit" value={formData.responsible_unit || ''} onChange={handleInputChange} disabled={!!assignedPersonnelId} required /></div>
                        <div className="space-y-1"><Label htmlFor="location">Kullanım Yeri</Label><Input id="location" value={formData.location || ''} onChange={handleInputChange} disabled={!!assignedPersonnelId} /></div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                           <Label htmlFor="calibration_frequency_months">Kalibrasyon Sıklığı (Ay) *</Label>
                           <Input id="calibration_frequency_months" type="number" min="1" value={Math.max(1, formData.calibration_frequency_months || 12)} onChange={handleInputChange} onInput={handleInputChange} required />
                       </div>
                        <div className="space-y-1"><Label htmlFor="status">Durum *</Label>
                            <Select onValueChange={(v) => setFormData(p => ({...p, status: v}))} value={formData.status || 'Aktif'} required>
                                <SelectTrigger><SelectValue placeholder="Durum seçin..." /></SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="description">Açıklama / Not</Label><Textarea id="description" value={formData.description || ''} onChange={handleInputChange} /></div>
                    
                    {!isEditMode && (
                        <>
                            <Separator className="my-4" />
                             <div className="flex items-center space-x-2">
                                <input type="checkbox" id="addInitialCalibration" checked={addInitialCalibration} onChange={(e) => setAddInitialCalibration(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                <Label htmlFor="addInitialCalibration" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    İlk Kalibrasyon Kaydı Ekle
                                </Label>
                            </div>
                            {addInitialCalibration && (
                                <div className="space-y-4 pt-2 border-l-2 border-primary pl-4">
                                     <div className="grid md:grid-cols-2 gap-4">
                                        <div><Label htmlFor="calibration_date">İlk Kalibrasyon Tarihi</Label><Input id="calibration_date" type="date" value={calibrationData.calibration_date || ''} onChange={handleCalibrationInputChange} /></div>
                                        <div><Label htmlFor="next_calibration_date">Sonraki Kalibrasyon Tarihi</Label><Input id="next_calibration_date" type="date" value={calibrationData.next_calibration_date || ''} disabled /></div>
                                    </div>
                                    <div><Label htmlFor="certificate_number">Sertifika Numarası</Label><Input id="certificate_number" value={calibrationData.certificate_number || ''} onChange={handleCalibrationInputChange} /></div>
                                     <div>
                                        <Label>Sertifika (PDF)</Label>
                                        <div {...getRootProps()} className={`mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors ${isDragActive ? 'border-primary' : 'hover:border-primary/50'}`}>
                                            <input {...getInputProps()} />
                                            <p className="text-muted-foreground">{certificateFile ? certificateFile.name : 'Dosya seçin veya sürükleyip bırakın'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </form>
                <DialogFooter>
                    <Button type="button" onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EquipmentFormModal;