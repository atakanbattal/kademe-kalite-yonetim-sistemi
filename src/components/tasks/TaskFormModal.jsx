import React, { useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { Checkbox } from '@/components/ui/checkbox';
    import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { ScrollArea } from '@/components/ui/scroll-area';

    const TaskFormModal = ({ isOpen, setIsOpen, task, onSaveSuccess }) => {
        const { personnel, taskTags, taskProjects } = useData();
        const { user } = useAuth();
        const { toast } = useToast();

        const isEditMode = !!task;
        const [saving, setSaving] = useState(false);
        const [formData, setFormData] = useState({});

        const getPersonnelIdFromUser = () => {
            if (!user || !personnel || personnel.length === 0) return null;
            const currentUserPersonnel = personnel.find(p => p.email === user.email);
            return currentUserPersonnel?.id || null;
        };

        const initializeFormData = (taskData) => {
            const ownerPersonnelId = getPersonnelIdFromUser();
            if (taskData) {
                return {
                    id: taskData.id,
                    title: taskData.title || '',
                    description: taskData.description || '',
                    status: taskData.status || 'Bekliyor',
                    priority: taskData.priority || 'Orta',
                    due_date: taskData.due_date ? new Date(taskData.due_date) : null,
                    owner_id: taskData.owner_id || ownerPersonnelId,
                    project_id: taskData.project_id || null, // Proje ID'si
                    assignees: taskData.assignees?.map(a => a.personnel_id || a.personnel.id) || [],
                    tags: taskData.tags?.map(t => t.tag_id || t.task_tags.id) || [],
                    checklist: taskData.checklist?.map(item => ({ ...item, id: item.id || uuidv4() })) || [],
                    task_no: taskData.task_no,
                };
            }
            return {
                title: '',
                description: '',
                status: 'Bekliyor',
                priority: 'Orta',
                due_date: null,
                owner_id: ownerPersonnelId,
                project_id: null, // Proje ID'si
                assignees: [],
                tags: [],
                checklist: [],
            };
        };

        // Modal açıldığında form verilerini initialize et, ama modal açıkken form verilerini koru
        const prevIsOpenRef = React.useRef(false);
        const prevTaskIdRef = React.useRef(null);
        const initializedRef = React.useRef(false);
        
        useEffect(() => {
            // Modal yeni açıldığında (kapalıdan açığa geçiş) form verilerini initialize et
            if (isOpen && !prevIsOpenRef.current) {
                initializedRef.current = false;
                // user ve personnel hazır olana kadar bekle
                if (user && personnel && personnel.length > 0) {
                    setFormData(initializeFormData(task));
                    prevTaskIdRef.current = task?.id || null;
                    initializedRef.current = true;
                }
            }
            // Modal açıkken ve henüz initialize edilmemişse, user/personnel yüklendiğinde initialize et
            else if (isOpen && prevIsOpenRef.current && !initializedRef.current) {
                if (user && personnel && personnel.length > 0) {
                    setFormData(initializeFormData(task));
                    prevTaskIdRef.current = task?.id || null;
                    initializedRef.current = true;
                }
            }
            // Modal açıkken task değiştiğinde (farklı bir görev seçildiğinde) form verilerini güncelle
            else if (isOpen && prevIsOpenRef.current && task?.id !== prevTaskIdRef.current) {
                if (user && personnel && personnel.length > 0) {
                    setFormData(initializeFormData(task));
                    prevTaskIdRef.current = task?.id || null;
                }
            }
            // Modal kapandığında form verilerini temizle
            else if (!isOpen && prevIsOpenRef.current) {
                setFormData({});
                prevTaskIdRef.current = null;
                initializedRef.current = false;
            }
            
            prevIsOpenRef.current = isOpen;
        }, [isOpen, task?.id]); // Sadece modal açılıp kapanmasını ve task değişimini dinle - personnel/user değişiklikleri form verilerini sıfırlamaz
        
        // user ve personnel yüklendiğinde, modal açıksa ve henüz initialize edilmemişse initialize et
        useEffect(() => {
            if (isOpen && !initializedRef.current && user && personnel && personnel.length > 0) {
                setFormData(initializeFormData(task));
                prevTaskIdRef.current = task?.id || null;
                initializedRef.current = true;
            }
        }, [user, personnel.length]); // Sadece user ve personnel yüklendiğinde çalış

        const handleInputChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSelectChange = (name, value) => {
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleMultiSelectChange = (name, selected) => {
            setFormData(prev => ({ ...prev, [name]: selected }));
        };

        const handleChecklistChange = (index, field, value) => {
            const newChecklist = [...formData.checklist];
            newChecklist[index][field] = value;
            setFormData(prev => ({ ...prev, checklist: newChecklist }));
        };

        const addChecklistItem = () => {
            setFormData(prev => ({
                ...prev,
                checklist: [...(prev.checklist || []), { id: uuidv4(), item_text: '', is_completed: false }]
            }));
        };

        const removeChecklistItem = (index) => {
            const newChecklist = formData.checklist.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, checklist: newChecklist }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!formData.owner_id) {
                toast({ variant: 'destructive', title: 'Hata!', description: 'Görevi oluşturan kişi bilgisi eksik. Lütfen tekrar deneyin.' });
                return;
            }
            setSaving(true);

            const { assignees, tags, checklist, ...taskCoreData } = formData;
            
            const { id, created_at, updated_at, task_no, ...dbData } = taskCoreData;
            if (dbData.due_date === '') dbData.due_date = null;

            // Geçerli tasks tablosu kolonlarını tanımla
            const validColumns = new Set([
                'title', 'description', 'owner_id', 'approver_id', 'start_date', 'due_date',
                'completed_at', 'priority', 'status', 'wip_limit', 'blocked_reason',
                'related_df_id', 'related_vehicle_id', 'related_kaizen_id', 'assignees_text', 'tags_text',
                'project_id' // Proje ID'si
            ]);

            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dbData) {
                if (dbData[key] !== undefined && key !== 'undefined' && validColumns.has(key)) {
                    cleanedData[key] = dbData[key];
                }
            }

            try {
                let savedTask;
                if (isEditMode) {
                    const { data, error } = await supabase.from('tasks').update(cleanedData).eq('id', id).select().single();
                    if (error) throw error;
                    savedTask = data;
                } else {
                    const { data, error } = await supabase.from('tasks').insert(cleanedData).select().single();
                    if (error) throw error;
                    savedTask = data;
                }

                await supabase.from('task_assignees').delete().eq('task_id', savedTask.id);
                if (assignees && assignees.length > 0) {
                    const newAssignees = assignees.map(personnel_id => ({ task_id: savedTask.id, personnel_id }));
                    const { error } = await supabase.from('task_assignees').insert(newAssignees);
                    if (error) throw error;
                }

                await supabase.from('task_tag_relations').delete().eq('task_id', savedTask.id);
                if (tags && tags.length > 0) {
                    const newTags = tags.map(tag_id => ({ task_id: savedTask.id, tag_id }));
                    const { error } = await supabase.from('task_tag_relations').insert(newTags);
                    if (error) throw error;
                }

                const checklistToSave = (checklist || []).filter(item => item.item_text.trim() !== '');
                const { data: existingChecklist } = await supabase.from('task_checklists').select('id').eq('task_id', savedTask.id);
                const existingIds = new Set((existingChecklist || []).map(i => i.id));
                
                const toDelete = Array.from(existingIds).filter(exId => !checklistToSave.some(item => item.id === exId));
                if (toDelete.length > 0) {
                    await supabase.from('task_checklists').delete().in('id', toDelete);
                }

                const now = new Date().toISOString();
                const toUpsert = checklistToSave.map(({ id: itemId, created_at, ...item }) => {
                    const isNewItem = !existingIds.has(itemId);
                    return {
                        ...item,
                        id: itemId,
                        task_id: savedTask.id,
                        created_at: isNewItem ? now : created_at,
                    };
                });

                if (toUpsert.length > 0) {
                    const { error } = await supabase.from('task_checklists').upsert(toUpsert, { onConflict: 'id' });
                    if (error) throw error;
                }

                toast({ title: 'Başarılı!', description: 'Görev başarıyla kaydedildi.' });
                onSaveSuccess();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Görev kaydedilemedi: ${error.message}` });
            } finally {
                setSaving(false);
            }
        };

        if (!user && isOpen) {
            return (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yükleniyor...</DialogTitle>
                            <DialogDescription>Kullanıcı bilgileri alınıyor, lütfen bekleyin.</DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            );
        }

        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const tagOptions = taskTags.map(t => ({ value: t.id, label: t.name }));
        const projectOptions = (taskProjects || []).map(p => ({ value: p.id, label: p.name, color: p.color }));

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-4xl w-[95vw]">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? `Görevi Düzenle: ${formData.task_no || ''}` : 'Yeni Görev Oluştur'}</DialogTitle>
                        <DialogDescription>
                            {isEditMode ? 'Görev detaylarını güncelleyin.' : 'Yeni bir görev oluşturun ve atamaları yapın.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <ScrollArea className="h-[65vh] p-1">
                            <div className="space-y-6 p-4">
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="title">Görev Başlığı <span className="text-red-500">*</span></Label>
                                                        <Input id="title" name="title" value={formData.title || ''} onChange={handleInputChange} required />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="project_id">Proje / Konu</Label>
                                                        <Select value={formData.project_id || 'none'} onValueChange={(value) => handleSelectChange('project_id', value === 'none' ? null : value)}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Proje seçin..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">
                                                                    <span className="text-muted-foreground">Proje seçilmedi</span>
                                                                </SelectItem>
                                                                {projectOptions.map(option => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: option.color }} />
                                                                            {option.label}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="owner_id">Görevi Atayan</Label>
                                                    <Select value={formData.owner_id || ''} onValueChange={(value) => handleSelectChange('owner_id', value)}>
                                                        <SelectTrigger><SelectValue placeholder="Atayan kişiyi seçin..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {personnelOptions.map(option => (
                                                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="assignees">Atanan Personeller</Label>
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1">
                                                            <MultiSelectPopover
                                                                options={personnelOptions}
                                                                value={formData.assignees || []}
                                                                onChange={(selected) => handleMultiSelectChange('assignees', selected)}
                                                                placeholder="Personel seçin..."
                                                            />
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon"
                                                            className="h-10 w-10 text-muted-foreground hover:text-destructive flex-shrink-0"
                                                            onClick={() => handleMultiSelectChange('assignees', [])}
                                                            title="Seçimi Temizle"
                                                            disabled={!formData.assignees || formData.assignees.length === 0}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Açıklama</Label>
                                    <Textarea id="description" name="description" value={formData.description || ''} onChange={handleInputChange} rows={5} />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <Label>Durum</Label>
                                        <Select value={formData.status || 'Bekliyor'} onValueChange={(value) => handleSelectChange('status', value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Bekliyor">Bekliyor</SelectItem>
                                                <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                                                <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                                                <SelectItem value="Engellendi">Engellendi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Öncelik</Label>
                                        <Select value={formData.priority || 'Orta'} onValueChange={(value) => handleSelectChange('priority', value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Düşük">Düşük</SelectItem>
                                                <SelectItem value="Orta">Orta</SelectItem>
                                                <SelectItem value="Yüksek">Yüksek</SelectItem>
                                                <SelectItem value="Kritik">Kritik</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bitiş Tarihi</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.due_date ? format(formData.due_date, 'PPP', { locale: tr }) : <span>Tarih seçin</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar locale={tr} mode="single" selected={formData.due_date} onSelect={(date) => handleSelectChange('due_date', date)} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Etiketler</Label>
                                        <MultiSelectPopover
                                            options={tagOptions}
                                            value={formData.tags || []}
                                            onChange={(selected) => handleMultiSelectChange('tags', selected)}
                                            placeholder="Etiket seçin..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Alt Görevler</Label>
                                    <div className="space-y-2 mt-2">
                                        {(formData.checklist || []).map((item, index) => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <Checkbox checked={item.is_completed} onCheckedChange={(checked) => handleChecklistChange(index, 'is_completed', checked)} />
                                                <Input value={item.item_text} onChange={(e) => handleChecklistChange(index, 'item_text', e.target.value)} className={item.is_completed ? 'line-through' : ''} />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeChecklistItem(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                                            <Plus className="h-4 w-4 mr-2" /> Alt Görev Ekle
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
                                İptal
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Kaydediliyor...' : 'Görevi Kaydet'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default TaskFormModal;