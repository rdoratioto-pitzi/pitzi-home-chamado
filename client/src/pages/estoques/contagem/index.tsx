import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ClipboardList, Play, CheckCircle2, Loader2, Clock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, fetchWithAuth } from "@/lib/queryClient";
import { BarcodeReader } from "./components/barcode-reader";
import { ManualInput } from "./components/manual-input";
import { ListaItens } from "./components/lista-itens";
import { ConfirmFinalizar, SucessoFinalizacao } from "./components/confirm-finalizar";
import { ConfirmRemoverItem } from "./components/confirm-remover-item";

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
  const [selectedContagem, setSelectedContagem] = useState<Contagem | null>(null);
  
  // Estado para confirmação de remoção de item
  const [itemToRemove, setItemToRemove] = useState<{ id: string; imei: string } | null>(null);

  // Buscar todas as contagens em aberto do usuário
  const { data: contagensEmAberto = [], isLoading: isLoadingAbertas, refetch: refetchAbertas } = useQuery<Contagem[]>({
    queryKey: ["/api/estoques/contagens/em-aberto"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/estoques/contagens/em-aberto");
      if (!res.ok) throw new Error("Erro ao buscar contagens em aberto");
      const data = await res.json();
      return data.data || [];
    },
  });

  // Contagem efetiva: primeiro a selecionada, senão a primeira da lista de abertas
  const contagem = selectedContagem || (contagensEmAberto.length > 0 ? contagensEmAberto[0] : null);
  
  // Loading é true se está carregando as abertas
  const isLoadingContagem = isLoadingAbertas;
  
  const refetchContagem = () => {
    refetchAbertas();
  };

  // Buscar itens da contagem
  const { data: itensContados = [], isLoading: isLoadingItens, refetch: refetchItens } = useQuery<ContagemItem[]>({
    queryKey: ["/api/estoques/contagens", contagem?.id, "itens"],
    queryFn: async () => {
      if (!contagem?.id) return [];
      const res = await fetchWithAuth(`/api/estoques/contagens/${contagem.id}/itens`);
      if (!res.ok) throw new Error("Erro ao buscar itens");
      const data = await res.json();
      return data.data;
    },
    enabled: !!contagem?.id,
  });

  // Mutation para iniciar contagem
  const iniciarContagem = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/estoques/contagens", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao iniciar contagem");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchAbertas();
      refetchContagem();
      // Selecionar a nova contagem
      setSelectedContagem(data.data);
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
      if (!contagem?.id) throw new Error("Sem contagem ativa");
      const res = await fetchWithAuth(`/api/estoques/contagens/${contagem.id}/item`, {
        method: "POST",
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
      refetchContagem();
      refetchAbertas();
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

  // Mutation para remover item
  const removerItem = useMutation({
    mutationFn: async ({ contagemId, itemId }: { contagemId: string; itemId: string }) => {
      const res = await fetchWithAuth(`/api/estoques/contagens/${contagemId}/item/${itemId}`, {
        method: "DELETE",
      });
      const text = await res.text();
      if (!res.ok) {
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || "Erro ao remover item");
        } catch {
          throw new Error(text || "Erro ao remover item");
        }
      }
      if (text) {
        return JSON.parse(text);
      }
      return { success: true };
    },
    onSuccess: () => {
      refetchItens();
      refetchContagem();
      refetchAbertas();
      toast({
        title: "✓ Item removido",
        description: "IMEI removido da contagem",
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

  // Mutation para finalizar contagem
  const finalizarContagem = useMutation({
    mutationFn: async () => {
      if (!contagem?.id) throw new Error("Sem contagem ativa");
      const res = await fetchWithAuth(`/api/estoques/contagens/${contagem.id}/finalizar`, {
        method: "POST",
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
      setSelectedContagem(null);
      refetchAbertas();
      refetchContagem();
      toast({
        title: "Contagem finalizada",
        description: "A contagem foi encerrada com sucesso",
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

  const handleRemoveRequest = (itemId: string, imei: string) => {
    setItemToRemove({ id: itemId, imei });
  };

  const handleRemoveItem = (itemId: string) => {
    if (contagem?.id) {
      removerItem.mutate({ contagemId: contagem.id, itemId });
    }
  };

  const handleConfirmRemoveItem = () => {
    if (itemToRemove && contagem?.id) {
      removerItem.mutate({ contagemId: contagem.id, itemId: itemToRemove.id });
      setItemToRemove(null);
    }
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

  const handleResumeContagem = (contagem: Contagem) => {
    setSelectedContagem(contagem);
  };

  const handleVoltarLista = () => {
    setSelectedContagem(null);
    refetchAbertas();
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

  // Loading inicial
  if (isLoadingAbertas) {
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

  // ==========================================
  // TELA: Com contagem selecionada (interface de contagem)
  // ==========================================
  if (contagem && selectedContagem) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <PageHeader
          title="Contagem Interna"
          description="Contagem física de estoque às cegas"
        />

        {/* Header da Contagem */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleVoltarLista} className="mr-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">{contagem.codigo}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Início: {contagem.dataInicio ? formatDate(contagem.dataInicio) : "-"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Em Andamento
                </Badge>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {itensContados.length} itens contados
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Área de Ações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
        <ListaItens
          itens={itensContados}
          isLoading={isLoadingItens}
          onRemove={handleRemoveItem}
          onRemoveRequest={handleRemoveRequest}
          isRemoving={removerItem.isPending}
        />

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

        {/* Modal de Confirmação para Remover Item */}
        <ConfirmRemoverItem
          open={!!itemToRemove}
          onOpenChange={(open) => !open && setItemToRemove(null)}
          onConfirm={handleConfirmRemoveItem}
          imei={itemToRemove?.imei || ""}
          isLoading={removerItem.isPending}
        />
      </div>
    );
  }

  // ==========================================
  // TELA: Lista de contagens em aberto
  // ==========================================
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Contagem Interna"
        description="Contagem física de estoque às cegas"
      />

      {/* Lista de Contagens em Aberto */}
      {contagensEmAberto.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Sessões em Aberto ({contagensEmAberto.length})
          </h2>
          <div className="grid gap-4">
            {contagensEmAberto.map((contagem) => (
              <Card key={contagem.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-orange-100">
                        <ClipboardList className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{contagem.codigo}</p>
                        <p className="text-sm text-muted-foreground">
                          Início: {formatDate(contagem.dataInicio)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {contagem.totalItensContados || 0} itens
                      </Badge>
                      <Button
                        onClick={() => handleResumeContagem(contagem)}
                        variant="default"
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Continuar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Iniciar Nova Contagem */}
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <ClipboardList className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">
                {contagensEmAberto.length > 0
                  ? "Iniciar nova contagem"
                  : "Nenhuma contagem em andamento"}
              </p>
              <p className="text-sm text-muted-foreground">
                {contagensEmAberto.length > 0
                  ? "Você pode ter múltiplas sessões simultâneas"
                  : "Inicie uma nova contagem para registrar os itens do estoque"}
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
