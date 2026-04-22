import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DEPARTMENTS } from '@/lib/constants';

const DeviationFilters = ({ filters, setFilters, deviations }) => {
    const requestingUnits = useMemo(() => {
        const units = new Set(deviations.map(d => d.requesting_unit).filter(Boolean));
        return ['all', ...Array.from(units).sort()];
    }, [deviations]);

    const sources = useMemo(() => {
        const sourceSet = new Set(deviations.map(d => d.source).filter(Boolean));
        return ['all', ...Array.from(sourceSet).sort()];
    }, [deviations]);

    const handleInputChange = (e) => {
        setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
    };

    const handleSelectChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleDateChange = (range) => {
        setFilters(prev => ({ ...prev, dateRange: range || { from: null, to: null } }));
    };

    const clearFilters = () => {
        setFilters({
            searchTerm: '',
            status: 'all',
            requestingUnit: 'all',
            source: 'all',
            dateRange: { from: null, to: null },
        });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 my-4 p-4 bg-card border rounded-lg">
            <div className="search-box col-span-1 lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                    type="text"
                    placeholder="Ara (No, Açıklama...)"
                    value={filters.searchTerm}
                    onChange={handleInputChange}
                    className="search-input"
                />
            </div>
            <Select value={filters.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="Açık">Açık</SelectItem>
                    <SelectItem value="Onay Bekliyor">Onay Bekliyor</SelectItem>
                    <SelectItem value="Onaylandı">Onaylandı</SelectItem>
                    <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                    <SelectItem value="Kapatıldı">Kapatıldı</SelectItem>
                </SelectContent>
            </Select>
            <Select value={filters.requestingUnit} onValueChange={(value) => handleSelectChange('requestingUnit', value)}>
                <SelectTrigger><SelectValue placeholder="Talep Eden Birim" /></SelectTrigger>
                <SelectContent>
                    {requestingUnits.map(unit => (
                        <SelectItem key={unit} value={unit}>
                            {unit === 'all' ? 'Tüm Birimler' : unit}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={filters.source} onValueChange={(value) => handleSelectChange('source', value)}>
                <SelectTrigger><SelectValue placeholder="Kaynak" /></SelectTrigger>
                <SelectContent>
                    {sources.map(src => (
                        <SelectItem key={src} value={src}>
                            {src === 'all' ? 'Tüm Kaynaklar' : src}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
                <DateRangePicker
                    date={filters.dateRange}
                    onDateChange={handleDateChange}
                    className="w-full"
                />
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default DeviationFilters;