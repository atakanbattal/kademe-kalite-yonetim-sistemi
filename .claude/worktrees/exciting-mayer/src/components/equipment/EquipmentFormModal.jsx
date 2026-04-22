import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { sanitizeFileName, normalizeToTitleCase } from '@/lib/utils';
import { Wrench } from 'lucide-react';

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

    // Personel listesi yüklendikten sonra assignedPersonnelId'yi set et (ÖNEMLİ: Bu, assignedPersonnelId'nin doğru şekilde set edilmesini garanti eder)
    useEffect(() => {
        if (personnelList.length > 0 && isOpen && isEditMode && existingEquipment) {
            // Aktif zimmet kaydını bul
            const activeAssignment = existingEquipment.equipment_assignments?.find(a => a.is_active !== false);
            if (activeAssignment?.assigned_personnel_id) {
                const personnelId = String(activeAssignment.assigned_personnel_id);
                // Personel listesinde bu ID var mı kontrol et
                const foundPersonnel = personnelList.find(p => String(p.id) === personnelId);
                if (foundPersonnel) {
                    // Her zaman güncelle (personnelList yüklendikten sonra)
                    setAssignedPersonnelId(personnelId);
                    console.log('✅ Personel listesi yüklendikten sonra assignedPersonnelId set edildi:', foundPersonnel.full_name, 'ID:', personnelId);
                } else {
                    console.log('⚠️ Personel listesinde assignedPersonnelId bulunamadı:', personnelId);
                    console.log('📋 Mevcut personel listesi:', personnelList.map(p => ({ id: p.id, name: p.full_name })));
                    setAssignedPersonnelId(null);
                }
            } else {
                // Aktif zimmet yoksa null set et
                setAssignedPersonnelId(null);
            }
        } else if (isOpen && !isEditMode) {
            // Yeni ekipman modunda null set et
            setAssignedPersonnelId(null);
        }
    }, [personnelList, isOpen, isEditMode, existingEquipment]);

    // ÖNEMLİ: Modal verilerini koru - sadece existingEquipment değiştiğinde yükle
    useEffect(() => {
        const initialEqData = {
            name: '', serial_number: '', brand_model: '',
            responsible_unit: '', location: '', description: '', status: 'Aktif',
            measurement_range: '', measurement_uncertainty: '', calibration_frequency_months: 12
        };

        if (!isOpen) {
            // Modal kapalıyken hiçbir şey yapma - veriler korunmalı
            return;
        }

        if (isEditMode && existingEquipment) {
            // Düzenleme modu: Mevcut ekipman verilerini yükle
            console.log('📝 Ekipman düzenleme modu:', existingEquipment.id);
            console.log('🔍 Equipment assignments:', existingEquipment.equipment_assignments);
            // equipment_calibrations ve equipment_assignments'ı hariç tut - bunlar veritabanı kolonları değil
            const { equipment_calibrations, equipment_assignments, ...cleanEquipmentData } = existingEquipment;
            setFormData({
                ...cleanEquipmentData,
                measurement_uncertainty: existingEquipment.measurement_uncertainty?.replace('±', '').trim() || ''
            });
            setAddInitialCalibration(false);
            
            // NOT: assignedPersonnelId'yi burada set etmiyoruz - personnelList yüklendikten sonra set edilecek
            // Bu, Select component'inin doğru değeri göstermesini garanti eder
            console.log('✅ Ekipman verileri yüklendi (assignedPersonnelId personnelList yüklendikten sonra set edilecek)');
        } else if (isOpen) {
            // Yeni ekipman modu: Sadece modal YENİ açıldığında sıfırla
            console.log('➕ Yeni ekipman modu');
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

        // Her zaman kalibrasyon tarihi ve sıklığı varsa sonraki tarihi hesapla
        if ((id === 'calibration_date' || id === 'next_calibration_date') && value) {
            // İlk kalibrasyon tarihi değiştiğinde veya form açıldığında hesapla
            if (id === 'calibration_date') {
                const nextDate = new Date(value);
                const frequency = parseInt(formData.calibration_frequency_months, 10) || 12;
                
                if (!isNaN(nextDate)) {
                    nextDate.setMonth(nextDate.getMonth() + frequency);
                    newCalData.next_calibration_date = nextDate.toISOString().slice(0, 10);
                }
            }
        }
        setCalibrationData(newCalData);
    };

    // Kalibrasyon sıklığı veya tarihi değiştiğinde sonraki tarihi hesapla
    useEffect(() => {
        if (calibrationData.calibration_date && formData.calibration_frequency_months) {
            const nextDate = new Date(calibrationData.calibration_date);
            const frequency = parseInt(formData.calibration_frequency_months, 10) || 12;
            
            if (!isNaN(nextDate)) {
                nextDate.setMonth(nextDate.getMonth() + frequency);
                setCalibrationData(prev => ({
                    ...prev,
                    next_calibration_date: nextDate.toISOString().slice(0, 10)
                }));
            }
        }
    }, [calibrationData.calibration_date, formData.calibration_frequency_months]);

    const handlePersonnelChange = (personnelId) => {
        // String UUID'yi sakla
        const id = personnelId ? String(personnelId) : null;
        setAssignedPersonnelId(id);
        const selectedPersonnel = personnelList.find(p => String(p.id) === String(personnelId));
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
            
            // Geçerli equipments tablosu kolonlarını tanımla
            const validColumns = [
                'name', 'serial_number', 'brand_model', 'responsible_unit', 'location', 
                'description', 'status', 'measurement_range', 'measurement_uncertainty', 
                'calibration_frequency_months', 'category', 'parent_equipment_id', 
                'criticality', 'image_url', 'documents', 'scrap_date', 'scrap_reason', 
                'scrap_document_path'
            ];
            
            // Sadece geçerli kolonları ve undefined olmayan değerleri tut
            const cleanData = {};
            validColumns.forEach(col => {
                if (eqData.hasOwnProperty(col) && eqData[col] !== undefined) {
                    cleanData[col] = eqData[col];
                }
            });
            
            // measurement_uncertainty formatla
            if (cleanData.measurement_uncertainty) {
                cleanData.measurement_uncertainty = `± ${cleanData.measurement_uncertainty}`;
            }
            
            // responsible_unit ve brand_model'i normalize et
            if (cleanData.responsible_unit) {
                cleanData.responsible_unit = normalizeToTitleCase(cleanData.responsible_unit);
            }
            if (cleanData.brand_model) {
                cleanData.brand_model = normalizeToTitleCase(cleanData.brand_model);
            }

            const { data: equipment, error: equipmentError } = isEditMode
                ? await supabase.from('equipments').update(cleanData).eq('id', existingEquipment.id).select().single()
                : await supabase.from('equipments').insert(cleanData).select().single();

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

    const assignedPersonName = personnelList.find(p => String(p.id) === String(assignedPersonnelId))?.full_name || '-';
    const rightPanel = (
        <div className="p-5 space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><Wrench className="w-20 h-20" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Ekipman</p>
                </div>
                <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{formData.name || '-'}</p>
                {formData.serial_number && <p className="text-xs text-muted-foreground mt-1 font-mono">{formData.serial_number}</p>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{formData.status || '-'}</Badge>
            </div>

            <Separator className="my-1" />

            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ekipman Bilgileri</p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Marka/Model', value: formData.brand_model },
                        { label: 'Ölçüm Aralığı', value: formData.measurement_range },
                        { label: 'Ölçüm Belirsizliği', value: formData.measurement_uncertainty ? `±${formData.measurement_uncertainty}` : null },
                        { label: 'Kullanım Yeri', value: formData.location },
                    ].map(({ label, value }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-semibold truncate text-foreground">
                                {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="my-1" />

            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Sorumluluk</p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Sorumlu Birim', value: formData.responsible_unit },
                        { label: 'Zimmetli Personel', value: assignedPersonName },
                    ].map(({ label, value }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-semibold truncate text-foreground">
                                {value && value !== '-' ? value : <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="my-1" />

            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Kalibrasyon</p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Kalibrasyon Periyodu', value: formData.calibration_frequency_months ? `${formData.calibration_frequency_months} ay` : null },
                        { label: 'Son Kalibrasyon', value: formData.last_calibration_date ? new Date(formData.last_calibration_date).toLocaleDateString('tr-TR') : null },
                        { label: 'Sonraki Kalibrasyon', value: formData.next_calibration_date ? new Date(formData.next_calibration_date).toLocaleDateString('tr-TR') : null },
                        { label: 'Sertifika No', value: formData.calibration_certificate_no },
                    ].map(({ label, value }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-semibold truncate text-foreground">
                                {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title={isEditMode ? 'Ekipmanı Düzenle' : 'Yeni Ekipman Ekle'}
            subtitle="Ekipman Yönetimi"
            icon={<Wrench className="h-5 w-5 text-white" />}
            badge={isEditMode ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setIsOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel={isEditMode ? 'Güncelle' : 'Kaydet'}
            cancelLabel="İptal"
            formId="equipment-form"
            rightPanel={rightPanel}
        >
                <form id="equipment-form" onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="name">Ekipman Adı *</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange} required /></div>
                        <div className="space-y-1"><Label htmlFor="serial_number">Seri Numarası *</Label><Input id="serial_number" value={formData.serial_number || ''} onChange={handleInputChange} required /></div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="brand_model">Marka/Model</Label><Input id="brand_model" value={formData.brand_model || ''} onChange={handleInputChange} /></div>
                         <div className="space-y-1"><Label htmlFor="assigned_personnel_id">Zimmetli Personel</Label>
                            {(() => {
                                const selectValue = assignedPersonnelId ? String(assignedPersonnelId) : undefined;
                                return (
                                    <Select 
                                        onValueChange={handlePersonnelChange} 
                                        value={selectValue}
                                        key={`personnel-select-${isOpen}-${assignedPersonnelId || 'empty'}`}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Personel seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personnelList.length > 0 ? (
                                                personnelList.map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.full_name}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Personel listesi yükleniyor...</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                );
                            })()}
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
        </ModernModalLayout>
    );
};

export default EquipmentFormModal;