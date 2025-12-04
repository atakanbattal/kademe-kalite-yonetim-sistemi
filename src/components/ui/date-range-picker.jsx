import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { tr } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const quickFilters = [
  { label: 'Tüm Zamanlar', value: 'all' },
  { label: 'Son 7 Gün', value: 'last7days' },
  { label: 'Son 30 Gün', value: 'last30days' },
  { label: 'Geçen Ay', value: 'lastMonth' },
  { label: 'Son 3 Ay', value: 'last3months' },
  { label: 'Son 6 Ay', value: 'last6months' },
  { label: 'Bu Ay', value: 'thisMonth' },
  { label: 'Bu Yıl', value: 'thisYear' },
];

const getDateRangeFromFilter = (filterValue) => {
  const now = new Date();
  
  switch (filterValue) {
    case 'all':
      return null;
    case 'last7days':
      return { from: subDays(now, 7), to: now };
    case 'last30days':
      return { from: subDays(now, 30), to: now };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case 'last3months':
      return { from: subMonths(now, 3), to: now };
    case 'last6months':
      return { from: subMonths(now, 6), to: now };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return null;
  }
};

export function DateRangePicker({
  className,
  date,
  onDateChange,
}) {
  const [selectedFilter, setSelectedFilter] = useState('thisMonth');

  const handleQuickFilter = (filterValue) => {
    setSelectedFilter(filterValue);
    const newRange = getDateRangeFromFilter(filterValue);
    onDateChange(newRange);
  };

  const handleCustomDateChange = (newDate) => {
    setSelectedFilter('custom');
    onDateChange(newDate);
  };

  const getDisplayText = () => {
    if (!date || !date.from) {
      return 'Tarih aralığı seçin';
    }
    
    const filter = quickFilters.find(f => {
      const range = getDateRangeFromFilter(f.value);
      if (!range && !date.from) return f.value === 'all';
      if (!range) return false;
      return range.from?.toDateString() === date.from?.toDateString() && 
             range.to?.toDateString() === date.to?.toDateString();
    });

    if (filter) {
      return filter.label;
    }

    if (date.to) {
      return `${format(date.from, 'dd MMM y', { locale: tr })} - ${format(date.to, 'dd MMM y', { locale: tr })}`;
    }
    return format(date.from, 'dd MMM y', { locale: tr });
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="end">
          <div className="flex">
            <div className="border-r p-3 space-y-1">
              <div className="text-sm font-semibold mb-2 text-foreground">Hızlı Filtreler</div>
              {quickFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={selectedFilter === filter.value ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => handleQuickFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleCustomDateChange}
                numberOfMonths={2}
                locale={tr}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}