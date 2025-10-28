import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CreateNCFromQuarantineModal = ({ isOpen, setIsOpen, quarantineRecord, onOpenNCForm, refreshData }) => {
  const [ncType, setNcType] = useState('DF');
  
  if (!isOpen) return null;

  const handleConfirm = async () => {
    const ncData = {
        source_quarantine_id: quarantineRecord.id,
        part_name: quarantineRecord.part_name,
        part_code: quarantineRecord.part_code,
        description: `Karantina Kaydı: ${quarantineRecord.part_name} - ${quarantineRecord.description}`,
        department: quarantineRecord.source_department,
        requesting_unit: quarantineRecord.requesting_department,
        requesting_person: quarantineRecord.requesting_person_name,
    };
    await onOpenNCForm(ncType, ncData);
    if(refreshData) {
      await refreshData();
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">Uygunsuzluk Kaydı Oluştur</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            <b>{quarantineRecord.part_name}</b> için oluşturulacak uygunsuzluk türünü seçin.
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
            Seçiminize göre ilgili form, karantina kaydındaki bilgilerle önceden doldurulmuş olarak açılacaktır.
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

export default CreateNCFromQuarantineModal;