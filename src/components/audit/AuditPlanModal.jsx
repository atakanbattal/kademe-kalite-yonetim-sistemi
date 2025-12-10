import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { format } from 'date-fns';
    import { Plus } from 'lucide-react';

    const AuditPlanModal = ({ isOpen, setIsOpen, refreshAudits, auditToEdit }) => {
        const { toast } = useToast();
        const [formData, setFormData] = useState({
            title: '',
            department_id: '',
            audit_date: '',
            auditor_name: '',
            audit_standard_id: '',
            audit_type_id: '',
        });
        const [departments, setDepartments] = useState([]);
        const [auditStandards, setAuditStandards] = useState([]);
        const [auditTypes, setAuditTypes] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [isAddingAuditType, setIsAddingAuditType] = useState(false);
        const [newAuditTypeName, setNewAuditTypeName] = useState('');
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
                const standardsData = await supabase
                    .from('audit_standards')
                    .select('id, code, name')
                    .eq('is_active', true)
                    .order('code');
                
                if (standardsData.data) {
                    setAuditStandards(standardsData.data);
                    
                    if (isEditMode) {
                        setFormData({
                            title: auditToEdit.title || '',
                            department_id: auditToEdit.department_id || '',
                            audit_date: auditToEdit.audit_date ? format(new Date(auditToEdit.audit_date), 'yyyy-MM-dd') : '',
                            auditor_name: auditToEdit.auditor_name || '',
                            audit_standard_id: auditToEdit.audit_standard_id || auditToEdit.audit_standard?.id || '',
                            audit_type_id: auditToEdit.audit_type_id || auditToEdit.audit_type?.id || '',
                        });
                    } else {
                        // Varsayılan olarak 9001'i seç
                        const defaultStandard = standardsData.data.find(s => s.code === '9001');
                        setFormData({ 
                            title: '', 
                            department_id: '', 
                            audit_date: '', 
                            auditor_name: '',
                            audit_standard_id: defaultStandard?.id || '',
                            audit_type_id: '',
                        });
                    }
                }
            };
            
            initializeForm();
        }, [isOpen, auditToEdit, isEditMode, toast]);

        // Standart seçildiğinde denetim türlerini yükle
        useEffect(() => {
            if (!formData.audit_standard_id) {
                setAuditTypes([]);
                return;
            }

            const fetchAuditTypes = async () => {
                const { data, error } = await supabase
                    .from('audit_types')
                    .select('id, name, description')
                    .eq('audit_standard_id', formData.audit_standard_id)
                    .eq('is_active', true)
                    .order('name');

                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: 'Denetim türleri yüklenemedi.' });
                    setAuditTypes([]);
                } else {
                    setAuditTypes(data);
                }
            };

            fetchAuditTypes();
        }, [formData.audit_standard_id, toast]);

        // Denetim türü seçildiğinde title'ı otomatik güncelle
        useEffect(() => {
            if (formData.audit_type_id && !isEditMode) {
                const selectedType = auditTypes.find(t => t.id === formData.audit_type_id);
                if (selectedType && !formData.title) {
                    setFormData(prev => ({ ...prev, title: selectedType.name }));
                }
            }
        }, [formData.audit_type_id, auditTypes, isEditMode]);

        const handleAddAuditType = async () => {
            if (!newAuditTypeName.trim() || !formData.audit_standard_id) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen denetim türü adı girin ve standart seçin.' });
                return;
            }

            const { data, error } = await supabase
                .from('audit_types')
                .insert([{
                    audit_standard_id: formData.audit_standard_id,
                    name: newAuditTypeName.trim()
                }])
                .select()
                .single();

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Denetim türü eklenemedi: ' + error.message });
            } else {
                setAuditTypes([...auditTypes, data]);
                setFormData(prev => ({ ...prev, audit_type_id: data.id, title: data.name }));
                setNewAuditTypeName('');
                setIsAddingAuditType(false);
                toast({ title: 'Başarılı', description: 'Denetim türü eklendi.' });
            }
        };

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
                        <div className="grid grid-cols-2 gap-4">
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
                                <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor="audit_type_id">Denetim Türü <span className="text-red-500">*</span></Label>
                                    {formData.audit_standard_id && !isEditMode && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsAddingAuditType(!isAddingAuditType)}
                                            className="h-7 text-xs"
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            {isAddingAuditType ? 'İptal' : 'Yeni Ekle'}
                                        </Button>
                                    )}
                                </div>
                                {isAddingAuditType ? (
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Denetim türü adı (örn: Ford Onaylı Üstyapıcılık Denetimi)"
                                            value={newAuditTypeName}
                                            onChange={(e) => setNewAuditTypeName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddAuditType();
                                                }
                                            }}
                                        />
                                        <Button type="button" onClick={handleAddAuditType} size="sm">
                                            Ekle
                                        </Button>
                                    </div>
                                ) : (
                                    <Select 
                                        value={formData.audit_type_id} 
                                        onValueChange={(v) => handleSelectChange('audit_type_id', v)} 
                                        required
                                        disabled={!formData.audit_standard_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={!formData.audit_standard_id ? "Önce standart seçin" : "Denetim türü seçin..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {auditTypes.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
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