import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { useData } from '@/contexts/DataContext';

const EquipmentManagement = ({ equipment, loading, refreshEquipment }) => {
    const { toast } = useToast();
    const { personnel, products, productCategories } = useData();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        equipment_code: '',
        equipment_name: '',
        equipment_type: '',
        description: '',
        location: '',
        responsible_unit: '',
        responsible_person_id: null,
        status: 'Aktif'
    });

    const personnelOptions = (personnel || []).map(p => ({
        value: p.id,
        label: p.full_name || `${p.name} ${p.surname || ''}`.trim()
    }));

    // Araç tiplerini products tablosundan çek (VEHICLE_TYPES kategorisi)
    const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    const vehicleTypeOptions = (products || [])
        .filter(p => p.category_id === vehicleTypeCategory?.id)
        .map(p => ({
            value: p.product_name,
            label: p.product_name
        }));

    // Araç tipleri (TOOLS kategorisi)
    const toolsCategory = (productCategories || []).find(cat => cat.category_code === 'TOOLS');
    const toolTypeOptions = (products || [])
        .filter(p => p.category_id === toolsCategory?.id)
        .map(p => ({
            value: p.product_name,
            label: p.product_name
        }));

    // Tüm araç tipi seçenekleri (araç tipleri + araçlar)
    const equipmentTypeOptions = [
        ...vehicleTypeOptions,
        ...toolTypeOptions,
        { value: 'Kalıp', label: 'Kalıp' },
        { value: 'Fixture', label: 'Fixture' },
        { value: 'Jig', label: 'Jig' },
        { value: 'Diğer', label: 'Diğer' }
    ];

    const filteredEquipment = equipment.filter(eq => {
        const searchLower = searchTerm.toLowerCase();
        return (
            eq.equipment_code?.toLowerCase().includes(searchLower) ||
            eq.equipment_name?.toLowerCase().includes(searchLower) ||
            eq.equipment_type?.toLowerCase().includes(searchLower) ||
            eq.location?.toLowerCase().includes(searchLower) ||
            eq.responsible_unit?.toLowerCase().includes(searchLower)
        );
    });

    const handleOpenForm = (eq = null) => {
        if (eq) {
            setSelectedEquipment(eq);
            setFormData({
                equipment_code: eq.equipment_code || '',
                equipment_name: eq.equipment_name || '',
                equipment_type: eq.equipment_type || '',
                description: eq.description || '',
                location: eq.location || '',
                responsible_unit: eq.responsible_unit || '',
                responsible_person_id: eq.responsible_person_id || null,
                status: eq.status || 'Aktif'
            });
        } else {
            setSelectedEquipment(null);
            setFormData({
                equipment_code: '',
                equipment_name: '',
                equipment_type: '',
                description: '',
                location: '',
                responsible_unit: '',
                responsible_person_id: null,
                status: 'Aktif'
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.equipment_code || !formData.equipment_name) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen araç kodu ve adını girin.' });
            return;
        }

        try {
            if (selectedEquipment) {
                const { error } = await supabase
                    .from('process_control_equipment')
                    .update(formData)
                    .eq('id', selectedEquipment.id);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Araç güncellendi.' });
            } else {
                const { error } = await supabase
                    .from('process_control_equipment')
                    .insert([formData]);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Araç eklendi.' });
            }
            
            setIsFormOpen(false);
            refreshEquipment();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu aracı silmek istediğinizden emin misiniz?')) return;
        
        try {
            const { error } = await supabase
                .from('process_control_equipment')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Araç silindi.' });
            refreshEquipment();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    return (
        <div className="space-y-4">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedEquipment ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                        </DialogTitle>
                        <DialogDescription>
                            Proses kontrol aracının bilgilerini girin.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Araç Kodu (*)</Label>
                                    <Input
                                        value={formData.equipment_code}
                                        onChange={(e) => setFormData({ ...formData, equipment_code: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Araç Adı (*)</Label>
                                    <Input
                                        value={formData.equipment_name}
                                        onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Araç Tipi</Label>
                                    <Combobox
                                        options={equipmentTypeOptions}
                                        value={formData.equipment_type}
                                        onChange={(v) => setFormData({ ...formData, equipment_type: v })}
                                        placeholder="Araç tipi seçin..."
                                    />
                                </div>
                                <div>
                                    <Label>Durum</Label>
                                    <Combobox
                                        options={[
                                            { value: 'Aktif', label: 'Aktif' },
                                            { value: 'Bakımda', label: 'Bakımda' },
                                            { value: 'Hurdaya Ayrıldı', label: 'Hurdaya Ayrıldı' },
                                            { value: 'Arşiv', label: 'Arşiv' }
                                        ]}
                                        value={formData.status}
                                        onChange={(v) => setFormData({ ...formData, status: v })}
                                        placeholder="Durum seçin..."
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Lokasyon</Label>
                                    <Input
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Sorumlu Birim</Label>
                                    <Input
                                        value={formData.responsible_unit}
                                        onChange={(e) => setFormData({ ...formData, responsible_unit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Sorumlu Personel</Label>
                                <Combobox
                                    options={personnelOptions}
                                    value={formData.responsible_person_id}
                                    onChange={(v) => setFormData({ ...formData, responsible_person_id: v })}
                                    placeholder="Personel seçin..."
                                />
                            </div>
                            <div>
                                <Label>Açıklama</Label>
                                <textarea
                                    className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                                İptal
                            </Button>
                            <Button type="submit">Kaydet</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Araç kodu, adı veya lokasyon ile ara..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni Araç
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="p-3 text-left">Araç Kodu</th>
                            <th className="p-3 text-left">Araç Adı</th>
                            <th className="p-3 text-left">Tip</th>
                            <th className="p-3 text-left">Lokasyon</th>
                            <th className="p-3 text-left">Sorumlu Birim</th>
                            <th className="p-3 text-left">Durum</th>
                            <th className="p-3 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">
                                    Yükleniyor...
                                </td>
                            </tr>
                        ) : filteredEquipment.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">
                                    Araç bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredEquipment.map((eq) => (
                                <tr key={eq.id} className="border-t hover:bg-muted/50">
                                    <td className="p-3 font-medium">{eq.equipment_code}</td>
                                    <td className="p-3">{eq.equipment_name}</td>
                                    <td className="p-3">{eq.equipment_type || '-'}</td>
                                    <td className="p-3">{eq.location || '-'}</td>
                                    <td className="p-3">{eq.responsible_unit || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            eq.status === 'Aktif' ? 'bg-green-100 text-green-800' :
                                            eq.status === 'Bakımda' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {eq.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenForm(eq)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(eq.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EquipmentManagement;

