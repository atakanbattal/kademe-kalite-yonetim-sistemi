import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { format } from 'date-fns';

    const AuditPlanModal = ({ isOpen, setIsOpen, refreshAudits, auditToEdit }) => {
        const { toast } = useToast();
        const [formData, setFormData] = useState({
            title: '',
            department_id: '',
            audit_date: '',
            auditor_name: '',
            audit_standard_id: '',
        });
        const [departments, setDepartments] = useState([]);
        const [auditStandards, setAuditStandards] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const isEditMode = !!auditToEdit;

        useEffect(() => {
            if (!isOpen) return;

            const fetchDepartments = async () => {
                const { data, error } = await supabase
                    .from('cost_settings')
                    .select('id, unit_name')
                    .order('unit_name');

                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: 'Birimler yüklenemedi.' });
                } else {
                    setDepartments(data);
                }
            };

            const fetchStandards = async () => {
                const { data, error } = await supabase
                    .from('audit_standards')
                    .select('id, code, name')
                    .eq('is_active', true)
                    .order('code');

                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: 'Standartlar yüklenemedi.' });
                } else {
                    setAuditStandards(data);
                }
            };

            const initializeForm = async () => {
                await Promise.all([fetchDepartments(), fetchStandards()]);
                
                // Standartlar yüklendikten sonra formData'yı set et
                const { data: standardsData } = await supabase
                    .from('audit_standards')
                    .select('id, code, name')
                    .eq('is_active', true)
                    .order('code');
                
                if (standardsData) {
                    setAuditStandards(standardsData);
                    
                    if (isEditMode) {
                        setFormData({
                            title: auditToEdit.title || '',
                            department_id: auditToEdit.department_id || '',
                            audit_date: auditToEdit.audit_date ? format(new Date(auditToEdit.audit_date), 'yyyy-MM-dd') : '',
                            auditor_name: auditToEdit.auditor_name || '',
                            audit_standard_id: auditToEdit.audit_standard_id || auditToEdit.audit_standard?.id || '',
                        });
                    } else {
                        // Varsayılan olarak 9001'i seç
                        const defaultStandard = standardsData.find(s => s.code === '9001');
                        setFormData({ 
                            title: '', 
                            department_id: '', 
                            audit_date: '', 
                            auditor_name: '',
                            audit_standard_id: defaultStandard?.id || '',
                        });
                    }
                }
            };
            
            initializeForm();
        }, [isOpen, auditToEdit, isEditMode, toast]);


        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData((prev) => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (id, value) => {
            setFormData((prev) => ({ ...prev, [id]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);

            let result;
            if (isEditMode) {
                // Düzenleme modunda - trigger otomatik olarak rapor numarasını güncelleyecek
                const { error } = await supabase.from('audits').update(formData).eq('id', auditToEdit.id);
                result = { error };
            } else {
                // Yeni kayıt - report_number trigger tarafından otomatik oluşturulacak
                const { error } = await supabase.from('audits').insert({ ...formData, status: 'Planlandı' });
                result = { error };
            }

            if (result.error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Tetkik planı ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${result.error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Tetkik planı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
                refreshAudits();
                setIsOpen(false);
            }
            setIsSubmitting(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? 'Tetkik Planını Düzenle' : 'Yeni Tetkik Planı Oluştur'}</DialogTitle>
                        <DialogDescription>{isEditMode ? 'Mevcut tetkik planını güncelleyin.' : 'Yeni bir iç tetkik planlayın.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="audit_standard_id">İç Tetkik Standartı <span className="text-red-500">*</span></Label>
                            <Select value={formData.audit_standard_id} onValueChange={(v) => handleSelectChange('audit_standard_id', v)} required>
                                <SelectTrigger><SelectValue placeholder="Standart seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {auditStandards.map((standard) => (
                                        <SelectItem key={standard.id} value={standard.id}>
                                            {standard.code} - {standard.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="title">Tetkik Başlığı</Label>
                            <Input id="title" value={formData.title} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="department_id">Denetlenecek Birim <span className="text-red-500">*</span></Label>
                            <Select value={formData.department_id} onValueChange={(v) => handleSelectChange('department_id', v)} required>
                                <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.unit_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="audit_date">Tetkik Tarihi</Label>
                            <Input id="audit_date" type="date" value={formData.audit_date} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="auditor_name">Tetkikçi</Label>
                            <Input id="auditor_name" value={formData.auditor_name} onChange={handleInputChange} required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Planı Kaydet')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default AuditPlanModal;