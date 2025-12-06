import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const PHASE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const OVERALL_STATUSES = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];

const DMAICProjectFormModal = ({ open, setOpen, existingProject, onSuccess }) => {
    const { toast } = useToast();
    const { personnel = [] } = useData();
    const [formData, setFormData] = useState({
        project_name: '',
        project_number: '',
        problem_statement: '',
        business_case: '',
        overall_status: 'Planning',
        project_leader_id: null,
        define_status: 'Not Started',
        measure_status: 'Not Started',
        analyze_status: 'Not Started',
        improve_status: 'Not Started',
        control_status: 'Not Started',
        define_summary: '',
        measure_summary: '',
        analyze_summary: '',
        improve_summary: '',
        control_summary: '',
        target_completion_date: '',
        actual_completion_date: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingProject) {
            setFormData({
                ...existingProject,
                target_completion_date: existingProject.target_completion_date || '',
                actual_completion_date: existingProject.actual_completion_date || ''
            });
        } else {
            setFormData({
                project_name: '',
                project_number: '',
                problem_statement: '',
                business_case: '',
                overall_status: 'Planning',
                project_leader_id: null,
                define_status: 'Not Started',
                measure_status: 'Not Started',
                analyze_status: 'Not Started',
                improve_status: 'Not Started',
                control_status: 'Not Started',
                define_summary: '',
                measure_summary: '',
                analyze_summary: '',
                improve_summary: '',
                control_summary: '',
                target_completion_date: '',
                actual_completion_date: ''
            });
        }
    }, [existingProject, open]);

    const generateProjectNumber = () => {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `DMAIC-${year}-${random}`;
    };

    useEffect(() => {
        if (!existingProject && open && !formData.project_number) {
            setFormData(prev => ({ ...prev, project_number: generateProjectNumber() }));
        }
    }, [open, existingProject]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                project_leader_id: formData.project_leader_id || null,
                target_completion_date: formData.target_completion_date || null,
                actual_completion_date: formData.actual_completion_date || null
            };

            if (existingProject) {
                const { error } = await supabase
                    .from('dmaic_projects')
                    .update(dataToSubmit)
                    .eq('id', existingProject.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'DMAIC projesi güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('dmaic_projects')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'DMAIC projesi oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
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

    const personnelOptions = (personnel || []).map(p => ({ value: p.id, label: p.full_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingProject ? 'DMAIC Projesi Düzenle' : 'Yeni DMAIC Projesi'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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
                                <Label htmlFor="project_number">Proje Numarası *</Label>
                                <Input
                                    id="project_number"
                                    value={formData.project_number}
                                    onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="problem_statement">Problem Tanımı *</Label>
                            <Textarea
                                id="problem_statement"
                                value={formData.problem_statement}
                                onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="business_case">İş Gerekçesi</Label>
                            <Textarea
                                id="business_case"
                                value={formData.business_case}
                                onChange={(e) => setFormData({ ...formData, business_case: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="overall_status">Genel Durum</Label>
                                <Select
                                    value={formData.overall_status}
                                    onValueChange={(v) => setFormData({ ...formData, overall_status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {OVERALL_STATUSES.map(s => (
                                            <SelectItem key={s} value={s}>
                                                {s === 'Planning' ? 'Planlama' :
                                                 s === 'In Progress' ? 'Devam Eden' :
                                                 s === 'Completed' ? 'Tamamlanan' :
                                                 s === 'On Hold' ? 'Beklemede' : 'İptal Edildi'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Proje Lideri</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.project_leader_id}
                                    onChange={(v) => setFormData({ ...formData, project_leader_id: v })}
                                    triggerPlaceholder="Personel Seçin"
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
                            {formData.overall_status === 'Completed' && (
                                <div>
                                    <Label htmlFor="actual_completion_date">Gerçek Tamamlanma Tarihi</Label>
                                    <Input
                                        id="actual_completion_date"
                                        type="date"
                                        value={formData.actual_completion_date}
                                        onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">DMAIC Aşamaları</h4>
                            <div className="space-y-3">
                                {['define', 'measure', 'analyze', 'improve', 'control'].map((phase) => (
                                    <div key={phase} className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>{phase.charAt(0).toUpperCase() + phase.slice(1)} Durumu</Label>
                                            <Select
                                                value={formData[`${phase}_status`]}
                                                onValueChange={(v) => setFormData({ ...formData, [`${phase}_status`]: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PHASE_STATUSES.map(s => (
                                                        <SelectItem key={s} value={s}>
                                                            {s === 'Not Started' ? 'Başlanmadı' :
                                                             s === 'In Progress' ? 'Devam Eden' :
                                                             s === 'Completed' ? 'Tamamlanan' : 'Beklemede'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>{phase.charAt(0).toUpperCase() + phase.slice(1)} Özeti</Label>
                                            <Textarea
                                                value={formData[`${phase}_summary`]}
                                                onChange={(e) => setFormData({ ...formData, [`${phase}_summary`]: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
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

export default DMAICProjectFormModal;
