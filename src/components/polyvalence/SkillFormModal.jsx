import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Target } from 'lucide-react';

const SkillFormModal = ({ isOpen, onClose, skill, skillCategories, onRefresh, departments = [] }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        category_id: '',
        description: '',
        requires_certification: false,
        certification_validity_days: '',
        is_critical: false,
        target_level: 3,
        department: null
    });

    useEffect(() => {
        if (skill) {
            setFormData({
                name: skill.name || '',
                code: skill.code || '',
                category_id: skill.category_id || '',
                description: skill.description || '',
                requires_certification: skill.requires_certification || false,
                certification_validity_days: skill.certification_validity_days || '',
                is_critical: skill.is_critical || false,
                target_level: skill.target_level || 3,
                department: skill.department || null
            });
        } else {
            setFormData({
                name: '',
                code: '',
                category_id: skillCategories[0]?.id || '',
                description: '',
                requires_certification: false,
                certification_validity_days: '',
                is_critical: false,
                target_level: 3,
                department: null
            });
        }
    }, [skill, skillCategories, isOpen]);

    const handleSave = async () => {
        if (!formData.name || !formData.category_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen yetkinlik adı ve kategori seçin.'
            });
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                certification_validity_days: formData.certification_validity_days 
                    ? parseInt(formData.certification_validity_days) 
                    : null,
                department: formData.department || null
            };

            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dataToSave) {
                if (dataToSave[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = dataToSave[key];
                }
            }

            if (skill) {
                // Update existing
                const { error } = await supabase
                    .from('skills')
                    .update(cleanedData)
                    .eq('id', skill.id);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Yetkinlik güncellendi.'
                });
            } else {
                // Insert new
                const { error } = await supabase
                    .from('skills')
                    .insert([cleanedData]);

                if (error) throw error;

                toast({
                    title: 'Başarılı',
                    description: 'Yeni yetkinlik eklendi.'
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        {skill ? 'Yetkinlik Düzenle' : 'Yeni Yetkinlik Ekle'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Yetkinlik Adı <span className="text-red-500">*</span></Label>
                            <Input
                                autoFormat={false}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Örn: TIG Kaynak (Paslanmaz Çelik)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Yetkinlik Kodu</Label>
                            <Input
                                autoFormat={false}
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="Örn: WLD-TIG-001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Kategori <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategori seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {skillCategories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <Textarea
                            autoFormat={false}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Yetkinlik hakkında detaylı açıklama..."
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hedef Seviye</Label>
                            <Select
                                value={formData.target_level.toString()}
                                onValueChange={(val) => setFormData({ ...formData, target_level: parseInt(val) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Seviye 1 - Temel</SelectItem>
                                    <SelectItem value="2">Seviye 2 - Gözetimli</SelectItem>
                                    <SelectItem value="3">Seviye 3 - Bağımsız</SelectItem>
                                    <SelectItem value="4">Seviye 4 - Eğitmen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Sertifika Geçerlilik (Gün)</Label>
                            <Input
                                type="number"
                                value={formData.certification_validity_days}
                                onChange={(e) => setFormData({ ...formData, certification_validity_days: e.target.value })}
                                placeholder="Örn: 1095 (3 yıl)"
                                disabled={!formData.requires_certification}
                            />
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="requires_certification"
                                checked={formData.requires_certification}
                                onChange={(e) => setFormData({ ...formData, requires_certification: e.target.checked })}
                                className="rounded"
                            />
                            <Label htmlFor="requires_certification" className="cursor-pointer">
                                Sertifika Gerektirir
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_critical"
                                checked={formData.is_critical}
                                onChange={(e) => setFormData({ ...formData, is_critical: e.target.checked })}
                                className="rounded"
                            />
                            <Label htmlFor="is_critical" className="cursor-pointer">
                                Kritik Yetkinlik
                            </Label>
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

export default SkillFormModal;

