import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

const TrainingFormModal = ({ isOpen, onClose, personnel, skills, onRefresh }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        personnel_id: '',
        skill_id: '',
        training_date: format(new Date(), 'yyyy-MM-dd'),
        training_type: 'İç Eğitim',
        trainer_name: '',
        duration_hours: '',
        notes: '',
        new_level: ''
    });

    const handleSave = async () => {
        if (!formData.personnel_id || !formData.skill_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen personel ve yetkinlik seçin.'
            });
            return;
        }

        setLoading(true);
        try {
            // Personnel skill kaydını bul veya oluştur
            const { data: existingSkill, error: fetchError } = await supabase
                .from('personnel_skills')
                .select('*')
                .eq('personnel_id', formData.personnel_id)
                .eq('skill_id', formData.skill_id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            const updateData = {
                last_training_date: formData.training_date || null,
                training_required: false
            };

            // Eğer yeni seviye belirlendiyse ekle
            if (formData.new_level) {
                updateData.current_level = parseInt(formData.new_level);
                updateData.last_assessment_date = formData.training_date || null;
            }

            if (existingSkill) {
                // Mevcut kaydı güncelle
                const { error } = await supabase
                    .from('personnel_skills')
                    .update(updateData)
                    .eq('id', existingSkill.id);

                if (error) throw error;
            } else {
                // Yeni kayıt oluştur
                const newSkillData = {
                    personnel_id: formData.personnel_id,
                    skill_id: formData.skill_id,
                    current_level: formData.new_level ? parseInt(formData.new_level) : 1,
                    ...updateData
                };

                const { error } = await supabase
                    .from('personnel_skills')
                    .insert([newSkillData]);

                if (error) throw error;
            }

            // Eğitim kaydını trainings tablosuna ekle (eğer varsa)
            try {
                await supabase.from('trainings').insert([{
                    title: `${skills.find(s => s.id === formData.skill_id)?.name} Eğitimi`,
                    training_date: formData.training_date || null,
                    training_type: formData.training_type || null,
                    trainer_name: formData.trainer_name || null,
                    duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
                    description: formData.notes || null,
                    status: 'Tamamlandı'
                }]);
            } catch (err) {
                console.log('Training table not found, skipping...');
            }

            toast({
                title: 'Başarılı',
                description: 'Eğitim kaydı başarıyla eklendi.'
            });

            onRefresh();
            onClose();

            // Form'u sıfırla
            setFormData({
                personnel_id: '',
                skill_id: '',
                training_date: format(new Date(), 'yyyy-MM-dd'),
                training_type: 'İç Eğitim',
                trainer_name: '',
                duration_hours: '',
                notes: '',
                new_level: ''
            });
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
                        <div className="bg-white/20 p-2.5 rounded-lg"><BookOpen className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Eğitim Kaydı Ekle</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Polivalans eğitim kaydı</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Yeni</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Personel <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.personnel_id}
                                onValueChange={(val) => setFormData({ ...formData, personnel_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Personel seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {personnel.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.full_name} - {p.department}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Yetkinlik <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.skill_id}
                                onValueChange={(val) => setFormData({ ...formData, skill_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Yetkinlik seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {skills.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.code ? `${s.code} - ` : ''}{s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Eğitim Tarihi</Label>
                            <Input
                                type="date"
                                value={formData.training_date}
                                onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Eğitim Türü</Label>
                            <Select
                                value={formData.training_type}
                                onValueChange={(val) => setFormData({ ...formData, training_type: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="İç Eğitim">İç Eğitim</SelectItem>
                                    <SelectItem value="Dış Eğitim">Dış Eğitim</SelectItem>
                                    <SelectItem value="Online Eğitim">Online Eğitim</SelectItem>
                                    <SelectItem value="İş Başı Eğitim">İş Başı Eğitim</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Süre (Saat)</Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={formData.duration_hours}
                                onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                                placeholder="Örn: 8"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Eğitmen Adı</Label>
                            <Input
                                value={formData.trainer_name}
                                onChange={(e) => setFormData({ ...formData, trainer_name: e.target.value })}
                                placeholder="Eğitmen adı"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Eğitim Sonrası Yeni Seviye</Label>
                            <Select
                                value={formData.new_level || "no_change"}
                                onValueChange={(val) => setFormData({ ...formData, new_level: val === "no_change" ? '' : val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Değişiklik yok" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no_change">Değişiklik yok</SelectItem>
                                    <SelectItem value="1">Seviye 1 - Temel</SelectItem>
                                    <SelectItem value="2">Seviye 2 - Gözetimli</SelectItem>
                                    <SelectItem value="3">Seviye 3 - Bağımsız</SelectItem>
                                    <SelectItem value="4">Seviye 4 - Eğitmen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notlar</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Eğitim hakkında notlar..."
                            rows={3}
                        />
                    </div>
                </div>
                </div>
                </div>
                <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                    <div className="p-5 space-y-5">
                        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Tarih:</span><span className="font-medium">{formData.training_date || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Tür:</span><span className="font-medium">{formData.training_type || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Süre:</span><span className="font-medium">{formData.duration_hours ? formData.duration_hours + ' saat' : '-'}</span></div>
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

export default TrainingFormModal;

