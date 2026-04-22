import React, { useState, useEffect } from 'react';
    import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
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
    import { Calendar as CalendarIcon, Plus, Trash2, CheckSquare, Hash, User } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Badge } from '@/components/ui/badge';
    import { Separator } from '@/components/ui/separator';

    const TaskFormModal = ({ isOpen, setIsOpen, task, onSaveSuccess, defaultProjectId = null }) => {
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
                project_id: defaultProjectId || null, // Aktif proje otomatik seçilir
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
                <ModernModalLayout open={isOpen} onOpenChange={setIsOpen} title="Yükleniyor..." subtitle="Kullanıcı bilgileri alınıyor" icon={<CheckSquare className="h-5 w-5 text-white" />} onCancel={() => setIsOpen(false)} onSubmit={() => setIsOpen(false)} submitLabel="Kapat" footerLeft={null}>
                    <div className="p-6 text-muted-foreground text-sm">Lütfen bekleyin.</div>
                </ModernModalLayout>
            );
        }

        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const tagOptions = taskTags.map(t => ({ value: t.id, label: t.name }));
        const projectOptions = (taskProjects || []).map(p => ({ value: p.id, label: p.name, color: p.color }));
        const ownerName = personnel.find(p => p.id === formData.owner_id)?.full_name || '-';
        const projectName = (taskProjects || []).find(p => p.id === formData.project_id)?.name || '-';
        const rightPanel = (
            <div className="p-5 space-y-4">
                {/* Görev Kartı */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                    <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><CheckSquare className="w-20 h-20" /></div>
                    <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-primary" />
                        <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Görev</p>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{formData.title || '-'}</p>
                    {formData.task_no && <p className="text-xs text-muted-foreground mt-1 font-mono">{formData.task_no}</p>}
                </div>

                {/* Durum & Öncelik Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{formData.status || 'Beklemede'}</Badge>
                    {formData.priority && (
                        <Badge className={`text-[10px] ${
                            formData.priority === 'Kritik' ? 'bg-red-100 text-red-800' :
                            formData.priority === 'Yüksek' ? 'bg-orange-100 text-orange-800' :
                            formData.priority === 'Orta' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>{formData.priority}</Badge>
                    )}
                </div>

                <Separator className="my-1" />

                {/* Kişiler */}
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <User className="w-3 h-3" /> Kişiler & Proje
                    </p>
                    <div className="space-y-1.5 pl-1">
                        {[
                            { label: 'Görevi Atayan', value: ownerName },
                            { label: 'Proje / Konu', value: projectName },
                        ].map(({ label, value }) => (
                            <div key={label} className="py-1">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                                <p className="text-xs font-semibold truncate text-foreground">
                                    {value && value !== '-' ? value : <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator className="my-1" />

                {/* Tarih */}
                <div className="flex items-start gap-2.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bitiş Tarihi</p>
                        <p className="text-xs font-semibold text-foreground">
                            {formData.due_date ? format(formData.due_date, 'd MMMM yyyy', { locale: tr }) : <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                        </p>
                    </div>
                </div>

                {/* Açıklama Önizleme */}
                {formData.description && (
                    <>
                        <Separator className="my-1" />
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Açıklama</p>
                            <p className="text-[11px] text-foreground leading-relaxed line-clamp-4 bg-muted/30 rounded-lg p-2.5 border">
                                {formData.description}
                            </p>
                        </div>
                    </>
                )}
            </div>
        );

        return (
            <ModernModalLayout
                open={isOpen}
                onOpenChange={setIsOpen}
                title={isEditMode ? `Görevi Düzenle: ${formData.task_no || ''}` : 'Yeni Görev Oluştur'}
                subtitle="Görev Yönetimi"
                icon={<CheckSquare className="h-5 w-5 text-white" />}
                badge={isEditMode ? 'Düzenleme' : 'Yeni'}
                onCancel={() => setIsOpen(false)}
                onSubmit={handleSubmit}
                isSubmitting={saving}
                submitLabel="Görevi Kaydet"
                cancelLabel="İptal"
                formId="task-form"
                footerDate={formData.due_date}
                rightPanel={rightPanel}
            >
                    <form id="task-form" onSubmit={handleSubmit}>
                        <ScrollArea className="h-[65vh] p-1">
                            <div className="space-y-6 p-4">
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="title">Görev Başlığı <span className="text-red-500">*</span></Label>
                                                        <Input id="title" name="title" value={formData.title || ''} onChange={handleInputChange} required autoFormat={false} />
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
                                                <Input autoFormat={false} value={item.item_text} onChange={(e) => handleChecklistChange(index, 'item_text', e.target.value)} className={item.is_completed ? 'line-through' : ''} />
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
                    </form>
            </ModernModalLayout>
        );
    };

    export default TaskFormModal;