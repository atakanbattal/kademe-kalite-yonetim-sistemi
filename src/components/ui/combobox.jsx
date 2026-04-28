
    import * as React from "react"
    import { Check, ChevronsUpDown } from "lucide-react"

    import { cn } from "@/lib/utils"
    import { Button } from "@/components/ui/button"
    import {
      Command,
      CommandEmpty,
      CommandGroup,
      CommandInput,
      CommandItem,
      CommandList,
    } from "@/components/ui/command"
    import {
      Popover,
      PopoverContent,
      PopoverTrigger,
    } from "@/components/ui/popover"

    /**
     * @param {{ value: string }[]} options — value benzersiz olmalı; label arama metni için kullanılır (cmdk)
     */
    export function Combobox({
      options = [],
      value,
      onChange,
      placeholder,
      searchPlaceholder,
      notFoundText,
      disabled,
      id,
      contentClassName,
      triggerClassName,
      allowClear = true,
      /** Radix Dialog içindeyken false önerilir (odak/taşınabilir iletişim) */
      modal = true,
      listMaxHeightClassName = 'max-h-72',
    }) {
      const [open, setOpen] = React.useState(false)

      const normalizedValue = value === undefined || value === null ? '' : String(value)
      const selectedOption = options.find((option) => String(option.value) === normalizedValue)

      return (
        <Popover open={open} onOpenChange={setOpen} modal={modal}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                'w-full justify-between rounded-md border border-input bg-background px-2.5 py-2 sm:px-3 sm:h-10 font-normal text-sm ring-offset-background min-h-9 sm:min-h-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                triggerClassName
              )}
              disabled={disabled}
            >
              <span className={cn('truncate min-w-0 flex-1 text-left', selectedOption ? 'text-foreground' : 'text-muted-foreground')}>
                {selectedOption ? selectedOption.label : (placeholder ?? 'Seçim yapın...')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn('w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0 z-[120]', contentClassName)} align="start" sideOffset={4}>
            <Command shouldFilter>
              <CommandInput placeholder={searchPlaceholder || 'Ara...'} />
              <CommandList className={cn(listMaxHeightClassName)}>
                <CommandEmpty>{notFoundText || 'Sonuç bulunamadı.'}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={String(option.value)}
                      value={[option.label, option.value].filter(Boolean).join(' ')}
                      onSelect={() => {
                        const v = option.value
                        const isSame = String(v) === normalizedValue
                        if (isSame) {
                          if (allowClear) onChange('')
                          setOpen(false)
                          return
                        }
                        onChange(v)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          normalizedValue === String(option.value) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )
    }
