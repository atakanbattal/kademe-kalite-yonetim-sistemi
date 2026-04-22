import React, { useState, useRef, useCallback } from 'react';
    import { X } from 'lucide-react';
    import { Badge } from '@/components/ui/badge';
    import {
      Command,
      CommandGroup,
      CommandItem,
      CommandList,
    } from '@/components/ui/command';
    import { Command as CommandPrimitive } from 'cmdk';

    export function MultiSelect({ options, value, onChange, placeholder = 'Select options...' }) {
      const inputRef = useRef(null);
      const [open, setOpen] = useState(false);
      const [inputValue, setInputValue] = useState('');

      const selected = new Set(value || []);

      const handleUnselect = useCallback((optionValue) => {
        const newSelected = new Set(selected);
        newSelected.delete(optionValue);
        onChange(Array.from(newSelected));
      }, [selected, onChange]);

      const handleKeyDown = useCallback((e) => {
        if (e.key === 'Backspace' && inputValue === '' && selected.size > 0) {
          const lastSelectedValue = Array.from(selected).pop();
          handleUnselect(lastSelectedValue);
        }
      }, [inputValue, selected, handleUnselect]);

      const selectables = options.filter(option => !selected.has(option.value));

      return (
        <Command onKeyDown={handleKeyDown} className="overflow-visible bg-transparent">
          <div className="group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="flex flex-wrap gap-1">
              {Array.from(selected).map((val) => {
                const option = options.find(opt => opt.value === val);
                return option ? (
                  <Badge key={option.value} variant="secondary">
                    {option.label}
                    <button
                      className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUnselect(option.value);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() => handleUnselect(option.value)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ) : null;
              })}
              <CommandPrimitive.Input
                ref={inputRef}
                value={inputValue}
                onValueChange={setInputValue}
                onBlur={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="relative mt-2">
            {open && selectables.length > 0 ? (
              <div className="absolute top-0 z-50 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
                <CommandList>
                  <CommandGroup className="h-full max-h-60 overflow-auto">
                    {selectables.map((option) => (
                      <CommandItem
                        key={option.value}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={() => {
                          setInputValue('');
                          onChange([...selected, option.value]);
                        }}
                        className="cursor-pointer"
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </div>
            ) : null}
          </div>
        </Command>
      );
    }