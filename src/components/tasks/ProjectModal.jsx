import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Trash2 } from 'lucide-react';

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
                <DialogHeader>
                    <DialogTitle className="text-foreground">
                        {isEditMode ? 'Projeyi Düzenle' : 'Yeni Proje Oluştur'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditMode 
                            ? 'Proje bilgilerini güncelleyin.' 
                            : 'Görevleri organize etmek için yeni bir proje oluşturun.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                    <DialogFooter className="flex justify-between">
                        <div>
                            {isEditMode && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={saving}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Sil
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                disabled={saving}
                            >
                                İptal
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Kaydediliyor...' : (isEditMode ? 'Güncelle' : 'Oluştur')}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectModal;
