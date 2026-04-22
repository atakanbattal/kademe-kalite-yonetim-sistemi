import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, CheckCircle, Edit, FlaskConical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import FaultCostModal from './FaultCostModal';
import { Calculator } from 'lucide-react';
import {
    cleanupVehicleFaultNonconformity,
    enrichVehicleFaultRecord,
    syncVehicleFaultGroupNonconformity,
    syncVehicleFaultNonconformity
} from '@/lib/vehicleFaultNonconformitySync';

const VehicleFaultsModal = ({ isOpen, setIsOpen, vehicle, departments, onUpdate, onOpenNCForm }) => {
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const { unitCostSettings, refreshData, qualityCosts } = useData();
    const [faults, setFaults] = useState([]);
    const [newFault, setNewFault] = useState({ description: '', department_id: '', category_id: '', quantity: 1 });
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [filteredCategories, setFilteredCategories] = useState([]);
    const [isFaultCostModalOpen, setIsFaultCostModalOpen] = useState(false);
    const [editingFault, setEditingFault] = useState(null);
    const [editFaultData, setEditFaultData] = useState({ description: '', department_id: '', category_id: '', quantity: 1 });
    const [hasExistingCosts, setHasExistingCosts] = useState(false);

    const hasSpecialAccess = () => {
        const userEmail = user?.email?.toLowerCase()?.trim();
        const userRole = profile?.role;
        const specialQualityEmails = [
            'atakan.battal@kademe.com.tr',
            'yunus.senel@kademe.com.tr',
            'safa.bagci@kademe.com.tr',
            'ramazan.boztilki@kademe.com.tr'
        ].map(email => email.toLowerCase().trim());

        const hasAccess = userRole === 'admin' || specialQualityEmails.includes(userEmail);

        // Debug için (production'da kaldırılabilir)
        if (!hasAccess && userEmail) {
            console.log('🔒 Yetki kontrolü:', {
                userEmail,
                userRole,
                specialQualityEmails,
                hasAccess
            });
        }

        return hasAccess;
    };
    const canManage = hasSpecialAccess();

    const categoriesById = useMemo(
        () => Object.fromEntries((categories || []).map(category => [String(category.id), category])),
        [categories]
    );

    const departmentsById = useMemo(
        () => Object.fromEntries((departments || []).map(department => [String(department.id), department])),
        [departments]
    );

    const enrichFaultRecord = useCallback((fault) => {
        return enrichVehicleFaultRecord(fault, { categoriesById, departmentsById });
    }, [categoriesById, departmentsById]);

    const syncFaultNonconformityRecord = useCallback(async (fault) => {
        return syncVehicleFaultNonconformity({
            supabase,
            fault,
            vehicle,
            reporterName: profile?.full_name || user?.email || null,
            userId: user?.id || null
        });
    }, [profile?.full_name, supabase, user?.email, user?.id, vehicle]);

    const syncFaultCategoryGroup = useCallback(async ({ categoryId = null, categoryName = null }) => {
        return syncVehicleFaultGroupNonconformity({
            supabase,
            vehicle,
            reporterName: profile?.full_name || user?.email || null,
            userId: user?.id || null,
            categoryId,
            categoryName
        });
    }, [profile?.full_name, supabase, user?.email, user?.id, vehicle]);

    const cleanupFaultNonconformityRecord = useCallback(async (fault) => {
        return cleanupVehicleFaultNonconformity({
            supabase,
            fault,
            vehicle,
            reporterName: profile?.full_name || user?.email || null,
            userId: user?.id || null
        });
    }, [profile?.full_name, supabase, user?.email, user?.id, vehicle]);

    const fetchFaults = useCallback(async () => {
        if (!vehicle || !vehicle.id) {
            setFaults([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('quality_inspection_faults')
                .select('*, department:production_departments(name), category:fault_categories(name)')
                .eq('inspection_id', vehicle.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Hatalar alınamadı:', error);
                toast({ variant: 'destructive', title: 'Hata', description: 'Hatalar alınamadı: ' + error.message });
                setFaults([]);
            } else {
                const enrichedFaults = (data || []).map(enrichFaultRecord);
                setFaults(enrichedFaults);
            }
        } catch (err) {
            console.error('❌ Hatalar yüklenirken beklenmeyen hata:', err);
            toast({ variant: 'destructive', title: 'Hata', description: 'Hatalar yüklenirken bir hata oluştu.' });
            setFaults([]);
        }
    }, [vehicle, toast, enrichFaultRecord]);

    // Araç verilerini tam olarak yükle (timeline events ve faults ile birlikte)
    const fetchFullVehicleData = useCallback(async () => {
        if (!vehicle?.id) return null;
        try {
            const { data, error } = await supabase
                .from('quality_inspections')
                .select(`
                        *,
                        quality_inspection_faults(*, department:production_departments(name)),
                        vehicle_timeline_events(*)
                    `)
                .eq('id', vehicle.id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('❌ Araç verileri yüklenemedi:', error);
            return null;
        }
    }, [vehicle]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data, error } = await supabase.from('fault_categories').select('*');
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Kategoriler alınamadı.' });
            } else {
                setCategories(data);
            }
        };

        if (isOpen) {
            fetchInitialData();
            fetchFaults();
        }
    }, [isOpen, toast, fetchFaults]);

    useEffect(() => {
        if (vehicle) {
            fetchFaults();
        }
    }, [vehicle, fetchFaults]);

    // Mevcut maliyet kayıtlarını kontrol et - DOĞRUDAN VERİTABANINDAN
    const checkExistingCosts = useCallback(async () => {
        if (!vehicle?.id) {
            setHasExistingCosts(false);
            return;
        }

        try {
            // Hem 'produced_vehicle_final_faults' hem de 'produced_vehicle_manual' source_type'larını kontrol et
            const { data, error } = await supabase
                .from('quality_costs')
                .select('id')
                .in('source_type', ['produced_vehicle_final_faults', 'produced_vehicle_manual'])
                .eq('source_record_id', vehicle.id)
                .limit(1);

            if (error) {
                console.error('Maliyet kayıtları kontrol edilirken hata:', error);
                setHasExistingCosts(false);
                return;
            }

            setHasExistingCosts((data || []).length > 0);
        } catch (error) {
            console.error('Maliyet kayıtları kontrol edilirken hata:', error);
            setHasExistingCosts(false);
        }
    }, [vehicle?.id]);

    useEffect(() => {
        if (!isOpen) {
            setHasExistingCosts(false);
            return;
        }

        checkExistingCosts();
    }, [isOpen, checkExistingCosts]);

    // FaultCostModal kapandığında tekrar kontrol et
    useEffect(() => {
        if (!isFaultCostModalOpen && isOpen) {
            checkExistingCosts();
        }
    }, [isFaultCostModalOpen, isOpen, checkExistingCosts]);

    // Realtime subscription for dynamic updates
    useEffect(() => {
        if (!vehicle?.id || !isOpen) return;

        const subscription = supabase
            .channel(`vehicle_faults_${vehicle.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quality_inspection_faults',
                filter: `inspection_id=eq.${vehicle.id}`
            }, () => {
                // Herhangi bir değişiklik olduğunda hataları yeniden yükle
                fetchFaults();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [vehicle?.id, isOpen, fetchFaults]);

    const handleDepartmentChange = (deptId) => {
        setNewFault(prev => ({ ...prev, department_id: deptId, category_id: '' }));
        const filtered = categories.filter(c => c.department_id === deptId);
        setFilteredCategories(filtered);
    };

    const handleAddFault = async () => {
        if (!newFault.description || !newFault.department_id || !newFault.quantity || !newFault.category_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm alanları doldurun.' });
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('quality_inspection_faults')
            .insert({
                inspection_id: vehicle.id,
                description: newFault.description,
                department_id: newFault.department_id,
                category_id: newFault.category_id,
                quantity: newFault.quantity,
                fault_date: new Date().toISOString(),
                is_resolved: false,
                user_id: user?.id || null // Hatayı giren kullanıcının ID'sini kaydet
            })
            .select(`*, department:production_departments(name), category:fault_categories(name)`)
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Hata eklenemedi: ' + error.message });
        } else {
            const newFaultWithDept = enrichFaultRecord(data);
            let syncWarning = null;

            try {
                await syncFaultNonconformityRecord(newFaultWithDept);
            } catch (syncError) {
                console.error('Araç hatasi eklendikten sonra uygunsuzluk kaydi acilamadi:', syncError);
                syncWarning = syncError;
            }

            toast({
                title: syncWarning ? 'Kısmi Başarı' : 'Başarılı',
                description: syncWarning
                    ? `Hata kaydedildi ancak otomatik uygunsuzluk kaydı açılamadı: ${syncWarning.message}`
                    : 'Hata ve bağlı uygunsuzluk kaydı başarıyla oluşturuldu.'
            });

            setFaults(prev => [newFaultWithDept, ...prev]);
            setNewFault({ description: '', department_id: '', category_id: '', quantity: 1 });
            setFilteredCategories([]);
            if (onUpdate) {
                await onUpdate();
            }
        }
        setLoading(false);
    };

    const handleRemoveFault = async (fault) => {
        setLoading(true);
        const { error } = await supabase.from('quality_inspection_faults').delete().eq('id', fault.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Hata silinemedi: ' + error.message });
        } else {
            let ncCleanupResult = null;
            let syncWarning = null;

            try {
                ncCleanupResult = await cleanupFaultNonconformityRecord(fault);
            } catch (syncError) {
                console.error('Hata silindikten sonra bagli uygunsuzluk kaydi temizlenemedi:', syncError);
                syncWarning = syncError;
            }

            const successDescription = syncWarning
                ? `Hata silindi ancak bağlı uygunsuzluk kaydı temizlenemedi: ${syncWarning.message}`
                : ncCleanupResult?.mode === 'preserved'
                    ? 'Hata silindi. Açılmış DF/8D süreci olduğu için bağlı uygunsuzluk kaydı korundu.'
                    : 'Hata ve bağlı otomatik uygunsuzluk kaydı başarıyla silindi.';

            toast({ title: syncWarning ? 'Kısmi Başarı' : 'Başarılı', description: successDescription });
            setFaults(prev => prev.filter(f => f.id !== fault.id));
            if (onUpdate) {
                await onUpdate();
            }
        }
        setLoading(false);
    };

    const handleToggleResolved = async (faultId, currentStatus) => {
        const { data, error } = await supabase
            .from('quality_inspection_faults')
            .update({
                is_resolved: !currentStatus,
                resolved_at: !currentStatus ? new Date().toISOString() : null
            })
            .eq('id', faultId)
            .select(`*, department:production_departments(name), category:fault_categories(name)`)
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Hata durumu güncellenemedi: ' + error.message });
        } else {
            const updatedFault = enrichFaultRecord(data);

            try {
                await syncFaultNonconformityRecord(updatedFault);
            } catch (syncError) {
                console.error('Hata durumuyla bagli uygunsuzluk senkronize edilemedi:', syncError);
                toast({
                    variant: 'destructive',
                    title: 'Senkronizasyon Hatası',
                    description: `Hata durumu güncellendi ancak uygunsuzluk kaydı senkronize edilemedi: ${syncError.message}`
                });
            }

            setFaults(prev => prev.map(f => f.id === faultId ? updatedFault : f));
            if (onUpdate) {
                await onUpdate();
            }
        }
    };

    const handleToggleArgeApproved = async (faultId, currentStatus) => {
        const { data, error } = await supabase
            .from('quality_inspection_faults')
            .update({
                arge_approved: !currentStatus,
                arge_approved_at: !currentStatus ? new Date().toISOString() : null,
                arge_approved_by: !currentStatus ? profile.id : null
            })
            .eq('id', faultId)
            .select(`*, department:production_departments(name), category:fault_categories(name)`)
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Ar-Ge onay durumu güncellenemedi: ' + error.message });
        } else {
            const updatedFault = enrichFaultRecord(data);
            setFaults(prev => prev.map(f => f.id === faultId ? updatedFault : f));
            toast({
                title: 'Başarılı',
                description: !currentStatus ? 'Ar-Ge onayı verildi.' : 'Ar-Ge onayı kaldırıldı.'
            });
            if (onUpdate) {
                await onUpdate();
            }
        }
    };

    const handleEditFault = (fault) => {
        setEditingFault(fault);
        setEditFaultData({
            description: fault.description || '',
            department_id: fault.department_id || '',
            category_id: fault.category_id || '',
            quantity: fault.quantity || 1
        });
        // Kategorileri filtrele
        const filtered = categories.filter(c => c.department_id === fault.department_id);
        setFilteredCategories(filtered);
    };

    const handleUpdateFault = async () => {
        if (!editingFault || !editFaultData.description || !editFaultData.department_id || !editFaultData.quantity || !editFaultData.category_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm alanları doldurun.' });
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('quality_inspection_faults')
            .update({
                description: editFaultData.description,
                department_id: editFaultData.department_id,
                category_id: editFaultData.category_id,
                quantity: editFaultData.quantity,
            })
            .eq('id', editingFault.id)
            .select(`*, department:production_departments(name), category:fault_categories(name)`)
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Hata güncellenemedi: ' + error.message });
        } else {
            const updatedFault = enrichFaultRecord(data);
            let syncWarning = null;
            const previousCategoryId = editingFault.category_id || null;
            const previousCategoryName = editingFault.category_name || editingFault.category?.name || null;

            try {
                await syncFaultNonconformityRecord(updatedFault);

                const categoryChanged =
                    String(previousCategoryId || '') !== String(updatedFault.category_id || '') ||
                    (previousCategoryName || '') !== (updatedFault.category_name || '');

                if (categoryChanged && (previousCategoryId || previousCategoryName)) {
                    await syncFaultCategoryGroup({
                        categoryId: previousCategoryId,
                        categoryName: previousCategoryName
                    });
                }
            } catch (syncError) {
                console.error('Guncellenen hata ile bagli uygunsuzluk kaydi senkronize edilemedi:', syncError);
                syncWarning = syncError;
            }

            toast({
                title: syncWarning ? 'Kısmi Başarı' : 'Başarılı',
                description: syncWarning
                    ? `Hata güncellendi ancak bağlı uygunsuzluk kaydı senkronize edilemedi: ${syncWarning.message}`
                    : 'Hata ve bağlı uygunsuzluk kaydı başarıyla güncellendi.'
            });

            setFaults(prev => prev.map(f => f.id === editingFault.id ? updatedFault : f));
            setEditingFault(null);
            setEditFaultData({ description: '', department_id: '', category_id: '', quantity: 1 });
            setFilteredCategories([]);
            if (onUpdate) {
                await onUpdate();
            }
        }
        setLoading(false);
    };

    const handleCancelEdit = () => {
        setEditingFault(null);
        setEditFaultData({ description: '', department_id: '', category_id: '', quantity: 1 });
        setFilteredCategories([]);
    };

    const handleCreateNC = () => {
        const selectedFaults = faults.filter(f => !f.is_resolved);
        if (selectedFaults.length === 0) {
            toast({ variant: 'destructive', title: 'Uygunsuzluk Oluşturulamaz', description: 'Uygunsuzluk oluşturmak için en az bir açık hata olmalıdır.' });
            return;
        }
        const combinedDescription = selectedFaults.map(f => `- ${f.description} (${f.quantity} adet)`).join('\n');
        const primaryFault = selectedFaults[0];

        onOpenNCForm({
            id: null,
            description: combinedDescription,
            department_name: primaryFault.department_name,
        }, vehicle);
        setIsOpen(false);
    };

    if (!vehicle) {
        return null;
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Hataları Yönet: {vehicle?.chassis_no || vehicle?.serial_no || 'Bilinmeyen'}</DialogTitle>
                        <DialogDescription>Bu araç için tespit edilen hataları ekleyin, düzenleyin veya silin.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Mevcut Hatalar</h3>
                                <ScrollArea className="h-72 pr-6 border rounded-md">
                                    <div className="space-y-3 p-4">
                                        {faults.map(fault => (
                                            <div key={fault.id} className={cn("p-3 rounded-md border flex items-center justify-between", fault.is_resolved ? "bg-green-100/50 border-green-200" : "bg-red-100/50 border-red-200", fault.arge_approved && "ring-2 ring-purple-300")}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{fault.description}</p>
                                                        {fault.category_name && (
                                                            <Badge variant="outline" className="bg-white/80">
                                                                {fault.category_name}
                                                            </Badge>
                                                        )}
                                                        {fault.arge_approved && (
                                                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300">
                                                                <FlaskConical className="h-3 w-3 mr-1" />
                                                                Ar-Ge Onaylı
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{fault.department_name} - {fault.quantity} adet</p>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        <span>Giriş: {fault.created_at ? new Date(fault.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                                        {fault.is_resolved && fault.resolved_at && (
                                                            <span className="text-green-700">Çözüm: {new Date(fault.resolved_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                        )}
                                                        {fault.arge_approved && fault.arge_approved_at && (
                                                            <span className="text-purple-700">Ar-Ge Onay: {new Date(fault.arge_approved_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {canManage && !fault.is_resolved && (
                                                        <>
                                                            <Button variant="ghost" size="icon" onClick={() => handleEditFault(fault)} disabled={loading} className="text-blue-600 hover:bg-blue-100">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleToggleResolved(fault.id, fault.is_resolved)} disabled={loading} className="text-green-600 hover:bg-green-100">
                                                                <CheckCircle className="h-5 w-5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleToggleArgeApproved(fault.id, fault.arge_approved)} disabled={loading} className={cn("text-purple-600 hover:bg-purple-100", fault.arge_approved && "bg-purple-100")}>
                                                                <FlaskConical className="h-5 w-5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {canManage && fault.is_resolved && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleToggleResolved(fault.id, fault.is_resolved)}
                                                            disabled={loading}
                                                            className="text-orange-600 hover:bg-orange-100"
                                                            title="Tekrar Aktifleştir"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canManage && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" disabled={loading} className="text-destructive hover:bg-red-100">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                                            <AlertDialogDescription>Bu işlem geri alınamaz. Hata kaydı kalıcı olarak silinecektir.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleRemoveFault(fault)}>Sil</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                            {canManage ? (
                                <div className="space-y-4 pt-2">
                                    <h3 className="text-lg font-semibold mb-2">{editingFault ? 'Hata Düzenle' : 'Yeni Hata Ekle'}</h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="fault-dept">İlgili Birim</Label>
                                        <Select
                                            value={editingFault ? editFaultData.department_id : newFault.department_id}
                                            onValueChange={(value) => {
                                                if (editingFault) {
                                                    setEditFaultData({ ...editFaultData, department_id: value, category_id: '' });
                                                    const filtered = categories.filter(c => c.department_id === value);
                                                    setFilteredCategories(filtered);
                                                } else {
                                                    handleDepartmentChange(value);
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="fault-dept"><SelectValue placeholder="Birim Seçin" /></SelectTrigger>
                                            <SelectContent>
                                                {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fault-cat">Kategori</Label>
                                        <Select
                                            value={editingFault ? editFaultData.category_id : newFault.category_id}
                                            onValueChange={(value) => {
                                                if (editingFault) {
                                                    setEditFaultData({ ...editFaultData, category_id: value });
                                                } else {
                                                    setNewFault({ ...newFault, category_id: value });
                                                }
                                            }}
                                            disabled={editingFault ? !editFaultData.department_id : !newFault.department_id}
                                        >
                                            <SelectTrigger id="fault-cat"><SelectValue placeholder="Kategori Seçin" /></SelectTrigger>
                                            <SelectContent>
                                                {filteredCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fault-desc">Hata Açıklaması</Label>
                                        <Input
                                            id="fault-desc"
                                            value={editingFault ? editFaultData.description : newFault.description}
                                            onChange={(e) => {
                                                if (editingFault) {
                                                    setEditFaultData({ ...editFaultData, description: e.target.value });
                                                } else {
                                                    setNewFault({ ...newFault, description: e.target.value });
                                                }
                                            }}
                                            placeholder="Örn: Boya akıntısı"
                                            autoCapitalize="off"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fault-qty">Adet</Label>
                                        <Input
                                            id="fault-qty"
                                            type="number"
                                            min="1"
                                            value={editingFault ? editFaultData.quantity : newFault.quantity}
                                            onChange={(e) => {
                                                if (editingFault) {
                                                    setEditFaultData({ ...editFaultData, quantity: parseInt(e.target.value) || 1 });
                                                } else {
                                                    setNewFault({ ...newFault, quantity: parseInt(e.target.value) || 1 });
                                                }
                                            }}
                                        />
                                    </div>
                                    {editingFault ? (
                                        <div className="flex gap-2">
                                            <Button onClick={handleUpdateFault} disabled={loading} className="flex-1">
                                                <Edit className="mr-2 h-4 w-4" /> {loading ? 'Güncelleniyor...' : 'Güncelle'}
                                            </Button>
                                            <Button onClick={handleCancelEdit} variant="outline" disabled={loading}>
                                                İptal
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button onClick={handleAddFault} disabled={loading} className="w-full">
                                            <PlusCircle className="mr-2 h-4 w-4" /> {loading ? 'Ekleniyor...' : 'Hata Ekle'}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
                                    <p className="text-muted-foreground">Hata yönetimi için yetkiniz yok.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex-shrink-0 flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-2">
                        </div>
                        <div className="flex gap-2">
                            {canManage && faults.length > 0 && (
                                hasExistingCosts ? (
                                    // Mevcut kayıt varsa düzenleme butonu göster
                                    <Button
                                        variant="default"
                                        onClick={() => setIsFaultCostModalOpen(true)}
                                        disabled={loading}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Maliyet Kaydı Düzenle
                                    </Button>
                                ) : (
                                    // Mevcut kayıt yoksa oluşturma butonu göster
                                    <Button
                                        variant="default"
                                        onClick={() => setIsFaultCostModalOpen(true)}
                                        disabled={loading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Hatalar için Maliyet Kaydı Oluştur
                                    </Button>
                                )
                            )}
                            {canManage && (
                                <Button variant="secondary" onClick={handleCreateNC} disabled={loading}>
                                    Uygunsuzluk Oluştur
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {vehicle && (
                <FaultCostModal
                    isOpen={isFaultCostModalOpen}
                    setIsOpen={setIsFaultCostModalOpen}
                    vehicle={vehicle}
                    faults={faults || []}
                    onSuccess={() => {
                        // Kayıt oluşturuldu/güncellendi, artık kayıt var
                        setHasExistingCosts(true);
                        if (onUpdate) onUpdate();
                    }}
                />
            )}
        </>
    );
};

export default VehicleFaultsModal;
