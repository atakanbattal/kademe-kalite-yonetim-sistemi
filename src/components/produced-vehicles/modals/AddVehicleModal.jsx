import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BaseVehicleForm from '@/components/produced-vehicles/modals/BaseVehicleForm';

const AddVehicleModal = ({ isOpen, setIsOpen, refreshVehicles }) => (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
                <DialogTitle>Yeni Araç Ekle</DialogTitle>
                <DialogDescription>
                    Kalite sürecine yeni bir araç ekleyin. Gerekli tüm alanları doldurun.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                <BaseVehicleForm onSave={refreshVehicles} setIsOpen={setIsOpen} />
            </div>
        </DialogContent>
    </Dialog>
);

export default AddVehicleModal;