import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPLICATION_CATEGORIES,
  getApplicationLabel,
  getApplicationsByCategory,
} from "@shared/applications";
import { cn } from "@/lib/utils";

interface ApplicationSelectProps {
  value: string | null;
  onChange: (key: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
  /** Mostrar opção "Todas" (para filtros). */
  showAllOption?: boolean;
  allOptionLabel?: string;
  /** Marcar erro visual (borda vermelha) — usado quando required+vazio após submit. */
  hasError?: boolean;
  className?: string;
}

const SENTINEL_ALL = "__all__";
const SENTINEL_NULL = "__none__";

/**
 * Dropdown de Aplicação Renov agrupado por categoria.
 * Importa a fonte de verdade de shared/applications.ts.
 */
export function ApplicationSelect({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "Selecione a aplicação",
  size = "md",
  showAllOption = false,
  allOptionLabel = "Todas as Aplicações",
  hasError = false,
  className,
}: ApplicationSelectProps) {
  const grouped = getApplicationsByCategory();

  // value interno: usa sentinelas pra null/all (Radix Select não aceita value="")
  const internalValue =
    value === null || value === undefined
      ? showAllOption
        ? SENTINEL_ALL
        : SENTINEL_NULL
      : value;

  const handleChange = (next: string) => {
    if (next === SENTINEL_ALL || next === SENTINEL_NULL) {
      onChange(null);
      return;
    }
    onChange(next);
  };

  const triggerLabel =
    value === null || value === undefined
      ? showAllOption
        ? allOptionLabel
        : placeholder
      : getApplicationLabel(value);

  const triggerHeight = size === "sm" ? "h-7 text-xs" : "h-9 text-sm";

  return (
    <Select value={internalValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          triggerHeight,
          "w-full",
          hasError && "border-red-500 focus:ring-red-500",
          className,
        )}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
      >
        <SelectValue placeholder={placeholder}>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value={SENTINEL_ALL}>{allOptionLabel}</SelectItem>
        )}
        {!required && !showAllOption && (
          <SelectItem value={SENTINEL_NULL}>—</SelectItem>
        )}
        {APPLICATION_CATEGORIES.map((cat) => {
          const apps = grouped[cat];
          if (!apps || apps.length === 0) return null;
          return (
            <SelectGroup key={cat}>
              <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                {cat}
              </SelectLabel>
              {apps.map((app) => (
                <SelectItem key={app.key} value={app.key}>
                  {app.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
