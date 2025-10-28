import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CreateNCFromFaultModal = ({ isOpen, setIsOpen, fault, vehicle, onOpenNCForm }) => {
  const [ncType, setNcType] = useState('DF');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    const ncData = {
      source_inspection_fault_id: fault.id,
      title: `${vehicle.vehicle_type} - ${fault.description}`,
      description: `Araç Şasi No: ${vehicle.chassis_no}\nAraç Seri No: ${vehicle.serial_no}\nHata: ${fault.description} (Adet: ${fault.quantity})`,
      department: fault.department?.name,
      requesting_unit: 'Kalite Kontrol',
      source: 'vehicle_fault'
    };
    onOpenNCForm(ncType, ncData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">Uygunsuzluk Kaydı Oluştur</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            <b>{fault?.description}</b> hatası için oluşturulacak uygunsuzluk türünü seçin.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="nc-type-select" className="text-foreground">Uygunsuzluk Türü</Label>
            <Select value={ncType} onValueChange={setNcType}>
              <SelectTrigger id="nc-type-select">
                <SelectValue placeholder="Tür seçin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DF">DF (Düzeltici Faaliyet)</SelectItem>
                <SelectItem value="8D">8D Raporu</SelectItem>
                <SelectItem value="MDI">MDI (Mini Düzeltici İyileştirme)</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="text-sm p-3 bg-secondary rounded-md text-muted-foreground">
            Seçiminize göre ilgili form, araç ve hata bilgileriyle önceden doldurulmuş olarak açılacaktır.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
          <Button onClick={handleConfirm}>Devam Et</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNCFromFaultModal;