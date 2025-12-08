import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X as XIcon, PlusCircle, Trash2, Calendar as CalendarIcon, FileText, Link2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEPARTMENTS } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn, sanitizeFileName } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SourceRecordSelector from './SourceRecordSelector';

const VEHICLE_TYPES = ["FTH-240", "Çelik-2000", "AGA2100", "AGA3000", "AGA6000", "Kompost Makinesi", "Çay Toplama Makinesi", "KDM 35", "KDM 70", "KDM 80", "Rusya Motor Odası", "Ural", "HSCK", "Traktör Kabin", "Diğer"];

const DeviationFormModal = ({ isOpen, setIsOpen, refreshData, existingDeviation }) => {
    const { toast } = useToast();
    const isEditMode = !!existingDeviation;
    const [formData, setFormData] = useState({});
    const [vehicles, setVehicles] = useState([{ customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [creationMode, setCreationMode] = useState('manual'); // 'manual' veya 'from_record'
    const [selectedSourceRecord, setSelectedSourceRecord] = useState(null);
    
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

                // Fetch suppliers (tüm aktif tedarikçiler)
                const { data: supplierData, error: supplierError } = await supabase
                    .from('suppliers')
                    .select('id, name')
                    .order('name');
                
                if (supplierError) throw supplierError;
                console.log('📦 Tedarikçiler yüklendi:', supplierData);
                setSuppliers(supplierData || []);

                // Yeni sapma için otomatik talep numarası oluştur
                if (!isEditMode) {
                    await generateRequestNumber();
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Ayarlar yüklenemedi.' });
            }
        };
        
        if (isOpen) {
            fetchSettingsData();
        }
    }, [isOpen, toast, isEditMode]);

    // ÖNEMLİ: Modal verilerini koru - sadece existingDeviation değiştiğinde yükle
    useEffect(() => {
        const initialData = {
            request_no: '',
            vehicle_type: '',
            part_code: '',
            description: '',
            source: '',
            requesting_unit: '',
            requesting_person: '',
            created_at: new Date(),
        };

        if (!isOpen) {
            // Modal kapalıyken hiçbir şey yapma - veriler korunmalı
            return;
        }

        if (isEditMode && existingDeviation) {
            // Düzenleme modu: Mevcut sapma verilerini yükle
            console.log('📝 Sapma düzenleme modu:', existingDeviation.id);
            const { deviation_vehicles, deviation_attachments, ...rest } = existingDeviation;
            setFormData({
                ...rest,
                created_at: rest.created_at ? new Date(rest.created_at) : new Date(),
            });
            if (deviation_vehicles && deviation_vehicles.length > 0) {
                setVehicles(deviation_vehicles.map(({ customer_name, chassis_no, vehicle_serial_no }) => ({ customer_name: customer_name || '', chassis_no: chassis_no || '', vehicle_serial_no: vehicle_serial_no || '' })));
                console.log('✅ Araç bilgileri yüklendi:', deviation_vehicles.length);
            } else {
                setVehicles([{ customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
            }
        } else if (isOpen) {
            // Yeni sapma modu: Sadece modal YENİ açıldığında sıfırla
            console.log('➕ Yeni sapma kaydı modu');
            setFormData(initialData);
            setVehicles([{ customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
        }
        setFiles([]);
    }, [existingDeviation, isOpen, isEditMode]);
    
    const handleVehicleChange = (index, field, value) => {
        const newVehicles = [...vehicles];
        newVehicles[index][field] = value;
        setVehicles(newVehicles);
    };

    const addVehicle = () => {
        setVehicles([...vehicles, { customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
    };

    const removeVehicle = (index) => {
        if (vehicles.length > 1) {
            const newVehicles = vehicles.filter((_, i) => i !== index);
            setVehicles(newVehicles);
        }
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({ ...prev, created_at: date }));
    };

    const generateRequestNumber = async () => {
        try {
            // Son sapma kaydının numarasını al
            const { data, error } = await supabase
                .from('deviations')
                .select('request_no')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            let newNumber = 1;
            if (data && data.length > 0 && data[0].request_no) {
                // Mevcut numaradan sonraki numarayı al
                const lastNo = data[0].request_no;
                const match = lastNo.match(/SAP-(\d+)/);
                if (match) {
                    newNumber = parseInt(match[1]) + 1;
                }
            }

            // Yeni talep numarasını oluştur (SAP-0001 formatında)
            const requestNo = `SAP-${String(newNumber).padStart(4, '0')}`;
            setFormData(prev => ({ ...prev, request_no: requestNo }));
        } catch (error) {
            console.error('Talep numarası oluşturulamadı:', error);
            // Hata durumunda rastgele numara
            const fallbackNo = `SAP-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
            setFormData(prev => ({ ...prev, request_no: fallbackNo }));
        }
    };

    const handleSourceRecordSelect = (autoFillData, record) => {
        if (!autoFillData) {
            // Temizleme
            setSelectedSourceRecord(null);
            setFormData(prev => ({
                ...prev,
                source_type: null,
                source_record_id: null,
                source_record_details: null
            }));
            return;
        }

        setSelectedSourceRecord(record);
        
        // Detaylı açıklama oluştur
        let detailedDescription = '';
        const details = autoFillData.source_record_details;
        
        if (record._source_type === 'incoming_inspection') {
            detailedDescription = `Girdi Kalite Kontrol Kaydı (${details.record_no || details.inspection_number || 'N/A'})\n\n`;
            detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
            if (details.part_name) {
                detailedDescription += `Parça Adı: ${details.part_name}\n`;
            }
            detailedDescription += `Red Edilen Miktar: ${details.quantity_rejected || details.quantity || 'N/A'} adet\n`;
            if (details.quantity_conditional) {
                detailedDescription += `Şartlı Kabul Miktarı: ${details.quantity_conditional} adet\n`;
            }
            detailedDescription += `Tedarikçi: ${details.supplier || 'Belirtilmemiş'}\n`;
            detailedDescription += `Karar: ${details.decision || 'N/A'}\n`;
            if (details.delivery_note_number) {
                detailedDescription += `Teslimat No: ${details.delivery_note_number}\n`;
            }
            if (details.defects && details.defects.length > 0) {
                detailedDescription += `\nHata Detayları:\n`;
                details.defects.forEach((defect, idx) => {
                    detailedDescription += `${idx + 1}. ${defect.defect_description} (Miktar: ${defect.quantity})\n`;
                });
            }
            if (details.description) {
                detailedDescription += `\nAçıklama: ${details.description}\n`;
            }
            if (details.notes) {
                detailedDescription += `Notlar: ${details.notes}\n`;
            }
            detailedDescription += `\nBu parça için sapma onayı talep edilmektedir.`;
        } else if (record._source_type === 'quarantine') {
            detailedDescription = `Karantina Kaydı (${details.lot_no || details.quarantine_number || 'N/A'})\n\n`;
            detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
            if (details.part_name) {
                detailedDescription += `Parça Adı: ${details.part_name}\n`;
            }
            detailedDescription += `Miktar: ${details.quantity || 'N/A'} adet\n`;
            if (details.source_department) {
                detailedDescription += `Kaynak Birim: ${details.source_department}\n`;
            }
            if (details.requesting_department) {
                detailedDescription += `Talep Eden Birim: ${details.requesting_department}\n`;
            }
            if (details.requesting_person_name) {
                detailedDescription += `Talep Eden Kişi: ${details.requesting_person_name}\n`;
            }
            if (details.description) {
                detailedDescription += `\nSebep/Açıklama: ${details.description}\n`;
            }
            if (details.decision) {
                detailedDescription += `Karar: ${details.decision}\n`;
            }
            detailedDescription += `\nKarantinadaki bu parça için sapma onayı talep edilmektedir.`;
        } else if (record._source_type === 'quality_cost') {
            detailedDescription = `Kalitesizlik Maliyeti Kaydı\n\n`;
            detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
            detailedDescription += `Maliyet Türü: ${details.cost_type || 'N/A'}\n`;
            detailedDescription += `Tutar: ₺${details.amount || '0,00'}\n`;
            detailedDescription += `Birim/Tedarikçi: ${details.unit || details.supplier || 'Belirtilmemiş'}\n`;
            detailedDescription += `\nBu maliyet kaydı için sapma onayı talep edilmektedir.`;
        }
        
        // Otomatik doldur
        setFormData(prev => ({
            ...prev,
            ...autoFillData,
            part_code: autoFillData.part_code || prev.part_code,
            description: detailedDescription,
        }));
    };

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.png', '.jpg', '.gif'],
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
        }
    });

    const removeFile = (fileToRemove) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const submissionData = { ...formData };
        if (!isEditMode) {
            submissionData.status = 'Açık';
        }
        
        delete submissionData.deviation_approvals;
        delete submissionData.deviation_attachments;
        delete submissionData.deviation_vehicles;
        delete submissionData.customer_name; 

        const { data: deviationData, error: deviationError } = isEditMode
            ? await supabase.from('deviations').update(submissionData).eq('id', existingDeviation.id).select().single()
            : await supabase.from('deviations').insert(submissionData).select().single();
        
        if (deviationError) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Sapma kaydı kaydedilemedi: ${deviationError.message}` });
            setIsSubmitting(false);
            return;
        }

        if (isEditMode) {
            await supabase.from('deviation_vehicles').delete().eq('deviation_id', deviationData.id);
        }

        const validVehicles = vehicles.filter(v => v.customer_name || v.chassis_no || v.vehicle_serial_no);
        if (validVehicles.length > 0) {
            const vehicleRecords = validVehicles.map(v => ({ ...v, deviation_id: deviationData.id }));
            const { error: vehicleError } = await supabase.from('deviation_vehicles').insert(vehicleRecords);
            if (vehicleError) {
                toast({ variant: 'destructive', title: 'Hata!', description: 'Araç bilgileri kaydedilemedi.' });
            }
        }

        if (files.length > 0) {
            const uploadPromises = files.map(file => {
                const sanitizedFileName = sanitizeFileName(file.name);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 9);
                const filePath = `${deviationData.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                return supabase.storage.from('deviation_attachments').upload(filePath, file, { 
                    contentType: file.type || 'application/octet-stream',
                    cacheControl: '3600',
                    upsert: false
                });
            });
            const uploadResults = await Promise.all(uploadPromises);

            const attachmentRecords = uploadResults.map((result, index) => {
                if (result.error) return null;
                return {
                    deviation_id: deviationData.id,
                    file_path: result.data.path,
                    file_name: files[index].name,
                    file_type: files[index].type
                };
            }).filter(Boolean);

            if(attachmentRecords.length > 0) {
                const { error: attachmentsError } = await supabase.from('deviation_attachments').insert(attachmentRecords);
                if (attachmentsError) {
                     toast({ variant: 'destructive', title: 'Dosya Hatası', description: 'Dosya bilgileri veritabanına kaydedilemedi.' });
                }
            }
        }
        
        toast({ title: 'Başarılı!', description: `Sapma kaydı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
        refreshData();
        setIsOpen(false);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Sapma Kaydını Düzenle' : 'Yeni Sapma Kaydı Oluştur'}</DialogTitle>
                    <DialogDescription>
                        Lütfen sapma ile ilgili tüm bilgileri eksiksiz girin.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    {/* Oluşturma Modu Seçimi - Sadece yeni kayıt için */}
                    {!isEditMode && (
                        <Tabs value={creationMode} onValueChange={setCreationMode} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="manual" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Manuel Oluştur
                                </TabsTrigger>
                                <TabsTrigger value="from_record" className="flex items-center gap-2">
                                    <Link2 className="h-4 w-4" />
                                    Mevcut Kayıttan
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="from_record" className="mt-4">
                                <SourceRecordSelector
                                    onSelect={handleSourceRecordSelect}
                                    initialSourceType={formData.source_type}
                                    initialSourceId={formData.source_record_id}
                                />
                            </TabsContent>
                        </Tabs>
                    )}

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="request_no">Talep Numarası <span className="text-red-500">*</span></Label>
                            <Input id="request_no" value={formData.request_no || ''} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="requesting_unit">Talep Eden Birim</Label>
                            <Select onValueChange={(value) => handleSelectChange('requesting_unit', value)} value={formData.requesting_unit || ''}>
                                <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="requesting_person">Talep Eden Personel</Label>
                            <Select onValueChange={(value) => handleSelectChange('requesting_person', value)} value={formData.requesting_person || ''}>
                                <SelectTrigger><SelectValue placeholder="Personel seçin..." /></SelectTrigger>
                                <SelectContent>{personnel.map(p => <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="vehicle_type">Araç Tipi</Label>
                            <Select onValueChange={(value) => handleSelectChange('vehicle_type', value)} value={formData.vehicle_type || ''}>
                                <SelectTrigger><SelectValue placeholder="Araç tipi seçin..." /></SelectTrigger>
                                <SelectContent>{VEHICLE_TYPES.map(vt => <SelectItem key={vt} value={vt}>{vt}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="part_code">Sapma İstenilen Parça Kodu</Label>
                            <Input id="part_code" value={formData.part_code || ''} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="created_at">Kayıt Tarihi</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !formData.created_at && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.created_at ? format(formData.created_at, "d MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={formData.created_at} onSelect={handleDateChange} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label>Etkilenen Araçlar</Label>
                        {vehicles.map((vehicle, index) => (
                             <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                                <div>
                                    {index === 0 && <Label htmlFor={`customer_name_${index}`}>Müşteri Adı</Label>}
                                    <Input id={`customer_name_${index}`} value={vehicle.customer_name} onChange={(e) => handleVehicleChange(index, 'customer_name', e.target.value)} placeholder="Müşteri Adı (Opsiyonel)" />
                                </div>
                                <div>
                                    {index === 0 && <Label htmlFor={`chassis_no_${index}`}>Şasi Numarası</Label>}
                                    <Input id={`chassis_no_${index}`} value={vehicle.chassis_no} onChange={(e) => handleVehicleChange(index, 'chassis_no', e.target.value)} placeholder="Şasi No" />
                                </div>
                                <div>
                                    {index === 0 && <Label htmlFor={`vehicle_serial_no_${index}`}>Araç Seri Numarası</Label>}
                                    <Input id={`vehicle_serial_no_${index}`} value={vehicle.vehicle_serial_no} onChange={(e) => handleVehicleChange(index, 'vehicle_serial_no', e.target.value)} placeholder="Seri No" />
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeVehicle(index)} disabled={vehicles.length === 1}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                             </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addVehicle} className="mt-2">
                            <PlusCircle className="h-4 w-4 mr-2" /> Araç Ekle
                        </Button>
                    </div>

                     <div className="space-y-2">
                        <Label htmlFor="description">Sapma Talebi Açıklaması <span className="text-red-500">*</span></Label>
                        <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} required rows={5} />
                    </div>
                    
                     <div className="space-y-2">
                        <Label htmlFor="source">Sapma Kaynağı <span className="text-red-500">*</span></Label>
                         <Select onValueChange={(value) => handleSelectChange('source', value)} value={formData.source || ''} required>
                            <SelectTrigger><SelectValue placeholder="Sapma kaynağını seçin..." /></SelectTrigger>
                            <SelectContent>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Birimler</div>
                                {departments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                {suppliers.length > 0 && <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Tedarikçiler</div>}
                                {suppliers.map(s => <SelectItem key={s.id} value={`TEDARİKÇİ: ${s.name}`}>🏭 {s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Belge Ekle</Label>
                        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Onaylı sapma formu veya destekleyici dokümanları buraya sürükleyin ya da seçmek için tıklayın.</p>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-2 space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="w-4 h-4" />
                                            <span className="text-sm">{file.name}</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file)}>
                                            <XIcon className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </form>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeviationFormModal;