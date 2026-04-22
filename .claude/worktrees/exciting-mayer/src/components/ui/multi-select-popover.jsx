import React, { useState, useMemo, useRef } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function MultiSelectPopover({
  options,
  value = [],
  onChange,
  placeholder = 'Seçim yapın...',
  className,
}) {
  const [open, setOpen] = useState(false);
  const selectedValuesSet = useMemo(() => new Set(value), [value]);
  const isSelectingRef = useRef(false);

  // Seçili değerleri value array'ine göre sıralı olarak göster
  const selectedOptions = useMemo(() => {
    return value
      .map(val => options.find(opt => opt.value === val))
      .filter(Boolean);
  }, [value, options]);

  const handleBadgeRemove = (e, optionValue) => {
    e.preventDefault();
    e.stopPropagation();
    const newValues = value.filter(v => v !== optionValue);
    onChange(newValues);
  };

  const handleToggleOption = (optionValue) => {
    // Çift tıklama sorununu önle
    if (isSelectingRef.current) {
      return;
    }
    
    isSelectingRef.current = true;
    
    // UUID'leri karşılaştırmak için her iki tarafı da string'e çevir
    const currentValueSet = new Set(value.map(v => String(v)));
    const optionValueStr = String(optionValue);
    
    const newValues = currentValueSet.has(optionValueStr)
      ? value.filter(v => String(v) !== optionValueStr)
      : [...value, optionValue]; // Orijinal değeri ekle (UUID olarak)
    
    onChange(newValues);
    
    // 100ms sonra ref'i temizle
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 100);
  };

  const handleTriggerClick = (e) => {
    // Badge veya X butonuna tıklandığında popover açılmasını engelle
    if (e.target.closest('.badge-remove-button') || e.target.closest('.badge-content')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-[42px] py-2 px-3", className)}
          onClick={handleTriggerClick}
        >
          <div className="flex gap-1.5 flex-wrap flex-1 items-center min-w-0">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <div
                  key={option.value}
                  className="badge-content inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground border border-primary/20 hover:bg-primary/90 transition-colors"
                >
                  <span className="whitespace-normal break-words text-left leading-tight">{option.label}</span>
                  <button
                    type="button"
                    className="badge-remove-button inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors focus:outline-none ml-1"
                    onClick={(e) => handleBadgeRemove(e, option.value)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    aria-label={`${option.label} seçimini kaldır`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2 self-center" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Ara..." />
          <CommandList>
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValuesSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      handleToggleOption(option.value);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className={cn(isSelected && 'font-medium')}>
                      {option.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}