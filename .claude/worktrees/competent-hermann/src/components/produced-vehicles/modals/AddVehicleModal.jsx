import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BaseVehicleForm from '@/components/produced-vehicles/modals/BaseVehicleForm';

const AddVehicleModal = ({ isOpen, setIsOpen, refreshVehicles }) => (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
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