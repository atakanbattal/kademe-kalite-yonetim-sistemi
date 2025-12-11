import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { PlusCircle, Trash2, CheckCircle } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { createVehicleQualityCostRecord } from '@/lib/vehicleCostCalculator';
    import FaultCostModal from './FaultCostModal';
    import { Calculator } from 'lucide-react';

    const VehicleFaultsModal = ({ isOpen, setIsOpen, vehicle, departments, onUpdate, onOpenNCForm }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const { unitCostSettings, refreshData, qualityCosts } = useData();
        const [faults, setFaults] = useState([]);
        const [newFault, setNewFault] = useState({ description: '', department_id: '', category_id: '', quantity: 1 });
        const [loading, setLoading] = useState(false);
        const [categories, setCategories] = useState([]);
        const [filteredCategories, setFilteredCategories] = useState([]);
        const [autoCreateCost, setAutoCreateCost] = useState(true); // Otomatik maliyet kaydı oluşturma toggle
        const [isFaultCostModalOpen, setIsFaultCostModalOpen] = useState(false);

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

        const fetchFaults = useCallback(async () => {
            if (!vehicle || !vehicle.id) {
                setFaults([]);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('quality_inspection_faults')
                    .select('*, department:production_departments(name)')
                    .eq('inspection_id', vehicle.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('❌ Hatalar alınamadı:', error);
                    toast({ variant: 'destructive', title: 'Hata', description: 'Hatalar alınamadı: ' + error.message });
                    setFaults([]);
                } else {
                    const enrichedFaults = (data || []).map(f => ({
                        ...f,
                        department_name: f.department?.name || 'Bilinmeyen'
                    }));
                    setFaults(enrichedFaults);
                }
            } catch (err) {
                console.error('❌ Hatalar yüklenirken beklenmeyen hata:', err);
                toast({ variant: 'destructive', title: 'Hata', description: 'Hatalar yüklenirken bir hata oluştu.' });
                setFaults([]);
            }
        }, [vehicle, toast]);

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
            if(vehicle) {
                fetchFaults();
            }
        }, [vehicle, fetchFaults]);

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
                })
                .select(`*, department:production_departments(name)`)
                .single();

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Hata eklenemedi: ' + error.message });
            } else {
                toast({ title: 'Başarılı', description: 'Hata başarıyla eklendi.' });
                const newFaultWithDept = { ...data, department_name: data.department?.name || 'Bilinmeyen' };
                setFaults(prev => [newFaultWithDept, ...prev]);
                setNewFault({ description: '', department_id: '', category_id: '', quantity: 1 });
                setFilteredCategories([]);
                if (onUpdate) onUpdate();
                
                // Otomatik kalitesizlik maliyeti kaydı oluştur (eğer aktifse)
                if (autoCreateCost && unitCostSettings.length > 0) {
                    try {
                        const fullVehicleData = await fetchFullVehicleData();
                        if (fullVehicleData) {
                            const costRecord = await createVehicleQualityCostRecord(fullVehicleData, unitCostSettings);
                            if (costRecord) {
                                toast({ 
                                    title: 'Maliyet Kaydı Oluşturuldu', 
                                    description: `Kalitesizlik maliyeti otomatik olarak kaydedildi: ${costRecord.amount.toFixed(2)} ₺`,
                                    duration: 5000
                                });
                                if (refreshData) refreshData();
                            }
                        }
                    } catch (costError) {
                        console.error('❌ Otomatik maliyet kaydı oluşturulamadı:', costError);
                        // Hata mesajı gösterme, sessizce devam et
                    }
                }
            }
            setLoading(false);
        };

        const handleRemoveFault = async (faultId) => {
            setLoading(true);
            const { error } = await supabase.from('quality_inspection_faults').delete().eq('id', faultId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Hata silinemedi: ' + error.message });
            } else {
                toast({ title: 'Başarılı', description: 'Hata başarıyla silindi.' });
                setFaults(prev => prev.filter(f => f.id !== faultId));
                if (onUpdate) onUpdate();
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
                .select(`*, department:production_departments(name)`)
                .single();

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Hata durumu güncellenemedi: ' + error.message });
            } else {
                 const updatedFault = { ...data, department_name: data.department?.name || 'Bilinmeyen' };
                setFaults(prev => prev.map(f => f.id === faultId ? updatedFault : f));
                if (onUpdate) onUpdate();
                
                // Eğer hata çözüldüyse ve otomatik maliyet kaydı aktifse, maliyet kaydını güncelle
                if (!currentStatus && autoCreateCost && unitCostSettings.length > 0) {
                    try {
                        const fullVehicleData = await fetchFullVehicleData();
                        if (fullVehicleData) {
                            const costRecord = await createVehicleQualityCostRecord(fullVehicleData, unitCostSettings);
                            if (costRecord) {
                                toast({ 
                                    title: 'Maliyet Kaydı Güncellendi', 
                                    description: `Kalitesizlik maliyeti güncellendi: ${costRecord.amount.toFixed(2)} ₺`,
                                    duration: 5000
                                });
                                if (refreshData) refreshData();
                            }
                        }
                    } catch (costError) {
                        console.error('❌ Otomatik maliyet kaydı güncellenemedi:', costError);
                    }
                }
            }
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
                    <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Hataları Yönet: {vehicle?.chassis_no || vehicle?.serial_no || 'Bilinmeyen'}</DialogTitle>
                        <DialogDescription>Bu araç için tespit edilen hataları ekleyin, düzenleyin veya silin.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Mevcut Hatalar</h3>
                             <ScrollArea className="h-72 pr-6 border rounded-md">
                                <div className="space-y-3 p-4">
                                    {faults.map(fault => (
                                        <div key={fault.id} className={cn("p-3 rounded-md border flex items-center justify-between", fault.is_resolved ? "bg-green-100/50 border-green-200" : "bg-red-100/50 border-red-200")}>
                                            <div className="flex-1">
                                                <p className="font-medium">{fault.description}</p>
                                                <p className="text-sm text-muted-foreground">{fault.department_name} - {fault.quantity} adet</p>
                                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span>Giriş: {fault.created_at ? new Date(fault.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                                    {fault.is_resolved && fault.resolved_at && (
                                                        <span className="text-green-700">Çözüm: {new Date(fault.resolved_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {canManage && !fault.is_resolved && (
                                                     <Button variant="ghost" size="icon" onClick={() => handleToggleResolved(fault.id, fault.is_resolved)} disabled={loading} className="text-green-600 hover:bg-green-100">
                                                        <CheckCircle className="h-5 w-5" />
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
                                                                <AlertDialogAction onClick={() => handleRemoveFault(fault.id)}>Sil</AlertDialogAction>
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
                                <h3 className="text-lg font-semibold mb-2">Yeni Hata Ekle</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="fault-dept">İlgili Birim</Label>
                                    <Select value={newFault.department_id} onValueChange={handleDepartmentChange}>
                                        <SelectTrigger id="fault-dept"><SelectValue placeholder="Birim Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fault-cat">Kategori</Label>
                                     <Select value={newFault.category_id} onValueChange={(value) => setNewFault({ ...newFault, category_id: value })} disabled={!newFault.department_id}>
                                        <SelectTrigger id="fault-cat"><SelectValue placeholder="Kategori Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            {filteredCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fault-desc">Hata Açıklaması</Label>
                                    <Input id="fault-desc" value={newFault.description} onChange={(e) => setNewFault({ ...newFault, description: e.target.value })} placeholder="Örn: Boya akıntısı" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fault-qty">Adet</Label>
                                    <Input id="fault-qty" type="number" min="1" value={newFault.quantity} onChange={(e) => setNewFault({ ...newFault, quantity: parseInt(e.target.value) || 1 })} />
                                </div>
                                <Button onClick={handleAddFault} disabled={loading} className="w-full">
                                    <PlusCircle className="mr-2 h-4 w-4" /> {loading ? 'Ekleniyor...' : 'Hata Ekle'}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
                                <p className="text-muted-foreground">Hata yönetimi için yetkiniz yok.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {canManage && (
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoCreateCost}
                                        onChange={(e) => setAutoCreateCost(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-muted-foreground">Otomatik maliyet kaydı oluştur</span>
                                </label>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {canManage && faults.length > 0 && (() => {
                                // Mevcut maliyet kayıtlarını kontrol et
                                const existingCostRecords = qualityCosts?.filter(cost => 
                                    cost.source_type === 'produced_vehicle_final_faults' && 
                                    cost.source_record_id === vehicle?.id
                                ) || [];
                                const hasExistingCosts = existingCostRecords.length > 0;

                                if (hasExistingCosts) {
                                    // Mevcut kayıt varsa düzenleme butonu göster
                                    return (
                                        <Button 
                                            variant="default" 
                                            onClick={() => setIsFaultCostModalOpen(true)} 
                                            disabled={loading}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Calculator className="mr-2 h-4 w-4" />
                                            Maliyet Kayıtlarını Düzenle
                                        </Button>
                                    );
                                } else {
                                    // Mevcut kayıt yoksa oluşturma butonu göster
                                    return (
                                        <Button 
                                            variant="default" 
                                            onClick={() => setIsFaultCostModalOpen(true)} 
                                            disabled={loading}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <Calculator className="mr-2 h-4 w-4" />
                                            Hatalar için Maliyet Kaydı Oluştur
                                        </Button>
                                    );
                                }
                            })()}
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
                        if (onUpdate) onUpdate();
                    }}
                />
            )}
        </>
    );
};

export default VehicleFaultsModal;