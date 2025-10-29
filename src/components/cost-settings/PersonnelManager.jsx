import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Edit, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const PersonnelFormModal = ({ open, setOpen, onSuccess, existingPersonnel, units }) => {
    const { toast } = useToast();
    const isEditMode = !!existingPersonnel;
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData = { full_name: '', registration_number: '', department: '', job_title: '', is_active: true, unit_id: null };
        if (isEditMode) {
            setFormData({ ...existingPersonnel });
        } else {
            setFormData(initialData);
        }
    }, [existingPersonnel, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({...prev, [id]: value }));
    }
    
    const handleCheckboxChange = (id, checked) => {
        setFormData(prev => ({...prev, [id]: checked }));
    };

    const handleUnitChange = (unitId) => {
        const selectedUnit = units.find(u => u.id === unitId);
        setFormData(prev => ({
            ...prev,
            unit_id: unitId,
            department: selectedUnit ? selectedUnit.unit_name : ''
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
        const { id, created_at, updated_at, unit, ...dataToSubmit } = formData;
      
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
    
    const unitOptions = units.map(unit => ({ value: unit.id, label: unit.unit_name }));

    if (units.length === 0 && !isEditMode) {
         return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Birim Bulunamadı</DialogTitle>
                        <DialogDescription>
                            Yeni personel ekleyebilmek için önce sistemde en az bir birim tanımlanmalıdır. Lütfen "Birim Maliyetleri" sekmesinden yeni bir birim ekleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>Anladım</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div>
                        <Label htmlFor="full_name">Ad Soyad <span className="text-red-500">*</span></Label>
                        <Input id="full_name" value={formData.full_name || ''} onChange={handleChange} required />
                    </div>
                    <div>
                        <Label htmlFor="registration_number">Sicil Numarası</Label>
                        <Input id="registration_number" value={formData.registration_number || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="unit_id">Birim <span className="text-red-500">*</span></Label>
                        <SearchableSelectDialog
                            options={unitOptions}
                            value={formData.unit_id || ''}
                            onChange={handleUnitChange}
                            triggerPlaceholder="Birim seçin..."
                            dialogTitle="Birim Seç"
                            searchPlaceholder="Birim ara..."
                            notFoundText="Birim bulunamadı."
                        />
                        <p className="text-xs text-muted-foreground mt-1">Personelin ana birimi. Departman alanı otomatik dolar, ancak manuel değiştirilebilir.</p>
                    </div>
                    <div>
                        <Label htmlFor="department">Departman</Label>
                        <Input id="department" value={formData.department || ''} onChange={handleChange} placeholder="Örn: Kalite Kontrol"/>
                    </div>
                     <div className="md:col-span-2">
                        <Label htmlFor="job_title">Görevi</Label>
                        <Input id="job_title" value={formData.job_title || ''} onChange={handleChange} />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <Checkbox id="is_active" checked={!!formData.is_active} onCheckedChange={(c) => handleCheckboxChange('is_active', c)} />
                        <Label htmlFor="is_active">Aktif</Label>
                    </div>
                    <DialogFooter className="md:col-span-2 mt-4">
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
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

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: personnelData, error: personnelError } = await supabase.from('personnel').select('*, unit:cost_settings(unit_name)').order('full_name');
        const { data: unitsData, error: unitsError } = await supabase.from('cost_settings').select('*').order('unit_name');

        if (personnelError) toast({ variant: 'destructive', title: 'Personel alınamadı!' }); else setPersonnel(personnelData.map(p => ({...p, department: p.department || p.unit?.unit_name })));
        if (unitsError) toast({ variant: 'destructive', title: 'Birimler alınamadı!' }); else setUnits(unitsData);
        
        setLoading(false);
    }, [toast]);

    useEffect(() => { fetchData() }, [fetchData]);

    const filteredPersonnel = useMemo(() => {
        if (!searchTerm) return personnel;
        const lowercasedTerm = searchTerm.toLowerCase();
        return personnel.filter(p =>
            p.full_name.toLowerCase().includes(lowercasedTerm) ||
            (p.registration_number && p.registration_number.toLowerCase().includes(lowercasedTerm)) ||
            p.department?.toLowerCase().includes(lowercasedTerm) ||
            p.job_title?.toLowerCase().includes(lowercasedTerm)
        );
    }, [personnel, searchTerm]);
    
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
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                <h2 className="widget-title">Personel Listesi</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Personel ara..." 
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openModal()} className="flex-shrink-0"><Plus className="w-4 h-4 mr-2" /> Yeni Personel Ekle</Button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Ad Soyad</th>
                            <th>Sicil No</th>
                            <th>Görevi</th>
                            <th>Departman</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan="7" className="text-center">Yükleniyor...</td></tr> : filteredPersonnel.map((p, index) => (
                            <tr key={p.id}>
                                <td>{index + 1}</td>
                                <td className="font-medium">{p.full_name}</td>
                                <td>{p.registration_number}</td>
                                <td>{p.job_title}</td>
                                <td>{p.department}</td>
                                <td><Badge variant={p.is_active ? "success" : "destructive"}>{p.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
                                <td className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openModal(p)}><Edit className="w-4 h-4 mr-1" /> Düzenle</Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                <AlertDialogDescription>"{p.full_name}" adlı personeli kalıcı olarak sileceksiniz.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deletePersonnel(p.id)}>Sil</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default PersonnelManager;