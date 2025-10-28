import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const QUALITY_STATUSES = [
    "Kaliteye Girdi",
    "Kontrol Başladı",
    "Kontrol Bitti",
    "Yeniden İşlemde",
    "Sevk Hazır",
    "Sevk Edildi",
];

const DMO_STATUSES = [
    "DMO Bekliyor",
    "DMO Geçti",
    "DMO Kaldı",
];

const UpdateStatusModal = ({ isOpen, setIsOpen, vehicle, onUpdate, refreshVehicles }) => {
    const [qualityStatus, setQualityStatus] = useState('');
    const [dmoStatus, setDmoStatus] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { profile } = useAuth();

    const isActionDisabled = profile?.role !== 'admin';

    useEffect(() => {
        if (vehicle) {
            setQualityStatus(vehicle.status || '');
            setDmoStatus(vehicle.dmo_status || '');
            setNotes('');
        }
    }, [vehicle, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((!qualityStatus && !dmoStatus) || !vehicle || isActionDisabled) return;

        setIsSubmitting(true);
        try {
            await onUpdate({
                id: vehicle.id,
                nextStatus: qualityStatus,
                dmoStatus: dmoStatus,
                notes: notes || `Durum ${profile?.full_name || 'kullanıcı'} tarafından manuel olarak değiştirildi.`,
            });
            if (refreshVehicles) refreshVehicles();
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Hata!",
                description: `Durum güncellenemedi: ${error.message}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!vehicle) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Durum Değiştir: {vehicle.chassis_no}</DialogTitle>
                    <DialogDescription>
                        Aracın kalite ve DMO durumlarını manuel olarak değiştirin. Bu işlem standart iş akışının dışındadır ve yalnızca admin tarafından yapılabilir.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="quality-status">Kalite Durumu</Label>
                        <Select onValueChange={setQualityStatus} value={qualityStatus} disabled={isActionDisabled}>
                            <SelectTrigger id="quality-status">
                                <SelectValue placeholder="Kalite durumu seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {QUALITY_STATUSES.map(status => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dmo-status">DMO Durumu</Label>
                        <Select onValueChange={setDmoStatus} value={dmoStatus} disabled={isActionDisabled}>
                            <SelectTrigger id="dmo-status">
                                <SelectValue placeholder="DMO durumu seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {DMO_STATUSES.map(status => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notlar (İsteğe Bağlı)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Durum değişikliğinin nedenini açıklayın..."
                            disabled={isActionDisabled}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting || isActionDisabled}>
                            {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default UpdateStatusModal;