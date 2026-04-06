import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTriagemRecebimentos, type RecebimentosFilters } from "@/hooks/use-triagem";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_BADGE: Record<string, string> = {
  recebido: "bg-green-100 text-green-800 border-green-200",
  "em triagem": "bg-blue-100 text-blue-800 border-blue-200",
  bloqueado: "bg-red-100 text-red-800 border-red-200",
  manutenção: "bg-orange-100 text-orange-800 border-orange-200",
  divergente: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    return format(parseISO(normalized), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

const PAGE_LIMIT = 50;

export default function TriagemRecebimentosPage() {
  const [filters, setFilters] = useState<RecebimentosFilters>({});
  const [draft, setDraft] = useState<RecebimentosFilters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTriagemRecebimentos(filters, page, PAGE_LIMIT);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_LIMIT)) : 1;

  function applyFilters() {
    setFilters({ ...draft });
    setPage(1);
  }

  function clearFilters() {
    setDraft({});
    setFilters({});
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Recebimentos" />
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Filtros */}
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Input
                placeholder="IMEI"
                value={draft.imei || ""}
                onChange={(e) => setDraft(prev => ({ ...prev, imei: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Categoria"
                value={draft.categoria || ""}
                onChange={(e) => setDraft(prev => ({ ...prev, categoria: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Rede"
                value={draft.rede || ""}
                onChange={(e) => setDraft(prev => ({ ...prev, rede: e.target.value }))}
                className="text-sm"
              />
              <Select
                value={draft.status || ""}
                onValueChange={(v) => setDraft(prev => ({ ...prev, status: v === "_all" ? "" : v }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos os status</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="em triagem">Em triagem</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="manutenção">Manutenção</SelectItem>
                  <SelectItem value="divergente">Divergente</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="Data início"
                value={draft.dataInicio || ""}
                onChange={(e) => setDraft(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                placeholder="Data fim"
                value={draft.dataFim || ""}
                onChange={(e) => setDraft(prev => ({ ...prev, dataFim: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={applyFilters}>
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Buscar
              </Button>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Recebimentos
              </span>
              {data && (
                <span className="text-sm font-normal text-muted-foreground">
                  {data.total} dispositivo{data.total !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ borderColor: "var(--sep)" }}>
                        <TableHead className="text-xs font-semibold uppercase">IMEI</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Modelo</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Categoria</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Rede</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Data Recebimento</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Responsável</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            Nenhum registro encontrado com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.items.map((item, idx) => (
                          <TableRow
                            key={`${item.imei}-${idx}`}
                            className="hover-elevate"
                            style={{ borderColor: "var(--sep)" }}
                          >
                            <TableCell className="font-mono text-xs">{item.imei || "—"}</TableCell>
                            <TableCell className="text-sm max-w-[180px] truncate">{item.modelo || "—"}</TableCell>
                            <TableCell className="text-sm">{item.categoria || "—"}</TableCell>
                            <TableCell className="text-sm">{item.rede || "—"}</TableCell>
                            <TableCell>
                              {item.status ? (
                                <Badge
                                  variant="outline"
                                  className={STATUS_BADGE[item.status.toLowerCase()] || "bg-slate-100 text-slate-700"}
                                >
                                  {item.status}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(item.dataRecebimento)}
                            </TableCell>
                            <TableCell className="text-sm">{item.responsavel || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--sep)" }}>
                    <span className="text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
