import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';

const DMO_STATUS_OPTIONS = ['DMO Bekliyor', 'DMO Geçti', 'DMO Kaldı'];

const EditVehicleModal = ({ isOpen, setIsOpen, vehicle, refreshVehicles }) => {
    const { toast } = useToast();
    const { refreshProducedVehicles, products, productCategories } = useData();
    const [formData, setFormData] = useState({
        chassis_no: '',
        serial_no: '',
        customer_name: '',
        vehicle_type: '',
        notes: '',
        dmo_status: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [initialFormData, setInitialFormData] = useState({});
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingClose, setPendingClose] = useState(false);
    
    // Araç tiplerini products tablosundan çek
    const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    const vehicleTypes = (products || [])
        .filter(p => p.category_id === vehicleTypeCategory?.id)
        .map(p => p.product_name);

    useEffect(() => {
        if (vehicle && isOpen) {
            const initialData = {
                chassis_no: vehicle.chassis_no || '',
                serial_no: vehicle.serial_no || '',
                customer_name: vehicle.customer_name || '',
                vehicle_type: vehicle.vehicle_type || '',
                notes: vehicle.notes || '',
                dmo_status: vehicle.dmo_status || '',
            };
            setFormData(initialData);
            setInitialFormData(initialData);
        }
    }, [vehicle, isOpen]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value === 'none' ? '' : value }));
    };

    const handleClose = (open) => {
        if (!open) {
            const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
            if (hasChanged) {
                setPendingClose(true);
                setShowConfirmDialog(true);
            } else {
                setIsOpen(false);
            }
        }
    };
    
    const handleConfirmClose = () => {
        setShowConfirmDialog(false);
        setIsOpen(false);
        setPendingClose(false);
    };
    
    const handleCancelClose = () => {
        setShowConfirmDialog(false);
        setPendingClose(false);
        // Modal'ı tekrar aç (çünkü Dialog onOpenChange ile kapanmış olabilir)
        if (!isOpen && pendingClose) {
            setIsOpen(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!vehicle) return;
        setIsSubmitting(true);

        const { error } = await supabase
            .from('quality_inspections')
            .update({
                chassis_no: formData.chassis_no,
                serial_no: formData.serial_no,
                customer_name: formData.customer_name,
                vehicle_type: formData.vehicle_type,
                notes: formData.notes,
                dmo_status: formData.dmo_status,
            })
            .eq('id', vehicle.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Araç güncellenirken bir hata oluştu: ${error.message}`,
            });
        } else {
            toast({
                title: 'Başarılı!',
                description: 'Araç bilgileri başarıyla güncellendi.',
            });
            // Önce özel refresh fonksiyonunu çağır (daha hızlı)
            if (refreshProducedVehicles) {
                refreshProducedVehicles();
            }
            // Sonra genel refresh'i de çağır (fallback)
            if (refreshVehicles) {
                refreshVehicles();
            }
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-2xl" onEscapeKeyDown={(e) => {
                    const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
                    if (hasChanged) {
                        e.preventDefault();
                        setPendingClose(true);
                        setShowConfirmDialog(true);
                    }
                }}>
                <DialogHeader>
                    <DialogTitle>Araç Bilgilerini Düzenle</DialogTitle>
                    <DialogDescription>
                        Şasi No: {vehicle?.chassis_no}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="chassis_no">Şasi No</Label>
                            <Input id="chassis_no" value={formData.chassis_no} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="serial_no">Seri No</Label>
                            <Input id="serial_no" value={formData.serial_no} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="customer_name">Müşteri Adı</Label>
                            <Input id="customer_name" value={formData.customer_name} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="vehicle_type">Araç Tipi</Label>
                            <Select value={formData.vehicle_type} onValueChange={(value) => handleSelectChange('vehicle_type', value)}>
                                <SelectTrigger><SelectValue placeholder="Araç tipi seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {vehicleTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="dmo_status">DMO Durumu</Label>
                            <Select value={formData.dmo_status} onValueChange={(value) => handleSelectChange('dmo_status', value)}>
                                <SelectTrigger><SelectValue placeholder="DMO durumu seçin..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {DMO_STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="notes">Notlar</Label>
                        <Textarea id="notes" value={formData.notes} onChange={handleInputChange} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Değişiklikler Kaydedilmedi</AlertDialogTitle>
                    <AlertDialogDescription>
                        Yapılan değişiklikler kaydedilmedi. Çıkmak istediğinize emin misiniz?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancelClose}>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmClose}>Çık</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
};

export default EditVehicleModal;