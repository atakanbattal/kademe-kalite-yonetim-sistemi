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
  allowClear = false,
  triggerClassName = "",
  labelClassName = "",
  dialogContentClassName = "",
  listClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (currentValue) => {
    // Prevent double calls
    if (isSelecting) return;
    
    setIsSelecting(true);
    
    // Always set the value, don't clear if same value is selected
    if (currentValue && currentValue !== value) {
      onChange(currentValue);
    } else if (currentValue) {
      // Same value selected, just close the modal
      onChange(currentValue);
    }
    
    // Close modal after a short delay to ensure onChange is called
    setTimeout(() => {
      setOpen(false);
      setIsSelecting(false);
    }, 100);
  };
  
  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };
  
  // A helper to get the displayable label from an option, which might be a React node.
  const getDisplayLabel = (option) => {
      if (option?.triggerLabel) {
          return option.triggerLabel;
      }
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
    if (option?.searchText) {
        return option.searchText;
    }
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
          className={cn("w-full justify-between gap-2 min-h-11 h-auto py-2", triggerClassName)}
          title={selectedOption ? String(getDisplayLabel(selectedOption)) : triggerPlaceholder}
        >
          <span className={cn("flex-1 truncate text-left", labelClassName)}>
            {selectedOption ? getDisplayLabel(selectedOption) : triggerPlaceholder}
          </span>
          <div className="flex shrink-0 items-center gap-1">
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
      <DialogContent className={cn("p-0", dialogContentClassName)} style={{ pointerEvents: 'auto' }}>
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <ScrollArea className={cn("max-h-[300px]", listClassName)} style={{ pointerEvents: 'auto' }}>
            <CommandList style={{ pointerEvents: 'auto' }}>
              <CommandEmpty>{notFoundText}</CommandEmpty>
              <CommandGroup style={{ pointerEvents: 'auto' }}>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={getSearchValue(option)}
                    onSelect={() => {
                      if (!isSelecting) {
                        handleSelect(option.value);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isSelecting) {
                        handleSelect(option.value);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{option.label}</div>
                      {option.description && (
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </div>
                      )}
                    </div>
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
