import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

const toYmd = (d) => (d ? format(d, 'yyyy-MM-dd') : null);

const CostFilters = ({ dateRange, setDateRange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rangeDraft, setRangeDraft] = useState({ from: undefined, to: undefined });

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

    useEffect(() => {
        if (!isOpen) return;
        if (dateRange?.startDate && dateRange?.endDate) {
            const a = new Date(dateRange.startDate);
            const b = new Date(dateRange.endDate);
            if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
                setRangeDraft({ from: a, to: b });
                return;
            }
        }
        setRangeDraft({ from: undefined, to: undefined });
    }, [isOpen, dateRange?.startDate, dateRange?.endDate]);

    const handlePresetChange = (value) => {
        const now = new Date();
        let startDate;
        let endDate;
        let label = 'Tüm Zamanlar';

        switch (value) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = 'Bu Ay';
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                label = 'Geçen Ay';
                break;
            case 'last_3_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = 'Son 3 Ay';
                break;
            case 'last_6_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = 'Son 6 Ay';
                break;
            case 'last_12_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = 'Son 12 Ay';
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                label = 'Bu Yıl';
                break;
            case 'all':
            default:
                startDate = null;
                endDate = null;
                break;
        }

        setDateRange({
            key: value,
            label,
            startDate: startDate ? toYmd(startDate) : null,
            endDate: endDate ? toYmd(endDate) : null,
        });
        setIsOpen(false);
    };

    const handleMonthYearChange = (type, value) => {
        let currentYear = new Date().getFullYear().toString();
        let currentMonth = new Date().getMonth().toString();

        if (dateRange && dateRange.startDate) {
            const d = new Date(dateRange.startDate);
            if (!Number.isNaN(d.getTime())) {
                currentYear = d.getFullYear().toString();
                currentMonth = d.getMonth().toString();
            }
        }

        const year = type === 'year' ? value : currentYear;
        const month = type === 'month' ? value : currentMonth;

        const pad = (n) => n.toString().padStart(2, '0');
        const startDateStr = `${year}-${pad(parseInt(month, 10) + 1)}-01`;

        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10) + 1, 0).getDate();
        const endDateStr = `${year}-${pad(parseInt(month, 10) + 1)}-${pad(lastDay)}`;

        setDateRange({
            key: 'custom',
            label: `${months.find(m => m.value === month)?.label || ''} ${year}`,
            startDate: startDateStr,
            endDate: endDateStr,
        });
    };

    const applyCalendarRange = () => {
        const { from, to } = rangeDraft;
        if (!from || !to) return;
        const start = from <= to ? from : to;
        const end = from <= to ? to : from;
        setDateRange({
            key: 'custom_range',
            label: `${format(start, 'd MMM yyyy', { locale: tr })} – ${format(end, 'd MMM yyyy', { locale: tr })}`,
            startDate: toYmd(start),
            endDate: toYmd(end),
        });
        setIsOpen(false);
    };

    let selectedYear = '';
    let selectedMonth = '';
    if (dateRange && dateRange.startDate) {
        const d = new Date(dateRange.startDate);
        if (!Number.isNaN(d.getTime())) {
            selectedYear = d.getFullYear().toString();
            selectedMonth = d.getMonth().toString();
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant="outline"
                    className="w-[min(100%,240px)] justify-start text-left font-normal"
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{dateRange.label || 'Dönem Seçin'}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 max-h-[min(90vh,720px)] overflow-y-auto" align="start">
                <div className="p-4">
                    <h4 className="font-medium text-sm mb-2">Hızlı Seçim</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('all')}>Tüm Zamanlar</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('this_month')}>Bu Ay</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('last_month')}>Geçen Ay</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('last_3_months')}>Son 3 Ay</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('last_6_months')}>Son 6 Ay</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => handlePresetChange('last_12_months')}>Son 12 Ay</Button>
                        <Button variant="ghost" className="justify-start col-span-2" onClick={() => handlePresetChange('this_year')}>Bu Yıl</Button>
                    </div>
                </div>
                <div className="border-t px-4 py-4 space-y-2">
                    <Label className="text-sm font-medium">Tarih aralığı (takvim)</Label>
                    <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={rangeDraft}
                        onSelect={setRangeDraft}
                        defaultMonth={rangeDraft?.from || new Date()}
                    />
                    <Button
                        className="w-full"
                        size="sm"
                        disabled={!rangeDraft?.from || !rangeDraft?.to}
                        onClick={applyCalendarRange}
                    >
                        Aralığı uygula
                    </Button>
                </div>
                <div className="border-t p-4">
                    <h4 className="font-medium text-sm mb-2">Tek ay ve yıl</h4>
                    <div className="flex gap-2">
                        <Select value={selectedMonth} onValueChange={(value) => handleMonthYearChange('month', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ay" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => (
                                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={(value) => handleMonthYearChange('year', value)}>
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
