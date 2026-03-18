import { STATUS_CONTAGEM_MAP } from "../utils";
import { fetchWithAuth } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { ResumoCards } from "./components/resumo-cards";
import { VisaoCategoria } from "./components/visao-categoria";
import { VisaoItem } from "./components/visao-item";
import { Divergencias } from "./components/divergencias";

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do servidor (${res.status})`);
  }
}

async function fetchResumo(id: string) {
  const res = await fetchWithAuth(`/api/estoques/contagens/${id}/resumo`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar resumo");
  return data.data;
}

async function fetchCategoria(id: string) {
  const res = await fetchWithAuth(`/api/estoques/contagens/${id}/categoria`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar categorias");
  return data.data || [];
}

async function fetchItens(id: string) {
  const res = await fetchWithAuth(`/api/estoques/contagens/${id}/itens-comparativo`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar itens");
  return data.data || [];
}

async function fetchDivergencias(id: string) {
  const res = await fetchWithAuth(`/api/estoques/contagens/${id}/divergencias`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar divergências");
  return data.data || [];
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONTAGEM_MAP[status] ?? { label: status, className: "" };
  return <Badge className={config.className}>{config.label}</Badge>;
}

export default function EstoquesRelatorioContagemDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: resumo, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["contagem-resumo", id],
    queryFn: () => fetchResumo(id!),
    enabled: !!id && user?.isAdmin === true,
  });

  const { data: categorias = [], isLoading: isLoadingCategoria } = useQuery({
    queryKey: ["contagem-categorias", id],
    queryFn: () => fetchCategoria(id!),
    enabled: !!id && user?.isAdmin === true,
  });

  const { data: itens = [], isLoading: isLoadingItens } = useQuery({
    queryKey: ["contagem-itens-comp", id],
    queryFn: () => fetchItens(id!),
    enabled: !!id && user?.isAdmin === true,
  });

  const { data: divergencias = [], isLoading: isLoadingDivergencias } = useQuery({
    queryKey: ["contagem-divergencias", id],
    queryFn: () => fetchDivergencias(id!),
    enabled: !!id && user?.isAdmin === true,
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

  const duracao =
    resumo?.dataInicio && resumo?.dataFim
      ? Math.round(
          (new Date(resumo.dataFim).getTime() - new Date(resumo.dataInicio).getTime()) / 60000
        )
      : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/estoques/relatorio-contagens")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Relatório de Contagens
          </button>
          <PageHeader
            title={resumo?.codigo ?? "Detalhes da Contagem"}
            description="Análise comparativa da contagem física"
          />
        </div>
        <Button variant="outline" asChild>
          <a href={`/api/estoques/contagens/${id}/export`} download>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </a>
        </Button>
      </div>

      {/* Info da contagem */}
      {(isLoadingResumo || resumo) && (
        <div className="flex flex-wrap items-center gap-6 rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Responsável</p>
            <p className="text-sm font-medium">{resumo?.responsavelNome ?? "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Início</p>
            <p className="text-sm">
              {resumo?.dataInicio
                ? new Date(resumo.dataInicio).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Fim</p>
            <p className="text-sm">
              {resumo?.dataFim
                ? new Date(resumo.dataFim).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
          {duracao != null && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="text-sm">{duracao} min</p>
            </div>
          )}
          {resumo?.status && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={resumo.status} />
            </div>
          )}
        </div>
      )}

      {/* Cards de resumo */}
      <ResumoCards
        resumo={
          resumo
            ? {
                totalSistema: resumo.totalSistema,
                totalContado: resumo.totalContado,
                sobras: resumo.sobras,
                faltas: resumo.faltas,
                acuracidade: resumo.acuracidade,
              }
            : undefined
        }
        isLoading={isLoadingResumo}
      />

      {/* Abas de visualização */}
      <Tabs defaultValue="categoria">
        <TabsList>
          <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
          <TabsTrigger value="item">Por Item</TabsTrigger>
          <TabsTrigger value="divergencias">
            Divergências
            {divergencias.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-xs font-medium">
                {divergencias.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categoria" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <VisaoCategoria categorias={categorias} isLoading={isLoadingCategoria} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="item" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <VisaoItem itens={itens} isLoading={isLoadingItens} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divergencias" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Divergencias
                divergencias={divergencias}
                isLoading={isLoadingDivergencias}
                contagemId={id!}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
