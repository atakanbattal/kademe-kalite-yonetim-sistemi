
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

    export function Combobox({ options, value, onChange, placeholder, searchPlaceholder, notFoundText, disabled }) {
      const [open, setOpen] = React.useState(false)

      const selectedOption = options.find((option) => option.value === value);

      return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              {selectedOption
                ? selectedOption.label
                : <span className="text-muted-foreground">{placeholder || "Seçim yapın..."}</span>}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder={searchPlaceholder || "Ara..."} />
              <CommandList>
                <CommandEmpty>{notFoundText || "Sonuç bulunamadı."}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={(currentLabel) => {
                        const selected = options.find(opt => opt.label.toLowerCase() === currentLabel.toLowerCase());
                        if (selected) {
                            onChange(selected.value === value ? "" : selected.value);
                        }
                        setOpen(false);
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
            </Command>
          </PopoverContent>
        </Popover>
      )
    }
  