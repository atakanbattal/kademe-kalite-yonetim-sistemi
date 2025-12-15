import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { UploadCloud, XCircle, Loader2 } from 'lucide-react';

const CalibrationModal = ({ isOpen, setIsOpen, equipment, refreshData, existingCalibration }) => {
    const { toast } = useToast();
    const isEditMode = !!existingCalibration;
    
    const getInitialFormData = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);
        const nextCalDate = new Date();
        const frequency = equipment?.calibration_frequency_months || 12;
        nextCalDate.setMonth(nextCalDate.getMonth() + frequency);

        return {
            calibration_date: today,
            next_calibration_date: nextCalDate.toISOString().slice(0, 10),
            certificate_number: '',
            notes: '',
            certificate_path: null,
        };
    }, [equipment]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && existingCalibration) {
                setFormData({
                    ...existingCalibration,
                    calibration_date: existingCalibration.calibration_date ? new Date(existingCalibration.calibration_date).toISOString().slice(0, 10) : '',
                    next_calibration_date: existingCalibration.next_calibration_date ? new Date(existingCalibration.next_calibration_date).toISOString().slice(0, 10) : '',
                });
            } else {
                setFormData(getInitialFormData());
            }
            setFile(null);
        }
    }, [existingCalibration, isOpen, isEditMode, getInitialFormData]);

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        multiple: false,
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        const newFormData = { ...formData, [id]: value };

        if (id === "calibration_date" && equipment?.calibration_frequency_months) {
            const nextDate = new Date(value);
            if (!isNaN(nextDate)) {
                nextDate.setMonth(nextDate.getMonth() + parseInt(equipment.calibration_frequency_months, 10));
                newFormData.next_calibration_date = nextDate.toISOString().slice(0, 10);
            }
        }
        setFormData(newFormData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!equipment || !equipment.id) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Ekipman bilgisi eksik, işlem yapılamıyor.' });
            return;
        }
        setIsSubmitting(true);

        try {
            let finalCertificatePath = formData.certificate_path;

            if (file) {
                if (isEditMode && formData.certificate_path) {
                    const { error: deleteError } = await supabase.storage.from('calibration_certificates').remove([formData.certificate_path]);
                    if (deleteError && deleteError.message !== 'The resource was not found') {
                         console.warn("Eski sertifika silinemedi, ancak işleme devam ediliyor:", deleteError.message);
                    }
                }
                const sanitizedName = sanitizeFileName(file.name);
                // Equipment ID ile klasör yapısı kullan (EquipmentFormModal ile tutarlılık için)
                const newPath = `${equipment.id}/${uuidv4()}-${sanitizedName}`;
                const { error: uploadError } = await supabase.storage.from('calibration_certificates').upload(newPath, file);
                if (uploadError) {
                    throw new Error(`Sertifika yüklenemedi: ${uploadError.message}`);
                }
                finalCertificatePath = newPath;
            }
            
            // Geçerli equipment_calibrations tablosu kolonlarını tanımla
            const validColumns = [
                'equipment_id', 'calibration_date', 'next_calibration_date', 
                'certificate_path', 'notes', 'last_calibration_date', 
                'certificate_number', 'is_active'
            ];
            
            // Sadece geçerli kolonları ve undefined olmayan değerleri tut
            const dataToSubmit = {
                equipment_id: equipment.id,
                certificate_path: finalCertificatePath,
                last_calibration_date: formData.calibration_date,
            };
            
            validColumns.forEach(col => {
                if (col !== 'equipment_id' && col !== 'certificate_path' && col !== 'last_calibration_date') {
                    if (formData.hasOwnProperty(col) && formData[col] !== undefined) {
                        dataToSubmit[col] = formData[col];
                    }
                }
            });

            const { error } = isEditMode
                ? await supabase.from('equipment_calibrations').update(dataToSubmit).eq('id', existingCalibration.id)
                : await supabase.from('equipment_calibrations').insert(dataToSubmit);

            if (error) throw error;
            
            await supabase.from('equipments').update({ status: 'Aktif' }).eq('id', equipment.id);
            toast({ title: 'Başarılı', description: `Kalibrasyon kaydı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            refreshData();
            setIsOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const removeFile = (e) => {
        e.stopPropagation();
        setFile(null);
    }
    
    const getCurrentCertificateName = () => {
        if (!formData.certificate_path) return null;
        const parts = formData.certificate_path.split('-');
        if (parts.length > 1) {
            return parts.slice(1).join('-');
        }
        return formData.certificate_path;
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Kalibrasyon Kaydını Düzenle' : 'Yeni Kalibrasyon Kaydı'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="md:col-span-2">
                        <Label>Ekipman</Label>
                        <Input value={`${equipment?.name} (S/N: ${equipment?.serial_number})`} disabled />
                    </div>
                    <div>
                        <Label htmlFor="calibration_date">Kalibrasyon Tarihi</Label>
                        <Input id="calibration_date" type="date" value={formData.calibration_date || ''} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="next_calibration_date">Sonraki Kalibrasyon Tarihi</Label>
                        <Input id="next_calibration_date" type="date" value={formData.next_calibration_date || ''} onChange={handleInputChange} required disabled />
                    </div>
                    <div>
                        <Label htmlFor="certificate_number">Sertifika Numarası</Label>
                        <Input id="certificate_number" value={formData.certificate_number || ''} onChange={handleInputChange} />
                    </div>
                     <div className="md:col-span-2">
                        <Label htmlFor="notes">Notlar</Label>
                        <Textarea id="notes" value={formData.notes || ''} onChange={handleInputChange} />
                    </div>
                     <div className="md:col-span-2">
                        <Label>Sertifika (PDF)</Label>
                        <div {...getRootProps()} className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}>
                            <input {...getInputProps()} />
                            {file ? (
                                <div className="text-center">
                                    <p className="text-primary font-semibold">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(2)} KB)</p>
                                    <Button variant="ghost" size="sm" className="mt-2 text-destructive hover:text-destructive/80" onClick={removeFile}>
                                        <XCircle className="w-4 h-4 mr-2" /> Dosyayı Kaldır
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <p className="mt-4 text-muted-foreground">Dosya seçin veya sürükleyip bırakın</p>
                                    <p className="text-xs text-muted-foreground/80">Sadece PDF, en fazla 5MB</p>
                                </div>
                            )}
                        </div>
                        {!file && isEditMode && formData.certificate_path && (
                            <p className="text-sm mt-2 text-muted-foreground">Mevcut sertifika: {getCurrentCertificateName()}</p>
                        )}
                    </div>
                    <DialogFooter className="md:col-span-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kaydediliyor...</> : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CalibrationModal;