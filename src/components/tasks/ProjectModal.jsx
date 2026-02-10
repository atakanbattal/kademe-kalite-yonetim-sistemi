import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Trash2, FolderKanban } from 'lucide-react';

const ProjectModal = ({ isOpen, setIsOpen, project, onSaveSuccess }) => {
    const { toast } = useToast();
    const isEditMode = !!project;
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_active: true
    });

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && project) {
                setFormData({
                    name: project.name || '',
                    description: project.description || '',
                    is_active: project.is_active !== undefined ? project.is_active : true
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    is_active: true
                });
            }
        }
    }, [isOpen, isEditMode, project]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckboxChange = (checked) => {
        setFormData(prev => ({ ...prev, is_active: checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || formData.name.trim() === '') {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Proje adı zorunludur.'
            });
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (isEditMode) {
                const { error } = await supabase
                    .from('task_projects')
                    .update({
                        name: formData.name.trim(),
                        description: formData.description?.trim() || null,
                        is_active: formData.is_active,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', project.id);

                if (error) {
                    throw error;
                }

                toast({
                    title: 'Başarılı!',
                    description: 'Proje güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('task_projects')
                    .insert([{
                        name: formData.name.trim(),
                        description: formData.description?.trim() || null,
                        is_active: formData.is_active,
                        created_by: user?.id || null
                    }])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                toast({
                    title: 'Başarılı!',
                    description: 'Proje oluşturuldu.'
                });
            }

            setIsOpen(false);
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Proje kaydedilemedi: ${error.message}`
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isEditMode || !project) return;

        if (!confirm('Bu projeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('task_projects')
                .delete()
                .eq('id', project.id);

            if (error) {
                throw error;
            }

            toast({
                title: 'Başarılı!',
                description: 'Proje silindi.'
            });

            setIsOpen(false);
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Proje silinemedi: ${error.message}`
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><FolderKanban className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Projeyi Düzenle' : 'Yeni Proje Oluştur'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Görev Yönetimi</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{isEditMode ? 'Düzenleme' : 'Yeni'}</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <form id="project-form" onSubmit={handleSubmit} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-4 border-r border-border space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Proje Adı <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Proje adını girin..."
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Proje açıklamasını girin..."
                            rows={4}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => handleCheckboxChange(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="is_active" className="cursor-pointer">
                            Aktif
                        </Label>
                    </div>
                    </div>
                </form>
                <aside className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4 px-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Özet</h3>
                    <div className="space-y-3">
                        <div className="bg-background rounded-xl p-4 shadow-sm border border-border">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Proje</p>
                            <p className="font-bold text-foreground truncate">{formData.name || '-'}</p>
                        </div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Durum:</span><span className="font-semibold text-foreground">{formData.is_active ? 'Aktif' : 'Pasif'}</span></div>
                    </div>
                </aside>
                </div>
                <footer className="flex shrink-0 justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
                    <div>
                        {isEditMode && (
                            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>İptal</Button>
                        <Button form="project-form" type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : (isEditMode ? 'Güncelle' : 'Oluştur')}</Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectModal;
