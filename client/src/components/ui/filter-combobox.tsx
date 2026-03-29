import * as React from "react"
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
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  allLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
}

export function FilterCombobox({
  value,
  onValueChange,
  options,
  allLabel = "Todos",
  placeholder = "Filtrar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado",
  className,
}: FilterComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const displayValue = value === "all" ? allLabel : value || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 justify-between text-xs", className)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => { onValueChange("all"); setOpen(false) }}
                className="cursor-pointer text-xs"
              >
                {allLabel}
                <Check className={cn("ml-auto h-3 w-3", value === "all" ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onValueChange(opt); setOpen(false) }}
                  className="cursor-pointer text-xs"
                >
                  <span className="truncate">{opt}</span>
                  <Check className={cn("ml-auto h-3 w-3", value === opt ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
