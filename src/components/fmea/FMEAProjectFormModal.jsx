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

const FMEA_TYPES = ['DFMEA', 'PFMEA'];
const FMEA_STATUSES = ['Draft', 'In Review', 'Approved', 'Active', 'Obsolete'];

const FMEAProjectFormModal = ({ open, setOpen, existingProject, onSuccess }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings, customers } = useData();
    const [formData, setFormData] = useState({
        fmea_number: '',
        fmea_name: '',
        fmea_type: 'DFMEA',
        part_number: '',
        part_name: '',
        process_name: '',
        customer_id: null,
        status: 'Draft',
        revision_number: 'Rev. 01',
        revision_date: new Date().toISOString().split('T')[0],
        team_leader_id: null,
        responsible_department_id: null,
        team_members: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingProject) {
            setFormData({
                ...existingProject,
                revision_date: existingProject.revision_date || new Date().toISOString().split('T')[0]
            });
        } else {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            setFormData({
                fmea_number: `FMEA-${year}-${randomNum}`,
                fmea_name: '',
                fmea_type: 'DFMEA',
                part_number: '',
                part_name: '',
                process_name: '',
                customer_id: null,
                status: 'Draft',
                revision_number: 'Rev. 01',
                revision_date: new Date().toISOString().split('T')[0],
                team_leader_id: null,
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
                revision_date: formData.revision_date || null
            };

            if (existingProject) {
                const { error } = await supabase
                    .from('fmea_projects')
                    .update(dataToSubmit)
                    .eq('id', existingProject.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'FMEA projesi güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('fmea_projects')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'FMEA projesi oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving FMEA project:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'FMEA projesi kaydedilirken hata oluştu.'
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
                        {existingProject ? 'FMEA Projesi Düzenle' : 'Yeni FMEA Projesi'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="fmea_number">FMEA Numarası *</Label>
                                <Input
                                    id="fmea_number"
                                    value={formData.fmea_number}
                                    onChange={(e) => setFormData({ ...formData, fmea_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="fmea_name">FMEA Adı *</Label>
                                <Input
                                    id="fmea_name"
                                    value={formData.fmea_name}
                                    onChange={(e) => setFormData({ ...formData, fmea_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="fmea_type">FMEA Tipi *</Label>
                                <Select
                                    value={formData.fmea_type}
                                    onValueChange={(v) => setFormData({ ...formData, fmea_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FMEA_TYPES.map(type => (
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
                                        {FMEA_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                            {formData.fmea_type === 'PFMEA' && (
                                <div className="md:col-span-2">
                                    <Label htmlFor="process_name">Proses Adı</Label>
                                    <Input
                                        id="process_name"
                                        value={formData.process_name}
                                        onChange={(e) => setFormData({ ...formData, process_name: e.target.value })}
                                    />
                                </div>
                            )}
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
                                <Label htmlFor="revision_number">Revizyon Numarası</Label>
                                <Input
                                    id="revision_number"
                                    value={formData.revision_number}
                                    onChange={(e) => setFormData({ ...formData, revision_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="revision_date">Revizyon Tarihi</Label>
                                <Input
                                    id="revision_date"
                                    type="date"
                                    value={formData.revision_date}
                                    onChange={(e) => setFormData({ ...formData, revision_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Takım Lideri</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.team_leader_id}
                                    onChange={(v) => setFormData({ ...formData, team_leader_id: v })}
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

export default FMEAProjectFormModal;

