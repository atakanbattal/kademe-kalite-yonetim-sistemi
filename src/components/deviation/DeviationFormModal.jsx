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
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);
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
            
            // Mevcut attachment'ları yükle
            if (deviation_attachments && Array.isArray(deviation_attachments) && deviation_attachments.length > 0) {
                setExistingAttachments(deviation_attachments);
                console.log('✅ Mevcut attachment\'lar yüklendi:', deviation_attachments.length, deviation_attachments);
            } else {
                setExistingAttachments([]);
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
            setExistingAttachments([]);
        }
        setFiles([]);
        setDeletedAttachmentIds([]);
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
        
        // Eğer defects ve results bilgisi yoksa, record'dan direkt çek
        let defectsToUse = details.defects || [];
        if ((!defectsToUse || defectsToUse.length === 0) && record.defects && Array.isArray(record.defects) && record.defects.length > 0) {
            defectsToUse = record.defects;
        }
        
        let resultsToUse = details.results || [];
        if ((!resultsToUse || resultsToUse.length === 0) && record.results && Array.isArray(record.results) && record.results.length > 0) {
            resultsToUse = record.results;
        }
        
        if (record._source_type === 'incoming_inspection') {
            detailedDescription = `Girdi Kalite Kontrol Kaydı (${details.record_no || details.inspection_number || '-'})\n\n`;
            detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
            if (details.part_name) {
                detailedDescription += `Parça Adı: ${details.part_name}\n`;
            }
            // Red edilen miktar - N/A yerine anlamlı değer göster
            const rejectedQty = details.quantity_rejected || details.quantity;
            if (rejectedQty && rejectedQty !== 0 && String(rejectedQty).toLowerCase() !== 'n/a') {
                detailedDescription += `Red Edilen Miktar: ${rejectedQty} adet\n`;
            }
            // Şartlı kabul miktarı
            if (details.quantity_conditional && details.quantity_conditional !== 0) {
                detailedDescription += `Şartlı Kabul Miktarı: ${details.quantity_conditional} adet\n`;
            }
            detailedDescription += `Tedarikçi: ${details.supplier || 'Belirtilmemiş'}\n`;
            detailedDescription += `Karar: ${details.decision || '-'}\n`;
            if (details.delivery_note_number) {
                detailedDescription += `Teslimat No: ${details.delivery_note_number}\n`;
            }
            
            // Ölçüm sonuçlarını detaylı göster (girdi kontrol formatı gibi)
            if (resultsToUse && Array.isArray(resultsToUse) && resultsToUse.length > 0) {
                detailedDescription += `\n`;
                
                // Sadece OK olmayanları al
                const failedResults = resultsToUse.filter(r => {
                    if (typeof r.result === 'boolean') {
                        return !r.result;
                    }
                    const resultStr = (r.result || '').toString().trim().toUpperCase();
                    return resultStr !== 'OK' && resultStr !== '';
                });
                
                if (failedResults.length > 0) {
                    detailedDescription += `UYGUNSUZ BULUNAN ÖLÇÜMLER:\n`;
                    failedResults.forEach((result, idx) => {
                        const nominal = result.nominal_value ?? null;
                        const min = result.min_value ?? null;
                        const max = result.max_value ?? null;
                        
                        let measuredValue = null;
                        if (result.actual_value !== null && result.actual_value !== undefined) {
                            const actualValueStr = String(result.actual_value).trim();
                            if (actualValueStr !== '' && actualValueStr !== 'null' && actualValueStr !== 'undefined') {
                                measuredValue = result.actual_value;
                            }
                        }
                        if (measuredValue === null && result.measured_value !== null && result.measured_value !== undefined) {
                            const measuredValueStr = String(result.measured_value).trim();
                            if (measuredValueStr !== '' && measuredValueStr !== 'null' && measuredValueStr !== 'undefined') {
                                measuredValue = result.measured_value;
                            }
                        }
                        
                        detailedDescription += `\n${idx + 1}. ${result.characteristic_name || result.feature || 'Özellik'}`;
                        if (result.measurement_number && result.total_measurements) {
                            detailedDescription += ` (Ölçüm ${result.measurement_number}/${result.total_measurements})`;
                        }
                        detailedDescription += `:\n`;
                        
                        if (nominal !== null || min !== null || max !== null) {
                            detailedDescription += `   Beklenen Değer (Nominal): ${nominal !== null ? nominal + ' mm' : '-'}\n`;
                            detailedDescription += `   Tolerans Aralığı: ${min !== null ? min : '-'} mm ~ ${max !== null ? max : '-'} mm\n`;
                        }
                        
                        if (measuredValue !== null && measuredValue !== '') {
                            detailedDescription += `   Gerçek Ölçülen Değer: ${measuredValue} mm\n`;
                            
                            const measuredNum = parseFloat(String(measuredValue).replace(',', '.'));
                            const isOutOfTolerance = (min !== null && measuredNum < parseFloat(min)) || 
                                                    (max !== null && measuredNum > parseFloat(max));
                            
                            if (isOutOfTolerance) {
                                detailedDescription += `   ⚠ HATALI DEĞER: Tolerans dışında!\n`;
                                
                                if (nominal !== null && !isNaN(measuredNum) && !isNaN(parseFloat(nominal))) {
                                    const nominalNum = parseFloat(nominal);
                                    const deviation = measuredNum - nominalNum;
                                    detailedDescription += `   → Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm\n`;
                                }
                                
                                if (min !== null && measuredNum < parseFloat(min)) {
                                    const underTolerance = parseFloat(min) - measuredNum;
                                    detailedDescription += `   → Alt Tolerans Aşımı: ${min} mm'den ${underTolerance.toFixed(3)} mm küçük (${((underTolerance / parseFloat(min)) * 100).toFixed(2)}%)\n`;
                                }
                                if (max !== null && measuredNum > parseFloat(max)) {
                                    const overTolerance = measuredNum - parseFloat(max);
                                    detailedDescription += `   → Üst Tolerans Aşımı: ${max} mm'den ${overTolerance.toFixed(3)} mm büyük (${((overTolerance / parseFloat(max)) * 100).toFixed(2)}%)\n`;
                                }
                            } else if (nominal !== null && !isNaN(measuredNum) && !isNaN(parseFloat(nominal))) {
                                const nominalNum = parseFloat(nominal);
                                const deviation = measuredNum - nominalNum;
                                if (Math.abs(deviation) > 0.001) {
                                    detailedDescription += `   → Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm (Tolerans içinde)\n`;
                                }
                            }
                        } else {
                            detailedDescription += `   Gerçek Ölçülen Değer: Ölçülmemiş\n`;
                        }
                        
                        const resultDisplay = typeof result.result === 'boolean' ? (result.result ? 'OK' : 'NOK') : result.result;
                        detailedDescription += `   Sonuç: ${resultDisplay}\n`;
                    });
                }
                
                // Ölçüm özeti
                const totalResults = resultsToUse.length;
                const okCount = resultsToUse.filter(r => r.result === 'OK' || r.result === 'Kabul').length;
                const nokCount = totalResults - okCount;
                
                detailedDescription += `\n\nÖLÇÜM ÖZETİ:\n`;
                detailedDescription += `Toplam Ölçüm Sayısı: ${totalResults}\n`;
                detailedDescription += `Uygun Ölçümler: ${okCount}\n`;
                detailedDescription += `Uygunsuz Ölçümler: ${nokCount}\n`;
                if (totalResults > 0) {
                    detailedDescription += `Ret Oranı: ${((nokCount / totalResults) * 100).toFixed(1)}%\n`;
                }
            }
            
            // Hata Detayları (Defects) - Girdi kontrol formatı gibi
            if (defectsToUse && Array.isArray(defectsToUse) && defectsToUse.length > 0) {
                detailedDescription += `\n\nTESPİT EDİLEN HATALAR:\n`;
                defectsToUse.forEach((defect, idx) => {
                    const defectDesc = defect.defect_description || defect.description || 'Belirtilmemiş';
                    const defectQty = defect.quantity || defect.qty || '-';
                    detailedDescription += `${idx + 1}. ${defectDesc} (Miktar: ${defectQty} adet)\n`;
                });
            }
            
            if (details.description) {
                detailedDescription += `\n\nAçıklama: ${details.description}\n`;
            }
            if (details.notes) {
                detailedDescription += `Notlar: ${details.notes}\n`;
            }
            detailedDescription += `\n\nBu parça için sapma onayı talep edilmektedir.`;
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
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const removeExistingAttachment = (attachmentId) => {
        setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
        setDeletedAttachmentIds(prev => [...prev, attachmentId]);
    };

    // Dosya uzantısına göre MIME type belirleme fonksiyonu
    const getMimeTypeFromFileName = (fileName) => {
        if (!fileName) return 'application/octet-stream';
        
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            // Documents
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'rtf': 'application/rtf',
            'csv': 'text/csv',
            
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon',
            
            // Archives
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',
            
            // Audio
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            
            // Video
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'wmv': 'video/x-ms-wmv',
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
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
            
            // Silinen mevcut attachment'ları sil
            if (deletedAttachmentIds.length > 0) {
                // Önce storage'dan dosyaları sil
                const attachmentsToDelete = existingDeviation.deviation_attachments?.filter(att => 
                    deletedAttachmentIds.includes(att.id)
                ) || [];
                
                for (const att of attachmentsToDelete) {
                    try {
                        await supabase.storage.from('deviation_attachments').remove([att.file_path]);
                    } catch (error) {
                        console.error('Dosya silme hatası:', error);
                    }
                }
                
                // Sonra veritabanından kayıtları sil
                const { error: deleteError } = await supabase
                    .from('deviation_attachments')
                    .delete()
                    .in('id', deletedAttachmentIds);
                
                if (deleteError) {
                    console.error('Attachment silme hatası:', deleteError);
                    toast({ variant: 'destructive', title: 'Uyarı', description: 'Bazı ekler silinemedi.' });
                }
            }
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
            // Deviation ID kontrolü
            if (!deviationData || !deviationData.id) {
                const errorMsg = 'Sapma kaydı ID bulunamadı. Lütfen tekrar deneyin.';
                console.error(errorMsg, deviationData);
                toast({ variant: 'destructive', title: 'Hata', description: errorMsg });
                setIsSubmitting(false);
                return;
            }
            
            const uploadPromises = files.map(async (file, index) => {
                try {
                    // Dosya bilgilerini logla
                    console.log(`📤 Dosya yükleniyor: ${file.name} (${file.size} bytes, ${file.type})`);
                    
                    const sanitizedFileName = sanitizeFileName(file.name);
                    if (!sanitizedFileName || sanitizedFileName.length === 0) {
                        const errorMsg = `Dosya adı geçersiz: ${file.name}`;
                        console.error(errorMsg);
                        toast({ variant: 'destructive', title: 'Dosya Hatası', description: errorMsg });
                        return null;
                    }
                    
                    // MIME type belirleme: ÖNCE dosya uzantısından belirle, sonra file.type'ı kontrol et
                    // Bu şekilde file.type yanlış olsa bile doğru MIME type kullanılır
                    let contentType = getMimeTypeFromFileName(file.name);
                    
                    // Eğer file.type geçerli ve dosya uzantısından belirlenen ile uyumluysa kullan
                    if (file.type && 
                        file.type !== 'application/json' && 
                        !file.type.includes('application/json') &&
                        file.type !== 'application/octet-stream' &&
                        file.type !== '') {
                        // file.type geçerli görünüyor, ama yine de dosya uzantısından belirleneni kullan
                        // Çünkü file.type bazen yanlış olabiliyor
                        console.log(`ℹ️ file.type: ${file.type}, dosya uzantısından belirlenen: ${contentType}`);
                    } else {
                        console.log(`⚠️ file.type geçersiz (${file.type}), dosya uzantısından belirlendi: ${contentType}`);
                    }
                    
                    const timestamp = Date.now();
                    const randomStr = Math.random().toString(36).substring(2, 9);
                    const filePath = `${deviationData.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                    
                    console.log(`📁 Dosya yolu: ${filePath}`);
                    console.log(`📦 Bucket: deviation_attachments`);
                    console.log(`🆔 Deviation ID: ${deviationData.id}`);
                    console.log(`📄 Content-Type: ${contentType}`);
                    
                    // Dosya boyutunu kontrol et (max 50MB)
                    const maxSize = 50 * 1024 * 1024; // 50MB
                    if (file.size > maxSize) {
                        const errorMsg = `Dosya çok büyük: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimum boyut: 50MB`;
                        console.error(errorMsg);
                        toast({ variant: 'destructive', title: 'Dosya Hatası', description: errorMsg });
                        return null;
                    }
                    
                    // Dosyayı Blob olarak yeniden oluştur - bu file.type sorununu tamamen çözer
                    // File nesnesinin type'ı yanlış olsa bile, yeni Blob doğru content-type ile oluşturulur
                    const fileArrayBuffer = await file.arrayBuffer();
                    const fileBlob = new Blob([fileArrayBuffer], { type: contentType });
                    
                    console.log(`⬆️ Storage'a yükleniyor... (Blob size: ${fileBlob.size}, type: ${fileBlob.type})`);
                    const uploadResult = await supabase.storage.from('deviation_attachments').upload(filePath, fileBlob, { 
                        contentType: contentType,
                        upsert: false
                    });
                    
                    if (uploadResult.error) {
                        console.error(`❌ Dosya yükleme hatası (${file.name}):`, uploadResult.error);
                        console.error(`Hata detayları:`, JSON.stringify(uploadResult.error, null, 2));
                        toast({ 
                            variant: 'destructive', 
                            title: 'Dosya Yükleme Hatası', 
                            description: `${file.name} yüklenemedi: ${uploadResult.error.message || 'Bilinmeyen hata'}` 
                        });
                        return null;
                    }
                    
                    console.log(`✅ Dosya storage'a yüklendi: ${uploadResult.data.path}`);
                    
                    // Dosya başarıyla yüklendiyse, veritabanına kaydet
                    const attachmentRecord = {
                        deviation_id: deviationData.id,
                        file_path: uploadResult.data.path,
                        file_name: file.name,
                        file_type: contentType // Doğru MIME type'ı kullan
                    };
                    
                    console.log(`💾 Veritabanına kaydediliyor...`, attachmentRecord);
                    const { data: insertedData, error: insertError } = await supabase
                        .from('deviation_attachments')
                        .insert(attachmentRecord)
                        .select()
                        .single();
                    
                    if (insertError) {
                        console.error(`❌ Veritabanı kayıt hatası (${file.name}):`, insertError);
                        console.error(`Hata detayları:`, JSON.stringify(insertError, null, 2));
                        // Dosya yüklendi ama veritabanına kaydedilemedi - dosyayı sil
                        try {
                            console.log(`🗑️ Orphan dosya siliniyor: ${uploadResult.data.path}`);
                            const removeResult = await supabase.storage.from('deviation_attachments').remove([uploadResult.data.path]);
                            if (removeResult.error) {
                                console.error('Orphan dosya silme hatası:', removeResult.error);
                            } else {
                                console.log('✅ Orphan dosya başarıyla silindi');
                            }
                        } catch (removeError) {
                            console.error('Orphan dosya silme hatası:', removeError);
                        }
                        toast({ 
                            variant: 'destructive', 
                            title: 'Veritabanı Hatası', 
                            description: `${file.name} veritabanına kaydedilemedi: ${insertError.message || 'Bilinmeyen hata'}` 
                        });
                        return null;
                    }
                    
                    console.log(`✅ Dosya başarıyla yüklendi ve kaydedildi: ${file.name}`, insertedData);
                    return insertedData;
                } catch (error) {
                    console.error(`❌ Beklenmeyen hata (${file.name}):`, error);
                    console.error(`Hata stack:`, error.stack);
                    toast({ 
                        variant: 'destructive', 
                        title: 'Beklenmeyen Hata', 
                        description: `${file.name} yüklenirken beklenmeyen bir hata oluştu: ${error.message || 'Bilinmeyen hata'}` 
                    });
                    return null;
                }
            });
            
            const uploadResults = await Promise.all(uploadPromises);
            const successfulUploads = uploadResults.filter(result => result !== null);
            
            if (successfulUploads.length > 0) {
                console.log(`✅ ${successfulUploads.length} dosya başarıyla yüklendi ve kaydedildi`);
            }
            
            if (successfulUploads.length < files.length) {
                toast({ variant: 'warning', title: 'Kısmi Başarı', description: `${successfulUploads.length}/${files.length} dosya başarıyla yüklendi.` });
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
                        
                        {/* Mevcut attachment'lar (sadece düzenleme modunda) */}
                        {isEditMode && existingAttachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Mevcut Ekler:</p>
                                {existingAttachments.map((att) => (
                                    <div key={att.id} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="w-4 h-4" />
                                            <span className="text-sm">{att.file_name}</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExistingAttachment(att.id)}>
                                            <XIcon className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Yeni eklenen dosyalar */}
                        {files.length > 0 && (
                            <div className="mt-2 space-y-2">
                                {isEditMode && existingAttachments.length > 0 && (
                                    <p className="text-xs text-muted-foreground font-medium">Yeni Eklenen Dosyalar:</p>
                                )}
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