import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Target } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const ACTION_TYPES = ['Anlık Aksiyon', 'Düzeltici Aksiyon', 'Önleyici Aksiyon', 'İyileştirme'];
const STATUSES = ['Planlandı', 'Devam Ediyor', 'Tamamlandı', 'İptal', 'Ertelendi'];

const ActionFormModal = ({ open, setOpen, complaintId, existingAction, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { personnel, unitCostSettings } = useData();
    const isEditMode = !!existingAction;
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData = {
            action_type: 'Düzeltici Aksiyon',
            action_title: '',
            action_description: '',
            responsible_person_id: '',
            responsible_department_id: '',
            planned_start_date: '',
            planned_end_date: '',
            actual_start_date: '',
            actual_completion_date: '',
            status: 'Planlandı',
            completion_percentage: 0,
            effectiveness_verified: false,
            effectiveness_verification_date: '',
            effectiveness_notes: '',
            verified_by: '',
            estimated_cost: '',
            actual_cost: ''
        };

        if (isEditMode) {
            setFormData({
                ...existingAction,
                planned_start_date: existingAction.planned_start_date || '',
                planned_end_date: existingAction.planned_end_date || '',
                actual_start_date: existingAction.actual_start_date || '',
                actual_completion_date: existingAction.actual_completion_date || '',
                effectiveness_verification_date: existingAction.effectiveness_verification_date || ''
            });
        } else {
            setFormData(initialData);
        }
    }, [existingAction, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckboxChange = (id, checked) => {
        const updates = { [id]: checked };
        // Etkinlik doğrulandığında otomatik olarak current user'ı ata
        if (id === 'effectiveness_verified' && checked) {
            updates.verified_by = user?.id;
        }
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.action_title || !formData.action_description) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Başlık ve açıklama zorunludur.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const { id, created_at, updated_at, responsible_person, responsible_department, verified_by: verifiedByObj, ...dataToSubmit } = formData;
            dataToSubmit.complaint_id = complaintId;

            Object.keys(dataToSubmit).forEach(key => {
                if (dataToSubmit[key] === '') dataToSubmit[key] = null;
            });

            if (dataToSubmit.completion_percentage) dataToSubmit.completion_percentage = parseInt(dataToSubmit.completion_percentage);
            if (dataToSubmit.estimated_cost) dataToSubmit.estimated_cost = parseFloat(dataToSubmit.estimated_cost);
            if (dataToSubmit.actual_cost) dataToSubmit.actual_cost = parseFloat(dataToSubmit.actual_cost);

            let result;
            if (isEditMode) {
                result = await supabase.from('complaint_actions').update(dataToSubmit).eq('id', existingAction.id).select().single();
            } else {
                result = await supabase.from('complaint_actions').insert([dataToSubmit]).select().single();
            }

            if (result.error) throw result.error;

            toast({ title: 'Başarılı!', description: `Aksiyon başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            onSuccess();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.filter(p => p.is_active).map(p => ({ value: p.id, label: p.full_name }));
    const departmentOptions = unitCostSettings.map(u => ({ value: u.id, label: u.unit_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><Target className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Aksiyon Düzenle' : 'Yeni Aksiyon'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Şikayet aksiyonu</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{isEditMode ? 'Düzenle' : 'Yeni'}</span>
                    </div>
                </header>
                <form id="complaint-action-form" onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                    <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Aksiyon Tipi</Label>
                            <Select value={formData.action_type || ''} onValueChange={(v) => handleSelectChange('action_type', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Durum</Label>
                            <Select value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="action_title">Başlık *</Label>
                        <Input id="action_title" value={formData.action_title || ''} onChange={handleChange} required />
                    </div>
                    <div>
                        <Label htmlFor="action_description">Açıklama *</Label>
                        <Textarea id="action_description" value={formData.action_description || ''} onChange={handleChange} rows={4} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Sorumlu Departman</Label>
                            <SearchableSelectDialog options={departmentOptions} value={formData.responsible_department_id || ''} onChange={(v) => handleSelectChange('responsible_department_id', v)} triggerPlaceholder="Departman seçin..." allowClear />
                        </div>
                        <div>
                            <Label>Sorumlu Kişi</Label>
                            <SearchableSelectDialog options={personnelOptions} value={formData.responsible_person_id || ''} onChange={(v) => handleSelectChange('responsible_person_id', v)} triggerPlaceholder="Kişi seçin..." allowClear />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="planned_start_date">Planlanan Başlangıç</Label>
                            <Input id="planned_start_date" type="date" value={formData.planned_start_date || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="planned_end_date">Planlanan Bitiş</Label>
                            <Input id="planned_end_date" type="date" value={formData.planned_end_date || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="actual_start_date">Gerçekleşen Başlangıç</Label>
                            <Input id="actual_start_date" type="date" value={formData.actual_start_date || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="actual_completion_date">Gerçekleşen Bitiş</Label>
                            <Input id="actual_completion_date" type="date" value={formData.actual_completion_date || ''} onChange={handleChange} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="completion_percentage">Tamamlanma Yüzdesi (%)</Label>
                        <Input id="completion_percentage" type="number" min="0" max="100" value={formData.completion_percentage || 0} onChange={handleChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="estimated_cost">Tahmini Maliyet (TL)</Label>
                            <Input id="estimated_cost" type="number" step="0.01" value={formData.estimated_cost || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="actual_cost">Gerçekleşen Maliyet (TL)</Label>
                            <Input id="actual_cost" type="number" step="0.01" value={formData.actual_cost || ''} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="space-y-2 border-t pt-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="effectiveness_verified" checked={!!formData.effectiveness_verified} onCheckedChange={(c) => handleCheckboxChange('effectiveness_verified', c)} />
                            <Label htmlFor="effectiveness_verified">Etkinlik Doğrulandı</Label>
                        </div>
                        {formData.effectiveness_verified && (
                            <>
                                <div>
                                    <Label htmlFor="effectiveness_verification_date">Doğrulama Tarihi</Label>
                                    <Input id="effectiveness_verification_date" type="date" value={formData.effectiveness_verification_date || ''} onChange={handleChange} />
                                </div>
                                <div>
                                    <Label htmlFor="effectiveness_notes">Doğrulama Notları</Label>
                                    <Textarea id="effectiveness_notes" value={formData.effectiveness_notes || ''} onChange={handleChange} rows={3} />
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                    </div>
                    <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                        <div className="p-5 space-y-5">
                            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Tip:</span><span className="font-medium">{formData.action_type || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Durum:</span><span className="font-medium">{formData.status || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tamamlanma:</span><span className="font-medium">%{formData.completion_percentage ?? 0}</span></div>
                            </div>
                        </div>
                    </div>
                </form>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>İptal</Button>
                    <Button type="submit" form="complaint-action-form" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default ActionFormModal;

