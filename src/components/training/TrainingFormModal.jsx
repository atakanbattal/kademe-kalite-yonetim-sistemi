import React, { useState, useEffect, useCallback } from 'react';
    import {
        Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
    } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
    import { Calendar as CalendarIcon } from 'lucide-react';
    import { Calendar } from '@/components/ui/calendar';
    import { cn } from '@/lib/utils';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useData } from '@/contexts/DataContext';
    import { MultiSelect } from '@/components/ui/multi-select';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { ScrollArea } from '@/components/ui/scroll-area';

    const TRAINING_CATEGORIES = ['Oryantasyon', 'Teknik', 'İSG', 'Kalite', 'Yönetim', 'Diğer'];
    const TRAINING_TYPES = ['İç', 'Dış', 'Online', 'Hibrit'];
    const TRAINING_STATUSES = ['Planlandı', 'Aktif', 'Onay Bekliyor', 'Onaylandı', 'Tamamlandı', 'İptal'];

    const TrainingFormModal = ({ isOpen, setIsOpen, training, onSave }) => {
        const { toast } = useToast();
        const { personnel } = useData();
        const [formData, setFormData] = useState({});
        const [selectedParticipants, setSelectedParticipants] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);

        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));

        const resetForm = useCallback(() => {
            setFormData({
                title: '',
                description: '',
                instructor: '',
                start_date: null,
                end_date: null,
                category: '',
                training_type: '',
                location: '',
                duration_hours: 0,
                capacity: 0,
                target_audience: '',
                objectives: '',
                prerequisites: '',
                status: 'Planlandı',
            });
            setSelectedParticipants([]);
        }, []);

        useEffect(() => {
            const initialize = async () => {
                if (isOpen && training) {
                    // Düzenleme modu: mevcut kaydı yükle
                    console.log('📝 Training Düzenleme modu: kayıt yükleniyor', training.id);
                    setFormData({
                        ...training,
                        start_date: training.start_date ? new Date(training.start_date) : null,
                        end_date: training.end_date ? new Date(training.end_date) : null,
                    });
                    const { data, error } = await supabase
                        .from('training_participants')
                        .select('personnel_id')
                        .eq('training_id', training.id);
                    if (!error) {
                        setSelectedParticipants(data.map(p => p.personnel_id));
                    }
                } else if (isOpen && !training) {
                    // Yeni kayıt modu: form sıfırla
                    console.log('✨ Training Yeni kayıt modu: form sıfırlanıyor');
                    resetForm();
                }
                // NOT: Modal kapandığında (isOpen=false) hiçbir şey yapma - verileri koru!
            };
            if (isOpen || training) initialize();
        }, [isOpen, training, resetForm]);

        const handleChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSelectChange = (name, value) => {
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);

            let training_id = training?.id;
            const { training_participants, ...dbData } = formData;

            if (training) {
                const { error } = await supabase.from('trainings').update(dbData).eq('id', training.id);
                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Eğitim güncellenemedi: ${error.message}` });
                    setIsSubmitting(false);
                    return;
                }
            } else {
                const { data: codeData, error: codeError } = await supabase.rpc('generate_training_code');
                if (codeError) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Eğitim kodu oluşturulamadı: ${codeError.message}` });
                    setIsSubmitting(false);
                    return;
                }
                dbData.training_code = codeData;
                const { data, error } = await supabase.from('trainings').insert(dbData).select().single();
                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Eğitim oluşturulamadı: ${error.message}` });
                    setIsSubmitting(false);
                    return;
                }
                training_id = data.id;
            }

            const { data: existingParticipantsData } = await supabase.from('training_participants').select('personnel_id').eq('training_id', training_id);
            const existingParticipants = existingParticipantsData.map(p => p.personnel_id);
            const toAdd = selectedParticipants.filter(p => !existingParticipants.includes(p));
            const toRemove = existingParticipants.filter(p => !selectedParticipants.includes(p));

            if (toAdd.length > 0) {
                await supabase.from('training_participants').insert(toAdd.map(personnel_id => ({ training_id, personnel_id, status: 'Kayıtlı' })));
            }
            if (toRemove.length > 0) {
                await supabase.from('training_participants').delete().eq('training_id', training_id).in('personnel_id', toRemove);
            }

            toast({ title: 'Başarılı', description: `Eğitim başarıyla ${training ? 'güncellendi' : 'oluşturuldu'}.` });
            setIsSubmitting(false);
            onSave();
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{training ? 'Eğitimi Düzenle' : 'Yeni Eğitim Planı Oluştur'}</DialogTitle>
                        <DialogDescription>Eğitim detaylarını doldurun ve katılımcıları seçin.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <ScrollArea className="h-[70vh] p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2"><Label>Eğitim Adı *</Label><Input name="title" value={formData.title || ''} onChange={handleChange} required /></div>
                                <div className="space-y-2"><Label>Kategori</Label><Select name="category" value={formData.category || ''} onValueChange={(v) => handleSelectChange('category', v)}><SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger><SelectContent>{TRAINING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>Eğitim Türü</Label><Select name="training_type" value={formData.training_type || ''} onValueChange={(v) => handleSelectChange('training_type', v)}><SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger><SelectContent>{TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>Eğitmen</Label><Input name="instructor" value={formData.instructor || ''} onChange={handleChange} /></div>
                                <div className="space-y-2"><Label>Başlangıç Tarihi</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.start_date ? format(formData.start_date, "PPP", { locale: tr }) : <span>Tarih seçin</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.start_date} onSelect={(d) => setFormData(p => ({ ...p, start_date: d }))} initialFocus locale={tr} /></PopoverContent></Popover></div>
                                <div className="space-y-2"><Label>Bitiş Tarihi</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.end_date ? format(formData.end_date, "PPP", { locale: tr }) : <span>Tarih seçin</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.end_date} onSelect={(d) => setFormData(p => ({ ...p, end_date: d }))} initialFocus locale={tr} /></PopoverContent></Popover></div>
                                <div className="space-y-2"><Label>Eğitim Yeri/Platform</Label><Input name="location" value={formData.location || ''} onChange={handleChange} /></div>
                                <div className="space-y-2"><Label>Süre (saat)</Label><Input type="number" name="duration_hours" value={formData.duration_hours || ''} onChange={handleChange} /></div>
                                <div className="space-y-2"><Label>Kontenjan</Label><Input type="number" name="capacity" value={formData.capacity || ''} onChange={handleChange} /></div>
                                <div className="space-y-2"><Label>Durum</Label><Select name="status" value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)}><SelectTrigger><SelectValue placeholder="Durum seçin" /></SelectTrigger><SelectContent>{TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2 col-span-full"><Label>Hedef Kitle</Label><Input name="target_audience" value={formData.target_audience || ''} onChange={handleChange} /></div>
                                <div className="space-y-2 col-span-full"><Label>Açıklama</Label><Textarea name="description" value={formData.description || ''} onChange={handleChange} /></div>
                                <div className="space-y-2 col-span-full"><Label>Eğitim Hedefleri</Label><Textarea name="objectives" value={formData.objectives || ''} onChange={handleChange} /></div>
                                <div className="space-y-2 col-span-full"><Label>Ön Koşullar</Label><Textarea name="prerequisites" value={formData.prerequisites || ''} onChange={handleChange} /></div>
                                <div className="space-y-2 col-span-full"><Label>Katılımcılar</Label><MultiSelect options={personnelOptions} value={selectedParticipants} onChange={setSelectedParticipants} placeholder="Personel seçin..." /></div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="pt-4 mt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default TrainingFormModal;