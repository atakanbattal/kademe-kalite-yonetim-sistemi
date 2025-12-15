import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BaseVehicleForm from '@/components/produced-vehicles/modals/BaseVehicleForm';

const AddVehicleModal = ({ isOpen, setIsOpen, refreshVehicles }) => (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Yeni Araç Ekle</DialogTitle>
                <DialogDescription>
                    Kalite sürecine yeni bir araç ekleyin. Gerekli tüm alanları doldurun.
                </DialogDescription>
            </DialogHeader>
            <BaseVehicleForm onSave={refreshVehicles} setIsOpen={setIsOpen} />
        </DialogContent>
    </Dialog>
);

export default AddVehicleModal;