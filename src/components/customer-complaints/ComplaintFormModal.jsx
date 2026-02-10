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
import { AlertCircle, Package, Users, Calendar } from 'lucide-react';

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
    const rightPanel = (
        <div className="p-6 space-y-5">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Şikayet Özeti</h2>
            <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none"><Package className="w-20 h-20" /></div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Şikayet</p>
                <p className="text-lg font-bold text-foreground truncate">{formData.title || '-'}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{customerName}</p>
            </div>
            <div className="space-y-2.5">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Durum:</span><span className="font-semibold text-foreground">{formData.status || '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Önem:</span><span className="font-semibold text-foreground">{formData.severity || '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Öncelik:</span><span className="font-semibold text-foreground">{formData.priority || '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tarih:</span><span className="font-semibold text-foreground">{formData.complaint_date ? new Date(formData.complaint_date).toLocaleDateString('tr-TR') : '-'}</span></div>
            </div>
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
