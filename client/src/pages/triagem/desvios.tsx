import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldAlert, Wrench, AlertTriangle, X } from "lucide-react";
import { useTriagemDesvios, type DesvioItem } from "@/hooks/use-triagem";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    return format(parseISO(normalized), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ─── Shared table component ───────────────────────────────────────────────────

interface DesvioTableProps {
  items: DesvioItem[];
  filterImei: string;
  onFilterChange: (v: string) => void;
  emptyMessage: string;
}

function DesvioTable({ items, filterImei, onFilterChange, emptyMessage }: DesvioTableProps) {
  const filtered = filterImei
    ? items.filter(i => i.imei.toLowerCase().includes(filterImei.toLowerCase()))
    : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filtrar por IMEI"
          value={filterImei}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-sm max-w-xs"
        />
        {filterImei && (
          <Button size="sm" variant="ghost" onClick={() => onFilterChange("")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--sep)" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--sep)" }}>
              <TableHead className="text-xs font-semibold uppercase">IMEI</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Modelo</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Rede</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Categoria</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Data Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {filterImei ? "Nenhum item encontrado com este IMEI." : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item, idx) => (
                <TableRow
                  key={`${item.imei}-${idx}`}
                  className="hover-elevate"
                  style={{ borderColor: "var(--sep)" }}
                >
                  <TableCell className="font-mono text-xs">{item.imei || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate">{item.modelo || "—"}</TableCell>
                  <TableCell className="text-sm">{item.rede || "—"}</TableCell>
                  <TableCell className="text-sm">{item.categoria || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(item.dataEntrada)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TriagemDesviosPage() {
  const { data, isLoading } = useTriagemDesvios();

  const [imeiBloqueados, setImeiBloqueados] = useState("");
  const [imeiManutencao, setImeiManutencao] = useState("");
  const [imeiDivergentes, setImeiDivergentes] = useState("");

  const allItems = data?.data ?? [];

  const bloqueados = useMemo(
    () => allItems.filter(i => i.tipoDesvio === "bloqueado"),
    [allItems]
  );
  const manutencao = useMemo(
    () => allItems.filter(i => i.tipoDesvio === "manutencao"),
    [allItems]
  );
  const divergentes = useMemo(
    () => allItems.filter(i => i.tipoDesvio === "divergente"),
    [allItems]
  );

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Triagem — Desvios" />
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Desvios" />
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card style={{ background: "var(--vf)", border: "none" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFFFFF" }}>
                Total Desvios
              </CardTitle>
              <AlertTriangle className="h-4 w-4" style={{ color: "#FFFFFF" }} />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "#FFFFFF" }}>
                {allItems.length}
              </div>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                desvios em aberto
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Bloqueados
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {bloqueados.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">iCloud / Google Lock</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Em Manutenção
              </CardTitle>
              <Wrench className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {manutencao.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">em reparo</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Divergentes
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {divergentes.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">reavaliação necessária</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de desvios */}
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-6">
            <Tabs defaultValue="bloqueados">
              <TabsList className="mb-4">
                <TabsTrigger value="bloqueados" className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                  Bloqueados ({bloqueados.length})
                </TabsTrigger>
                <TabsTrigger value="manutencao" className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-yellow-500" />
                  Manutenção ({manutencao.length})
                </TabsTrigger>
                <TabsTrigger value="divergentes" className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Divergentes ({divergentes.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bloqueados">
                <DesvioTable
                  items={bloqueados}
                  filterImei={imeiBloqueados}
                  onFilterChange={setImeiBloqueados}
                  emptyMessage="Nenhum dispositivo bloqueado no momento."
                />
              </TabsContent>

              <TabsContent value="manutencao">
                <DesvioTable
                  items={manutencao}
                  filterImei={imeiManutencao}
                  onFilterChange={setImeiManutencao}
                  emptyMessage="Nenhum dispositivo em manutenção no momento."
                />
              </TabsContent>

              <TabsContent value="divergentes">
                <DesvioTable
                  items={divergentes}
                  filterImei={imeiDivergentes}
                  onFilterChange={setImeiDivergentes}
                  emptyMessage="Nenhum dispositivo divergente no momento."
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
