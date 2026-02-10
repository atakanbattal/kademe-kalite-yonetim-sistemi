import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, FolderPlus } from 'lucide-react';

const COLORS = [
    { name: 'Kırmızı', value: '#ef4444' },
    { name: 'Turuncu', value: '#f97316' },
    { name: 'Sarı', value: '#eab308' },
    { name: 'Yeşil', value: '#22c55e' },
    { name: 'Mavi', value: '#3b82f6' },
    { name: 'Mor', value: '#a855f7' },
    { name: 'Pembe', value: '#ec4899' },
    { name: 'Gri', value: '#6b7280' }
];

const CategoryFormModal = ({ isOpen, onClose, category, onRefresh, departments = [] }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#3b82f6',
        icon: 'Target',
        department: null
    });

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                description: category.description || '',
                color: category.color || '#3b82f6',
                icon: category.icon || 'Target',
                department: category.department || null
            });
        } else {
            setFormData({
                name: '',
                description: '',
                color: '#3b82f6',
                icon: 'Target',
                department: null
            });
        }
    }, [category, isOpen]);

    const handleSave = async () => {
        if (!formData.name) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen kategori adı girin.'
            });
            return;
        }

        setLoading(true);
        try {
            if (category) {
                // Update existing
                const { error } = await supabase
                    .from('skill_categories')
                    .update({
                        name: formData.name,
                        description: formData.description,
                        color: formData.color,
                        icon: formData.icon,
                        department: formData.department || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', category.id);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Kategori güncellendi.'
                });
            } else {
                // Insert new - get max order_index first
                const { data: maxOrderData } = await supabase
                    .from('skill_categories')
                    .select('order_index')
                    .order('order_index', { ascending: false })
                    .limit(1)
                    .single();

                const newOrderIndex = (maxOrderData?.order_index || 0) + 1;

                const { error } = await supabase
                    .from('skill_categories')
                    .insert([{
                        name: formData.name,
                        description: formData.description,
                        color: formData.color,
                        icon: formData.icon,
                        department: formData.department || null,
                        order_index: newOrderIndex,
                        is_active: true
                    }]);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Yeni kategori eklendi.'
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="h-5 w-5" />
                        {category ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Kategori Adı <span className="text-red-500">*</span></Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Örn: İş Güvenliği, Teknik Yetkinlikler..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Departman</Label>
                        <Select
                            value={formData.department || 'all'}
                            onValueChange={(val) => setFormData({ ...formData, department: val === 'all' ? null : val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm departmanlar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Departmanlar (Genel)</SelectItem>
                                {departments.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Tüm departmanlar seçilirse bu kategori herkese görünür
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Kategori hakkında açıklama..."
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Renk</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color: color.value })}
                                    className={`
                                        h-12 rounded-lg border-2 transition-all
                                        ${formData.color === color.value 
                                            ? 'border-primary ring-2 ring-primary ring-offset-2' 
                                            : 'border-transparent hover:border-muted-foreground/50'
                                        }
                                    `}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
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

export default CategoryFormModal;

