import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Download, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ETAPA_LABELS: Record<string, string> = {
  voucher:     "Voucher Utilizado",
  confirmacao: "Confirmação Gerente",
  coleta:      "Coleta / Trânsito",
  recebimento: "Recebimento",
  triagem:     "Triagem",
  bloqueados:  "Bloqueados",
  manutencao:  "Manutenção",
  divergentes: "Divergentes",
};

interface DispositivoEtapa {
  imei: string;
  modelo: string;
  categoria: string;
  rede: string;
  mesTradeIn: string;
  diasNaEtapa: number;
  valor: number;
  dataEntradaEtapa: string | null;
}

async function fetchEtapaItems(
  etapa: string,
  page: number,
  limite: number,
  filtroMes?: string,
): Promise<{ data: DispositivoEtapa[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limite: String(limite) });
  if (filtroMes && filtroMes !== "all") params.set("filtroMes", filtroMes);
  const res = await fetchWithAuth(`/api/estoques/pipeline/${etapa}?${params.toString()}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

interface Props {
  etapa: string | null;
  onClose: () => void;
}

export function TabelaEtapa({ etapa, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [filtroMes, setFiltroMes] = useState<string>("all");
  const LIMITE = 50;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pipeline-etapa", etapa, page, filtroMes],
    queryFn: () => fetchEtapaItems(etapa!, page, LIMITE, filtroMes === "all" ? undefined : filtroMes),
    enabled: !!etapa,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMITE);

  // Extract unique months from items
  const meses = [...new Set(items.map(i => i.mesTradeIn))].filter(m => m !== "N/D").sort();

  const handleExport = () => {
    if (!items.length) return;
    const header = ["IMEI", "Modelo", "Categoria", "Rede", "Mês Trade-in", "Dias na Etapa", "Valor", "Data Entrada"];
    const rows = items.map(i => [
      i.imei,
      i.modelo,
      i.categoria,
      i.rede,
      i.mesTradeIn,
      i.diasNaEtapa,
      i.valor,
      i.dataEntradaEtapa ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${etapa}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={!!etapa} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{etapa ? ETAPA_LABELS[etapa] ?? etapa : ""}</SheetTitle>
          <SheetDescription>
            {total > 0 ? `${total.toLocaleString("pt-BR")} dispositivos nesta etapa` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={filtroMes} onValueChange={(v) => { setFiltroMes(v); setPage(1); }}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Mês Trade-in" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport} disabled={!items.length}>
            <Download className="h-3 w-3" /> Exportar CSV
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              Erro ao carregar dados.
              <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum dispositivo encontrado nesta etapa.
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {["IMEI", "Modelo", "Categoria", "Mês TI", "Dias", "Rede"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono">{item.imei || "—"}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate">{item.modelo || "—"}</td>
                    <td className="px-3 py-2">{item.categoria || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{item.mesTradeIn}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className={
                        item.diasNaEtapa > 30 ? "text-red-600 font-semibold" :
                        item.diasNaEtapa > 15 ? "text-amber-600 font-medium" :
                        "text-green-700"
                      }>
                        {item.diasNaEtapa}d
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.rede || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
