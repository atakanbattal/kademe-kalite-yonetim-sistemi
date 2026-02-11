import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
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
            // Code alanı boşsa NULL gönder (boş string unique constraint hatası verir)
            const codeValue = formData.code && formData.code.trim() !== '' 
                ? formData.code.trim() 
                : null;

            const dataToSave = {
                ...formData,
                code: codeValue,
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
                // Update işleminde: Eğer code değiştiyse ve yeni code başka bir kayıtta varsa kontrol et
                if (codeValue && codeValue !== skill.code) {
                    const { data: existingSkill } = await supabase
                        .from('skills')
                        .select('id')
                        .eq('code', codeValue)
                        .neq('id', skill.id)
                        .single();

                    if (existingSkill) {
                        toast({
                            variant: 'destructive',
                            title: 'Hata',
                            description: 'Bu yetkinlik kodu zaten kullanılıyor. Lütfen farklı bir kod girin.'
                        });
                        setLoading(false);
                        return;
                    }
                }

                // Update existing
                const { error } = await supabase
                    .from('skills')
                    .update(cleanedData)
                    .eq('id', skill.id);

                if (error) {
                    // Unique constraint hatası kontrolü
                    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
                        throw new Error('Bu yetkinlik kodu zaten kullanılıyor. Lütfen farklı bir kod girin.');
                    }
                    throw error;
                }

                toast({
                    title: 'Başarılı',
                    description: 'Yetkinlik güncellendi.'
                });
            } else {
                // Insert işleminde: Code varsa ve başka bir kayıtta kullanılıyorsa kontrol et
                if (codeValue) {
                    const { data: existingSkill } = await supabase
                        .from('skills')
                        .select('id')
                        .eq('code', codeValue)
                        .single();

                    if (existingSkill) {
                        toast({
                            variant: 'destructive',
                            title: 'Hata',
                            description: 'Bu yetkinlik kodu zaten kullanılıyor. Lütfen farklı bir kod girin.'
                        });
                        setLoading(false);
                        return;
                    }
                }

                // Insert new
                const { error } = await supabase
                    .from('skills')
                    .insert([cleanedData]);

                if (error) {
                    // Unique constraint hatası kontrolü
                    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
                        throw new Error('Bu yetkinlik kodu zaten kullanılıyor. Lütfen farklı bir kod girin.');
                    }
                    throw error;
                }

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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><Target className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{skill ? 'Yetkinlik Düzenle' : 'Yeni Yetkinlik Ekle'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Polivalans yetkinliği</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{skill ? 'Düzenle' : 'Yeni'}</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                <div className="p-6 space-y-4">
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
                </div>
                <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                    <div className="p-5 space-y-5">
                        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Yetkinlik:</span><span className="font-medium">{formData.name || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Kod:</span><span className="font-medium">{formData.code || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Kritik:</span><span className="font-medium">{formData.is_critical ? 'Evet' : 'Hayır'}</span></div>
                        </div>
                    </div>
                </div>
                </div>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={loading}>İptal</Button>
                    <Button onClick={handleSave} disabled={loading}><Save className="mr-2 h-4 w-4" /> Kaydet</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default SkillFormModal;

