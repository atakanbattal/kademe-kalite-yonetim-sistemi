import React, { useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn, normalizeTurkishForSearch } from '@/lib/utils';

function renderOptionLabel(option, fallback) {
  if (typeof option.label === 'string') return option.label;
  if (React.isValidElement(option.label)) return option.label;
  return option.triggerLabel || fallback || String(option.value ?? '');
}

/**
 * Diyalog içinde portal + manuel dışarı tıklama yerine Radix Popover (modal={false}) + cmdk.
 * Odak ve arama çakışması yaşanmaz; üst Dialog ile uyum için içerik `data-kdm-combobox-content` işaretlenir.
 */
export function SearchableSelectDialog({
  options,
  value,
  onChange,
  triggerPlaceholder = 'Seçim yapın...',
  dialogTitle = 'Öğe Seçin',
  searchPlaceholder = 'Ara...',
  notFoundText = 'Sonuç bulunamadı.',
  allowClear = false,
  triggerClassName = '',
  labelClassName = '',
  dialogContentClassName = '',
  listClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = normalizeTurkishForSearch(query.trim());
    if (!q) return options || [];
    return (options || []).filter((option) => {
      const labelText =
        typeof option.label === 'string'
          ? option.label
          : React.isValidElement(option.label)
            ? ''
            : String(option.label ?? '');
      const st = option.searchText || labelText;
      const hay = normalizeTurkishForSearch(`${st} ${labelText}`);
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const getDisplayLabel = (option) => {
    if (option?.triggerLabel) return option.triggerLabel;
    if (React.isValidElement(option?.label)) {
      if (option.label.props && option.label.props.children) {
        const children = React.Children.toArray(option.label.props.children);
        const textChild = children.find(
          (child) =>
            typeof child === 'string' ||
            (child.props && typeof child.props.children === 'string')
        );
        return textChild
          ? typeof textChild === 'string'
            ? textChild
            : textChild.props.children
          : triggerPlaceholder;
      }
      return triggerPlaceholder;
    }
    return option?.label || triggerPlaceholder;
  };

  const handlePick = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    setOpen(false);
  };

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <div className={cn('relative w-full', triggerClassName)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'min-h-11 h-auto w-full justify-between gap-2 py-2 font-normal shadow-sm transition-shadow hover:shadow',
              allowClear && selectedOption && 'pr-10'
            )}
            title={selectedOption ? String(getDisplayLabel(selectedOption)) : triggerPlaceholder}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={cn('flex-1 truncate text-left pointer-events-none', labelClassName)}>
              {selectedOption ? getDisplayLabel(selectedOption) : triggerPlaceholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
          </Button>
        </PopoverTrigger>
        {allowClear && selectedOption && (
          <button
            type="button"
            className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleClear}
            aria-label="Seçimi temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <PopoverContent
          data-kdm-combobox-content=""
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          sticky="partial"
          className={cn(
            'z-[120] w-[var(--radix-popover-trigger-width)] max-w-[min(440px,calc(100vw-1.5rem))] min-w-[260px] overflow-hidden rounded-xl border border-border/80 bg-background p-0 text-foreground shadow-2xl ring-1 ring-black/5 dark:ring-white/10',
            dialogContentClassName
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const root = e.currentTarget;
              const input = root?.querySelector('[cmdk-input]');
              input?.focus();
            });
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border/70 bg-muted/35 px-3 py-2 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {dialogTitle}
            </p>
          </div>
          <Command shouldFilter={false} className="rounded-none border-0 bg-transparent shadow-none">
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              className="h-11 border-0 border-b border-border/60 bg-transparent"
            />
            <CommandList className={cn('max-h-[280px] overflow-y-auto overscroll-contain', listClassName)}>
              <CommandEmpty className="py-8 text-muted-foreground">{notFoundText}</CommandEmpty>
              <CommandGroup className="p-1">
                {filtered.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={String(option.value)}
                    onSelect={() => handlePick(option.value)}
                    className="cursor-pointer rounded-lg aria-selected:bg-accent"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100 text-primary' : 'opacity-0'
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium leading-snug">
                        {renderOptionLabel(option, String(option.value))}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </div>
    </Popover>
  );
}
