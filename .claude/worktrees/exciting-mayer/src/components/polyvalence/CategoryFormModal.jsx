import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><FolderPlus className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{category ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Yetkinlik kategorisi</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{category ? 'Düzenle' : 'Yeni'}</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                <div className="p-6 space-y-4">
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
                </div>
                <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                    <div className="p-5 space-y-5">
                        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Kategori:</span><span className="font-medium">{formData.name || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Departman:</span><span className="font-medium">{formData.department || 'Tümü'}</span></div>
                        </div>
                    </div>
                </div>
                </div>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        İptal
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        <Save className="mr-2 h-4 w-4" />
                        Kaydet
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default CategoryFormModal;

