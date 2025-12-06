import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';

export function SearchableSelectDialog({
  options,
  value,
  onChange,
  triggerPlaceholder = "Seçim yapın...",
  dialogTitle = "Öğe Seçin",
  searchPlaceholder = "Ara...",
  notFoundText = "Sonuç bulunamadı.",
  allowClear = false
}) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (currentValue) => {
    onChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };
  
  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };
  
  // A helper to get the displayable label from an option, which might be a React node.
  const getDisplayLabel = (option) => {
      if (React.isValidElement(option?.label)) {
          // Attempt to find the textual content. This is a simplification.
          // It works for simple cases like <div><span>Text</span><Badge>...</Badge></div>
          if (option.label.props && option.label.props.children) {
               const children = React.Children.toArray(option.label.props.children);
               const textChild = children.find(child => typeof child === 'string' || (child.props && typeof child.props.children === 'string'));
               return textChild ? (typeof textChild === 'string' ? textChild : textChild.props.children) : triggerPlaceholder;
          }
          return triggerPlaceholder;
      }
      return option?.label || triggerPlaceholder;
  }

  // A helper to get the search value from an option, which must be a string.
  const getSearchValue = (option) => {
    if (React.isValidElement(option?.label)) {
        if (option.label.props && option.label.props.children) {
            const children = React.Children.toArray(option.label.props.children);
            const textChild = children.find(child => typeof child === 'string' || (child.props && typeof child.props.children === 'string'));
             if (textChild) {
                 return typeof textChild === 'string' ? textChild : textChild.props.children;
             }
        }
        return '';
    }
    return option?.label || '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedOption ? getDisplayLabel(selectedOption) : triggerPlaceholder}
          <div className="flex items-center gap-1">
            {allowClear && selectedOption && (
              <X 
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <ScrollArea className="max-h-[300px]">
            <CommandList>
              <CommandEmpty>{notFoundText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={getSearchValue(option)}
                    onSelect={() => handleSelect(option.value)}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelect(option.value);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      </DialogContent>
    </Dialog>
  );
}