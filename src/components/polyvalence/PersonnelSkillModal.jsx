import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Award, Calendar, User, TrendingUp, Save, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const PersonnelSkillModal = ({ isOpen, onClose, person, skill, personnelSkill, onRefresh }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        current_level: 0,
        target_level: 3,
        is_certified: false,
        certification_date: '',
        certification_expiry_date: '',
        certification_number: '',
        certification_authority: '',
        last_assessment_date: '',
        last_assessment_score: '',
        assessment_notes: '',
        training_required: false,
        training_priority: 'Orta',
        last_training_date: '',
        next_training_date: ''
    });

    useEffect(() => {
        if (personnelSkill) {
            setFormData({
                current_level: personnelSkill.current_level || 0,
                target_level: personnelSkill.target_level || 3,
                is_certified: personnelSkill.is_certified || false,
                certification_date: personnelSkill.certification_date || '',
                certification_expiry_date: personnelSkill.certification_expiry_date || '',
                certification_number: personnelSkill.certification_number || '',
                certification_authority: personnelSkill.certification_authority || '',
                last_assessment_date: personnelSkill.last_assessment_date || '',
                last_assessment_score: personnelSkill.last_assessment_score || '',
                assessment_notes: personnelSkill.assessment_notes || '',
                training_required: personnelSkill.training_required || false,
                training_priority: personnelSkill.training_priority || 'Orta',
                last_training_date: personnelSkill.last_training_date || '',
                next_training_date: personnelSkill.next_training_date || ''
            });
        } else {
            // Default for new skill
            setFormData({
                current_level: 0,
                target_level: skill.target_level || 3,
                is_certified: false,
                certification_date: '',
                certification_expiry_date: '',
                certification_number: '',
                certification_authority: '',
                last_assessment_date: format(new Date(), 'yyyy-MM-dd'),
                last_assessment_score: '',
                assessment_notes: '',
                training_required: true,
                training_priority: 'Orta',
                last_training_date: '',
                next_training_date: ''
            });
        }
    }, [personnelSkill, skill]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const dataToSave = {
                personnel_id: person.id,
                skill_id: skill.id,
                current_level: formData.current_level,
                target_level: formData.target_level,
                is_certified: formData.is_certified,
                certification_date: formData.certification_date || null,
                certification_expiry_date: formData.certification_expiry_date || null,
                certification_number: formData.certification_number || null,
                certification_authority: formData.certification_authority || null,
                last_assessment_date: formData.last_assessment_date || null,
                last_assessment_score: formData.last_assessment_score ? parseFloat(formData.last_assessment_score) : null,
                assessment_notes: formData.assessment_notes || null,
                training_required: formData.training_required,
                training_priority: formData.training_priority || null,
                last_training_date: formData.last_training_date || null,
                next_training_date: formData.next_training_date || null
            };

            if (personnelSkill) {
                // Update existing
                const { error } = await supabase
                    .from('personnel_skills')
                    .update(dataToSave)
                    .eq('id', personnelSkill.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('personnel_skills')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            toast({
                title: 'Başarılı!',
                description: 'Yetkinlik bilgisi kaydedildi. Polivalans skorları güncelleniyor...'
            });
            
            // Kısa bir gecikme ile refresh yap - view'in güncellenmesi için zaman tanı
            setTimeout(() => {
                onRefresh();
            }, 300);
            
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Kaydetme başarısız: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!personnelSkill || !confirm('Bu yetkinlik kaydını silmek istediğinize emin misiniz?')) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('personnel_skills')
                .delete()
                .eq('id', personnelSkill.id);

            if (error) throw error;

            toast({
                title: 'Başarılı!',
                description: 'Yetkinlik kaydı silindi.'
            });
            
            onRefresh();
            onClose();
        } catch (error) {
            console.error('Delete error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Silme başarısız: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {person.full_name} - {skill.name}
                    </DialogTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{person.department}</span>
                        {person.position && <><span>•</span><span>{person.position}</span></>}
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Seviye Seçimi */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Mevcut Seviye</Label>
                            <Select 
                                value={formData.current_level.toString()} 
                                onValueChange={(val) => setFormData({...formData, current_level: parseInt(val)})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">0 - Bilgi Yok</SelectItem>
                                    <SelectItem value="1">1 - Temel Bilgi</SelectItem>
                                    <SelectItem value="2">2 - Gözetimli</SelectItem>
                                    <SelectItem value="3">3 - Bağımsız</SelectItem>
                                    <SelectItem value="4">4 - Eğitmen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Hedef Seviye</Label>
                            <Select 
                                value={formData.target_level?.toString() || '3'} 
                                onValueChange={(val) => setFormData({...formData, target_level: parseInt(val)})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 - Temel Bilgi</SelectItem>
                                    <SelectItem value="2">2 - Gözetimli</SelectItem>
                                    <SelectItem value="3">3 - Bağımsız</SelectItem>
                                    <SelectItem value="4">4 - Eğitmen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Sertifikasyon */}
                    {skill.requires_certification && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Award className="h-5 w-5 text-purple-500" />
                                    <Label className="text-base font-semibold">Sertifikasyon Bilgileri</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_certified"
                                        checked={formData.is_certified}
                                        onChange={(e) => setFormData({...formData, is_certified: e.target.checked})}
                                        className="rounded"
                                    />
                                    <Label htmlFor="is_certified">Sertifikalı</Label>
                                </div>

                                {formData.is_certified && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Sertifika Tarihi</Label>
                                            <Input
                                                type="date"
                                                value={formData.certification_date}
                                                onChange={(e) => setFormData({...formData, certification_date: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Geçerlilik Tarihi</Label>
                                            <Input
                                                type="date"
                                                value={formData.certification_expiry_date}
                                                onChange={(e) => setFormData({...formData, certification_expiry_date: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Sertifika No</Label>
                                            <Input
                                                value={formData.certification_number}
                                                onChange={(e) => setFormData({...formData, certification_number: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Sertifika Kurumu</Label>
                                            <Input
                                                value={formData.certification_authority}
                                                onChange={(e) => setFormData({...formData, certification_authority: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Değerlendirme */}
                    <Separator />
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <Label className="text-base font-semibold">Değerlendirme</Label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Son Değerlendirme Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.last_assessment_date}
                                    onChange={(e) => setFormData({...formData, last_assessment_date: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Değerlendirme Puanı (0-100)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.last_assessment_score}
                                    onChange={(e) => setFormData({...formData, last_assessment_score: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Değerlendirme Notları</Label>
                            <Textarea
                                value={formData.assessment_notes}
                                onChange={(e) => setFormData({...formData, assessment_notes: e.target.value})}
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Eğitim İhtiyacı */}
                    <Separator />
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-orange-500" />
                            <Label className="text-base font-semibold">Eğitim İhtiyacı</Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="training_required"
                                checked={formData.training_required}
                                onChange={(e) => setFormData({...formData, training_required: e.target.checked})}
                                className="rounded"
                            />
                            <Label htmlFor="training_required">Eğitim Gerekli</Label>
                        </div>

                        {formData.training_required && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Öncelik</Label>
                                    <Select 
                                        value={formData.training_priority} 
                                        onValueChange={(val) => setFormData({...formData, training_priority: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Düşük">Düşük</SelectItem>
                                            <SelectItem value="Orta">Orta</SelectItem>
                                            <SelectItem value="Yüksek">Yüksek</SelectItem>
                                            <SelectItem value="Kritik">Kritik</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Son Eğitim</Label>
                                    <Input
                                        type="date"
                                        value={formData.last_training_date}
                                        onChange={(e) => setFormData({...formData, last_training_date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Planlanan Eğitim</Label>
                                    <Input
                                        type="date"
                                        value={formData.next_training_date}
                                        onChange={(e) => setFormData({...formData, next_training_date: e.target.value})}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex justify-between">
                    <div>
                        {personnelSkill && (
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            İptal
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            Kaydet
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PersonnelSkillModal;

