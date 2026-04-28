import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Radix Dialog/Popover kullanmaz — modal içinde ikinci portal ve body pointer-events ile şişmez.
 * Liste tetikleyicinin altına absolute açılır (overflow-y-auto sütun içinde kaydırılabilir).
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
  const rootRef = useRef(null);

  const selectedOption = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLocaleLowerCase('tr-TR');
    if (!q) return options || [];
    return (options || []).filter((option) => {
      const labelText =
        typeof option.label === 'string'
          ? option.label
          : React.isValidElement(option.label)
            ? ''
            : String(option.label ?? '');
      const st = option.searchText || labelText;
      const hay = (st + labelText).toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
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
  };

  return (
    <div ref={rootRef} className={cn('relative isolate w-full', triggerClassName)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          'relative z-10 w-full justify-between gap-2 min-h-11 h-auto py-2',
          allowClear && selectedOption && 'pr-10'
        )}
        title={selectedOption ? String(getDisplayLabel(selectedOption)) : triggerPlaceholder}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className={cn('flex-1 truncate text-left pointer-events-none', labelClassName)}>
          {selectedOption ? getDisplayLabel(selectedOption) : triggerPlaceholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
      </Button>
      {allowClear && selectedOption && (
        <button
          type="button"
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleClear}
          aria-label="Seçimi temizle"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-[9999] mt-1 flex max-h-[min(22rem,calc(100vh-12rem))] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
            dialogContentClassName,
            listClassName
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold">{dialogTitle}</p>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-1 min-h-0 max-h-[min(18rem,calc(100vh-14rem))]">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{notFoundText}</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((option) => (
                  <li key={String(option.value)}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                        value === option.value && 'bg-accent/80'
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePick(option.value)}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          value === option.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
