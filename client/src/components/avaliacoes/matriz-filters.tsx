import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";

interface MatrizFiltersProps {
  filters: AvaliacoesFilters;
  onChange: (filters: AvaliacoesFilters) => void;
  /** Se true, esconde o toggle IA/Humano (layout lg com as duas matrizes visíveis) */
  hideTipoToggle?: boolean;
}

export function MatrizFilters({ filters, onChange, hideTipoToggle = false }: MatrizFiltersProps) {
  function update(partial: Partial<AvaliacoesFilters>) {
    onChange({ ...filters, ...partial });
  }

  const tipo = filters.tipo ?? "ia";
  const area = filters.area ?? "ambas";

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Toggle IA / Humano */}
      {!hideTipoToggle && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Avaliador
          </Label>
          <Tabs value={tipo} onValueChange={(v) => update({ tipo: v as "ia" | "humano" })}>
            <TabsList className="h-8">
              <TabsTrigger value="ia" className="text-xs px-3 h-6">
                IA
              </TabsTrigger>
              <TabsTrigger value="humano" className="text-xs px-3 h-6">
                Humano
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Toggle Display / Carcaça */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Área
        </Label>
        <Tabs value={area} onValueChange={(v) => update({ area: v as AvaliacoesFilters["area"] })}>
          <TabsList className="h-8">
            <TabsTrigger value="ambas" className="text-xs px-3 h-6">
              Ambas
            </TabsTrigger>
            <TabsTrigger value="display" className="text-xs px-3 h-6">
              Display
            </TabsTrigger>
            <TabsTrigger value="carcaca" className="text-xs px-3 h-6">
              Carcaça
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Data Início */}
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

      {/* Data Fim */}
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

      {/* Categoria */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide" style={{ color: "var(--l3)" }}>
          Categoria
        </Label>
        <Select
          value={filters.categoria ?? "todos"}
          onValueChange={(v) => update({ categoria: v === "todos" ? undefined : v })}
        >
          <SelectTrigger
            className="h-8 text-sm w-36"
            style={{ background: "var(--bg3)", borderColor: "var(--sep)" }}
          >
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
    </div>
  );
}
