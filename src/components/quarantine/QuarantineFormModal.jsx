import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { normalizeUnitNameForSettings } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModernModalLayout, ModalSectionHeader, ModalField } from '@/components/shared/ModernModalLayout';
import { PackageX, Package, CalendarDays, Upload, FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid';
import { normalizeQuarantineAttachments } from '@/lib/quarantineAttachments';

const QUARANTINE_FILES_BUCKET = 'quarantine_documents';
const RECORD_ATTACHMENTS_PREFIX = 'record_attachments';
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const isSupplierSourceDepartment = (dept) => {
    if (!dept || typeof dept !== 'string') return false;
    const n = dept.trim().toLowerCase();
    return n.includes('tedarikçi') || n.includes('tedarikci');
};

const QuarantineFormModal = ({ isOpen, setIsOpen, existingRecord, refreshData, mode }) => {
    const { toast } = useToast();
    const isEditMode = mode === 'edit';
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [newFiles, setNewFiles] = useState([]);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchSettingsData = async () => {
            try {
                // Fetch departments from cost_settings
                const { data: deptData, error: deptError } = await supabase
                    .from('cost_settings')
                    .select('unit_name')
                    .order('unit_name');
                
                if (deptError) throw deptError;
                setDepartments(deptData.map((d) => normalizeUnitNameForSettings(d.unit_name || '')));
                
                // Fetch active personnel
                const { data: personnelData, error: personnelError } = await supabase
                    .from('personnel')
                    .select('id, full_name')
                    .eq('is_active', true)
                    .order('full_name');
                
                if (personnelError) throw personnelError;
                setPersonnel(personnelData || []);

                const { data: supplierData, error: supplierError } = await supabase
                    .from('suppliers')
                    .select('id, name')
                    .order('name');
                if (supplierError) throw supplierError;
                setSuppliers(supplierData || []);
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
                supplier_id: '',
                supplier_name: '',
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
                supplier_id: existingRecord.supplier_id || '',
                supplier_name: existingRecord.supplier_name || '',
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
                supplier_id: '',
                supplier_name: '',
                quarantine_date: new Date().toISOString().slice(0, 10),
                status: 'Karantinada'
            });
        }
    }, [isOpen, mode, existingRecord?.id]); // existingRecord.id kullanarak referans sorunlarını önle

    useEffect(() => {
        if (!isOpen) {
            setExistingAttachments([]);
            setNewFiles([]);
            return;
        }
        if (mode === 'edit' && existingRecord?.id) {
            setExistingAttachments(normalizeQuarantineAttachments(existingRecord.attachments));
        } else {
            setExistingAttachments([]);
        }
        setNewFiles([]);
    }, [isOpen, mode, existingRecord?.id]);

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

    const handleSourceDepartmentChange = (value) => {
        setFormData(prev => ({
            ...prev,
            source_department: value,
            ...(isSupplierSourceDepartment(value) ? {} : { supplier_id: '', supplier_name: '' }),
        }));
    };

    const isAllowedAttachmentFile = (file) => {
        const byType = file.type?.startsWith('image/') || file.type === 'application/pdf';
        const byName = /\.pdf$/i.test(file.name || '');
        return byType || byName;
    };

    const handleAttachmentFiles = (e) => {
        const list = Array.from(e.target.files || []);
        e.target.value = '';
        const accepted = [];
        const rejected = [];
        for (const file of list) {
            if (!isAllowedAttachmentFile(file)) {
                rejected.push(`${file.name}: yalnızca görsel veya PDF`);
                continue;
            }
            if (file.size > MAX_ATTACHMENT_BYTES) {
                rejected.push(`${file.name}: 15 MB sınırı`);
                continue;
            }
            accepted.push(file);
        }
        if (rejected.length) {
            toast({ variant: 'destructive', title: 'Bazı dosyalar eklenmedi', description: rejected.slice(0, 3).join(' · ') });
        }
        if (accepted.length) {
            setNewFiles((prev) => [...prev, ...accepted]);
        }
    };

    const syncAttachmentsToRecord = useCallback(async (recordId) => {
        const prev = normalizeQuarantineAttachments(existingRecord?.attachments);
        const prevPaths = new Set(prev.map((a) => a.path).filter(Boolean));
        const keepPaths = new Set(existingAttachments.map((a) => a.path).filter(Boolean));
        const toRemove = [...prevPaths].filter((p) => !keepPaths.has(p));
        if (toRemove.length) {
            const { error: rmErr } = await supabase.storage.from(QUARANTINE_FILES_BUCKET).remove(toRemove);
            if (rmErr) console.warn('Karantina ek silme:', rmErr);
        }
        const uploaded = [];
        for (const file of newFiles) {
            const safeName = (file.name || 'dosya').replace(/[^\w.\-]+/g, '_');
            const filePath = `${RECORD_ATTACHMENTS_PREFIX}/${recordId}/${uuidv4()}-${safeName}`;
            const { error: upErr } = await supabase.storage.from(QUARANTINE_FILES_BUCKET).upload(filePath, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false,
            });
            if (upErr) throw new Error(upErr.message);
            const { data } = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(filePath);
            uploaded.push({
                name: file.name,
                path: filePath,
                mime_type: file.type || null,
                public_url: data.publicUrl,
            });
        }
        const final = [...existingAttachments, ...uploaded];
        const { error: attErr } = await supabase
            .from('quarantine_records')
            .update({ attachments: final })
            .eq('id', recordId);
        if (attErr) throw new Error(attErr.message);
    }, [existingRecord?.attachments, existingAttachments, newFiles]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.part_name || !formData.quantity || !formData.source_department) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen zorunlu alanları doldurun.' });
            return;
        }
        if (isSupplierSourceDepartment(formData.source_department) && !formData.supplier_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Kaynak tedarikçi seçildiğinde hangi tedarikçi olduğunu seçmeniz gerekir.' });
            return;
        }
        setIsSubmitting(true);
        
        const { non_conformity, non_conformity_id, nc_number, non_conformity_type, supplier_name: _supplierNameUi, ...rest } = formData;
        
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
        delete submissionData.attachments;

        // Undefined key'leri ve geçersiz kolonları temizle
        const cleanedData = {};
        for (const key in submissionData) {
            if (submissionData[key] !== undefined && key !== 'undefined') {
                cleanedData[key] = submissionData[key];
            }
        }

        if (!isSupplierSourceDepartment(cleanedData.source_department)) {
            cleanedData.supplier_id = null;
        } else if (cleanedData.supplier_id === '' || cleanedData.supplier_id == null) {
            cleanedData.supplier_id = null;
        }

        console.log('📝 Karantina güncelleme - cleanedData:', cleanedData);

        let error;
        let result;

        const recordIdAfterSave = isEditMode ? existingRecord.id : null;

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
                .select('id')
                .single();
            error = insertError;
            result = data;
            console.log('📝 Karantina INSERT sonucu:', { data, error: insertError });
        }

        if (error) {
            console.error('❌ Karantina kayıt hatası:', error);
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}` });
            setIsSubmitting(false);
            return;
        }

        const savedId = isEditMode ? recordIdAfterSave : result?.id;
        if (savedId) {
            try {
                await syncAttachmentsToRecord(savedId);
            } catch (attEx) {
                console.error(attEx);
                toast({
                    variant: 'destructive',
                    title: 'Dosya kaydı sorunu',
                    description: attEx.message || 'Kayıt kaydedildi ancak ekler güncellenemedi. Düzenleme ekranından tekrar deneyin.',
                });
                refreshData();
                setIsSubmitting(false);
                return;
            }
        }

        console.log('✅ Karantina kaydı başarılı:', result);
        toast({ title: 'Başarılı!', description: `Karantina kaydı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
        refreshData();
        setIsOpen(false);
        setIsSubmitting(false);
    };

    const rightPanel = (
        <div className="p-5 space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><PackageX className="w-20 h-20" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Karantina</p>
                </div>
                <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{formData.part_name || '-'}</p>
                {formData.part_code && <p className="text-xs text-muted-foreground mt-1 font-mono">{formData.part_code}</p>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{formData.status || 'Karantinada'}</Badge>
                {formData.quantity && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-800">{formData.quantity} {formData.unit || 'Adet'}</Badge>
                )}
                {(existingAttachments.length + newFiles.length) > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                        {existingAttachments.length + newFiles.length} ek
                    </Badge>
                )}
            </div>

            <Separator className="my-1" />

            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ürün Bilgileri</p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Lot / Seri No', value: formData.lot_no },
                        { label: 'Araç Tipi', value: formData.vehicle_type },
                        { label: 'Tedarikçi', value: formData.supplier_name },
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
                        { label: 'Kaynak Birim', value: formData.source_department },
                        { label: 'Talep Birimi', value: formData.requesting_department },
                        { label: 'Talep Eden', value: formData.requesting_person_name },
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

            <div className="flex items-start gap-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Karantina Tarihi</p>
                    <p className="text-xs font-semibold text-foreground">
                        {formData.quarantine_date ? new Date(formData.quarantine_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    </p>
                </div>
            </div>

            {formData.reason && (
                <>
                    <Separator className="my-1" />
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Karantina Sebebi</p>
                        <p className="text-[11px] text-foreground leading-relaxed line-clamp-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
                            {formData.reason}
                        </p>
                    </div>
                </>
            )}

            {formData.description && (
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Açıklama</p>
                    <p className="text-[11px] text-foreground leading-relaxed line-clamp-3 bg-muted/30 rounded-lg p-2.5 border">
                        {formData.description}
                    </p>
                </div>
            )}

            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2 border border-amber-100 dark:border-amber-800">
                <PackageX className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                    Karantina kaydı oluşturulduktan sonra takip listesinde görüntülenebilir.
                </p>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title={isEditMode ? 'Karantina Kaydını Düzenle' : 'Yeni Karantina Kaydı'}
            subtitle="Karantina Yönetimi"
            icon={<PackageX className="h-5 w-5 text-white" />}
            badge={isEditMode ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setIsOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel={isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet'}
            cancelLabel="İptal Et"
            formId="quarantine-form"
            footerDate={formData.quarantine_date}
            rightPanel={rightPanel}
        >
            <form id="quarantine-form" onSubmit={handleSubmit} className="p-6">
                <div className="space-y-6">
                    <div>
                        <ModalSectionHeader>Ürün Bilgileri</ModalSectionHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ModalField label="Parça Adı" required>
                                <Input id="part_name" value={formData.part_name || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required />
                            </ModalField>
                            <ModalField label="Parça Kodu">
                                <Input id="part_code" value={formData.part_code || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} />
                            </ModalField>
                            <ModalField label="Lot / Seri No">
                                <Input id="lot_no" value={formData.lot_no || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} />
                            </ModalField>
                            <div className="grid grid-cols-2 gap-2">
                                <ModalField label="Miktar" required>
                                    <Input id="quantity" type="number" value={formData.quantity || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required />
                                </ModalField>
                                <ModalField label="Birim">
                                    <Input id="unit" value={formData.unit || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} />
                                </ModalField>
                            </div>
                            <ModalField label="Karantina Tarihi" required>
                                <Input id="quarantine_date" type="date" value={formData.quarantine_date || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} required />
                            </ModalField>
                        </div>
                    </div>
                    <div>
                        <ModalSectionHeader>Talep ve Birim Bilgileri</ModalSectionHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ModalField label="Karantinaya Sebebiyet Veren Birim" required>
                                <Select value={formData.source_department || ''} onValueChange={handleSourceDepartmentChange}>
                                    <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                    <SelectContent>{departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                            {isSupplierSourceDepartment(formData.source_department) && (
                                <ModalField label="Sebep olan tedarikçi" required>
                                    <Select
                                        value={formData.supplier_id || '__none__'}
                                        onValueChange={(v) => {
                                            const id = v === '__none__' ? '' : v;
                                            const name = id ? (suppliers.find((s) => s.id === id)?.name || '') : '';
                                            setFormData((prev) => ({ ...prev, supplier_id: id, supplier_name: name }));
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Seçiniz</SelectItem>
                                            {suppliers.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </ModalField>
                            )}
                            <ModalField label="Talebi Yapan Birim">
                                <Select value={formData.requesting_department || ''} onValueChange={(v) => handleSelectChange('requesting_department', v)}>
                                    <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                    <SelectContent>{departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                            <ModalField label="Talebi Yapan Kişi">
                                <Select value={formData.requesting_person_name || ''} onValueChange={(v) => handleSelectChange('requesting_person_name', v)}>
                                    <SelectTrigger><SelectValue placeholder="Kişi seçin..." /></SelectTrigger>
                                    <SelectContent>{personnel.map(p => <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                            <div className="md:col-span-2">
                                <ModalField label="Açıklama / Detaylar">
                                    <Textarea ref={textareaRef} id="description" value={formData.description || ''} onChange={e => handleInputChange(e.target.id, e.target.value)} rows={3} className="resize-none overflow-hidden" />
                                </ModalField>
                            </div>
                            <div className="md:col-span-2 space-y-3 pt-2 border-t border-border/60">
                                <ModalSectionHeader>Görsel ve PDF ekleri</ModalSectionHeader>
                                <p className="text-xs text-muted-foreground">Ürün görüntüsü veya PDF belgesi ekleyebilirsiniz. En fazla 15 MB / dosya; birden fazla seçilebilir.</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        ref={fileInputRef}
                                        id="quarantine-attachments"
                                        type="file"
                                        accept="image/*,.pdf,application/pdf"
                                        multiple
                                        className="hidden"
                                        autoFormat={false}
                                        onChange={handleAttachmentFiles}
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Dosya ekle
                                    </Button>
                                </div>
                                {(existingAttachments.length > 0 || newFiles.length > 0) && (
                                    <ul className="rounded-lg border border-border bg-muted/20 divide-y divide-border text-sm">
                                        {existingAttachments.map((a, i) => (
                                            <li key={a.path || i} className="flex items-center gap-2 px-3 py-2">
                                                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                <span className="flex-1 truncate min-w-0">{a.name}</span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">Kayıtlı</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                    onClick={() => setExistingAttachments((prev) => prev.filter((_, j) => j !== i))}
                                                    aria-label="Kaldır"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </li>
                                        ))}
                                        {newFiles.map((f, i) => (
                                            <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                                                <FileText className="w-4 h-4 shrink-0 text-primary" />
                                                <span className="flex-1 truncate min-w-0">{f.name}</span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {(f.size / 1024).toFixed(0)} KB · yüklenecek
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                    onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                                                    aria-label="Kaldır"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </ModernModalLayout>
    );
};

export default QuarantineFormModal;