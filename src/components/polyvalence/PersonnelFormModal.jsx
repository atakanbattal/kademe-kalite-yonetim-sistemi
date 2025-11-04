import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, UserPlus } from 'lucide-react';

const PersonnelFormModal = ({ isOpen, onClose, personnel, onRefresh }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        department: '',
        position: '',
        email: '',
        phone: '',
        registration_number: ''
    });

    useEffect(() => {
        if (personnel) {
            setFormData({
                full_name: personnel.full_name || '',
                department: personnel.department || '',
                position: personnel.position || '',
                email: personnel.email || '',
                phone: personnel.phone || '',
                registration_number: personnel.registration_number || ''
            });
        } else {
            setFormData({
                full_name: '',
                department: '',
                position: '',
                email: '',
                phone: '',
                registration_number: ''
            });
        }
    }, [personnel, isOpen]);

    const handleSave = async () => {
        if (!formData.full_name || !formData.department) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen personel adı ve departman bilgilerini doldurun.'
            });
            return;
        }

        setLoading(true);
        try {
            if (personnel) {
                // Update existing
                const { error } = await supabase
                    .from('personnel')
                    .update(formData)
                    .eq('id', personnel.id);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Personel bilgileri güncellendi.'
                });
            } else {
                // Insert new
                const { error } = await supabase
                    .from('personnel')
                    .insert([formData]);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Yeni personel eklendi.'
                });
            }

            onRefresh();
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kaydetme başarısız: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    // Departman listesi (örnek)
    const departments = [
        'Kaynak',
        'Montaj',
        'Kalite Kontrol',
        'Üretim Planlama',
        'Bakım Onarım',
        'Ar-Ge',
        'Yönetim'
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        {personnel ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Ad Soyad <span className="text-red-500">*</span></Label>
                        <Input
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Örn: Ahmet Yılmaz"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Departman <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.department}
                                onValueChange={(val) => setFormData({ ...formData, department: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Pozisyon</Label>
                            <Input
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                placeholder="Örn: Kaynak Operatörü"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>E-posta</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ornek@kademe.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Telefon</Label>
                            <Input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="555-123-4567"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Sicil No</Label>
                        <Input
                            value={formData.registration_number}
                            onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                            placeholder="Personel sicil numarası"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        İptal
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        <Save className="mr-2 h-4 w-4" />
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PersonnelFormModal;

