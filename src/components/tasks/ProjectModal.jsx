import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Trash2, FolderKanban, Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROJECT_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#d946ef', // Fuchsia
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6b7280', // Gray
];

const ProjectModal = ({ isOpen, setIsOpen, project, onSaveSuccess }) => {
    const { toast } = useToast();
    const isEditMode = !!project;
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#6366f1',
        status: 'Aktif'
    });

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && project) {
                setFormData({
                    name: project.name || '',
                    description: project.description || '',
                    color: project.color || '#6366f1',
                    status: project.status || 'Aktif'
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
                    status: 'Aktif'
                });
            }
        }
    }, [isOpen, isEditMode, project]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Proje adı zorunludur.' });
            return;
        }

        setSaving(true);
        try {
            if (isEditMode) {
                const { error } = await supabase
                    .from('task_projects')
                    .update({
                        name: formData.name.trim(),
                        description: formData.description?.trim() || null,
                        color: formData.color,
                        status: formData.status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', project.id);
                if (error) throw error;
                toast({ title: 'Proje güncellendi' });
            } else {
                const { error } = await supabase
                    .from('task_projects')
                    .insert([{
                        name: formData.name.trim(),
                        description: formData.description?.trim() || null,
                        color: formData.color,
                        status: formData.status
                    }]);
                if (error) throw error;
                toast({ title: 'Proje oluşturuldu' });
            }

            setIsOpen(false);
            if (onSaveSuccess) onSaveSuccess();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Proje kaydedilemedi: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isEditMode || !project) return;
        if (!confirm('Bu projeyi silmek istediğinizden emin misiniz?')) return;

        setSaving(true);
        try {
            // Önce bu projedeki görevlerin project_id'sini null yap
            await supabase.from('tasks').update({ project_id: null }).eq('project_id', project.id);
            
            const { error } = await supabase.from('task_projects').delete().eq('id', project.id);
            if (error) throw error;
            toast({ title: 'Proje silindi' });
            setIsOpen(false);
            if (onSaveSuccess) onSaveSuccess();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Proje silinemedi: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
                <DialogHeader className="sr-only"><DialogTitle>{isEditMode ? 'Projeyi Düzenle' : 'Yeni Proje'}</DialogTitle></DialogHeader>
                {/* Header */}
                <div 
                    className="px-6 py-5 flex items-center gap-3 transition-colors duration-300"
                    style={{ backgroundColor: formData.color + '15' }}
                >
                    <div 
                        className="p-2 rounded-lg transition-colors duration-300"
                        style={{ backgroundColor: formData.color + '30' }}
                    >
                        <FolderKanban className="h-5 w-5" style={{ color: formData.color }} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">
                            {isEditMode ? 'Projeyi Düzenle' : 'Yeni Proje'}
                        </h2>
                        <p className="text-xs text-muted-foreground">Görevlerinizi proje altında organize edin</p>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Proje Adı <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Proje adını girin..."
                            required
                            autoFocus
                            autoFormat={false}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Kısa açıklama (opsiyonel)..."
                            rows={3}
                        />
                    </div>

                    {/* Color Picker */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5" />
                            Proje Rengi
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {PROJECT_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                                    className={cn(
                                        'h-7 w-7 rounded-full transition-all duration-150 flex items-center justify-center',
                                        formData.color === color 
                                            ? 'ring-2 ring-offset-2 ring-offset-background scale-110' 
                                            : 'hover:scale-110'
                                    )}
                                    style={{ 
                                        backgroundColor: color,
                                        ringColor: color
                                    }}
                                >
                                    {formData.color === color && (
                                        <Check className="h-3.5 w-3.5 text-white" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status (only in edit mode) */}
                    {isEditMode && (
                        <div className="space-y-2">
                            <Label>Durum</Label>
                            <div className="flex gap-2">
                                {['Aktif', 'Tamamlandı', 'Arşivlendi'].map(status => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status }))}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                            formData.status === status
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                                        )}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between pt-3 border-t border-border">
                        <div>
                            {isEditMode && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                                    <Trash2 className="h-3.5 w-3.5" /> Sil
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={saving}>
                                İptal
                            </Button>
                            <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                                {saving ? 'Kaydediliyor...' : isEditMode ? 'Güncelle' : 'Oluştur'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectModal;
