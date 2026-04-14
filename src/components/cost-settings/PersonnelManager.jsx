import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Edit, Search, User, Building2, Briefcase, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { formatPersonnelModuleField, normalizeUnitNameForSettings, normalizeCostSettingsRows, normalizeCostSettingsJoin } from '@/lib/utils';

const PERSONNEL_TITLE_FIELDS = ['full_name', 'department', 'management_department', 'job_title'];

function formatTitleField(key, value) {
    if (value == null || typeof value !== 'string' || !value.trim()) return value;
    if (key === 'management_department') return normalizeUnitNameForSettings(value);
    return formatPersonnelModuleField(value);
}

function displayPersonnelField(fieldId, value) {
    if (value == null || String(value).trim() === '') return '';
    if (fieldId === 'management_department') return normalizeUnitNameForSettings(String(value));
    return formatPersonnelModuleField(String(value));
}

function collarDisplayLabel(type) {
    if (type === 'MAVİ') return 'Mavi';
    if (type === 'BEYAZ') return 'Beyaz';
    return type || '';
}

/** Sicil no artan (en düşük üstte); boş sicil sonda; eşitlikte ad soyad */
const comparePersonnelBySicil = (a, b) => {
    const sa = String(a.registration_number ?? '').trim();
    const sb = String(b.registration_number ?? '').trim();
    if (!sa && !sb) {
        return (a.full_name || '').localeCompare(b.full_name || '', 'tr');
    }
    if (!sa) return 1;
    if (!sb) return -1;
    const bySicil = sa.localeCompare(sb, 'tr', { numeric: true, sensitivity: 'base' });
    if (bySicil !== 0) return bySicil;
    return (a.full_name || '').localeCompare(b.full_name || '', 'tr');
};

const PersonnelFormModal = ({ open, setOpen, onSuccess, existingPersonnel, units }) => {
    const { toast } = useToast();
    const isEditMode = !!existingPersonnel;
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData = {
            full_name: '',
            registration_number: '',
            department: '',
            management_department: '',
            job_title: '',
            collar_type: '',
            is_active: true,
            unit_id: null,
        };
        if (isEditMode && existingPersonnel) {
            const p = { ...existingPersonnel };
            for (const key of PERSONNEL_TITLE_FIELDS) {
                if (typeof p[key] === 'string' && p[key].trim()) {
                    p[key] = formatTitleField(key, p[key]);
                }
            }
            setFormData(p);
        } else {
            setFormData(initialData);
        }
    }, [existingPersonnel, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({...prev, [id]: value }));
    };

    const handleTitleFieldBlur = (e) => {
        const { id, value } = e.target;
        if (!PERSONNEL_TITLE_FIELDS.includes(id)) return;
        const formatted = formatTitleField(id, value);
        if (formatted !== value) {
            setFormData((prev) => ({ ...prev, [id]: formatted }));
        }
    };
    
    const handleCheckboxChange = (id, checked) => {
        setFormData(prev => ({...prev, [id]: checked }));
    };

    const handleCollarChange = (value) => {
        setFormData((prev) => ({ ...prev, collar_type: value === '__none__' ? '' : value }));
    };

    const handleUnitChange = (unitId) => {
        const selectedUnit = units.find(u => u.id === unitId);
        const rawName = selectedUnit?.unit_name ?? '';
        const formatted = rawName ? normalizeUnitNameForSettings(rawName) : '';
        setFormData(prev => ({
            ...prev,
            unit_id: unitId,
            management_department: formatted,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.unit_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen personel için bir birim seçin.' });
            return;
        }
        setIsSubmitting(true);
        
        let error;
        const { id, created_at, updated_at, unit, ...raw } = formData;
        const dataToSubmit = { ...raw };
        for (const key of PERSONNEL_TITLE_FIELDS) {
            if (typeof dataToSubmit[key] === 'string') {
                dataToSubmit[key] = formatTitleField(key, dataToSubmit[key]);
            }
        }
      
        if (isEditMode) {
            const { error: updateError } = await supabase.from('personnel').update(dataToSubmit).eq('id', existingPersonnel.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('personnel').insert([dataToSubmit]);
            error = insertError;
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Personel ${isEditMode ? 'güncellenemedi' : 'eklenemedi'}: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Personel başarıyla ${isEditMode ? 'güncellendi' : 'eklendi'}.` });
            onSuccess();
        }
        setIsSubmitting(false);
    }
    
    const unitOptions = useMemo(
        () =>
            units.map((unit) => ({
                value: unit.id,
                label: normalizeUnitNameForSettings(unit.unit_name || ''),
            })),
        [units]
    );

    if (units.length === 0 && !isEditMode) {
         return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Önce birim tanımlayın</DialogTitle>
                        <DialogDescription>Önce Birim Yönetimi&apos;nden birim ekleyin.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>Tamam</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const formId = 'personnel-form-main';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl w-[96vw] max-h-[min(92vh,calc(100vh-1.5rem))] p-0 gap-0 overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]">
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0 text-left">
                    <DialogTitle className="text-xl">{isEditMode ? 'Personeli düzenle' : 'Yeni personel'}</DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                        {isEditMode ? 'Bilgileri güncelleyin.' : 'Zorunlu alanları doldurun.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4">
                    <form id={formId} onSubmit={handleSubmit} className="space-y-6 pb-2">
                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <User className="h-4 w-4 shrink-0" aria-hidden />
                                <span>Kimlik</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Ad soyad <span className="text-destructive">*</span></Label>
                                    <Input id="full_name" value={formData.full_name || ''} onChange={handleChange} onBlur={handleTitleFieldBlur} required autoComplete="name" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="registration_number">Sicil numarası</Label>
                                    <Input id="registration_number" value={formData.registration_number || ''} onChange={handleChange} placeholder="Örn: A012345" className="font-mono" />
                                </div>
                            </div>
                        </section>

                        <Separator />

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                                <span>Organizasyon ve birim</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Birim (maliyet) <span className="text-destructive">*</span></Label>
                                    <SearchableSelectDialog
                                        options={unitOptions}
                                        value={formData.unit_id || ''}
                                        onChange={handleUnitChange}
                                        triggerPlaceholder="Birim seçin..."
                                        dialogTitle="Birim seç"
                                        searchPlaceholder="Ara..."
                                        notFoundText="Kayıt bulunamadı."
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="department">Alt birim / ekip (görünen)</Label>
                                    <Input
                                        id="department"
                                        value={formData.department || ''}
                                        onChange={handleChange}
                                        onBlur={handleTitleFieldBlur}
                                        placeholder="Örn: Kabin hattı, kaynakhane (üst seçimden bağımsız düzenlenebilir)"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="management_department">Birim özeti</Label>
                                    <Input
                                        id="management_department"
                                        value={formData.management_department || ''}
                                        onChange={handleChange}
                                        onBlur={handleTitleFieldBlur}
                                        placeholder="Üst seçimle dolar; gerekirse düzenleyin"
                                    />
                                </div>
                            </div>
                        </section>

                        <Separator />

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
                                <span>Ünvan</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="collar_type">Yaka (MAVİ / BEYAZ)</Label>
                                    <Select value={formData.collar_type || '__none__'} onValueChange={handleCollarChange}>
                                        <SelectTrigger id="collar_type">
                                            <SelectValue placeholder="Seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Belirtilmedi</SelectItem>
                                            <SelectItem value="MAVİ">Mavi</SelectItem>
                                            <SelectItem value="BEYAZ">Beyaz</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="job_title">Şirket ünvanı / görev</Label>
                                    <Input id="job_title" value={formData.job_title || ''} onChange={handleChange} onBlur={handleTitleFieldBlur} placeholder="Örn: Montaj formeni" />
                                </div>
                            </div>
                        </section>

                        <Separator />

                        <section className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                                <span>Durum</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <Label htmlFor="is_active_switch" className="text-base font-medium text-foreground">Aktif personel</Label>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Kapalıysa pasif sayılır; DF, sapma ve benzeri modüllerde seçilmez.
                                    </p>
                                </div>
                                <Switch
                                    id="is_active_switch"
                                    checked={!!formData.is_active}
                                    onCheckedChange={(c) => handleCheckboxChange('is_active', c)}
                                    className="shrink-0"
                                />
                            </div>
                        </section>
                    </form>
                </div>
                <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex flex-row gap-2 sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        İptal
                    </Button>
                    <Button type="submit" form={formId} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : isEditMode ? 'Güncelle' : 'Personeli kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const PersonnelManager = () => {
    const { toast } = useToast();
    const [personnel, setPersonnel] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [togglingId, setTogglingId] = useState(null);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [personnelToDelete, setPersonnelToDelete] = useState(null);
    const [targetPersonnelId, setTargetPersonnelId] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { error: syncErr } = await supabase.rpc('sync_cost_settings_from_personnel');
        if (syncErr) console.warn('sync_cost_settings_from_personnel', syncErr);
        const { data: personnelData, error: personnelError } = await supabase.from('personnel').select('*, unit:cost_settings(unit_name)');
        const { data: unitsData, error: unitsError } = await supabase.from('cost_settings').select('*').order('unit_name');

        if (personnelError) {
            toast({ variant: 'destructive', title: 'Personel alınamadı!' });
        } else {
            const mapped = (personnelData || []).map((p) => ({
                ...p,
                unit: p.unit && typeof p.unit === 'object' ? normalizeCostSettingsJoin(p.unit) : p.unit,
            }));
            mapped.sort(comparePersonnelBySicil);
            setPersonnel(mapped);
        }
        if (unitsError) toast({ variant: 'destructive', title: 'Birim listesi alınamadı!' }); else setUnits(normalizeCostSettingsRows(unitsData || []));
        
        setLoading(false);
    }, [toast]);

    useEffect(() => { fetchData() }, [fetchData]);

    const statusCounts = useMemo(() => {
        const active = personnel.filter((p) => p.is_active !== false).length;
        return { all: personnel.length, active, inactive: personnel.length - active };
    }, [personnel]);

    const searchedPersonnel = useMemo(() => {
        if (!searchTerm.trim()) return personnel;
        const lowercasedTerm = searchTerm.toLowerCase();
        return personnel.filter(p =>
            p.full_name.toLowerCase().includes(lowercasedTerm) ||
            (p.registration_number && p.registration_number.toLowerCase().includes(lowercasedTerm)) ||
            p.department?.toLowerCase().includes(lowercasedTerm) ||
            p.job_title?.toLowerCase().includes(lowercasedTerm) ||
            p.management_department?.toLowerCase().includes(lowercasedTerm) ||
            p.collar_type?.toLowerCase().includes(lowercasedTerm) ||
            p.unit?.unit_name?.toLowerCase().includes(lowercasedTerm)
        );
    }, [personnel, searchTerm]);

    const filteredPersonnel = useMemo(() => {
        if (statusFilter === 'active') return searchedPersonnel.filter((p) => p.is_active !== false);
        if (statusFilter === 'inactive') return searchedPersonnel.filter((p) => p.is_active === false);
        return searchedPersonnel;
    }, [searchedPersonnel, statusFilter]);

    const setPersonnelActive = async (p, checked) => {
        const wasActive = p.is_active !== false;
        if (wasActive === checked) return;
        setTogglingId(p.id);
        setPersonnel((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: checked } : x)));
        const { error } = await supabase.from('personnel').update({ is_active: checked }).eq('id', p.id);
        setTogglingId(null);
        if (error) {
            setPersonnel((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: wasActive } : x)));
            toast({ variant: 'destructive', title: 'Güncellenemedi', description: error.message });
        } else {
            toast({ title: checked ? 'Personel aktif' : 'Personel pasif', description: `${p.full_name} durumu kaydedildi.` });
        }
    };
    
    const openModal = (person = null) => {
        setEditingPersonnel(person);
        setModalOpen(true);
    };

    const closeModal = () => {
        setEditingPersonnel(null);
        setModalOpen(false);
    };

    const handleSuccess = () => {
        fetchData();
        closeModal();
    }
    
    const transferDataAndDelete = async (fromPersonnelId, toPersonnelId) => {
        try {
            // 1. Tüm equipment_assignments'ı aktar
            const { data: assignments } = await supabase
                .from('equipment_assignments')
                .select('id')
                .eq('assigned_personnel_id', fromPersonnelId);
            
            if (assignments && assignments.length > 0) {
                const { error: assignError } = await supabase
                    .from('equipment_assignments')
                    .update({ assigned_personnel_id: toPersonnelId })
                    .eq('assigned_personnel_id', fromPersonnelId);
                if (assignError) throw assignError;
            }

            // 2. Tüm quality_costs'ı aktar
            const { data: costs } = await supabase
                .from('quality_costs')
                .select('id')
                .eq('responsible_personnel_id', fromPersonnelId);
            
            if (costs && costs.length > 0) {
                const { error: costError } = await supabase
                    .from('quality_costs')
                    .update({ responsible_personnel_id: toPersonnelId })
                    .eq('responsible_personnel_id', fromPersonnelId);
                if (costError) throw costError;
            }

            // 3. Personnel_skills'i aktar
            const { data: skills } = await supabase
                .from('personnel_skills')
                .select('*')
                .eq('personnel_id', fromPersonnelId);
            
            if (skills && skills.length > 0) {
                // Önce hedef personelin mevcut yeteneklerini kontrol et
                for (const skill of skills) {
                    const { data: existing } = await supabase
                        .from('personnel_skills')
                        .select('id')
                        .eq('personnel_id', toPersonnelId)
                        .eq('skill_id', skill.skill_id)
                        .single();
                    
                    if (!existing) {
                        // Yeni yetenek ekle
                        await supabase.from('personnel_skills').insert({
                            personnel_id: toPersonnelId,
                            skill_id: skill.skill_id,
                            current_level: skill.current_level,
                            target_level: skill.target_level,
                            training_required: skill.training_required,
                            certification_date: skill.certification_date,
                            certification_expiry_date: skill.certification_expiry_date,
                            last_assessment_date: skill.last_assessment_date,
                            last_training_date: skill.last_training_date,
                            next_training_date: skill.next_training_date,
                            notes: skill.notes
                        });
                    }
                }
                // Eski kayıtları sil
                await supabase.from('personnel_skills').delete().eq('personnel_id', fromPersonnelId);
            }

            // 4. Skill_assessments'ı aktar
            const { data: assessments } = await supabase
                .from('skill_assessments')
                .select('id')
                .eq('personnel_id', fromPersonnelId);
            
            if (assessments && assessments.length > 0) {
                await supabase
                    .from('skill_assessments')
                    .update({ personnel_id: toPersonnelId })
                    .eq('personnel_id', fromPersonnelId);
            }

            // 5. Diğer tüm foreign key ilişkilerini kontrol et ve aktar
            // NOT: Sadece gerçek tablo ve kolon isimlerini kullan
            const tablesToUpdate = [
                // DF modülü - non_conformities (nonconformities değil!)
                { table: 'non_conformities', column: 'requester_id' },
                { table: 'non_conformities', column: 'responsible_id' },
                // Kaizen - kaizen_entries (kaizen_suggestions değil!)
                { table: 'kaizen_entries', column: 'owner_id' },
                { table: 'kaizen_entries', column: 'responsible_id' },
                // Deviations - detected_by ve responsible_person_id kullanıyor
                { table: 'deviations', column: 'detected_by' },
                { table: 'deviations', column: 'responsible_person_id' },
                // Customer complaints
                { table: 'customer_complaints', column: 'responsible_personnel_id' },
                // Trainings - responsible_id kullanıyor (trainer_id değil!)
                { table: 'trainings', column: 'responsible_id' },
                // Tasks - owner_id var ama assigned_to yok!
                { table: 'tasks', column: 'owner_id' },
                // Document revisions - prepared_by_id
                { table: 'document_revisions', column: 'prepared_by_id' }
            ];

            for (const { table, column } of tablesToUpdate) {
                // Hata alırsak devam et, tüm tabloları dene
                try {
                    await supabase.from(table).update({ [column]: toPersonnelId }).eq(column, fromPersonnelId);
                } catch (err) {
                    console.warn(`${table}.${column} güncellenemedi:`, err);
                }
            }

            // 6. Son olarak personeli sil
            const { error: deleteError } = await supabase.from('personnel').delete().eq('id', fromPersonnelId);
            if (deleteError) throw deleteError;

            toast({ title: 'Başarılı!', description: 'Tüm veriler aktarıldı ve personel silindi.' });
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Transfer işlemi başarısız: ${error.message}` });
        }
    };

    const deletePersonnel = async (id) => {
        const { data: assignments, error: assignmentError } = await supabase.from('equipment_assignments').select('id').eq('assigned_personnel_id', id).limit(1);
        if(assignmentError || (assignments && assignments.length > 0)) {
            toast({ variant: 'destructive', title: 'Silme Başarısız', description: 'Bu personel bir ekipmana zimmetli olduğu için silinemez.' });
            return;
        }

        const { data: costs, error: costError } = await supabase.from('quality_costs').select('id').eq('responsible_personnel_id', id).limit(1);
        if(costError || (costs && costs.length > 0)) {
            toast({ variant: 'destructive', title: 'Silme Başarısız', description: 'Bu personel bir maliyet kaydından sorumlu olduğu için silinemez.' });
            return;
        }
        
        const { error: deleteError } = await supabase.from('personnel').delete().eq('id', id);
        if (deleteError) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Personel silinemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: `Personel silindi.` });
            fetchData();
        }
    }


    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-widget">
            {isModalOpen && <PersonnelFormModal open={isModalOpen} setOpen={setModalOpen} onSuccess={handleSuccess} existingPersonnel={editingPersonnel} units={units} />}
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="widget-title">Personel listesi</h2>
                    </div>
                    <Button size="sm" onClick={() => openModal()} className="flex-shrink-0 self-start sm:self-center">
                        <Plus className="w-4 h-4 mr-2" /> Yeni personel
                    </Button>
                </div>
                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                    <div className="search-box w-full lg:max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Ad, sicil, birim, yaka veya ünvan ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[200px]">
                        <Label className="text-xs text-muted-foreground">Durum filtresi</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger aria-label="Personel durum filtresi">
                                <SelectValue placeholder="Durum" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tümü ({statusCounts.all})</SelectItem>
                                <SelectItem value="active">Aktif ({statusCounts.active})</SelectItem>
                                <SelectItem value="inactive">Pasif ({statusCounts.inactive})</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table document-module-table">
                    <thead>
                        <tr>
                            <th className="w-10">S.No</th>
                            <th>Ad soyad</th>
                            <th>Sicil</th>
                            <th>Alt birim / ekip</th>
                            <th className="min-w-[220px] max-w-[280px]">Birim</th>
                            <th>Yaka</th>
                            <th className="min-w-[160px]">Şirket ünvanı</th>
                            <th className="whitespace-nowrap">Aktif</th>
                            <th className="text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
                        ) : filteredPersonnel.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center py-10 text-muted-foreground">
                                    {personnel.length === 0
                                        ? 'Henüz personel yok. Yeni personel ile ekleyebilirsiniz.'
                                        : 'Filtre veya arama kriterlerine uygun kayıt yok.'}
                                </td>
                            </tr>
                        ) : filteredPersonnel.map((p, index) => (
                            <tr
                                key={p.id}
                                className={p.is_active === false ? 'bg-muted/40 text-muted-foreground' : undefined}
                            >
                                <td className="tabular-nums text-muted-foreground">{index + 1}</td>
                                <td className="font-medium">{displayPersonnelField('full_name', p.full_name) || '—'}</td>
                                <td className="font-mono text-sm">{p.registration_number || '—'}</td>
                                <td className="text-sm">
                                    {displayPersonnelField('department', p.department) || '—'}
                                </td>
                                <td className="text-sm align-top">
                                    {p.management_department ? (
                                        <span className="block leading-snug whitespace-normal break-words">
                                            {displayPersonnelField('management_department', p.management_department)}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </td>
                                <td>
                                    {p.collar_type ? (
                                        <Badge variant={p.collar_type === 'MAVİ' ? 'default' : 'secondary'} className="font-medium">
                                            {collarDisplayLabel(p.collar_type)}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                </td>
                                <td className="text-sm align-top">
                                    {p.job_title ? (
                                        <span className="block leading-snug whitespace-normal break-words">
                                            {displayPersonnelField('job_title', p.job_title)}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={p.is_active !== false}
                                            onCheckedChange={(checked) => setPersonnelActive(p, checked)}
                                            disabled={togglingId === p.id}
                                            aria-label={p.is_active !== false ? `${p.full_name} pasif yap` : `${p.full_name} aktif yap`}
                                        />
                                        <span className="text-xs text-muted-foreground hidden xl:inline">
                                            {p.is_active !== false ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </div>
                                </td>
                                <td className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openModal(p)}><Edit className="w-4 h-4 mr-1" /> Düzenle</Button>
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => { setPersonnelToDelete(p); setTransferModalOpen(true); }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Transfer Modal */}
            <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Personel Verisini Aktar ve Sil</DialogTitle>
                        <DialogDescription>
                            {personnelToDelete && `"${personnelToDelete.full_name}" adlı personelin tüm verilerini başka bir personele aktarabilir ve sonra silebilirsiniz.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Hedef Personel (Verilerin Aktarılacağı Kişi)</Label>
                            <SearchableSelectDialog
                                options={personnel.filter(p => p.id !== personnelToDelete?.id).map(p => ({ value: p.id, label: p.full_name }))}
                                value={targetPersonnelId}
                                onChange={setTargetPersonnelId}
                                triggerPlaceholder="Personel seçin..."
                                searchPlaceholder="Personel ara..."
                            />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                            <strong>⚠️ Uyarı:</strong> Bu işlem geri alınamaz! Aşağıdaki veriler aktarılacak:
                            <ul className="list-disc ml-5 mt-2 space-y-1">
                                <li>Ekipman zimmetleri</li>
                                <li>Kalite maliyetleri</li>
                                <li>Yetkinlik kayıtları</li>
                                <li>Değerlendirmeler</li>
                                <li>DF, Kaizen, Sapma kayıtları</li>
                                <li>İç tetkikler, şikayetler, eğitimler</li>
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setTransferModalOpen(false); setTargetPersonnelId(null); }}>
                            İptal
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => {
                                if (targetPersonnelId && personnelToDelete) {
                                    transferDataAndDelete(personnelToDelete.id, targetPersonnelId);
                                    setTransferModalOpen(false);
                                    setTargetPersonnelId(null);
                                    setPersonnelToDelete(null);
                                } else {
                                    toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen hedef personel seçin.' });
                                }
                            }}
                            disabled={!targetPersonnelId}
                        >
                            Aktar ve Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

export default PersonnelManager;