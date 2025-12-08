import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, File, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const BUCKET_NAME = 'documents';

// Dosya adını normalize et
const normalizeFileName = (fileName) => {
    if (!fileName) return 'file';
    
    const turkishToAscii = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    };
    
    let normalized = fileName;
    Object.keys(turkishToAscii).forEach(key => {
        normalized = normalized.replace(new RegExp(key, 'g'), turkishToAscii[key]);
    });
    
    const lastDotIndex = normalized.lastIndexOf('.');
    let name = normalized;
    let ext = '';
    
    if (lastDotIndex > 0 && lastDotIndex < normalized.length - 1) {
        name = normalized.substring(0, lastDotIndex);
        ext = normalized.substring(lastDotIndex + 1);
    }
    
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    ext = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    if (!ext || ext.length === 0) {
        const originalLastDot = fileName.lastIndexOf('.');
        if (originalLastDot > 0 && originalLastDot < fileName.length - 1) {
            ext = fileName.substring(originalLastDot + 1).toLowerCase();
        }
    }
    
    if (!ext || ext.length === 0) ext = 'file';
    if (!name || name.length === 0) name = 'file';
    
    return `${name}.${ext}`;
};

const UploadDocumentModal = ({ 
    isOpen, 
    setIsOpen, 
    refreshDocuments, 
    existingDocument, 
    categories, 
    preselectedCategory,
    preselectedDepartment,
    preselectedSupplier,
    personnelList: propPersonnelList
}) => {
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const { personnel: contextPersonnel, productionDepartments, suppliers } = useData();
    const personnelList = propPersonnelList || contextPersonnel;
    const isEditMode = !!existingDocument;

    const [formData, setFormData] = useState({});
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    
    const initialLoadRef = useRef(true);

    useEffect(() => {
        if (isOpen) {
            if (initialLoadRef.current) {
                const currentUserPersonnel = personnelList?.find(p => p.email === user?.email);
                
                const initialData = {
                    title: '', 
                    document_type: preselectedCategory || '', 
                    document_subcategory: '',
                    document_category: preselectedSupplier ? 'Tedarikçi Dokümanı' : 'İç Doküman',
                    revision_number: '1', 
                    publish_date: new Date().toISOString().slice(0, 10), 
                    personnel_id: null,
                    revision_reason: 'İlk Yayın',
                    valid_until: '',
                    status: 'Taslak',
                    department_id: preselectedDepartment || profile?.department_id || '',
                    supplier_id: preselectedSupplier || '',
                    owner_id: currentUserPersonnel?.id || '',
                    classification: 'İç Kullanım',
                    approval_required: false,
                    review_frequency_months: 12,
                    keywords: [],
                    tags: [],
                    description: '',
                    notes: ''
                };

                if (isEditMode && existingDocument) {
                    const revision = existingDocument.document_revisions || existingDocument.current_revision;
                    setFormData({
                        id: existingDocument.id,
                        title: existingDocument.title || '',
                        document_type: existingDocument.document_type || '',
                        document_subcategory: existingDocument.document_subcategory || '',
                        document_category: existingDocument.document_category || 'İç Doküman',
                        personnel_id: existingDocument.personnel_id || null,
                        department_id: existingDocument.department_id || '',
                        supplier_id: existingDocument.supplier_id || '',
                        owner_id: existingDocument.owner_id || currentUserPersonnel?.id || '',
                        valid_until: existingDocument.valid_until ? new Date(existingDocument.valid_until).toISOString().slice(0, 10) : '',
                        revision_number: revision?.revision_number || '1',
                        publish_date: revision?.publish_date ? new Date(revision.publish_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                        revision_reason: revision?.revision_reason || '',
                        file_name: revision?.attachments?.[0]?.name,
                        classification: existingDocument.classification || 'İç Kullanım',
                        approval_required: existingDocument.approval_required || false,
                        review_frequency_months: existingDocument.review_frequency_months || 12,
                        keywords: existingDocument.keywords || [],
                        tags: existingDocument.tags || [],
                        description: existingDocument.description || '',
                        notes: existingDocument.notes || ''
                    });
                } else {
                    setFormData(initialData);
                }
                setFile(null);
                initialLoadRef.current = false;
            }
        } else {
            initialLoadRef.current = true;
        }
    }, [isOpen, existingDocument, isEditMode, preselectedCategory, preselectedDepartment, preselectedSupplier, profile, user, personnelList]);

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'image/*': ['.jpg', '.jpeg', '.png']
        },
        maxFiles: 1
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleTagsChange = (e) => {
        const value = e.target.value;
        const tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        setFormData(prev => ({ ...prev, tags }));
    };

    const handleKeywordsChange = (e) => {
        const value = e.target.value;
        const keywords = value.split(',').map(k => k.trim()).filter(k => k.length > 0);
        setFormData(prev => ({ ...prev, keywords }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isEditMode && !file) {
            toast({ variant: 'destructive', title: 'Dosya Eksik', description: 'Lütfen bir dosya seçin.' });
            return;
        }
        if (!formData.title || !formData.document_type) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen doküman adı ve kategorisini girin.' });
            return;
        }
        setIsSubmitting(true);

        try {
            const currentUserPersonnelRecord = personnelList?.find(p => p.email === user?.email);
            if (!currentUserPersonnelRecord) {
                throw new Error("Mevcut kullanıcı için personel kaydı bulunamadı.");
            }

            const documentId = isEditMode ? existingDocument.id : uuidv4();
            let attachmentData = null;

            if (file) {
                // Eski dosyayı sil (revizyon durumunda)
                if (isEditMode && existingDocument.current_revision_id) {
                    const { data: rev } = await supabase
                        .from('document_revisions')
                        .select('attachments')
                        .eq('id', existingDocument.current_revision_id)
                        .single();
                    
                    if (rev?.attachments?.length > 0) {
                        const paths = rev.attachments.map(att => att.path).filter(Boolean);
                        if (paths.length > 0) {
                            await supabase.storage.from(BUCKET_NAME).remove(paths);
                        }
                    }
                }

                // Dosya adını normalize et
                const normalizedFileName = normalizeFileName(file.name);
                const filePath = `${user.id}/${documentId}/${Date.now()}-${normalizedFileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream'
                    });
                
                if (uploadError) throw uploadError;

                attachmentData = {
                    path: filePath,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                };
            }
            
            const documentPayload = {
                title: formData.title,
                document_type: formData.document_type,
                document_subcategory: formData.document_subcategory || null,
                document_category: formData.document_category || 'İç Doküman',
                status: formData.status || 'Taslak',
                department_id: formData.department_id || null,
                supplier_id: formData.supplier_id || null,
                personnel_id: formData.document_type === 'Personel Sertifikaları' ? formData.personnel_id : null,
                valid_until: formData.valid_until || null,
                owner_id: formData.owner_id || currentUserPersonnelRecord.id,
                classification: formData.classification || 'İç Kullanım',
                approval_required: formData.approval_required || false,
                review_frequency_months: formData.review_frequency_months ? parseInt(formData.review_frequency_months) : null,
                keywords: formData.keywords || [],
                tags: formData.tags || [],
                description: formData.description || '',
                notes: formData.notes || '',
                user_id: user.id,
            };

            const revisionPayload = {
                revision_number: formData.revision_number || '1',
                revision_reason: formData.revision_reason || 'İlk Yayın',
                publish_date: formData.publish_date || new Date().toISOString().slice(0, 10),
                prepared_by_id: currentUserPersonnelRecord.id,
                user_id: user.id,
                attachments: attachmentData ? [attachmentData] : (isEditMode ? existingDocument.document_revisions?.attachments : null),
                revision_status: formData.status || 'Taslak',
                effective_date: formData.publish_date || new Date().toISOString().slice(0, 10),
            };
            
            if (isEditMode) {
                // Mevcut dokümanı güncelle
                const { data: docUpdateData, error: docUpdateError } = await supabase
                    .from('documents')
                    .update(documentPayload)
                    .eq('id', documentId)
                    .select('id')
                    .single();
                
                if (docUpdateError) throw docUpdateError;
                
                // Yeni revizyon oluştur (eğer dosya değiştiyse veya revizyon numarası değiştiyse)
                if (file || formData.revision_number !== (existingDocument.document_revisions?.revision_number || '1')) {
                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...revisionPayload, document_id: documentId })
                        .select('id')
                        .single();
                    
                    if (revError) throw revError;

                    // Current revision'ı güncelle
                    await supabase
                        .from('documents')
                        .update({ current_revision_id: revData.id })
                        .eq('id', documentId);
                } else {
                    // Mevcut revizyonu güncelle
                    await supabase
                        .from('document_revisions')
                        .update(revisionPayload)
                        .eq('document_id', documentId)
                        .eq('id', existingDocument.current_revision_id);
                }
            } else {
                // Yeni doküman oluştur
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .insert({ ...documentPayload, id: documentId })
                    .select('id, document_number')
                    .single();
                
                if (docError) throw docError;

                const { data: revData, error: revError } = await supabase
                    .from('document_revisions')
                    .insert({ ...revisionPayload, document_id: docData.id })
                    .select('id')
                    .single();
                
                if (revError) throw revError;

                await supabase
                    .from('documents')
                    .update({ current_revision_id: revData.id })
                    .eq('id', docData.id);

                // Tedarikçi dokümanı ise supplier_documents tablosuna ekle
                if (formData.supplier_id) {
                    await supabase.from('supplier_documents').insert({
                        supplier_id: formData.supplier_id,
                        document_id: docData.id,
                        document_category: formData.document_subcategory || formData.document_type,
                        document_date: formData.publish_date || new Date().toISOString().slice(0, 10),
                        expiry_date: formData.valid_until || null,
                        is_valid: true
                    });
                }
            }

            toast({ title: 'Başarılı!', description: `Doküman başarıyla ${isEditMode ? 'güncellendi' : 'yüklendi'}.` });
            refreshDocuments();
            setIsOpen(false);
        } catch (error) {
            console.error("Submit Error:", error);
            toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-foreground">
                        {isEditMode ? 'Dokümanı Düzenle' : 'Yeni Doküman Yükle'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditMode ? 'Mevcut doküman bilgilerini güncelleyin.' : 'Sisteme yeni bir doküman ekleyin.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                            <TabsTrigger value="details">Detaylar</TabsTrigger>
                            <TabsTrigger value="revision">Revizyon</TabsTrigger>
                        </TabsList>

                        {/* Genel Bilgiler Tab */}
                        <TabsContent value="general" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <Label htmlFor="title">Doküman Adı <span className="text-red-500">*</span></Label>
                                    <Input 
                                        id="title" 
                                        value={formData.title || ''} 
                                        onChange={handleInputChange} 
                                        required 
                                        placeholder="Örn: Kalite Kontrol Prosedürü"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="document_type">Kategori <span className="text-red-500">*</span></Label>
                                    <Select 
                                        value={formData.document_type || ''} 
                                        onValueChange={(v) => handleSelectChange('document_type', v)} 
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Kategori seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories?.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="document_subcategory">Alt Kategori</Label>
                                    <Input 
                                        id="document_subcategory" 
                                        value={formData.document_subcategory || ''} 
                                        onChange={handleInputChange} 
                                        placeholder="Örn: Üretim Prosedürü"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="document_category">Doküman Kategorisi</Label>
                                    <Select 
                                        value={formData.document_category || 'İç Doküman'} 
                                        onValueChange={(v) => handleSelectChange('document_category', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="İç Doküman">İç Doküman</SelectItem>
                                            <SelectItem value="Tedarikçi Dokümanı">Tedarikçi Dokümanı</SelectItem>
                                            <SelectItem value="Müşteri Dokümanı">Müşteri Dokümanı</SelectItem>
                                            <SelectItem value="Dış Doküman">Dış Doküman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.document_category === 'Tedarikçi Dokümanı' && (
                                    <div>
                                        <Label htmlFor="supplier_id">Tedarikçi</Label>
                                        <Select 
                                            value={formData.supplier_id || ''} 
                                            onValueChange={(v) => handleSelectChange('supplier_id', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tedarikçi seçin..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers?.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="department_id">Birim</Label>
                                    <Select 
                                        value={formData.department_id || ''} 
                                        onValueChange={(v) => handleSelectChange('department_id', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Birim seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productionDepartments?.map(dept => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.unit_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.document_type === 'Personel Sertifikaları' && (
                                    <div>
                                        <Label htmlFor="personnel_id">Personel</Label>
                                        <Select
                                            value={formData.personnel_id || ''}
                                            onValueChange={(value) => handleSelectChange('personnel_id', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Personel seçin..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {personnelList?.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="owner_id">Doküman Sahibi</Label>
                                    <Select
                                        value={formData.owner_id || ''}
                                        onValueChange={(value) => handleSelectChange('owner_id', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sahip seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personnelList?.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="classification">Sınıflandırma</Label>
                                    <Select 
                                        value={formData.classification || 'İç Kullanım'} 
                                        onValueChange={(v) => handleSelectChange('classification', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Genel">Genel</SelectItem>
                                            <SelectItem value="İç Kullanım">İç Kullanım</SelectItem>
                                            <SelectItem value="Gizli">Gizli</SelectItem>
                                            <SelectItem value="Çok Gizli">Çok Gizli</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="description">Açıklama</Label>
                                    <Textarea 
                                        id="description" 
                                        value={formData.description || ''} 
                                        onChange={handleInputChange} 
                                        rows={3}
                                        placeholder="Doküman hakkında kısa açıklama..."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Detaylar Tab */}
                        <TabsContent value="details" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="valid_until">Geçerlilik Tarihi</Label>
                                    <Input 
                                        id="valid_until" 
                                        type="date" 
                                        value={formData.valid_until || ''} 
                                        onChange={handleInputChange} 
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="review_frequency_months">Revizyon Sıklığı (Ay)</Label>
                                    <Input 
                                        id="review_frequency_months" 
                                        type="number" 
                                        value={formData.review_frequency_months || ''} 
                                        onChange={handleInputChange}
                                        placeholder="12"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="tags">Etiketler (virgülle ayırın)</Label>
                                    <Input 
                                        id="tags" 
                                        value={(formData.tags || []).join(', ')} 
                                        onChange={handleTagsChange}
                                        placeholder="kalite, prosedür, üretim"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="keywords">Anahtar Kelimeler (virgülle ayırın)</Label>
                                    <Input 
                                        id="keywords" 
                                        value={(formData.keywords || []).join(', ')} 
                                        onChange={handleKeywordsChange}
                                        placeholder="kalite kontrol, prosedür, talimat"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea 
                                        id="notes" 
                                        value={formData.notes || ''} 
                                        onChange={handleInputChange} 
                                        rows={3}
                                        placeholder="Ek notlar..."
                                    />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="approval_required"
                                        checked={formData.approval_required || false}
                                        onChange={(e) => handleSelectChange('approval_required', e.target.checked)}
                                        className="rounded"
                                    />
                                    <Label htmlFor="approval_required" className="cursor-pointer">
                                        Onay gerektir
                                    </Label>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Revizyon Tab */}
                        <TabsContent value="revision" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="revision_number">Versiyon Numarası</Label>
                                    <Input 
                                        id="revision_number" 
                                        value={formData.revision_number || '1'} 
                                        onChange={handleInputChange}
                                        placeholder="1, 2, Rev.01, vb."
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="publish_date">Yayın Tarihi <span className="text-red-500">*</span></Label>
                                    <Input 
                                        id="publish_date" 
                                        type="date" 
                                        value={formData.publish_date || ''} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="revision_reason">Revizyon Nedeni</Label>
                                    <Textarea 
                                        id="revision_reason" 
                                        value={formData.revision_reason || ''} 
                                        onChange={handleInputChange} 
                                        rows={3}
                                        placeholder="Revizyon yapılma nedeni..."
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="status">Durum</Label>
                                    <Select 
                                        value={formData.status || 'Taslak'} 
                                        onValueChange={(v) => handleSelectChange('status', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Taslak">Taslak</SelectItem>
                                            <SelectItem value="Onay Bekliyor">Onay Bekliyor</SelectItem>
                                            <SelectItem value="Onaylandı">Onaylandı</SelectItem>
                                            <SelectItem value="Yayınlandı">Yayınlandı</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Dosya Yükleme */}
                    <div className="mt-6">
                        <Label>Dosya {!isEditMode && <span className="text-red-500">*</span>}</Label>
                        <div 
                            {...getRootProps()} 
                            className={`mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors ${
                                isDragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                            }`}
                        >
                            <input {...getInputProps()} />
                            <div className="text-center">
                                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                    {isDragActive ? 'Dosyayı buraya bırakın...' : 'Dosyayı sürükleyin veya seçmek için tıklayın'}
                                </p>
                                <p className="text-xs leading-5 text-muted-foreground">
                                    PDF, Word, Excel, resim dosyaları kabul edilir.
                                </p>
                            </div>
                        </div>
                        {(file || (isEditMode && formData.file_name)) && (
                            <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary p-3">
                                <div className="flex items-center gap-2">
                                    <File className="h-5 w-5 text-primary" />
                                    <span className="text-sm font-medium text-foreground">
                                        {file?.name || formData.file_name}
                                    </span>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6" 
                                    onClick={() => { 
                                        setFile(null); 
                                        setFormData(prev => ({...prev, file_name: null})); 
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Dokümanı Kaydet')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default UploadDocumentModal;
