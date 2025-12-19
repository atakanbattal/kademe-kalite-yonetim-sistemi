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
import { useData } from '@/contexts/DataContext';

const DeviationFormModal = ({ isOpen, setIsOpen, refreshData, existingDeviation }) => {
    const { toast } = useToast();
    const { products, productCategories } = useData();
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
    const [deviationType, setDeviationType] = useState('Girdi Kontrolü'); // 'Girdi Kontrolü' veya 'Üretim'
    
    // Araç tiplerini products tablosundan çek
    const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    const vehicleTypes = (products || [])
        .filter(p => p.category_id === vehicleTypeCategory?.id && p.is_active)
        .map(p => p.product_name)
        .sort();
    
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
                    await generateRequestNumber(deviationType);
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Ayarlar yüklenemedi.' });
            }
        };
        
        if (isOpen) {
            fetchSettingsData();
        }
    }, [isOpen, toast, isEditMode]);

    // ÖNEMLİ: Modal açıldığında verileri yükle
    useEffect(() => {
        if (!isOpen) {
            // Modal kapalıyken hiçbir şey yapma
            return;
        }

        // Düzenleme modu: Mevcut sapma verilerini yükle
        if (existingDeviation && existingDeviation.id) {
            console.log('📝 Sapma düzenleme modu - Veriler yükleniyor:', existingDeviation);
            const { deviation_vehicles, deviation_attachments, deviation_approvals, ...rest } = existingDeviation;
            
            // Tüm form verilerini set et - TÜM alanları dahil et
            const formDataToSet = {
                ...rest, // Önce tüm alanları kopyala
                // Sonra önemli alanları açıkça set et (eğer undefined/null ise boş string)
                request_no: rest.request_no || '',
                vehicle_type: rest.vehicle_type || '',
                part_code: rest.part_code || '',
                description: rest.description || '',
                source: rest.source || '',
                requesting_unit: rest.requesting_unit || '',
                requesting_person: rest.requesting_person || '',
                deviation_type: rest.deviation_type || 'Girdi Kontrolü',
                created_at: rest.created_at ? new Date(rest.created_at) : new Date(),
            };
            
            console.log('📋 Form verileri set ediliyor:', formDataToSet);
            console.log('🔍 Önemli alanlar:', {
                source: formDataToSet.source,
                requesting_unit: formDataToSet.requesting_unit,
                requesting_person: formDataToSet.requesting_person,
                'source type': typeof formDataToSet.source,
                'requesting_unit type': typeof formDataToSet.requesting_unit,
                'requesting_person type': typeof formDataToSet.requesting_person,
            });
            
            // FormData'yı set et - departments ve personnel yüklendikten sonra da güncelle
            setFormData(formDataToSet);
            setDeviationType(rest.deviation_type || 'Girdi Kontrolü');
            
            // Araç bilgilerini yükle
            if (deviation_vehicles && Array.isArray(deviation_vehicles) && deviation_vehicles.length > 0) {
                const vehiclesToSet = deviation_vehicles.map(({ customer_name, chassis_no, vehicle_serial_no }) => ({
                    customer_name: customer_name || '',
                    chassis_no: chassis_no || '',
                    vehicle_serial_no: vehicle_serial_no || ''
                }));
                setVehicles(vehiclesToSet);
                console.log('✅ Araç bilgileri yüklendi:', vehiclesToSet.length, vehiclesToSet);
            } else {
                setVehicles([{ customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
            }
            
            console.log('✅ Form verileri yüklendi:', {
                requesting_person: formDataToSet.requesting_person,
                requesting_unit: formDataToSet.requesting_unit,
                source: formDataToSet.source,
                vehicle_type: formDataToSet.vehicle_type,
                part_code: formDataToSet.part_code,
            });
        } else {
            // Yeni sapma modu: Sadece modal YENİ açıldığında sıfırla
            console.log('➕ Yeni sapma kaydı modu');
            const initialData = {
                request_no: '',
                vehicle_type: '',
                part_code: '',
                description: '',
                source: '',
                requesting_unit: '',
                requesting_person: '',
                deviation_type: 'Girdi Kontrolü',
                created_at: new Date(),
            };
            setFormData(initialData);
            setDeviationType('Girdi Kontrolü');
            setVehicles([{ customer_name: '', chassis_no: '', vehicle_serial_no: '' }]);
        }
        setFiles([]);
    }, [isOpen, existingDeviation]); // existingDeviation objesi değiştiğinde çalış

    // Departments ve personnel yüklendikten sonra formData'yı güncelle (Select component'leri için)
    useEffect(() => {
        if (isEditMode && existingDeviation && existingDeviation.id && departments.length > 0 && personnel.length > 0) {
            // FormData'yı tekrar set et - Select component'lerinin doğru şekilde render olması için
            setFormData(prev => {
                // Eğer formData zaten doğru değerlere sahipse, tekrar set etme
                if (prev.requesting_unit === existingDeviation.requesting_unit && 
                    prev.requesting_person === existingDeviation.requesting_person && 
                    prev.source === existingDeviation.source) {
                    return prev;
                }
                // Değerler farklıysa güncelle
                return {
                    ...prev,
                    requesting_unit: existingDeviation.requesting_unit || prev.requesting_unit || '',
                    requesting_person: existingDeviation.requesting_person || prev.requesting_person || '',
                    source: existingDeviation.source || prev.source || '',
                };
            });
        }
    }, [departments.length, personnel.length, isEditMode, existingDeviation?.id]);
    
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

    const handleSelectChange = async (id, value) => {
        if (id === 'deviation_type') {
            setDeviationType(value);
            // Tip değiştiğinde numara yeniden oluştur (sadece yeni kayıt için)
            if (!isEditMode) {
                await generateRequestNumber(value);
            }
        }
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({ ...prev, created_at: date }));
    };

    const generateRequestNumber = async (type = 'Girdi Kontrolü') => {
        try {
            const currentYear = new Date().getFullYear();
            
            // Tüm sapma kayıtlarını al (tip filtresi olmadan - mevcut kayıtları da görmek için)
            const { data, error } = await supabase
                .from('deviations')
                .select('request_no, deviation_type, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            let newNumber = 1;
            let foundCurrentYearNumber = false;
            
            if (data && data.length > 0) {
                // Bu yıl ve bu tip için yeni format numaraları bul
                const currentYearNumbers = data.filter(d => {
                    if (!d.request_no) return false;
                    const yearMatch = d.request_no.match(/(\d{4})/);
                    if (!yearMatch) return false;
                    return parseInt(yearMatch[1]) === currentYear;
                });

                // Yeni format numaralarını kontrol et
                if (currentYearNumbers.length > 0) {
                    const sameTypeNumbers = currentYearNumbers.filter(d => {
                        // Tip kontrolü: numaraya göre tip belirle
                        const isProduction = d.request_no && d.request_no.includes('-U');
                        const isInputControl = d.request_no && d.request_no.match(/^\d{4}-\d+$/) && !d.request_no.includes('-U');
                        
                        if (type === 'Üretim') {
                            return isProduction || d.deviation_type === 'Üretim';
                        } else {
                            return isInputControl || (d.deviation_type === 'Girdi Kontrolü' && !isProduction);
                        }
                    });

                    if (sameTypeNumbers.length > 0) {
                        // En yüksek numarayı bul
                        let maxNumber = 0;
                        sameTypeNumbers.forEach(d => {
                            if (type === 'Üretim') {
                                const match = d.request_no.match(/\d{4}-U(\d+)/);
                                if (match) {
                                    const num = parseInt(match[1]);
                                    if (num > maxNumber) {
                                        maxNumber = num;
                                    }
                                }
                            } else {
                                const match = d.request_no.match(/\d{4}-(\d+)/);
                                if (match && !d.request_no.includes('-U')) {
                                    const num = parseInt(match[1]);
                                    if (num > maxNumber) {
                                        maxNumber = num;
                                    }
                                }
                            }
                        });
                        
                        if (maxNumber > 0) {
                            newNumber = maxNumber + 1;
                            foundCurrentYearNumber = true;
                        }
                    }
                }

                // Eğer bu yıl için numara bulunamadıysa, eski format numaralarını kontrol et
                if (!foundCurrentYearNumber) {
                    // Eski format: SAP-0001, SAP-0002 gibi
                    const oldFormatNumbers = data.filter(d => {
                        if (!d.request_no) return false;
                        return d.request_no.match(/^SAP-\d+/);
                    });

                    if (oldFormatNumbers.length > 0) {
                        // En yüksek eski numarayı bul
                        let maxOldNumber = 0;
                        oldFormatNumbers.forEach(d => {
                            const match = d.request_no.match(/SAP-(\d+)/);
                            if (match) {
                                const num = parseInt(match[1]);
                                if (num > maxOldNumber) {
                                    maxOldNumber = num;
                                }
                            }
                        });

                        // Eski numaralardan sonra devam et
                        // Eğer tip Üretim ise U001'den başla, değilse 001'den başla
                        // Ancak eski numaraların toplam sayısını da göz önünde bulundur
                        if (type === 'Üretim') {
                            // Üretim için ayrı sayaç başlat (eski kayıtlar genelde Girdi Kontrolü olabilir)
                            newNumber = 1;
                        } else {
                            // Girdi Kontrolü için eski numaralardan devam et
                            // Eski kayıtların bir kısmı Üretim olabilir, bu yüzden dikkatli ol
                            // En güvenli yol: eski numaraların sayısını al ve devam et
                            const oldFormatCount = oldFormatNumbers.length;
                            // Eğer bu yıl için hiç yeni format numarası yoksa, eski numaralardan devam et
                            if (currentYearNumbers.length === 0) {
                                newNumber = oldFormatCount + 1;
                            } else {
                                // Bu yıl için yeni format numaraları var, onlardan devam et
                                newNumber = 1;
                            }
                        }
                    }
                }
            }

            // Yeni talep numarasını oluştur
            let requestNo;
            if (type === 'Üretim') {
                requestNo = `${currentYear}-U${String(newNumber).padStart(3, '0')}`;
            } else {
                requestNo = `${currentYear}-${String(newNumber).padStart(3, '0')}`;
            }
            
            setFormData(prev => ({ ...prev, request_no: requestNo, deviation_type: type }));
        } catch (error) {
            console.error('Talep numarası oluşturulamadı:', error);
            const currentYear = new Date().getFullYear();
            const fallbackNo = type === 'Üretim' 
                ? `${currentYear}-U001`
                : `${currentYear}-001`;
            setFormData(prev => ({ ...prev, request_no: fallbackNo, deviation_type: type }));
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

        // Undefined key'leri ve geçersiz kolonları temizle
        const cleanedData = {};
        for (const key in submissionData) {
            if (submissionData[key] !== undefined && key !== 'undefined') {
                cleanedData[key] = submissionData[key];
            }
        }

        const { data: deviationData, error: deviationError } = isEditMode
            ? await supabase.from('deviations').update(cleanedData).eq('id', existingDeviation.id).select().single()
            : await supabase.from('deviations').insert(cleanedData).select().single();
        
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
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{isEditMode ? 'Sapma Kaydını Düzenle' : 'Yeni Sapma Kaydı Oluştur'}</DialogTitle>
                    <DialogDescription>
                        Lütfen sapma ile ilgili tüm bilgileri eksiksiz girin.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 grid gap-4 py-4 min-h-0">
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
                            
                            <TabsContent value="manual" className="mt-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="deviation_type">Sapma Tipi <span className="text-red-500">*</span></Label>
                                        <Select 
                                            onValueChange={(value) => handleSelectChange('deviation_type', value)} 
                                            value={formData.deviation_type || deviationType || 'Girdi Kontrolü'} 
                                            required
                                        >
                                            <SelectTrigger><SelectValue placeholder="Sapma tipini seçin..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Girdi Kontrolü">Girdi Kontrolü</SelectItem>
                                                <SelectItem value="Üretim">Üretim</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="request_no">Talep Numarası <span className="text-red-500">*</span></Label>
                                        <Input id="request_no" value={formData.request_no || ''} onChange={handleInputChange} required readOnly />
                                    </div>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="from_record" className="mt-4">
                                <div className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="deviation_type_from_record">Sapma Tipi <span className="text-red-500">*</span></Label>
                                            <Select 
                                                onValueChange={(value) => handleSelectChange('deviation_type', value)} 
                                                value={formData.deviation_type || deviationType || 'Girdi Kontrolü'} 
                                                required
                                            >
                                                <SelectTrigger><SelectValue placeholder="Sapma tipini seçin..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Girdi Kontrolü">Girdi Kontrolü</SelectItem>
                                                    <SelectItem value="Üretim">Üretim</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="request_no_from_record">Talep Numarası <span className="text-red-500">*</span></Label>
                                            <Input id="request_no_from_record" value={formData.request_no || ''} onChange={handleInputChange} required readOnly />
                                        </div>
                                    </div>
                                    <SourceRecordSelector
                                        onSelect={handleSourceRecordSelect}
                                        initialSourceType={formData.source_type}
                                        initialSourceId={formData.source_record_id}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}

                    {isEditMode && (
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="deviation_type">Sapma Tipi <span className="text-red-500">*</span></Label>
                                <Select 
                                    onValueChange={(value) => handleSelectChange('deviation_type', value)} 
                                    value={formData.deviation_type || deviationType || 'Girdi Kontrolü'} 
                                    required
                                    disabled={isEditMode}
                                >
                                    <SelectTrigger><SelectValue placeholder="Sapma tipini seçin..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Girdi Kontrolü">Girdi Kontrolü</SelectItem>
                                        <SelectItem value="Üretim">Üretim</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request_no">Talep Numarası <span className="text-red-500">*</span></Label>
                                <Input id="request_no" value={formData.request_no || ''} onChange={handleInputChange} required readOnly />
                            </div>
                        </div>
                    )}

                    {(isEditMode || creationMode === 'from_record') && (
                        <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="requesting_unit">Talep Eden Birim</Label>
                            <Select 
                                onValueChange={(value) => handleSelectChange('requesting_unit', value)} 
                                value={formData.requesting_unit || ''}
                                key={`requesting_unit-${formData.requesting_unit || 'empty'}-${departments.length}`}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Birim seçin..." />
                                </SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="requesting_person">Talep Eden Personel</Label>
                            <Select 
                                onValueChange={(value) => handleSelectChange('requesting_person', value)} 
                                value={formData.requesting_person || ''}
                                key={`requesting_person-${formData.requesting_person || 'empty'}-${personnel.length}`}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Personel seçin..." />
                                </SelectTrigger>
                                <SelectContent>{personnel.map(p => <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    )}

                    {!isEditMode && creationMode === 'manual' && (
                        <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="requesting_unit_manual">Talep Eden Birim</Label>
                            <Select onValueChange={(value) => handleSelectChange('requesting_unit', value)} value={formData.requesting_unit || ''}>
                                <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="requesting_person_manual">Talep Eden Personel</Label>
                            <Select onValueChange={(value) => handleSelectChange('requesting_person', value)} value={formData.requesting_person || ''}>
                                <SelectTrigger><SelectValue placeholder="Personel seçin..." /></SelectTrigger>
                                <SelectContent>{personnel.map(p => <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="vehicle_type">Araç Tipi</Label>
                            <Select onValueChange={(value) => handleSelectChange('vehicle_type', value)} value={formData.vehicle_type || ''}>
                                <SelectTrigger><SelectValue placeholder="Araç tipi seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {vehicleTypes.length > 0 ? (
                                        vehicleTypes.map(vt => <SelectItem key={vt} value={vt}>{vt}</SelectItem>)
                                    ) : (
                                        <SelectItem value="" disabled>Araç tipi bulunamadı</SelectItem>
                                    )}
                                </SelectContent>
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
                         <Select 
                            onValueChange={(value) => handleSelectChange('source', value)} 
                            value={formData.source || ''} 
                            required
                            key={`source-${formData.source || 'empty'}-${departments.length}-${suppliers.length}`}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Sapma kaynağını seçin..." />
                            </SelectTrigger>
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
                <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
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