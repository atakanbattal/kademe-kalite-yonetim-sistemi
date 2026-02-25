import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Package, Users, Calendar, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const COMPLAINT_SOURCES = [
    'Email', 'Telefon', 'Portal', 'Saha Ziyareti', 'Toplantı', 'Diğer'
];

const COMPLAINT_CATEGORIES = [
    'Ürün Kalitesi', 'Teslimat', 'Dokümantasyon', 'Hizmet', 
    'Paketleme', 'İletişim', 'Fiyatlandırma', 'Diğer'
];

// ISO 10002 gereklilikleri için şikayet sınıflandırması
const COMPLAINT_CLASSIFICATIONS = [
    { value: 'Ürün', label: 'Ürün' },
    { value: 'Servis', label: 'Servis' },
    { value: 'Montaj', label: 'Montaj' },
    { value: 'Yanlış Kullanım', label: 'Yanlış Kullanım' },
    { value: 'Diğer', label: 'Diğer' }
];

// SLA süreleri (saat cinsinden)
const SLA_DURATIONS = {
    'Kritik': { firstResponse: 24, resolution: 72 },
    'Yüksek': { firstResponse: 48, resolution: 120 },
    'Orta': { firstResponse: 72, resolution: 168 },
    'Düşük': { firstResponse: 120, resolution: 240 } // 5 iş günü = 120 saat
};

const SEVERITIES = ['Kritik', 'Yüksek', 'Orta', 'Düşük'];
const PRIORITIES = ['Acil', 'Yüksek', 'Normal', 'Düşük'];

const ComplaintFormModal = ({ open, setOpen, existingComplaint, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customers, personnel, unitCostSettings, nonConformities, deviations } = useData();
    const isEditMode = !!existingComplaint;
    
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debug: Personel verisi kontrolü
    useEffect(() => {
        if (open) {
            console.log('ComplaintFormModal - Personnel Data:', {
                personnelCount: personnel?.length || 0,
                activeCount: personnel?.filter(p => p.is_active)?.length || 0,
                firstThree: personnel?.slice(0, 3),
                unitCostCount: unitCostSettings?.length || 0,
                customersCount: customers?.length || 0
            });
        }
    }, [open, personnel, unitCostSettings, customers]);

    useEffect(() => {
        const initialData = {
            customer_id: '',
            complaint_date: new Date().toISOString().split('T')[0],
            title: '',
            description: '',
            complaint_source: 'Email',
            complaint_category: 'Ürün Kalitesi',
            severity: 'Orta',
            priority: 'Normal',
            status: 'Açık',
            product_code: '',
            product_name: '',
            batch_number: '',
            quantity_affected: '',
            production_date: '',
            responsible_department_id: '',
            responsible_personnel_id: '',
            assigned_to_id: '',
            target_close_date: '',
            customer_impact: '',
            financial_impact: '',
            related_nc_id: '',
            related_deviation_id: ''
        };

        if (isEditMode) {
            setFormData({
                ...existingComplaint,
                complaint_date: existingComplaint.complaint_date?.split('T')[0] || '',
                production_date: existingComplaint.production_date || '',
                target_close_date: existingComplaint.target_close_date || '',
            });
        } else {
            setFormData(initialData);
        }
    }, [existingComplaint, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.customer_id || !formData.title || !formData.description) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Müşteri, başlık ve açıklama alanları zorunludur.'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { 
                id, created_at, updated_at, complaint_number,
                customer, responsible_person, assigned_to, responsible_department,
                ...dataToSubmit 
            } = formData;

            // Boş string değerleri null'a çevir
            Object.keys(dataToSubmit).forEach(key => {
                if (dataToSubmit[key] === '') {
                    dataToSubmit[key] = null;
                }
            });

            // Sayısal değerleri dönüştür
            if (dataToSubmit.quantity_affected) {
                dataToSubmit.quantity_affected = parseInt(dataToSubmit.quantity_affected);
            }
            if (dataToSubmit.financial_impact) {
                dataToSubmit.financial_impact = parseFloat(dataToSubmit.financial_impact);
            }

            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dataToSubmit) {
                if (dataToSubmit[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = dataToSubmit[key];
                }
            }

            let result;
            if (isEditMode) {
                result = await supabase
                    .from('customer_complaints')
                    .update(cleanedData)
                    .eq('id', existingComplaint.id)
                    .select()
                    .single();
            } else {
                // Yeni şikayet için created_by ekle
                cleanedData.created_by = user?.id;
                
                result = await supabase
                    .from('customer_complaints')
                    .insert([cleanedData])
                    .select()
                    .single();
            }

            if (result.error) {
                throw result.error;
            }

            toast({
                title: 'Başarılı!',
                description: `Şikayet başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.`,
                duration: 3000,
            });

            // Modal'ı kapat ve callback'i çağır
            setOpen(false);
            if (onSuccess) {
                onSuccess(result.data);
            }
        } catch (error) {
            console.error('❌ Complaint save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Şikayet ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message || 'Bilinmeyen hata'}`,
                duration: 5000,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Seçenekleri hazırla
    const customerOptions = (customers || [])
        .filter(c => c.is_active !== false) // is_active undefined veya true ise göster
        .map(c => ({ 
            value: c.id, 
            label: `${c.name || c.customer_name || 'İsimsiz Müşteri'} ${c.customer_code ? `(${c.customer_code})` : ''}`.trim()
        }));

    const personnelOptions = (personnel || [])
        .filter(p => p.is_active)
        .map(p => ({ 
            value: p.id, 
            label: p.full_name 
        }));

    const departmentOptions = (unitCostSettings || []).map(u => ({
        value: u.id,
        label: u.unit_name
    }));

    const ncOptions = (nonConformities || [])
        .filter(nc => nc.status !== 'Kapalı')
        .map(nc => ({
            value: nc.id,
            label: `${nc.nc_number || nc.id.substring(0, 8)} - ${nc.title}`
        }));

    const deviationOptions = (deviations || [])
        .filter(d => d.status !== 'Kapalı')
        .map(d => ({
            value: d.id,
            label: `${d.deviation_number || d.id.substring(0, 8)} - ${d.title}`
        }));

    const customerName = (customers || []).find(c => c.id === formData.customer_id)?.name || (customers || []).find(c => c.id === formData.customer_id)?.customer_name || '-';
    const responsiblePersonName = formData.responsible_person || personnelOptions.find(p => p.value === formData.responsible_personnel_id)?.label;
    const responsibleDepartmentName = formData.responsible_department || departmentOptions.find(d => d.value === formData.responsible_department_id)?.label;

    const rightPanel = (
        <div className="p-5 space-y-4">
            {/* Şikayet Kartı */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><Package className="w-20 h-20" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Müşteri Şikayeti</p>
                </div>
                <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{formData.title || '-'}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{customerName}</p>
            </div>

            {/* Durum Badges */}
            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{formData.status || 'Açık'}</Badge>
                {formData.severity && (
                    <Badge className={`text-[10px] ${
                        formData.severity === 'Kritik' ? 'bg-red-100 text-red-800' :
                        formData.severity === 'Yüksek' ? 'bg-orange-100 text-orange-800' :
                        formData.severity === 'Orta' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>{formData.severity}</Badge>
                )}
                {formData.priority && (
                    <Badge variant="outline" className={`text-[10px] ${
                        formData.priority === 'Acil' ? 'border-red-300 text-red-700' : ''
                    }`}>{formData.priority}</Badge>
                )}
            </div>

            <Separator className="my-1" />

            {/* Ürün Bilgileri */}
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Ürün Bilgileri
                </p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Parça Kodu', value: formData.product_code, highlight: 'text-primary font-mono' },
                        { label: 'Parça Adı', value: formData.product_name },
                        { label: 'Araç Tipi', value: formData.vehicle_type },
                        { label: 'Adet', value: formData.quantity_affected },
                    ].map(({ label, value, highlight }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className={`text-xs font-semibold truncate ${highlight || 'text-foreground'}`}>
                                {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="my-1" />

            {/* Şikayet Detayları */}
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Şikayet Detayları
                </p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Şikayet Kaynağı', value: formData.complaint_source },
                        { label: 'Şikayet Tipi', value: formData.complaint_type },
                        { label: 'Kategori', value: formData.complaint_category },
                        { label: 'Sorumlu Kişi', value: responsiblePersonName },
                        { label: 'Sorumlu Birim', value: responsibleDepartmentName },
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

            {/* Tarih */}
            <div className="flex items-start gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Şikayet Tarihi</p>
                    <p className="text-xs font-semibold text-foreground">
                        {formData.complaint_date ? new Date(formData.complaint_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    </p>
                </div>
            </div>

            {/* Açıklama Önizleme */}
            {formData.description && (
                <>
                    <Separator className="my-1" />
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Açıklama</p>
                        <p className="text-[11px] text-foreground leading-relaxed line-clamp-4 bg-muted/30 rounded-lg p-2.5 border">
                            {formData.description}
                        </p>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <ModernModalLayout
            open={open}
            onOpenChange={setOpen}
            title={isEditMode ? 'Şikayet Düzenle' : 'Yeni Müşteri Şikayeti'}
            subtitle="Müşteri Şikayetleri"
            icon={<AlertCircle className="h-5 w-5 text-white" />}
            badge={isEditMode ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Kaydet"
            cancelLabel="İptal"
            formId="complaint-form"
            footerDate={formData.complaint_date}
            rightPanel={rightPanel}
        >
                <form id="complaint-form" onSubmit={handleSubmit} className="space-y-6 py-4">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Temel Bilgiler
                            </TabsTrigger>
                            <TabsTrigger value="product">
                                <Package className="w-4 h-4 mr-2" />
                                Ürün Bilgileri
                            </TabsTrigger>
                            <TabsTrigger value="responsibility">
                                <Users className="w-4 h-4 mr-2" />
                                Sorumluluk
                            </TabsTrigger>
                            <TabsTrigger value="additional">
                                <Calendar className="w-4 h-4 mr-2" />
                                Ek Bilgiler
                            </TabsTrigger>
                        </TabsList>

                        {/* Temel Bilgiler */}
                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <Label htmlFor="customer_id">
                                        Müşteri <span className="text-red-500">*</span>
                                    </Label>
                                    <SearchableSelectDialog
                                        options={customerOptions}
                                        value={formData.customer_id || ''}
                                        onChange={(val) => handleSelectChange('customer_id', val)}
                                        triggerPlaceholder="Müşteri seçin..."
                                        dialogTitle="Müşteri Seç"
                                        searchPlaceholder="Müşteri ara..."
                                        notFoundText="Müşteri bulunamadı."
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="complaint_date">
                                        Şikayet Tarihi <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="complaint_date"
                                        type="date"
                                        value={formData.complaint_date || ''}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="complaint_source">Şikayet Kaynağı</Label>
                                    <Select
                                        value={formData.complaint_source || 'Email'}
                                        onValueChange={(val) => handleSelectChange('complaint_source', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMPLAINT_SOURCES.map(source => (
                                                <SelectItem key={source} value={source}>
                                                    {source}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="complaint_category">Şikayet Kategorisi</Label>
                                    <Select
                                        value={formData.complaint_category || 'Ürün Kalitesi'}
                                        onValueChange={(val) => handleSelectChange('complaint_category', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMPLAINT_CATEGORIES.map(cat => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="severity">
                                        Önem Seviyesi <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={formData.severity || 'Orta'}
                                        onValueChange={(val) => handleSelectChange('severity', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SEVERITIES.map(sev => (
                                                <SelectItem key={sev} value={sev}>
                                                    {sev}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="title">
                                        Başlık <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="title"
                                        value={formData.title || ''}
                                        onChange={handleChange}
                                        required
                                        placeholder="Şikayet başlığı"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="description">
                                        Açıklama <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description || ''}
                                        onChange={handleChange}
                                        required
                                        rows={5}
                                        placeholder="Şikayetin detaylı açıklaması..."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Ürün Bilgileri */}
                        <TabsContent value="product" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="product_code">Ürün/Parça Kodu</Label>
                                    <Input
                                        id="product_code"
                                        value={formData.product_code || ''}
                                        onChange={handleChange}
                                        placeholder="Örn: PRD-001"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="product_name">Ürün/Parça Adı</Label>
                                    <Input
                                        id="product_name"
                                        value={formData.product_name || ''}
                                        onChange={handleChange}
                                        placeholder="Ürün adı"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="batch_number">Parti/Lot Numarası</Label>
                                    <Input
                                        id="batch_number"
                                        value={formData.batch_number || ''}
                                        onChange={handleChange}
                                        placeholder="LOT-2024-001"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="production_date">Üretim Tarihi</Label>
                                    <Input
                                        id="production_date"
                                        type="date"
                                        value={formData.production_date || ''}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="quantity_affected">Etkilenen Miktar</Label>
                                    <Input
                                        id="quantity_affected"
                                        type="number"
                                        min="0"
                                        value={formData.quantity_affected || ''}
                                        onChange={handleChange}
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="financial_impact">Finansal Etki (TL)</Label>
                                    <Input
                                        id="financial_impact"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.financial_impact || ''}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor="customer_impact">Müşteri Etkisi</Label>
                                    <Textarea
                                        id="customer_impact"
                                        value={formData.customer_impact || ''}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Şikayetin müşteri üzerindeki etkisi..."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Sorumluluk */}
                        <TabsContent value="responsibility" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="responsible_department_id">Sorumlu Departman</Label>
                                    <SearchableSelectDialog
                                        options={departmentOptions}
                                        value={formData.responsible_department_id || ''}
                                        onChange={(val) => handleSelectChange('responsible_department_id', val)}
                                        triggerPlaceholder="Departman seçin..."
                                        dialogTitle="Departman Seç"
                                        searchPlaceholder="Departman ara..."
                                        notFoundText="Departman bulunamadı."
                                        allowClear
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="responsible_personnel_id">Sorumlu Kişi</Label>
                                    <SearchableSelectDialog
                                        options={personnelOptions}
                                        value={formData.responsible_personnel_id || ''}
                                        onChange={(val) => handleSelectChange('responsible_personnel_id', val)}
                                        triggerPlaceholder="Sorumlu seçin..."
                                        dialogTitle="Sorumlu Seç"
                                        searchPlaceholder="Personel ara..."
                                        notFoundText="Personel bulunamadı."
                                        allowClear
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="assigned_to_id">Atanan Kişi</Label>
                                    <SearchableSelectDialog
                                        options={personnelOptions}
                                        value={formData.assigned_to_id || ''}
                                        onChange={(val) => handleSelectChange('assigned_to_id', val)}
                                        triggerPlaceholder="Atanan kişi seçin..."
                                        dialogTitle="Kişi Seç"
                                        searchPlaceholder="Personel ara..."
                                        notFoundText="Personel bulunamadı."
                                        allowClear
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="priority">Öncelik</Label>
                                    <Select
                                        value={formData.priority || 'Normal'}
                                        onValueChange={(val) => handleSelectChange('priority', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRIORITIES.map(pri => (
                                                <SelectItem key={pri} value={pri}>
                                                    {pri}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="status">Durum</Label>
                                    <Select
                                        value={formData.status || 'Açık'}
                                        onValueChange={(val) => handleSelectChange('status', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Açık">Açık</SelectItem>
                                            <SelectItem value="Analiz Aşamasında">Analiz Aşamasında</SelectItem>
                                            <SelectItem value="Aksiyon Alınıyor">Aksiyon Alınıyor</SelectItem>
                                            <SelectItem value="Doğrulama Bekleniyor">Doğrulama Bekleniyor</SelectItem>
                                            <SelectItem value="Kapalı">Kapalı</SelectItem>
                                            <SelectItem value="İptal">İptal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="target_close_date">Hedef Kapanış Tarihi</Label>
                                    <Input
                                        id="target_close_date"
                                        type="date"
                                        value={formData.target_close_date || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Ek Bilgiler */}
                        <TabsContent value="additional" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <Label htmlFor="related_nc_id">İlişkili Uygunsuzluk</Label>
                                    <SearchableSelectDialog
                                        options={ncOptions}
                                        value={formData.related_nc_id || ''}
                                        onChange={(val) => handleSelectChange('related_nc_id', val)}
                                        triggerPlaceholder="Uygunsuzluk seçin..."
                                        dialogTitle="Uygunsuzluk Seç"
                                        searchPlaceholder="Uygunsuzluk ara..."
                                        notFoundText="Uygunsuzluk bulunamadı."
                                        allowClear
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Bu şikayetle ilişkili bir uygunsuzluk kaydı varsa seçin
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="related_deviation_id">İlişkili Sapma</Label>
                                    <SearchableSelectDialog
                                        options={deviationOptions}
                                        value={formData.related_deviation_id || ''}
                                        onChange={(val) => handleSelectChange('related_deviation_id', val)}
                                        triggerPlaceholder="Sapma seçin..."
                                        dialogTitle="Sapma Seç"
                                        searchPlaceholder="Sapma ara..."
                                        notFoundText="Sapma bulunamadı."
                                        allowClear
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Bu şikayetle ilişkili bir sapma kaydı varsa seçin
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </form>
        </ModernModalLayout>
    );
};

export default ComplaintFormModal;
