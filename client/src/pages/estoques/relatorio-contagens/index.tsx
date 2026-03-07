import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FileSpreadsheet, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/permissions";

interface ContagemListItem {
  id: string;
  codigo: string;
  status: string;
  dataInicio: string | null;
  dataFim: string | null;
  totalItensContados: number | null;
  totalItensSistema: number | null;
  divergencia: number | null;
  acuracidade: string | null;
  responsavelId: string | null;
}

async function fetchContagens(): Promise<ContagemListItem[]> {
  const res = await fetch("/api/estoques/contagens");
  if (!res.ok) throw new Error("Erro ao buscar contagens");
  const data = await res.json();
  return data.data || [];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    em_andamento: { label: "Em Andamento", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
    finalizada: { label: "Finalizada", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
    em_analise: { label: "Em Análise", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
    aprovada: { label: "Aprovada", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  };
  const config = map[status] ?? { label: status, className: "" };
  return <Badge className={config.className}>{config.label}</Badge>;
}

export default function EstoquesRelatorioContagensPage() {
  const [, navigate] = useLocation();
  const user = getCurrentUser();

  const { data: contagens = [], isLoading } = useQuery({
    queryKey: ["contagens-lista"],
    queryFn: fetchContagens,
    enabled: user?.isAdmin === true,
  });

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">Acesso restrito a administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Relatório de Contagens"
        description="Análise comparativa sistema vs físico — acesso restrito a administradores"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : contagens.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 opacity-40" />
              <p>Nenhuma contagem registrada ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Qtd Contada</TableHead>
                  <TableHead className="text-right">Qtd Sistema</TableHead>
                  <TableHead className="text-right">Divergência</TableHead>
                  <TableHead className="text-right">Acuracidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contagens.map((c) => {
                  const acuracidade = c.acuracidade ? parseFloat(c.acuracidade) : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.codigo}</TableCell>
                      <TableCell className="text-sm">
                        {c.dataInicio
                          ? new Date(c.dataInicio).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(c.totalItensContados ?? 0).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {c.totalItensSistema != null
                          ? c.totalItensSistema.toLocaleString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.divergencia != null ? (
                          <span
                            className={
                              c.divergencia !== 0 ? "text-red-600 font-medium" : "text-green-600"
                            }
                          >
                            {c.divergencia > 0 ? "+" : ""}
                            {c.divergencia}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {acuracidade != null ? (
                          <span
                            className={
                              acuracidade >= 98
                                ? "text-green-600 font-medium"
                                : acuracidade >= 95
                                ? "text-yellow-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {acuracidade.toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/estoques/relatorio-contagens/${c.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/api/estoques/contagens/${c.id}/export`} download>
                              <FileSpreadsheet className="h-4 w-4 mr-1" />
                              Excel
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
