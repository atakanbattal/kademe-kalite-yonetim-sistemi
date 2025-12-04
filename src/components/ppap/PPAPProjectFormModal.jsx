import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const PROJECT_TYPES = ['APQP', 'PPAP', 'Run-at-Rate'];
const PROJECT_STATUSES = [
    'Planning',
    'Design',
    'Process Development',
    'Product Validation',
    'Feedback & Corrective Action',
    'Approved',
    'Rejected'
];
const PRIORITIES = ['Critical', 'High', 'Normal', 'Low'];

const PPAPProjectFormModal = ({ open, setOpen, existingProject, onSuccess }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings, customers } = useData();
    const [formData, setFormData] = useState({
        project_number: '',
        project_name: '',
        customer_id: null,
        part_number: '',
        part_name: '',
        project_type: 'APQP',
        status: 'Planning',
        priority: 'Normal',
        start_date: '',
        target_completion_date: '',
        project_manager_id: null,
        responsible_department_id: null,
        team_members: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingProject) {
            setFormData({
                ...existingProject,
                start_date: existingProject.start_date || '',
                target_completion_date: existingProject.target_completion_date || ''
            });
        } else {
            // Yeni proje numarası oluştur
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            setFormData({
                project_number: `APQP-${year}-${randomNum}`,
                project_name: '',
                customer_id: null,
                part_number: '',
                part_name: '',
                project_type: 'APQP',
                status: 'Planning',
                priority: 'Normal',
                start_date: '',
                target_completion_date: '',
                project_manager_id: null,
                responsible_department_id: null,
                team_members: []
            });
        }
    }, [existingProject, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                start_date: formData.start_date || null,
                target_completion_date: formData.target_completion_date || null
            };

            if (existingProject) {
                const { error } = await supabase
                    .from('apqp_projects')
                    .update(dataToSubmit)
                    .eq('id', existingProject.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Proje güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('apqp_projects')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Proje oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving project:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Proje kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
    const departmentOptions = unitCostSettings.map(u => ({ value: u.id, label: u.unit_name }));
    const customerOptions = customers.map(c => ({ value: c.id, label: c.customer_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingProject ? 'Proje Düzenle' : 'Yeni APQP Projesi'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="project_number">Proje Numarası *</Label>
                                <Input
                                    id="project_number"
                                    value={formData.project_number}
                                    onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="project_name">Proje Adı *</Label>
                                <Input
                                    id="project_name"
                                    value={formData.project_name}
                                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Müşteri</Label>
                                <SearchableSelectDialog
                                    options={customerOptions}
                                    value={formData.customer_id}
                                    onChange={(v) => setFormData({ ...formData, customer_id: v })}
                                    triggerPlaceholder="Müşteri Seçin"
                                />
                            </div>
                            <div>
                                <Label htmlFor="part_number">Parça Numarası</Label>
                                <Input
                                    id="part_number"
                                    value={formData.part_number}
                                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="part_name">Parça Adı</Label>
                                <Input
                                    id="part_name"
                                    value={formData.part_name}
                                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="project_type">Proje Tipi *</Label>
                                <Select
                                    value={formData.project_type}
                                    onValueChange={(v) => setFormData({ ...formData, project_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROJECT_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">Durum *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROJECT_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="priority">Öncelik</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map(priority => (
                                            <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="target_completion_date">Hedef Tamamlanma Tarihi</Label>
                                <Input
                                    id="target_completion_date"
                                    type="date"
                                    value={formData.target_completion_date}
                                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Proje Yöneticisi</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.project_manager_id}
                                    onChange={(v) => setFormData({ ...formData, project_manager_id: v })}
                                    triggerPlaceholder="Personel Seçin"
                                />
                            </div>
                            <div>
                                <Label>Sorumlu Departman</Label>
                                <SearchableSelectDialog
                                    options={departmentOptions}
                                    value={formData.responsible_department_id}
                                    onChange={(v) => setFormData({ ...formData, responsible_department_id: v })}
                                    triggerPlaceholder="Departman Seçin"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PPAPProjectFormModal;

