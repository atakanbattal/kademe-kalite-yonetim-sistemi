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

const DMAICProjectFormModal = ({ open, setOpen, existingProject, onSuccess }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [formData, setFormData] = useState({
        project_number: '',
        project_name: '',
        project_type: 'DMAIC',
        priority: 'Medium',
        problem_statement: '',
        business_case: '',
        project_scope: '',
        financial_impact: null,
        start_date: '',
        target_completion_date: '',
        project_leader_id: null,
        champion_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (existingProject) {
                setFormData({
                    project_number: existingProject.project_number || '',
                    project_name: existingProject.project_name || '',
                    project_type: existingProject.project_type || 'DMAIC',
                    priority: existingProject.priority || 'Medium',
                    problem_statement: existingProject.problem_statement || '',
                    business_case: existingProject.business_case || '',
                    project_scope: existingProject.project_scope || '',
                    financial_impact: existingProject.financial_impact || null,
                    start_date: existingProject.start_date || '',
                    target_completion_date: existingProject.target_completion_date || '',
                    project_leader_id: existingProject.project_leader_id || null,
                    champion_id: existingProject.champion_id || null
                });
            } else {
                setFormData({
                    project_number: '',
                    project_name: '',
                    project_type: 'DMAIC',
                    priority: 'Medium',
                    problem_statement: '',
                    business_case: '',
                    project_scope: '',
                    financial_impact: null,
                    start_date: '',
                    target_completion_date: '',
                    project_leader_id: null,
                    champion_id: null
                });
            }
        }
    }, [open, existingProject]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                financial_impact: formData.financial_impact ? parseFloat(formData.financial_impact) : null,
                start_date: formData.start_date || null,
                target_completion_date: formData.target_completion_date || null,
                project_leader_id: formData.project_leader_id || null,
                champion_id: formData.champion_id || null
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
            console.error('DMAIC project save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'DMAIC projesi kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({
        value: p.id,
        label: p.full_name
    }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingProject ? 'DMAIC Projesi Düzenle' : 'Yeni DMAIC Projesi'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="project_number">Proje Numarası <span className="text-red-500">*</span></Label>
                                <Input
                                    id="project_number"
                                    value={formData.project_number}
                                    onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="project_type">Proje Tipi</Label>
                                <Select
                                    value={formData.project_type}
                                    onValueChange={(value) => setFormData({ ...formData, project_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DMAIC">DMAIC</SelectItem>
                                        <SelectItem value="DMADV">DMADV</SelectItem>
                                        <SelectItem value="Quick Win">Quick Win</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="project_name">Proje Adı <span className="text-red-500">*</span></Label>
                            <Input
                                id="project_name"
                                value={formData.project_name}
                                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="priority">Öncelik</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(value) => setFormData({ ...formData, priority: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Düşük</SelectItem>
                                    <SelectItem value="Medium">Orta</SelectItem>
                                    <SelectItem value="High">Yüksek</SelectItem>
                                    <SelectItem value="Critical">Kritik</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="problem_statement">Problem Tanımı</Label>
                            <Textarea
                                id="problem_statement"
                                value={formData.problem_statement}
                                onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label htmlFor="business_case">İş Gerekçesi</Label>
                            <Textarea
                                id="business_case"
                                value={formData.business_case}
                                onChange={(e) => setFormData({ ...formData, business_case: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label htmlFor="project_scope">Proje Kapsamı</Label>
                            <Textarea
                                id="project_scope"
                                value={formData.project_scope}
                                onChange={(e) => setFormData({ ...formData, project_scope: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="financial_impact">Finansal Etki (₺)</Label>
                                <Input
                                    id="financial_impact"
                                    type="number"
                                    step="0.01"
                                    value={formData.financial_impact || ''}
                                    onChange={(e) => setFormData({ ...formData, financial_impact: e.target.value || null })}
                                />
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
                                <Label htmlFor="target_completion_date">Hedef Bitiş Tarihi</Label>
                                <Input
                                    id="target_completion_date"
                                    type="date"
                                    value={formData.target_completion_date}
                                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="project_leader_id">Proje Lideri</Label>
                                <Select
                                    value={formData.project_leader_id || ''}
                                    onValueChange={(value) => setFormData({ ...formData, project_leader_id: value || null })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Seçiniz</SelectItem>
                                        {personnelOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="champion_id">Sponsor</Label>
                                <Select
                                    value={formData.champion_id || ''}
                                    onValueChange={(value) => setFormData({ ...formData, champion_id: value || null })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Seçiniz</SelectItem>
                                        {personnelOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

