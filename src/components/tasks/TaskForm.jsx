import React, { useState, useEffect, useCallback } from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { Helmet } from 'react-helmet';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { Checkbox } from '@/components/ui/checkbox';
    import { MultiSelect } from '@/components/ui/multi-select';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { format } from 'date-fns';
    import { Calendar as CalendarIcon, Plus, Trash2, ArrowLeft } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';

    const TaskForm = () => {
        const { id } = useParams();
        const navigate = useNavigate();
        const { personnel, taskTags, refreshData } = useData();
        const { profile } = useAuth();
        const { toast } = useToast();

        const [isEditMode, setIsEditMode] = useState(false);
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);
        const [formData, setFormData] = useState({
            title: '',
            description: '',
            status: 'Bekliyor',
            priority: 'Orta',
            due_date: null,
            owner_id: profile?.id || '',
            assignees: [],
            tags: [],
            checklist: [],
        });

        useEffect(() => {
            if (id) {
                setIsEditMode(true);
                const fetchTask = async () => {
                    setLoading(true);
                    const { data, error } = await supabase
                        .from('tasks')
                        .select('*, assignees:task_assignees(personnel_id), tags:task_tag_relations(tag_id), checklist:task_checklists(*)')
                        .eq('id', id)
                        .single();

                    if (error) {
                        toast({ variant: 'destructive', title: 'Hata!', description: 'Görev yüklenemedi.' });
                        navigate('/tasks');
                    } else {
                        setFormData({
                            ...data,
                            assignees: data.assignees.map(a => a.personnel_id),
                            tags: data.tags.map(t => t.tag_id),
                            checklist: data.checklist || [],
                        });
                    }
                    setLoading(false);
                };
                fetchTask();
            } else {
                setIsEditMode(false);
                setFormData(prev => ({ ...prev, owner_id: profile?.id }));
                setLoading(false);
            }
        }, [id, navigate, toast, profile]);

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
                checklist: [...prev.checklist, { id: `new-${uuidv4()}`, item_text: '', is_completed: false }]
            }));
        };

        const removeChecklistItem = (index) => {
            const newChecklist = formData.checklist.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, checklist: newChecklist }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);

            const { assignees, tags, checklist, ...taskCoreData } = formData;
            
            // Clean up core data
            const { created_at, updated_at, task_no, ...dbData } = taskCoreData;
            if (dbData.due_date === '') dbData.due_date = null;

            // Geçerli tasks tablosu kolonlarını tanımla
            const validColumns = new Set([
                'title', 'description', 'owner_id', 'approver_id', 'start_date', 'due_date',
                'completed_at', 'priority', 'status', 'wip_limit', 'blocked_reason',
                'related_df_id', 'related_vehicle_id', 'related_kaizen_id', 'assignees_text', 'tags_text'
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

                // Handle assignees
                await supabase.from('task_assignees').delete().eq('task_id', savedTask.id);
                if (assignees && assignees.length > 0) {
                    const newAssignees = assignees.map(personnel_id => ({ task_id: savedTask.id, personnel_id }));
                    const { error } = await supabase.from('task_assignees').insert(newAssignees);
                    if (error) throw error;
                }

                // Handle tags
                await supabase.from('task_tag_relations').delete().eq('task_id', savedTask.id);
                if (tags && tags.length > 0) {
                    const newTags = tags.map(tag_id => ({ task_id: savedTask.id, tag_id }));
                    const { error } = await supabase.from('task_tag_relations').insert(newTags);
                    if (error) throw error;
                }

                // Handle checklist
                await supabase.from('task_checklists').delete().eq('task_id', savedTask.id);
                if (checklist && checklist.length > 0) {
                    const now = new Date().toISOString();
                    const newChecklistItems = checklist
                        .filter(item => item.item_text.trim() !== '')
                        .map(({ id: itemId, ...item }) => ({ 
                            ...item, 
                            task_id: savedTask.id,
                            created_at: now
                        }));
                    if (newChecklistItems.length > 0) {
                        const { error } = await supabase.from('task_checklists').insert(newChecklistItems);
                        if (error) throw error;
                    }
                }

                toast({ title: 'Başarılı!', description: 'Görev başarıyla kaydedildi.' });
                refreshData();
                navigate('/');
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Görev kaydedilemedi: ${error.message}` });
            } finally {
                setSaving(false);
            }
        };

        if (loading) {
            return <div className="flex justify-center items-center h-full">Yükleniyor...</div>;
        }

        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const tagOptions = taskTags.map(t => ({ value: t.id, label: t.name }));

        return (
            <div className="max-w-4xl mx-auto p-4">
                <Helmet>
                    <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
                </Helmet>
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="outline" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold">{isEditMode ? `Görevi Düzenle: ${formData.task_no || ''}` : 'Yeni Görev Oluştur'}</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Görev Başlığı</Label>
                            <Input id="title" name="title" value={formData.title} onChange={handleInputChange} required autoFormat={false} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="assignees">Atanan Personeller</Label>
                            <MultiSelect
                                options={personnelOptions}
                                selected={formData.assignees}
                                onChange={(selected) => handleMultiSelectChange('assignees', selected)}
                                placeholder="Personel seçin..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={5} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Label>Durum</Label>
                            <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
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
                            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
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
                                        {formData.due_date ? format(new Date(formData.due_date), 'PPP') : <span>Tarih seçin</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={formData.due_date ? new Date(formData.due_date) : null} onSelect={(date) => handleSelectChange('due_date', date)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Etiketler</Label>
                            <MultiSelect
                                options={tagOptions}
                                selected={formData.tags}
                                onChange={(selected) => handleMultiSelectChange('tags', selected)}
                                placeholder="Etiket seçin..."
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Alt Görevler</Label>
                        <div className="space-y-2 mt-2">
                            {formData.checklist.map((item, index) => (
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

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={saving}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Kaydediliyor...' : 'Görevi Kaydet'}
                        </Button>
                    </div>
                </form>
            </div>
        );
    };

    export default TaskForm;