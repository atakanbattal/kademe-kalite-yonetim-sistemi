import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { AlertCircle, ClipboardList } from 'lucide-react';
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

  const isEditMode = !!record?.id;

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
      } else {
        setFormData(defaultFormData);
      }
    }
  }, [isOpen, record]);

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
        const { data: recNum } = await supabase.rpc('generate_nonconformity_number');
        dbData.record_number = recNum;
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

  const rightPanel = (
    <div className="p-6 space-y-5">
      <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Kayıt Özeti</h2>

      <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
        <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none">
          <ClipboardList className="w-20 h-20" />
        </div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Kayıt No</p>
        <p className="text-lg font-bold text-foreground">{formData?.record_number || 'Otomatik'}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{formData?.part_code || 'Parça kodu girilmedi'}</p>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Ciddiyet:</span>
          <span className={`font-semibold ${
            formData?.severity === 'Kritik' ? 'text-red-600' :
            formData?.severity === 'Yüksek' ? 'text-orange-600' :
            formData?.severity === 'Orta' ? 'text-yellow-600' : 'text-green-600'
          }`}>{formData?.severity || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Kategori:</span>
          <span className="font-semibold text-foreground truncate ml-2">{formData?.category || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Sorumlu Birim:</span>
          <span className="font-semibold text-foreground truncate ml-2">{formData?.department || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tespit Alanı:</span>
          <span className="font-semibold text-foreground truncate ml-2">{formData?.detection_area || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Raporlayan:</span>
          <span className="font-semibold text-foreground truncate ml-2">{formData?.detected_by || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Sorumlu Kişi:</span>
          <span className="font-semibold text-foreground truncate ml-2">{formData?.responsible_person || '-'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Adet:</span>
          <span className="font-semibold text-foreground">{formData?.quantity || 1}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tespit Tarihi:</span>
          <span className="font-semibold text-foreground">
            {formData?.detection_date ? new Date(formData.detection_date).toLocaleDateString('tr-TR') : '-'}
          </span>
        </div>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2.5 border border-amber-100 dark:border-amber-800">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          Aynı parça kodunda belirlenen eşik değeri aşıldığında otomatik olarak DF veya 8D önerisi yapılacaktır.
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
