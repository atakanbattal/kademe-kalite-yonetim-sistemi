import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CostFilters = ({ dateRange, setDateRange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());
    }, []);

    const months = useMemo(() => [
        { value: '0', label: 'Ocak' }, { value: '1', label: 'Şubat' }, { value: '2', label: 'Mart' },
        { value: '3', label: 'Nisan' }, { value: '4', label: 'Mayıs' }, { value: '5', label: 'Haziran' },
        { value: '6', label: 'Temmuz' }, { value: '7', label: 'Ağustos' }, { value: '8', label: 'Eylül' },
        { value: '9', label: 'Ekim' }, { value: '10', label: 'Kasım' }, { value: '11', label: 'Aralık' },
    ], []);

    const handlePresetChange = (value) => {
        const now = new Date();
        let startDate, endDate;
        let label = "Tüm Zamanlar";

        switch (value) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = "Bu Ay";
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                label = "Geçen Ay";
                break;
            case 'last_3_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = "Son 3 Ay";
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                label = "Bu Yıl";
                break;
            case 'all':
            default:
                startDate = null;
                endDate = null;
                break;
        }
        
        setDateRange({ 
            key: value,
            label: label,
            startDate: startDate ? startDate.toISOString().slice(0, 10) : null, 
            endDate: endDate ? endDate.toISOString().slice(0, 10) : null 
        });
        setIsOpen(false);
    };

    const handleMonthYearChange = (type, value) => {
        const currentYear = dateRange.startDate ? new Date(dateRange.startDate).getFullYear().toString() : new Date().getFullYear().toString();
        const currentMonth = dateRange.startDate ? new Date(dateRange.startDate).getMonth().toString() : new Date().getMonth().toString();

        const year = type === 'year' ? value : currentYear;
        const month = type === 'month' ? value : currentMonth;

        const startDate = new Date(parseInt(year), parseInt(month), 1);
        const endDate = new Date(parseInt(year), parseInt(month) + 1, 0);

        setDateRange({
            key: 'custom',
            label: `${months.find(m => m.value === month)?.label || ''} ${year}`,
            startDate: startDate.toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
        });
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant="outline"
                    className="w-[240px] justify-start text-left font-normal"
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{dateRange.label || "Dönem Seçin"}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4">
                    <h4 className="font-medium text-sm mb-2">Hızlı Seçim</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" onClick={() => handlePresetChange('all')}>Tüm Zamanlar</Button>
                        <Button variant="ghost" onClick={() => handlePresetChange('this_month')}>Bu Ay</Button>
                        <Button variant="ghost" onClick={() => handlePresetChange('last_month')}>Geçen Ay</Button>
                        <Button variant="ghost" onClick={() => handlePresetChange('last_3_months')}>Son 3 Ay</Button>
                        <Button variant="ghost" onClick={() => handlePresetChange('this_year')}>Bu Yıl</Button>
                    </div>
                </div>
                <div className="border-t p-4">
                    <h4 className="font-medium text-sm mb-2">Ay ve Yıl Seçin</h4>
                    <div className="flex gap-2">
                        <Select onValueChange={(value) => handleMonthYearChange('month', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ay" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => (
                                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select onValueChange={(value) => handleMonthYearChange('year', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Yıl" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default CostFilters;