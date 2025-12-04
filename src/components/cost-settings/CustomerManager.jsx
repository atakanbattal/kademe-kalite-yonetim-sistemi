import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Trash2, Plus, Edit, Search, Building2, Mail, Phone, 
    MapPin, Calendar, DollarSign, TrendingUp, AlertCircle,
    FileText, Users
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
    AlertDialog, AlertDialogAction, AlertDialogCancel, 
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter, 
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CUSTOMER_TYPES = [
    'OEM',
    'Tier 1',
    'Tier 2',
    'Perakende',
    'Distribütör',
    'Diğer'
];

const CustomerFormModal = ({ open, setOpen, onSuccess, existingCustomer }) => {
    const { toast } = useToast();
    const isEditMode = !!existingCustomer;
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData = {
            name: '',
            customer_type: 'OEM',
            contact_person: '',
            contact_email: '',
            contact_phone: '',
            address: '',
            city: '',
            country: 'Türkiye',
            tax_number: '',
            contract_start_date: '',
            contract_end_date: '',
            annual_revenue: '',
            payment_terms: '',
            notes: '',
            is_active: true
        };
        
        if (isEditMode) {
            setFormData({ 
                ...existingCustomer,
                contract_start_date: existingCustomer.contract_start_date || '',
                contract_end_date: existingCustomer.contract_end_date || '',
            });
        } else {
            setFormData(initialData);
        }
    }, [existingCustomer, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleCheckboxChange = (id, checked) => {
        setFormData(prev => ({ ...prev, [id]: checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name) {
            toast({ 
                variant: 'destructive', 
                title: 'Eksik Bilgi', 
                description: 'Müşteri adı zorunludur.' 
            });
            return;
        }

        setIsSubmitting(true);
        
        const { id, created_at, updated_at, ...dataToSubmit } = formData;
        
        // Boş string değerleri null'a çevir
        Object.keys(dataToSubmit).forEach(key => {
            if (dataToSubmit[key] === '') {
                dataToSubmit[key] = null;
            }
        });

        let error;
        if (isEditMode) {
            const { error: updateError } = await supabase
                .from('customers')
                .update(dataToSubmit)
                .eq('id', existingCustomer.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('customers')
                .insert([dataToSubmit]);
            error = insertError;
        }

        if (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata!', 
                description: `Müşteri ${isEditMode ? 'güncellenemedi' : 'eklenemedi'}: ${error.message}` 
            });
        } else {
            toast({ 
                title: 'Başarılı!', 
                description: `Müşteri başarıyla ${isEditMode ? 'güncellendi' : 'eklendi'}.` 
            });
            onSuccess();
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
                    </DialogTitle>
                    <DialogDescription>
                        Müşteri bilgilerini ekleyin veya güncelleyin
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                            <TabsTrigger value="contact">İletişim</TabsTrigger>
                            <TabsTrigger value="business">İş Bilgileri</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name">
                                        Müşteri Adı <span className="text-red-500">*</span>
                                    </Label>
                                    <Input 
                                        id="name" 
                                        value={formData.name || ''} 
                                        onChange={handleChange} 
                                        required 
                                        placeholder="Firma ünvanı"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="customer_type">Müşteri Tipi</Label>
                                    <Select 
                                        value={formData.customer_type || 'OEM'} 
                                        onValueChange={(val) => handleSelectChange('customer_type', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CUSTOMER_TYPES.map(type => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="tax_number">Vergi Numarası</Label>
                                    <Input 
                                        id="tax_number" 
                                        value={formData.tax_number || ''} 
                                        onChange={handleChange} 
                                        placeholder="VKN / TCKN"
                                    />
                                </div>
                                <div className="flex items-center space-x-2 pt-6">
                                    <Checkbox 
                                        id="is_active" 
                                        checked={!!formData.is_active} 
                                        onCheckedChange={(c) => handleCheckboxChange('is_active', c)} 
                                    />
                                    <Label htmlFor="is_active">Aktif Müşteri</Label>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="contact" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contact_person">Yetkili Kişi</Label>
                                    <Input 
                                        id="contact_person" 
                                        value={formData.contact_person || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ad Soyad"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contact_email">Email</Label>
                                    <Input 
                                        id="contact_email" 
                                        type="email"
                                        value={formData.contact_email || ''} 
                                        onChange={handleChange} 
                                        placeholder="email@domain.com"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contact_phone">Telefon</Label>
                                    <Input 
                                        id="contact_phone" 
                                        value={formData.contact_phone || ''} 
                                        onChange={handleChange} 
                                        placeholder="+90 (555) 123 45 67"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="city">Şehir</Label>
                                    <Input 
                                        id="city" 
                                        value={formData.city || ''} 
                                        onChange={handleChange} 
                                        placeholder="İstanbul"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="country">Ülke</Label>
                                    <Input 
                                        id="country" 
                                        value={formData.country || 'Türkiye'} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="address">Adres</Label>
                                    <Textarea 
                                        id="address" 
                                        value={formData.address || ''} 
                                        onChange={handleChange} 
                                        rows={3}
                                        placeholder="Tam adres"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="business" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contract_start_date">Sözleşme Başlangıç</Label>
                                    <Input 
                                        id="contract_start_date" 
                                        type="date"
                                        value={formData.contract_start_date || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contract_end_date">Sözleşme Bitiş</Label>
                                    <Input 
                                        id="contract_end_date" 
                                        type="date"
                                        value={formData.contract_end_date || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="annual_revenue">Yıllık Ciro (TL)</Label>
                                    <Input 
                                        id="annual_revenue" 
                                        type="number"
                                        step="0.01"
                                        value={formData.annual_revenue || ''} 
                                        onChange={handleChange} 
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="payment_terms">Ödeme Koşulları</Label>
                                    <Input 
                                        id="payment_terms" 
                                        value={formData.payment_terms || ''} 
                                        onChange={handleChange} 
                                        placeholder="Örn: 30 gün vadeli"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea 
                                        id="notes" 
                                        value={formData.notes || ''} 
                                        onChange={handleChange} 
                                        rows={4}
                                        placeholder="Ek bilgiler, özel notlar..."
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setOpen(false)}
                        >
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const CustomerDetailCard = ({ customer, onEdit, onClose }) => {
    const [stats, setStats] = useState({
        totalComplaints: 0,
        openComplaints: 0,
        criticalComplaints: 0,
        avgResolutionDays: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!customer?.id) return;
            
            const { data: complaints, error } = await supabase
                .from('customer_complaints')
                .select('id, status, severity, complaint_date, actual_close_date')
                .eq('customer_id', customer.id);

            if (!error && complaints) {
                const open = complaints.filter(c => c.status !== 'Kapalı' && c.status !== 'İptal').length;
                const critical = complaints.filter(c => c.severity === 'Kritik').length;
                
                const resolved = complaints.filter(c => c.actual_close_date);
                let avgDays = 0;
                if (resolved.length > 0) {
                    const totalDays = resolved.reduce((sum, c) => {
                        const start = new Date(c.complaint_date);
                        const end = new Date(c.actual_close_date);
                        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                        return sum + diffDays;
                    }, 0);
                    avgDays = Math.round(totalDays / resolved.length);
                }

                setStats({
                    totalComplaints: complaints.length,
                    openComplaints: open,
                    criticalComplaints: critical,
                    avgResolutionDays: avgDays
                });
            }
            setLoading(false);
        };

        fetchStats();
    }, [customer?.id]);

    if (!customer) return null;

    return (
        <Dialog open={!!customer} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl">{customer.name}</DialogTitle>
                            <DialogDescription>
                                {customer.customer_code} • {customer.customer_type}
                            </DialogDescription>
                        </div>
                        <Badge variant={customer.is_active ? "success" : "secondary"}>
                            {customer.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Şikayet İstatistikleri */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Şikayet İstatistikleri
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-600">
                                            {loading ? '...' : stats.totalComplaints}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Toplam Şikayet
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-orange-600">
                                            {loading ? '...' : stats.openComplaints}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Açık Şikayet
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-red-600">
                                            {loading ? '...' : stats.criticalComplaints}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Kritik
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-green-600">
                                            {loading ? '...' : stats.avgResolutionDays}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Ort. Çözüm (gün)
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* İletişim Bilgileri */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            İletişim Bilgileri
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                            {customer.contact_person && (
                                <div className="flex items-start gap-2">
                                    <Users className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-medium">Yetkili</div>
                                        <div className="text-sm">{customer.contact_person}</div>
                                    </div>
                                </div>
                            )}
                            {customer.contact_email && (
                                <div className="flex items-start gap-2">
                                    <Mail className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-medium">Email</div>
                                        <div className="text-sm">{customer.contact_email}</div>
                                    </div>
                                </div>
                            )}
                            {customer.contact_phone && (
                                <div className="flex items-start gap-2">
                                    <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-medium">Telefon</div>
                                        <div className="text-sm">{customer.contact_phone}</div>
                                    </div>
                                </div>
                            )}
                            {(customer.address || customer.city) && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-medium">Adres</div>
                                        <div className="text-sm">
                                            {customer.address && <div>{customer.address}</div>}
                                            {customer.city && customer.country && (
                                                <div>{customer.city}, {customer.country}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* İş Bilgileri */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            İş Bilgileri
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                            {customer.tax_number && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Vergi No
                                    </div>
                                    <div className="text-sm">{customer.tax_number}</div>
                                </div>
                            )}
                            {customer.annual_revenue && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Yıllık Ciro
                                    </div>
                                    <div className="text-sm">
                                        {Number(customer.annual_revenue).toLocaleString('tr-TR')} TL
                                    </div>
                                </div>
                            )}
                            {customer.payment_terms && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Ödeme Koşulları
                                    </div>
                                    <div className="text-sm">{customer.payment_terms}</div>
                                </div>
                            )}
                            {(customer.contract_start_date || customer.contract_end_date) && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Sözleşme Dönemi
                                    </div>
                                    <div className="text-sm">
                                        {customer.contract_start_date && 
                                            new Date(customer.contract_start_date).toLocaleDateString('tr-TR')}
                                        {customer.contract_start_date && customer.contract_end_date && ' - '}
                                        {customer.contract_end_date && 
                                            new Date(customer.contract_end_date).toLocaleDateString('tr-TR')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {customer.notes && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Notlar</h3>
                            <div className="bg-muted/50 p-4 rounded-lg text-sm">
                                {customer.notes}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Kapat</Button>
                    <Button onClick={() => onEdit(customer)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Düzenle
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const CustomerManager = () => {
    const { toast } = useToast();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [viewingCustomer, setViewingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterActive, setFilterActive] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name');

        if (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Müşteriler alınamadı!',
                description: error.message 
            });
        } else {
            setCustomers(data || []);
        }
        
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredCustomers = useMemo(() => {
        let filtered = customers;

        // Tip filtresi
        if (filterType !== 'all') {
            filtered = filtered.filter(c => c.customer_type === filterType);
        }

        // Aktiflik filtresi
        if (filterActive === 'active') {
            filtered = filtered.filter(c => c.is_active);
        } else if (filterActive === 'inactive') {
            filtered = filtered.filter(c => !c.is_active);
        }

        // Arama
        if (searchTerm) {
            const lowercased = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.name?.toLowerCase().includes(lowercased) ||
                c.customer_code?.toLowerCase().includes(lowercased) ||
                c.contact_person?.toLowerCase().includes(lowercased) ||
                c.city?.toLowerCase().includes(lowercased)
            );
        }

        return filtered;
    }, [customers, searchTerm, filterType, filterActive]);

    const openModal = (customer = null) => {
        setEditingCustomer(customer);
        setModalOpen(true);
    };

    const closeModal = () => {
        setEditingCustomer(null);
        setModalOpen(false);
    };

    const handleSuccess = () => {
        fetchData();
        closeModal();
    };

    const viewCustomer = (customer) => {
        setViewingCustomer(customer);
    };

    const closeViewCustomer = () => {
        setViewingCustomer(null);
    };

    const handleEditFromView = (customer) => {
        setViewingCustomer(null);
        openModal(customer);
    };
    
    const deleteCustomer = async (id) => {
        // Önce müşteriyle ilişkili şikayet var mı kontrol et
        const { data: complaints, error: checkError } = await supabase
            .from('customer_complaints')
            .select('id')
            .eq('customer_id', id)
            .limit(1);

        if (checkError) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Kontrol sırasında hata oluştu.' 
            });
            return;
        }

        if (complaints && complaints.length > 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Silme Başarısız', 
                description: 'Bu müşteriye ait şikayetler olduğu için silinemez.' 
            });
            return;
        }
        
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);
            
        if (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata!', 
                description: 'Müşteri silinemedi.' 
            });
        } else {
            toast({ 
                title: 'Başarılı!', 
                description: 'Müşteri silindi.' 
            });
            fetchData();
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="space-y-6"
        >
            {isModalOpen && (
                <CustomerFormModal 
                    open={isModalOpen} 
                    setOpen={setModalOpen} 
                    onSuccess={handleSuccess} 
                    existingCustomer={editingCustomer} 
                />
            )}
            
            {viewingCustomer && (
                <CustomerDetailCard
                    customer={viewingCustomer}
                    onEdit={handleEditFromView}
                    onClose={closeViewCustomer}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        Müşteri Yönetimi
                    </CardTitle>
                    <CardDescription>
                        Müşteri bilgilerini yönetin ve şikayet istatistiklerini görüntüleyin
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filtreler ve Arama */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                            <div className="relative flex-1 sm:flex-initial">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Müşteri ara..." 
                                    className="pl-10 w-full sm:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-full sm:w-40">
                                    <SelectValue placeholder="Tüm Tipler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Tipler</SelectItem>
                                    {CUSTOMER_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filterActive} onValueChange={setFilterActive}>
                                <SelectTrigger className="w-full sm:w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="inactive">Pasif</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => openModal()} className="w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2" /> 
                            Yeni Müşteri
                        </Button>
                    </div>

                    {/* Müşteri Listesi */}
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="w-12">S.No</th>
                                    <th>Müşteri Adı</th>
                                    <th>Tip</th>
                                    <th>Yetkili Kişi</th>
                                    <th>İletişim</th>
                                    <th>Şehir</th>
                                    <th>Durum</th>
                                    <th className="text-center">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8">
                                            Yükleniyor...
                                        </td>
                                    </tr>
                                ) : filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8 text-muted-foreground">
                                            {searchTerm || filterType !== 'all' || filterActive !== 'all' 
                                                ? 'Arama kriterlerine uygun müşteri bulunamadı.' 
                                                : 'Henüz müşteri eklenmemiş.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map((customer, index) => (
                                        <tr 
                                            key={customer.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => viewCustomer(customer)}
                                        >
                                            <td>{index + 1}</td>
                                            <td className="font-medium">
                                                {customer.name}
                                            </td>
                                            <td>
                                                <Badge variant="outline">
                                                    {customer.customer_type}
                                                </Badge>
                                            </td>
                                            <td>{customer.contact_person || '-'}</td>
                                            <td>
                                                {customer.contact_email && (
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Mail className="w-3 h-3" />
                                                        {customer.contact_email}
                                                    </div>
                                                )}
                                                {customer.contact_phone && (
                                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                        <Phone className="w-3 h-3" />
                                                        {customer.contact_phone}
                                                    </div>
                                                )}
                                                {!customer.contact_email && !customer.contact_phone && '-'}
                                            </td>
                                            <td>{customer.city || '-'}</td>
                                            <td>
                                                <Badge 
                                                    variant={customer.is_active ? "success" : "secondary"}
                                                >
                                                    {customer.is_active ? 'Aktif' : 'Pasif'}
                                                </Badge>
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => openModal(customer)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Emin misiniz?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    "{customer.name}" adlı müşteriyi 
                                                                    kalıcı olarak sileceksiniz. Bu işlem geri alınamaz.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    onClick={() => deleteCustomer(customer.id)}
                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                >
                                                                    Sil
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Özet İstatistikler */}
                    {!loading && filteredCustomers.length > 0 && (
                        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <div>
                                Toplam {filteredCustomers.length} müşteri gösteriliyor
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Aktif: {filteredCustomers.filter(c => c.is_active).length}
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                    Pasif: {filteredCustomers.filter(c => !c.is_active).length}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default CustomerManager;
