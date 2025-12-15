import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const STATUS_OPTIONS = ['Aktif', 'Zimmetli', 'Bakımda', 'Kullanım Dışı', 'Kalibrasyonda', 'Hurdaya Ayrıldı'];
const CALIBRATION_STATUS_OPTIONS = ['Tamam', 'Yaklaşıyor', 'Geçmiş', 'Girilmemiş', 'Pasif'];

const EquipmentFilters = ({ isOpen, setIsOpen, filters, onFiltersChange, onReset }) => {
    const [localFilters, setLocalFilters] = useState(filters || {
        status: '',
        calibrationStatus: '',
        responsibleUnit: '',
        location: '',
        minCalibrationDays: '',
        maxCalibrationDays: ''
    });

    const handleFilterChange = (key, value) => {
        setLocalFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleApply = () => {
        onFiltersChange(localFilters);
        setIsOpen(false);
    };

    const handleReset = () => {
        const resetFilters = {
            status: '',
            calibrationStatus: '',
            responsibleUnit: '',
            location: '',
            minCalibrationDays: '',
            maxCalibrationDays: ''
        };
        setLocalFilters(resetFilters);
        onFiltersChange(resetFilters);
        if (onReset) onReset();
    };

    const activeFiltersCount = Object.values(localFilters).filter(v => v !== '').length;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Filtrele</DialogTitle>
                    <DialogDescription>
                        Ekipmanları durum, kalibrasyon ve diğer kriterlere göre filtreleyin.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Durum</Label>
                            <Select value={localFilters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                                <SelectTrigger id="status">
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tümü</SelectItem>
                                    {STATUS_OPTIONS.map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="calibrationStatus">Kalibrasyon Durumu</Label>
                            <Select value={localFilters.calibrationStatus} onValueChange={(value) => handleFilterChange('calibrationStatus', value)}>
                                <SelectTrigger id="calibrationStatus">
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tümü</SelectItem>
                                    {CALIBRATION_STATUS_OPTIONS.map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="responsibleUnit">Sorumlu Birim</Label>
                            <Input
                                id="responsibleUnit"
                                placeholder="Birim adı..."
                                value={localFilters.responsibleUnit}
                                onChange={(e) => handleFilterChange('responsibleUnit', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Konum</Label>
                            <Input
                                id="location"
                                placeholder="Konum..."
                                value={localFilters.location}
                                onChange={(e) => handleFilterChange('location', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="minCalibrationDays">Min. Kalibrasyon Günü</Label>
                            <Input
                                id="minCalibrationDays"
                                type="number"
                                placeholder="Örn: 0"
                                value={localFilters.minCalibrationDays}
                                onChange={(e) => handleFilterChange('minCalibrationDays', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxCalibrationDays">Max. Kalibrasyon Günü</Label>
                            <Input
                                id="maxCalibrationDays"
                                type="number"
                                placeholder="Örn: 30"
                                value={localFilters.maxCalibrationDays}
                                onChange={(e) => handleFilterChange('maxCalibrationDays', e.target.value)}
                            />
                        </div>
                    </div>

                    {activeFiltersCount > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-sm text-muted-foreground">Aktif Filtreler:</span>
                            {localFilters.status && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Durum: {localFilters.status}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('status', '')} />
                                </Badge>
                            )}
                            {localFilters.calibrationStatus && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Kalibrasyon: {localFilters.calibrationStatus}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('calibrationStatus', '')} />
                                </Badge>
                            )}
                            {localFilters.responsibleUnit && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Birim: {localFilters.responsibleUnit}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('responsibleUnit', '')} />
                                </Badge>
                            )}
                            {localFilters.location && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Konum: {localFilters.location}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('location', '')} />
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleReset}>
                        Sıfırla
                    </Button>
                    <Button onClick={handleApply}>
                        Uygula ({activeFiltersCount})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EquipmentFilters;

