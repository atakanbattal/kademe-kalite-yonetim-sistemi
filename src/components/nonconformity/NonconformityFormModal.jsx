import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import {
  AlertCircle, ClipboardList, Hash, Package, Shield, MapPin,
  User, Building2, Calendar, Car, Layers, FileText, Wrench, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = [
  'Boyut Hatası', 'Yüzey Hatası', 'Montaj Hatası', 'Kaynak Hatası',
  'Malzeme Hatası', 'Boya Hatası', 'Eksik Parça', 'Yanlış Parça',
  'Fonksiyon Hatası', 'Görsel Hata', 'Etiketleme Hatası', 'Ambalaj Hatası', 'Diğer'
];

const DETECTION_AREAS = [
  'Girdi Kalite Kontrol', 'Hat Sonu Kontrol', 'Proses İçi Kontrol',
  'Final Kontrol', 'Müşteri İadesi', 'İç Denetim', 'Montaj Hattı',
  'Kaynak Atölyesi', 'Boya Hattı', 'Depo', 'Sevkiyat', 'Diğer'
];

const SEVERITY_OPTIONS = [
  { value: 'Düşük', color: 'text-green-600' },
  { value: 'Orta', color: 'text-yellow-600' },
  { value: 'Yüksek', color: 'text-orange-600' },
  { value: 'Kritik', color: 'text-red-600' },
];

const defaultFormData = {
  part_code: '',
  part_name: '',
  description: '',
  category: '',
  detection_area: '',
  detection_date: format(new Date(), 'yyyy-MM-dd'),
  detected_by: '',
  responsible_person: '',
  severity: 'Orta',
  action_taken: '',
  vehicle_type: '',
  quantity: 1,
  department: '',
  notes: '',
};

const NonconformityFormModal = ({ isOpen, setIsOpen, record, onSaveSuccess }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { products, productCategories } = useData();
  const [formData, setFormData] = useState(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personnel, setPersonnel] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [previewRecordNumber, setPreviewRecordNumber] = useState(null);

  const isEditMode = !!record?.id;

  const fetchNextRecordNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const prefix = `UYG-${yearPrefix}-`;
    const { data: maxRec } = await supabase
      .from('nonconformity_records')
      .select('record_number')
      .like('record_number', `${prefix}%`)
      .order('record_number', { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (maxRec?.record_number) {
      const parts = maxRec.record_number.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    setPreviewRecordNumber(`${prefix}${String(nextNum).padStart(4, '0')}`);
  }, []);

  const vehicleTypes = useMemo(() => {
    const vehicleCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    if (!vehicleCategory) return [];
    return (products || [])
      .filter(p => p.category_id === vehicleCategory.id)
      .map(p => ({ value: p.product_name, label: p.product_name }));
  }, [products, productCategories]);

  useEffect(() => {
    if (isOpen) {
      if (record) {
        setFormData({
          ...defaultFormData,
          ...record,
          detection_date: record.detection_date
            ? format(new Date(record.detection_date), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
        });
        setPreviewRecordNumber(record.record_number || null);
      } else {
        setFormData(defaultFormData);
        fetchNextRecordNumber();
      }
    }
  }, [isOpen, record, fetchNextRecordNumber]);

  useEffect(() => {
    const fetchData = async () => {
      const [personnelRes, deptRes] = await Promise.all([
        supabase.from('personnel').select('id, full_name, department').eq('is_active', true).order('full_name'),
        supabase.from('production_departments').select('*').order('name'),
      ]);
      if (personnelRes.data) setPersonnel(personnelRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
    };
    if (isOpen) fetchData();
  }, [isOpen]);

  const personnelOptions = useMemo(() =>
    personnel.map(p => ({ value: p.full_name, label: p.full_name })),
    [personnel]
  );

  const departmentOptions = useMemo(() => {
    const deptSet = new Set();
    departments.forEach(d => deptSet.add(d.name));
    personnel.forEach(p => { if (p.department) deptSet.add(p.department); });
    return Array.from(deptSet).sort().map(d => ({ value: d, label: d }));
  }, [departments, personnel]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResponsiblePersonChange = (value) => {
    const person = personnel.find(p => p.full_name === value);
    setFormData(prev => ({
      ...prev,
      responsible_person: value,
      department: person?.department ? person.department : prev.department,
    }));
  };

  const handlePersonnelChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description?.trim()) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Açıklama alanı zorunludur.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const dbData = {
        part_code: formData.part_code || null,
        part_name: formData.part_name || null,
        description: formData.description,
        category: formData.category || null,
        detection_area: formData.detection_area || null,
        detection_date: formData.detection_date ? new Date(formData.detection_date).toISOString() : new Date().toISOString(),
        detected_by: formData.detected_by || null,
        responsible_person: formData.responsible_person || null,
        severity: formData.severity || 'Orta',
        status: formData.status || 'Açık',
        action_taken: formData.action_taken || null,
        vehicle_type: formData.vehicle_type || null,
        quantity: parseInt(formData.quantity) || 1,
        department: formData.department || null,
        notes: formData.notes || null,
      };

      let result;
      if (isEditMode) {
        const { data, error } = await supabase
          .from('nonconformity_records')
          .update(dbData)
          .eq('id', record.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const yearPrefix = new Date().getFullYear().toString().slice(-2);
        const prefix = `UYG-${yearPrefix}-`;
        const { data: maxRec } = await supabase
          .from('nonconformity_records')
          .select('record_number')
          .like('record_number', `${prefix}%`)
          .order('record_number', { ascending: false })
          .limit(1)
          .single();

        let nextNum = 1;
        if (maxRec?.record_number) {
          const parts = maxRec.record_number.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
        dbData.record_number = `${prefix}${String(nextNum).padStart(4, '0')}`;
        dbData.created_by = user?.id || null;

        const { data, error } = await supabase
          .from('nonconformity_records')
          .insert(dbData)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) {
        toast({ variant: 'destructive', title: 'Hata', description: result.error.message });
      } else {
        toast({ title: 'Başarılı', description: `Uygunsuzluk kaydı ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
        if (onSaveSuccess) onSaveSuccess(result.data);
        setIsOpen(false);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Hata', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityColor = formData?.severity === 'Kritik' ? 'text-red-600' :
    formData?.severity === 'Yüksek' ? 'text-orange-600' :
    formData?.severity === 'Orta' ? 'text-yellow-600' : 'text-green-600';

  const severityBg = formData?.severity === 'Kritik' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
    formData?.severity === 'Yüksek' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
    formData?.severity === 'Orta' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';

  const displayRecordNumber = isEditMode ? formData?.record_number : previewRecordNumber;

  const SummaryRow = ({ icon: Icon, label, value, highlight, className = '' }) => (
    <div className={`flex items-start gap-2.5 py-1.5 ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-xs font-semibold truncate ${highlight || 'text-foreground'}`}>
          {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
        </p>
      </div>
    </div>
  );

  const rightPanel = (
    <div className="p-5 space-y-4">
      {/* Kayıt No Kartı */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
        <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none">
          <ClipboardList className="w-20 h-20" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Uygunsuzluk No</p>
        </div>
        <p className="text-xl font-bold text-foreground font-mono tracking-wide">
          {displayRecordNumber || '...'}
        </p>
        {!isEditMode && (
          <p className="text-[10px] text-muted-foreground mt-1">Kayıt oluşturulduğunda atanacak</p>
        )}
      </div>

      {/* Durum Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-[10px] ${severityBg}`}>
          <Shield className="w-3 h-3 mr-1" />
          {formData?.severity || 'Orta'}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {isEditMode ? formData?.status || 'Açık' : 'Açık'}
        </Badge>
      </div>

      <Separator className="my-1" />

      {/* Parça & Ürün */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Package className="w-3 h-3" /> Parça Bilgileri
        </p>
        <div className="space-y-0.5 pl-1">
          <SummaryRow icon={null} label="Parça Kodu" value={formData?.part_code} highlight="text-primary font-mono" />
          <SummaryRow icon={null} label="Parça Adı" value={formData?.part_name} />
          <SummaryRow icon={null} label="Araç Tipi" value={formData?.vehicle_type} />
          <SummaryRow icon={null} label="Hatalı Adet" value={formData?.quantity} highlight={parseInt(formData?.quantity) > 10 ? 'text-red-600' : undefined} />
        </div>
      </div>

      <Separator className="my-1" />

      {/* Hata Detayları */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Hata Detayları
        </p>
        <div className="space-y-0.5 pl-1">
          <SummaryRow icon={null} label="Kategori" value={formData?.category} />
          <SummaryRow icon={null} label="Ciddiyet" value={formData?.severity} highlight={severityColor} />
          <SummaryRow icon={null} label="Tespit Alanı" value={formData?.detection_area} />
        </div>
      </div>

      <Separator className="my-1" />

      {/* Personel */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <User className="w-3 h-3" /> Personel & Birim
        </p>
        <div className="space-y-0.5 pl-1">
          <SummaryRow icon={null} label="Sorumlu Birim" value={formData?.department} />
          <SummaryRow icon={null} label="Raporlayan" value={formData?.detected_by} />
          <SummaryRow icon={null} label="Sorumlu Kişi" value={formData?.responsible_person} />
        </div>
      </div>

      <Separator className="my-1" />

      {/* Tarih */}
      <div className="flex items-start gap-2.5">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tespit Tarihi</p>
          <p className="text-xs font-semibold text-foreground">
            {formData?.detection_date ? new Date(formData.detection_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
          </p>
        </div>
      </div>

      {/* Açıklama Önizleme */}
      {formData?.description && (
        <>
          <Separator className="my-1" />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Açıklama
            </p>
            <p className="text-[11px] text-foreground leading-relaxed line-clamp-4 bg-muted/30 rounded-lg p-2.5 border">
              {formData.description}
            </p>
          </div>
        </>
      )}

      {/* Acil Aksiyon Önizleme */}
      {formData?.action_taken && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Acil Aksiyon
          </p>
          <p className="text-[11px] text-foreground leading-relaxed line-clamp-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
            {formData.action_taken}
          </p>
        </div>
      )}

      {/* Notlar Önizleme */}
      {formData?.notes && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Notlar
          </p>
          <p className="text-[11px] text-foreground leading-relaxed line-clamp-2 bg-muted/30 rounded-lg p-2.5 border">
            {formData.notes}
          </p>
        </div>
      )}

      {/* Bilgi Notu */}
      <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2 border border-amber-100 dark:border-amber-800">
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
          Aynı parça kodunda eşik aşıldığında otomatik DF/8D önerisi yapılır.
        </p>
      </div>
    </div>
  );

  return (
    <ModernModalLayout
      open={isOpen}
      onOpenChange={setIsOpen}
      title={isEditMode ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Kaydı'}
      subtitle="Uygunsuzluk Yönetimi"
      icon={<ClipboardList className="h-5 w-5 text-white" />}
      badge={isEditMode ? 'Düzenleme' : 'Yeni'}
      onCancel={() => setIsOpen(false)}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel={isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet'}
      cancelLabel="İptal"
      formId="nc-record-form"
      footerDate={formData?.detection_date}
      rightPanel={rightPanel}
    >
      <form id="nc-record-form" onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
        <ScrollArea className="flex-grow pr-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4">

            {/* Parça Bilgileri */}
            <div>
              <Label htmlFor="part_code">Parça Kodu</Label>
              <Input id="part_code" value={formData.part_code} onChange={handleChange} placeholder="Parça kodunu girin" />
            </div>
            <div>
              <Label htmlFor="part_name">Parça Adı</Label>
              <Input id="part_name" value={formData.part_name} onChange={handleChange} placeholder="Parça adını girin" />
            </div>

            {/* Açıklama */}
            <div className="md:col-span-2">
              <Label htmlFor="description">Uygunsuzluk Açıklaması <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Tespit edilen uygunsuzluğu detaylı açıklayın..."
              />
            </div>

            {/* Kategori & Ciddiyet */}
            <div>
              <Label>Hata Kategorisi</Label>
              <Select value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
                <SelectTrigger><SelectValue placeholder="Kategori seçin..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciddiyet</Label>
              <Select value={formData.severity} onValueChange={(v) => handleSelectChange('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={s.color}>{s.value}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sorumlu Birim & Tespit Alanı */}
            <div>
              <Label>Sorumlu Birim <span className="text-red-500">*</span></Label>
              {departmentOptions.length > 0 ? (
                <SearchableSelectDialog
                  options={departmentOptions}
                  value={formData.department}
                  onChange={(value) => handleSelectChange('department', value)}
                  triggerPlaceholder="Uygunsuzluğun yazılacağı birimi seçin..."
                  dialogTitle="Sorumlu Birim Seç"
                  searchPlaceholder="Birim ara..."
                  notFoundText="Birim bulunamadı."
                />
              ) : (
                <Input id="department" value={formData.department} onChange={handleChange} placeholder="Birim adını yazın" />
              )}
            </div>
            <div>
              <Label>Tespit Alanı</Label>
              <Select value={formData.detection_area} onValueChange={(v) => handleSelectChange('detection_area', v)}>
                <SelectTrigger><SelectValue placeholder="Nerede tespit edildi?" /></SelectTrigger>
                <SelectContent>
                  {DETECTION_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Raporlayan Kişi & Sorumlu Kişi */}
            <div>
              <Label>Raporlayan Kişi</Label>
              {personnelOptions.length > 0 ? (
                <SearchableSelectDialog
                  options={personnelOptions}
                  value={formData.detected_by}
                  onChange={(value) => handlePersonnelChange('detected_by', value)}
                  triggerPlaceholder="Uygunsuzluğu tespit eden kişi..."
                  dialogTitle="Raporlayan Kişi Seç"
                  searchPlaceholder="İsim ile ara..."
                  notFoundText="Personel bulunamadı."
                />
              ) : (
                <div className="flex items-center gap-2 p-2 border border-destructive/50 rounded-md bg-destructive/10">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">Personel listesi yükleniyor...</span>
                </div>
              )}
            </div>
            <div>
              <Label>Sorumlu Kişi</Label>
              {personnelOptions.length > 0 ? (
                <SearchableSelectDialog
                  options={personnelOptions}
                  value={formData.responsible_person}
                  onChange={handleResponsiblePersonChange}
                  triggerPlaceholder="DF/8D sorumlusu olacak kişi..."
                  dialogTitle="Sorumlu Kişi Seç"
                  searchPlaceholder="İsim ile ara..."
                  notFoundText="Personel bulunamadı."
                />
              ) : (
                <Input id="responsible_person" value={formData.responsible_person} onChange={handleChange} placeholder="Sorumlu kişiyi girin" />
              )}
            </div>

            {/* Tespit Tarihi & Adet */}
            <div>
              <Label htmlFor="detection_date">Tespit Tarihi</Label>
              <Input id="detection_date" type="date" value={formData.detection_date} onChange={handleChange} />
            </div>

            {/* Araç Tipi & Adet */}
            <div>
              <Label>Araç Tipi</Label>
              {vehicleTypes.length > 0 ? (
                <SearchableSelectDialog
                  options={vehicleTypes}
                  value={formData.vehicle_type}
                  onChange={(value) => handleSelectChange('vehicle_type', value)}
                  triggerPlaceholder="Araç tipi seçin..."
                  dialogTitle="Araç Tipi Seç"
                  searchPlaceholder="Araç tipi ara..."
                  notFoundText="Araç tipi bulunamadı."
                  allowClear
                />
              ) : (
                <Input id="vehicle_type" value={formData.vehicle_type} onChange={handleChange} placeholder="Araç tipini girin" />
              )}
            </div>
            <div>
              <Label htmlFor="quantity">Adet</Label>
              <Input id="quantity" type="number" min="1" value={formData.quantity} onChange={handleChange} />
            </div>

            {/* Acil Aksiyon */}
            <div className="md:col-span-2">
              <Label htmlFor="action_taken">Alınan Acil Aksiyon</Label>
              <Textarea
                id="action_taken"
                value={formData.action_taken}
                onChange={handleChange}
                rows={2}
                placeholder="Uygunsuzluk tespit edildiğinde alınan anlık aksiyonlar..."
              />
            </div>

            {/* Ek Notlar */}
            <div className="md:col-span-2">
              <Label htmlFor="notes">Ek Notlar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Ek bilgi veya notlar..."
              />
            </div>
          </div>
        </ScrollArea>
      </form>
    </ModernModalLayout>
  );
};

export default NonconformityFormModal;
