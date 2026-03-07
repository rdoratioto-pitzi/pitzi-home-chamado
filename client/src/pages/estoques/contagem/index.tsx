import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ClipboardList, Play, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BarcodeReader } from "./components/barcode-reader";
import { ManualInput } from "./components/manual-input";
import { ListaItens } from "./components/lista-itens";
import { ConfirmFinalizar, SucessoFinalizacao } from "./components/confirm-finalizar";

interface Contagem {
  id: string;
  codigo: string;
  status: string;
  dataInicio: string;
  totalItensContados: number;
  responsavelId: string;
}

interface ContagemItem {
  id: string;
  imei: string;
  codigoErp: string | null;
  modelo: string | null;
  categoria: string | null;
  marca: string | null;
  metodoLeitura: string;
  contadoEm: string;
}

export default function EstoquesContagemPage() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [showConfirmFinalizar, setShowConfirmFinalizar] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);

  // Buscar contagem ativa
  const { data: contagemAtiva, isLoading: isLoadingContagem, refetch: refetchContagem } = useQuery<Contagem | null>({
    queryKey: ["/api/estoques/contagens/ativa"],
    queryFn: async () => {
      const res = await fetch("/api/estoques/contagens/ativa");
      if (!res.ok) throw new Error("Erro ao buscar contagem ativa");
      const data = await res.json();
      return data.data;
    },
  });

  // Buscar itens da contagem
  const { data: itensContados = [], isLoading: isLoadingItens, refetch: refetchItens } = useQuery<ContagemItem[]>({
    queryKey: ["/api/estoques/contagens", contagemAtiva?.id, "itens"],
    queryFn: async () => {
      if (!contagemAtiva?.id) return [];
      const res = await fetch(`/api/estoques/contagens/${contagemAtiva.id}/itens`);
      if (!res.ok) throw new Error("Erro ao buscar itens");
      const data = await res.json();
      return data.data;
    },
    enabled: !!contagemAtiva?.id,
  });

  // Mutation para iniciar contagem
  const iniciarContagem = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/estoques/contagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao iniciar contagem");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estoques/contagens/ativa"] });
      toast({
        title: "Contagem iniciada",
        description: `Código: ${data.data.codigo}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    },
  });

  // Mutation para adicionar item
  const adicionarItem = useMutation({
    mutationFn: async ({ imei, metodoLeitura }: { imei: string; metodoLeitura: string }) => {
      if (!contagemAtiva?.id) throw new Error("Sem contagem ativa");
      const res = await fetch(`/api/estoques/contagens/${contagemAtiva.id}/item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imei, metodoLeitura }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao adicionar item");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setError(null);
      refetchItens();
      queryClient.invalidateQueries({ queryKey: ["/api/estoques/contagens/ativa"] });
      toast({
        title: "✓ Item adicionado",
        description: `IMEI ${data.data.imei} contado com sucesso`,
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      if (error.message.includes("já foi contado")) {
        toast({
          variant: "destructive",
          title: "⚠️ IMEI duplicado",
          description: error.message,
        });
      } else if (error.message.includes("15 dígitos")) {
        toast({
          variant: "destructive",
          title: "IMEI inválido",
          description: error.message,
        });
      }
    },
  });

  // Mutation para finalizar contagem
  const finalizarContagem = useMutation({
    mutationFn: async () => {
      if (!contagemAtiva?.id) throw new Error("Sem contagem ativa");
      const res = await fetch(`/api/estoques/contagens/${contagemAtiva.id}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao finalizar contagem");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowConfirmFinalizar(false);
      setShowSucesso(true);
      queryClient.invalidateQueries({ queryKey: ["/api/estoques/contagens/ativa"] });
      toast({
        title: "Contagem finalizada",
        description: "Os resultados serão analisados pela equipe administrativa",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    },
  });

  const handleScan = (imei: string) => {
    adicionarItem.mutate({ imei, metodoLeitura: "barcode" });
  };

  const handleManualSubmit = (imei: string) => {
    adicionarItem.mutate({ imei, metodoLeitura: "manual" });
  };

  const handleFinalizar = () => {
    setShowConfirmFinalizar(true);
  };

  const handleConfirmFinalizar = () => {
    finalizarContagem.mutate();
  };

  const handleNovaContagem = () => {
    setShowSucesso(false);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Cenário 1: Sem contagem ativa
  if (!contagemAtiva && !isLoadingContagem) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Contagem Interna"
          description="Contagem física de estoque às cegas"
        />

        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-muted mx-auto w-fit">
                <ClipboardList className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Nenhuma contagem em andamento</p>
                <p className="text-sm text-muted-foreground">
                  Inicie uma nova contagem para registrar os itens do estoque
                </p>
              </div>
              <Button
                onClick={() => iniciarContagem.mutate()}
                disabled={iniciarContagem.isPending}
                className="w-full"
                size="lg"
              >
                {iniciarContagem.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Nova Contagem
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading inicial
  if (isLoadingContagem) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Contagem Interna"
          description="Contagem física de estoque às cegas"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Cenário 2: Com contagem ativa
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Contagem Interna"
        description="Contagem física de estoque às cegas"
      />

      {/* Header da Contagem */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{contagemAtiva?.codigo}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Início: {contagemAtiva?.dataInicio ? formatDate(contagemAtiva.dataInicio) : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Em Andamento
              </Badge>
              <Badge variant="outline" className="text-lg px-3 py-1">
                {itensContados.length} itens contados
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Área de Ações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BarcodeReader
          onScan={handleScan}
          disabled={adicionarItem.isPending}
        />
        <ManualInput
          onSubmit={handleManualSubmit}
          disabled={adicionarItem.isPending}
          error={error}
        />
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-3 text-center h-full justify-center">
              <div className="p-4 rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Finalizar Contagem</p>
                <p className="text-sm text-muted-foreground">
                  Encerrar e enviar para análise
                </p>
              </div>
              <Button
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleFinalizar}
                disabled={itensContados.length === 0 || finalizarContagem.isPending}
              >
                {finalizarContagem.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Finalizar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Itens Contados */}
      <ListaItens itens={itensContados} isLoading={isLoadingItens} />

      {/* Modal de Confirmação */}
      <ConfirmFinalizar
        open={showConfirmFinalizar}
        onOpenChange={setShowConfirmFinalizar}
        onConfirm={handleConfirmFinalizar}
        totalItens={itensContados.length}
        isLoading={finalizarContagem.isPending}
      />

      {/* Modal de Sucesso */}
      <SucessoFinalizacao
        open={showSucesso}
        onOpenChange={setShowSucesso}
        onNovaContagem={handleNovaContagem}
      />
    </div>
  );
}
