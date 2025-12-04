import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ScrollArea } from '@/components/ui/scroll-area';

const VehicleFilterModal = ({ isOpen, setIsOpen, applyFilters, currentFilters, vehicles }) => {
    const [statusFilters, setStatusFilters] = useState(currentFilters.status || []);
    const [vehicleTypeFilters, setVehicleTypeFilters] = useState(currentFilters.vehicle_type || []);
    const [dateRange, setDateRange] = useState(currentFilters.dateRange);

    useEffect(() => {
        if (isOpen) {
            setStatusFilters(currentFilters.status || []);
            setVehicleTypeFilters(currentFilters.vehicle_type || []);
            setDateRange(currentFilters.dateRange);
        }
    }, [isOpen, currentFilters]);

    const uniqueStatuses = [...new Set(vehicles.map(v => v.status))];
    const uniqueVehicleTypes = [...new Set(vehicles.map(v => v.vehicle_type))];

    const handleStatusChange = (status) => {
        setStatusFilters(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const handleVehicleTypeChange = (type) => {
        setVehicleTypeFilters(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleApply = () => {
        applyFilters({
            status: statusFilters,
            vehicle_type: vehicleTypeFilters,
            dateRange: dateRange,
        });
        setIsOpen(false);
    };

    const handleClear = () => {
        setStatusFilters([]);
        setVehicleTypeFilters([]);
        setDateRange(null);
        applyFilters({
            status: [],
            vehicle_type: [],
            dateRange: null,
        });
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Araçları Filtrele</DialogTitle>
                    <DialogDescription>
                        Görüntülemek istediğiniz araçları filtreleyin.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="font-semibold mb-2 block">Durum</Label>
                            <ScrollArea className="h-40 border rounded-md p-2">
                                {uniqueStatuses.map(status => (
                                    <div key={status} className="flex items-center space-x-2 mb-2">
                                        <Checkbox
                                            id={`status-${status}`}
                                            checked={statusFilters.includes(status)}
                                            onCheckedChange={() => handleStatusChange(status)}
                                        />
                                        <label htmlFor={`status-${status}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {status}
                                        </label>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div>
                            <Label className="font-semibold mb-2 block">Araç Tipi</Label>
                            <ScrollArea className="h-40 border rounded-md p-2">
                                {uniqueVehicleTypes.map(type => (
                                    <div key={type} className="flex items-center space-x-2 mb-2">
                                        <Checkbox
                                            id={`type-${type}`}
                                            checked={vehicleTypeFilters.includes(type)}
                                            onCheckedChange={() => handleVehicleTypeChange(type)}
                                        />
                                        <label htmlFor={`type-${type}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {type}
                                        </label>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                    <div>
                        <Label className="font-semibold mb-2 block">Tarih Aralığı (Oluşturma)</Label>
                        <DateRangePicker
                            date={dateRange}
                            onDateChange={setDateRange}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClear}>Filtreleri Temizle</Button>
                    <Button onClick={handleApply}>Uygula</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleFilterModal;