import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface SquadOption {
  key: string;
  name: string;
}

interface SquadPickerProps {
  options: SquadOption[];
  value: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
  /** "field" ocupa a largura do formulário; "cell" é compacto para a tabela. */
  variant?: "field" | "cell";
  testId?: string;
}

/** Dropdown de squads (grupos de atendimento) com várias seleções. */
export function SquadPicker({ options, value, onChange, disabled, variant = "field", testId }: SquadPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.key));

  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal h-auto min-h-9",
            variant === "field" ? "w-full" : "w-full max-w-[220px] px-2",
          )}
          data-testid={testId}
        >
          {selected.length ? (
            <span className="flex flex-wrap gap-1">
              {selected.map((s) => (
                <Badge key={s.key} variant="outline">{s.name}</Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">Selecionar squad</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar squad..." />
          <CommandList>
            <CommandEmpty>Nenhuma squad encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.key}
                  value={o.name}
                  onSelect={() => toggle(o.key)}
                  data-testid={`option-squad-${o.key}`}
                >
                  <Check className={cn("mr-2 h-4 w-4", value.includes(o.key) ? "opacity-100" : "opacity-0")} />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
