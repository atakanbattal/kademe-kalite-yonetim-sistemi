import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, PlusCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const VehicleFaultsModal = ({ isOpen, setIsOpen, vehicle, onUpdate }) => {
    const { toast } = useToast();
    const [faults, setFaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [newFault, setNewFault] = useState({ department_id: '', description: '', quantity: 1, fault_date: new Date().toISOString().slice(0, 10) });
    const [isAdding, setIsAdding] = useState(false);

    const fetchFaults = useCallback(async () => {
        if (!vehicle?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quality_inspection_faults')
            .select('*, department:production_departments(name)')
            .eq('inspection_id', vehicle.id)
            .order('created_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Hata kayıtları alınamadı.' });
        } else {
            setFaults(data);
        }
        setLoading(false);
    }, [vehicle, toast]);

    useEffect(() => {
        const fetchDepartments = async () => {
            const { data, error } = await supabase.from('production_departments').select('*');
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Departmanlar alınamadı.' });
            } else {
                setDepartments(data);
            }
        };

        if (isOpen) {
            fetchFaults();
            fetchDepartments();
        }
    }, [isOpen, fetchFaults, toast]);

    const handleAddFault = async () => {
        if (!newFault.department_id || !newFault.description || !newFault.quantity) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm alanları doldurun.' });
            return;
        }
        setIsAdding(true);
        const { error } = await supabase.from('quality_inspection_faults').insert({
            inspection_id: vehicle.id,
            department_id: newFault.department_id,
            description: newFault.description,
            quantity: newFault.quantity,
            fault_date: newFault.fault_date,
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Hata eklenemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Hata kaydı eklendi.' });
            setNewFault({ department_id: '', description: '', quantity: 1, fault_date: new Date().toISOString().slice(0, 10) });
            fetchFaults();
            onUpdate();
        }
        setIsAdding(false);
    };

    const handleDeleteFault = async (faultId) => {
        const { error } = await supabase.from('quality_inspection_faults').delete().eq('id', faultId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Hata silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Hata kaydı silindi.' });
            fetchFaults();
            onUpdate();
        }
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setNewFault(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (value) => {
        setNewFault(prev => ({ ...prev, department_id: value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>Hata Kayıtları: {vehicle?.serial_no}</DialogTitle>
                    <DialogDescription>Araç için girilen tüm hata kayıtlarını yönetin.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Yeni Hata Ekle</h3>
                        <div>
                            <Label htmlFor="department_id">Departman</Label>
                            <Select onValueChange={handleSelectChange} value={newFault.department_id}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Departman seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="description">Hata Açıklaması</Label>
                            <Textarea id="description" value={newFault.description} onChange={handleInputChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="quantity">Adet</Label>
                                <Input id="quantity" type="number" min="1" value={newFault.quantity} onChange={handleInputChange} />
                            </div>
                            <div>
                                <Label htmlFor="fault_date">Hata Tarihi</Label>
                                <Input id="fault_date" type="date" value={newFault.fault_date} onChange={handleInputChange} />
                            </div>
                        </div>
                        <Button onClick={handleAddFault} disabled={isAdding}>
                            <PlusCircle className="mr-2 h-4 w-4" /> {isAdding ? 'Ekleniyor...' : 'Hata Ekle'}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">Mevcut Hatalar</h3>
                        <ScrollArea className="h-72 border rounded-md p-2">
                            {loading ? (
                                <p>Yükleniyor...</p>
                            ) : faults.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">Bu araç için hata kaydı bulunmuyor.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {faults.map(fault => (
                                        <li key={fault.id} className="flex justify-between items-center p-2 bg-secondary rounded">
                                            <div>
                                                <p className="font-medium">{fault.description}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {fault.department?.name || 'Bilinmeyen'} - {fault.quantity} adet
                                                </p>
                                            </div>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bu işlem geri alınamaz. Bu hata kaydını kalıcı olarak silecektir.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteFault(fault.id)}>Sil</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleFaultsModal;