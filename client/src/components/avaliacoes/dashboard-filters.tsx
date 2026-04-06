import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";

interface DashboardFiltersProps {
  filters: AvaliacoesFilters;
  onChange: (filters: AvaliacoesFilters) => void;
}

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  function update(partial: Partial<AvaliacoesFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Data Início
        </Label>
        <Input
          type="date"
          value={filters.dataInicio ?? ""}
          onChange={(e) => update({ dataInicio: e.target.value || undefined })}
          className="h-8 text-sm w-36"
          style={{ background: "var(--bg3)", borderColor: "var(--sep)", color: "var(--l1)" }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Data Fim
        </Label>
        <Input
          type="date"
          value={filters.dataFim ?? ""}
          onChange={(e) => update({ dataFim: e.target.value || undefined })}
          className="h-8 text-sm w-36"
          style={{ background: "var(--bg3)", borderColor: "var(--sep)", color: "var(--l1)" }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Categoria
        </Label>
        <Select value={filters.categoria ?? "todos"} onValueChange={(v) => update({ categoria: v === "todos" ? undefined : v })}>
          <SelectTrigger className="h-8 text-sm w-36" style={{ background: "var(--bg3)", borderColor: "var(--sep)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="smartphone">Smartphone</SelectItem>
            <SelectItem value="iphone">iPhone</SelectItem>
            <SelectItem value="console">Console</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Área
        </Label>
        <Select value={filters.area ?? "ambas"} onValueChange={(v) => update({ area: v as AvaliacoesFilters["area"] })}>
          <SelectTrigger className="h-8 text-sm w-36" style={{ background: "var(--bg3)", borderColor: "var(--sep)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ambas">Ambas</SelectItem>
            <SelectItem value="display">Display</SelectItem>
            <SelectItem value="carcaca">Carcaça</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
