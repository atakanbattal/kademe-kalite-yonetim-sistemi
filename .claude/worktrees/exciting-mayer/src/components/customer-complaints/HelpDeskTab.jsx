import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    Clock,
    Filter,
    Headphones,
    Loader2,
    MessageSquarePlus,
    Phone,
    Plus,
    Search,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { normalizeTurkishForSearch } from '@/lib/utils';
import {
    VEHICLE_CATEGORY_OPTIONS,
    CHASSIS_BRAND_OPTIONS,
    getVehicleModelsForCategory,
    getChassisModelsForBrand,
    requiresChassisSelection,
} from '@/components/customer-complaints/afterSalesConfig';
import { CustomerFormModal } from '@/components/cost-settings/CustomerFormModal';

const PRIORITY_OPTIONS = ['Düşük', 'Normal', 'Yüksek', 'Acil'];
const STATUS_OPTIONS = ['Açık', 'Beklemede', 'Çözüldü', 'Vakaya Dönüştürüldü'];
const CATEGORY_OPTIONS = ['Genel', 'Müşteri Şikayeti', 'Servis Talebi', 'Garanti Talebi', 'Teknik Destek', 'Yedek Parça', 'Bakım Talebi', 'Bilgi Talebi'];

const PRIORITY_VARIANT = {
    Düşük: 'secondary',
    Normal: 'default',
    Yüksek: 'warning',
    Acil: 'destructive',
};

const STATUS_VARIANT = {
    Açık: 'destructive',
    Beklemede: 'warning',
    Çözüldü: 'success',
    'Vakaya Dönüştürüldü': 'default',
};

const INITIAL_FORM = {
    subject: '',
    description: '',
    customer_id: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    vehicle_info: '',
    vehicle_category: '',
    vehicle_model_code: '',
    vehicle_serial_number: '',
    vehicle_chassis_number: '',
    vehicle_plate_number: '',
    chassis_brand: '',
    chassis_model: '',
    category: 'Genel',
    priority: 'Normal',
    notes: '',
};

const HelpDeskTab = ({ onConvertToCase }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customers, refreshCustomers } = useData();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');

    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [customerFormOpen, setCustomerFormOpen] = useState(false);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('after_sales_help_desk')
            .select('*, customer:customers(id, name)')
            .order('created_at', { ascending: false });
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        } else {
            setRecords(data || []);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => { loadRecords(); }, [loadRecords]);

    const filteredRecords = useMemo(() => {
        let list = records;
        if (filterStatus !== 'all') list = list.filter((r) => r.status === filterStatus);
        if (filterPriority !== 'all') list = list.filter((r) => r.priority === filterPriority);
        if (searchTerm.trim()) {
            const q = normalizeTurkishForSearch(searchTerm);
            list = list.filter((r) => {
                const haystack = normalizeTurkishForSearch(
                    [r.subject, r.description, r.contact_person, r.vehicle_info, r.vehicle_plate_number, r.vehicle_category, r.vehicle_model_code, r.vehicle_serial_number, r.vehicle_chassis_number, r.customer?.name, r.category].filter(Boolean).join(' ')
                );
                return haystack.includes(q);
            });
        }
        return list;
    }, [records, filterStatus, filterPriority, searchTerm]);

    const stats = useMemo(() => ({
        total: records.length,
        open: records.filter((r) => r.status === 'Açık').length,
        waiting: records.filter((r) => r.status === 'Beklemede').length,
        resolved: records.filter((r) => r.status === 'Çözüldü').length,
        converted: records.filter((r) => r.status === 'Vakaya Dönüştürüldü').length,
    }), [records]);

    const openNewForm = () => {
        setEditingId(null);
        setFormData(INITIAL_FORM);
        setFormOpen(true);
    };

    const openEditForm = (record) => {
        setEditingId(record.id);
        setFormData({
            subject: record.subject || '',
            description: record.description || '',
            customer_id: record.customer_id || '',
            contact_person: record.contact_person || '',
            contact_phone: record.contact_phone || '',
            contact_email: record.contact_email || '',
            vehicle_info: record.vehicle_info || '',
            vehicle_category: record.vehicle_category || '',
            vehicle_model_code: record.vehicle_model_code || '',
            vehicle_serial_number: record.vehicle_serial_number || '',
            vehicle_chassis_number: record.vehicle_chassis_number || '',
            vehicle_plate_number: record.vehicle_plate_number || '',
            chassis_brand: record.chassis_brand || '',
            chassis_model: record.chassis_model || '',
            category: record.category || 'Genel',
            priority: record.priority || 'Normal',
            notes: record.notes || '',
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!formData.subject.trim()) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Konu alanı zorunludur.' });
            return;
        }
        setIsSaving(true);
        const payload = {
            ...formData,
            customer_id: formData.customer_id || null,
            created_by: user?.id || null,
        };
        let error;
        if (editingId) {
            const { error: updateErr } = await supabase.from('after_sales_help_desk').update(payload).eq('id', editingId);
            error = updateErr;
        } else {
            const { error: insertErr } = await supabase.from('after_sales_help_desk').insert([payload]);
            error = insertErr;
        }
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        } else {
            toast({ title: 'Başarılı', description: editingId ? 'Kayıt güncellendi.' : 'Yeni kayıt oluşturuldu.' });
            setFormOpen(false);
            loadRecords();
        }
        setIsSaving(false);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from('after_sales_help_desk').delete().eq('id', deleteTarget);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        } else {
            toast({ title: 'Silindi', description: 'Kayıt silindi.' });
            loadRecords();
        }
        setDeleteTarget(null);
    };

    const handleConvert = (record) => {
        if (onConvertToCase) {
            onConvertToCase(record);
        }
    };

    const customerOptions = useMemo(
        () =>
            (customers || [])
                .map((c) => ({
                    value: c.id,
                    label: c.name || c.customer_name || '—',
                }))
                .sort((a, b) => a.label.localeCompare(b.label, 'tr')),
        [customers]
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="text-sm text-muted-foreground">Toplam</div>
                        <div className="text-2xl font-bold mt-1">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('Açık')}>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="text-sm text-muted-foreground">Açık</div>
                        <div className="text-2xl font-bold mt-1 text-red-600">{stats.open}</div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('Beklemede')}>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="text-sm text-muted-foreground">Beklemede</div>
                        <div className="text-2xl font-bold mt-1 text-amber-600">{stats.waiting}</div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('Vakaya Dönüştürüldü')}>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="text-sm text-muted-foreground">Vakaya Dönüşen</div>
                        <div className="text-2xl font-bold mt-1 text-blue-600">{stats.converted}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1 min-w-0">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            placeholder="Kayıt ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-2.5 sm:pl-10 sm:pr-3"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Öncelik</SelectItem>
                            {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={openNewForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Kayıt
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Kayıt bulunamadı.</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="text-left px-4 py-3 font-medium">Konu</th>
                                    <th className="text-left px-4 py-3 font-medium">Müşteri</th>
                                    <th className="text-left px-4 py-3 font-medium">Plaka</th>
                                    <th className="text-left px-4 py-3 font-medium">Araç</th>
                                    <th className="text-left px-4 py-3 font-medium">Kategori</th>
                                    <th className="text-left px-4 py-3 font-medium">Öncelik</th>
                                    <th className="text-left px-4 py-3 font-medium">Durum</th>
                                    <th className="text-left px-4 py-3 font-medium">Tarih</th>
                                    <th className="text-right px-4 py-3 font-medium">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((record) => (
                                    <tr key={record.id} className="border-t hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <button onClick={() => openEditForm(record)} className="text-left hover:text-primary transition-colors">
                                                <div className="font-medium">{record.subject}</div>
                                                {record.contact_person && <div className="text-xs text-muted-foreground mt-0.5">{record.contact_person}</div>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{record.customer?.name || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-medium">{record.vehicle_plate_number || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {record.vehicle_category
                                                ? <span>{record.vehicle_category}{record.vehicle_model_code ? ` / ${record.vehicle_model_code}` : ''}</span>
                                                : (record.vehicle_info || '-')}
                                        </td>
                                        <td className="px-4 py-3"><Badge variant="outline">{record.category}</Badge></td>
                                        <td className="px-4 py-3"><Badge variant={PRIORITY_VARIANT[record.priority] || 'default'}>{record.priority}</Badge></td>
                                        <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[record.status] || 'default'}>{record.status}</Badge></td>
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(record.created_at).toLocaleDateString('tr-TR')}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {record.status !== 'Vakaya Dönüştürüldü' && record.status !== 'Çözüldü' && (
                                                    <Button size="sm" variant="default" onClick={() => handleConvert(record)}>
                                                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                                                        Vakaya Dönüştür
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" onClick={() => openEditForm(record)}>Düzenle</Button>
                                                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(record.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Kaydı Düzenle' : 'Yeni Help Desk Kaydı'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Konu *</Label>
                            <Input value={formData.subject} onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))} placeholder="Kısa açıklama" />
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <Label className="sm:mb-2">Müşteri</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 gap-1"
                                        title="Ayarlar > Müşteri sekmesi ile aynı form"
                                        onClick={() => setCustomerFormOpen(true)}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Yeni müşteri
                                    </Button>
                                </div>
                                <Select value={formData.customer_id || '__none__'} onValueChange={(v) => setFormData((p) => ({ ...p, customer_id: v === '__none__' ? '' : v }))}>
                                    <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Seçiniz</SelectItem>
                                        {customerOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Kategori</Label>
                                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Öncelik</Label>
                                <Select value={formData.priority} onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Araç Kategorisi</Label>
                                <Select
                                    value={formData.vehicle_category || '__none__'}
                                    onValueChange={(v) => setFormData((p) => ({
                                        ...p,
                                        vehicle_category: v === '__none__' ? '' : v,
                                        vehicle_model_code: '',
                                        chassis_brand: '',
                                        chassis_model: '',
                                    }))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Araç kategorisi seçin" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Belirtilmedi</SelectItem>
                                        {VEHICLE_CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="hd_vehicle_plate">Plaka</Label>
                                <Input
                                    id="hd_vehicle_plate"
                                    value={formData.vehicle_plate_number}
                                    onChange={(e) => setFormData((p) => ({ ...p, vehicle_plate_number: e.target.value }))}
                                    placeholder="Plaka"
                                />
                            </div>
                        </div>
                        {formData.vehicle_category && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <Label>Model Kodu</Label>
                                    <Select
                                        value={formData.vehicle_model_code || '__none__'}
                                        onValueChange={(v) => setFormData((p) => ({ ...p, vehicle_model_code: v === '__none__' ? '' : v }))}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Model seçin" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Belirtilmedi</SelectItem>
                                            {getVehicleModelsForCategory(formData.vehicle_category).map((m) => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {requiresChassisSelection(formData.vehicle_category) && (
                                    <>
                                        <div>
                                            <Label>Şase Sağlayıcısı</Label>
                                            <Select
                                                value={formData.chassis_brand || '__none__'}
                                                onValueChange={(v) => setFormData((p) => ({ ...p, chassis_brand: v === '__none__' ? '' : v, chassis_model: '' }))}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Şase markası seçin" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Belirtilmedi</SelectItem>
                                                    {CHASSIS_BRAND_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {formData.chassis_brand && (
                                            <div>
                                                <Label>Şase Modeli</Label>
                                                <Select
                                                    value={formData.chassis_model || '__none__'}
                                                    onValueChange={(v) => setFormData((p) => ({ ...p, chassis_model: v === '__none__' ? '' : v }))}
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Şase modeli seçin" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Belirtilmedi</SelectItem>
                                                        {getChassisModelsForBrand(formData.chassis_brand).map((m) => (
                                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div>
                                    <Label>Araç Seri No</Label>
                                    <Input value={formData.vehicle_serial_number} onChange={(e) => setFormData((p) => ({ ...p, vehicle_serial_number: e.target.value }))} placeholder="Seri numarası" />
                                </div>
                                <div>
                                    <Label>Şasi No</Label>
                                    <Input value={formData.vehicle_chassis_number} onChange={(e) => setFormData((p) => ({ ...p, vehicle_chassis_number: e.target.value }))} placeholder="Şasi numarası" />
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <Label>İletişim Kişisi</Label>
                                <Input value={formData.contact_person} onChange={(e) => setFormData((p) => ({ ...p, contact_person: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Telefon</Label>
                                <Input value={formData.contact_phone} onChange={(e) => setFormData((p) => ({ ...p, contact_phone: e.target.value }))} />
                            </div>
                            <div>
                                <Label>E-posta</Label>
                                <Input value={formData.contact_email} onChange={(e) => setFormData((p) => ({ ...p, contact_email: e.target.value }))} type="email" />
                            </div>
                        </div>
                        <div>
                            <Label>Notlar</Label>
                            <Textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>İptal</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CustomerFormModal
                open={customerFormOpen}
                setOpen={setCustomerFormOpen}
                existingCustomer={null}
                onSuccess={async ({ customer }) => {
                    await refreshCustomers();
                    if (customer?.id) {
                        setFormData((prev) => ({ ...prev, customer_id: customer.id }));
                    }
                    setCustomerFormOpen(false);
                }}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                        <AlertDialogDescription>Bu kayıt kalıcı olarak silinecektir. Bu işlem geri alınamaz.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default HelpDeskTab;
