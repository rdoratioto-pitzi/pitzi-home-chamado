import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { BarcodeReader } from "./components/barcode-reader";
import { ManualInput } from "./components/manual-input";
import { ListaItens } from "./components/lista-itens";

interface Contagem {
  id: string;
  codigo: string;
  status: string;
  dataInicio: string | null;
  totalItensContados: number;
}

interface ContagemItem {
  id: string;
  imei: string;
  contadoEm: string | null;
  metodoLeitura: string;
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Servidor retornou resposta inválida (${res.status}). Tente novamente.`);
  }
}

async function fetchContagemAtiva(): Promise<Contagem | null> {
  const res = await fetch("/api/estoques/contagens/ativa");
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar contagem ativa");
  return data.data;
}

async function fetchItens(contagemId: string): Promise<ContagemItem[]> {
  const res = await fetch(`/api/estoques/contagens/${contagemId}/itens`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "Erro ao buscar itens");
  return data.data || [];
}

async function iniciarContagem(): Promise<Contagem> {
  const res = await fetch("/api/estoques/contagens", { method: "POST" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "Erro ao iniciar contagem");
  return data.data;
}

async function adicionarItem(
  contagemId: string,
  imei: string,
  metodoLeitura: string
): Promise<ContagemItem> {
  const res = await fetch(`/api/estoques/contagens/${contagemId}/item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imei, metodoLeitura }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "Erro ao adicionar item");
  return data.data;
}

async function finalizarContagem(contagemId: string): Promise<Contagem> {
  const res = await fetch(`/api/estoques/contagens/${contagemId}/finalizar`, {
    method: "POST",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "Erro ao finalizar contagem");
  return data.data;
}

export default function EstoquesContagemPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manualError, setManualError] = useState<string | null>(null);
  const [showConfirmFinalizar, setShowConfirmFinalizar] = useState(false);
  const [finalizada, setFinalizada] = useState(false);

  const { data: contagemAtiva, isLoading: isLoadingContagem } = useQuery({
    queryKey: ["contagem-ativa"],
    queryFn: fetchContagemAtiva,
  });

  const { data: itens = [], isLoading: isLoadingItens } = useQuery({
    queryKey: ["contagem-itens", contagemAtiva?.id],
    queryFn: () => fetchItens(contagemAtiva!.id),
    enabled: !!contagemAtiva?.id,
    refetchInterval: 5000,
  });

  const iniciarMutation = useMutation({
    mutationFn: iniciarContagem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contagem-ativa"] });
      toast({ title: "Contagem iniciada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const adicionarMutation = useMutation({
    mutationFn: ({ imei, metodo }: { imei: string; metodo: string }) =>
      adicionarItem(contagemAtiva!.id, imei, metodo),
    onSuccess: (_, variables) => {
      setManualError(null);
      queryClient.invalidateQueries({ queryKey: ["contagem-itens", contagemAtiva?.id] });
      queryClient.invalidateQueries({ queryKey: ["contagem-ativa"] });
      toast({ title: `IMEI ${variables.imei} adicionado` });
    },
    onError: (error: Error, variables) => {
      const msg = error.message.includes("já foi contado")
        ? `IMEI ${variables.imei} já foi contado nesta contagem`
        : error.message;
      setManualError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const finalizarMutation = useMutation({
    mutationFn: () => finalizarContagem(contagemAtiva!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contagem-ativa"] });
      setShowConfirmFinalizar(false);
      setFinalizada(true);
      toast({ title: "Contagem finalizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  function handleScan(imei: string) {
    adicionarMutation.mutate({ imei, metodo: "barcode" });
  }

  function handleManualSubmit(imei: string) {
    setManualError(null);
    adicionarMutation.mutate({ imei, metodo: "manual" });
  }

  const isAdding = adicionarMutation.isPending;

  // Pós-finalização
  if (finalizada) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Contagem Interna"
          description="Contagem física de estoque"
        />
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold text-center">
              Contagem finalizada com sucesso!
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Os resultados serão analisados pela equipe administrativa.
            </p>
            <Button onClick={() => setFinalizada(false)}>
              Iniciar Nova Contagem
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Contagem Interna"
        description="Contagem física de estoque"
      />

      {isLoadingContagem ? (
        <div className="h-40 rounded-lg bg-muted animate-pulse" />
      ) : !contagemAtiva ? (
        // Sem contagem ativa
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <p className="text-muted-foreground">Nenhuma contagem em andamento</p>
            <Button
              size="lg"
              onClick={() => iniciarMutation.mutate()}
              disabled={iniciarMutation.isPending}
            >
              <Plus className="h-5 w-5 mr-2" />
              {iniciarMutation.isPending ? "Iniciando..." : "Iniciar Nova Contagem"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header da contagem */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">Código</p>
              <p className="font-mono font-semibold">{contagemAtiva.codigo}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">Início</p>
              <p className="text-sm">
                {contagemAtiva.dataInicio
                  ? new Date(contagemAtiva.dataInicio).toLocaleString("pt-BR")
                  : "--"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="secondary">Em Andamento</Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">Itens</p>
              <p className="text-2xl font-bold">{contagemAtiva.totalItensContados ?? 0}</p>
            </div>
          </div>

          {/* Área de ações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BarcodeReader onScan={handleScan} disabled={isAdding} />
            <ManualInput
              onSubmit={handleManualSubmit}
              disabled={isAdding}
              error={manualError}
            />

            {/* Finalizar */}
            <Card
              className="border-2 border-dashed border-destructive/40 cursor-pointer hover:border-destructive/80 transition-colors"
              onClick={() => setShowConfirmFinalizar(true)}
            >
              <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
                <CheckCircle className="h-12 w-12 text-destructive/60" />
                <div className="text-center">
                  <p className="font-medium">Finalizar Contagem</p>
                  <p className="text-sm text-muted-foreground">Encerrar e salvar</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de itens */}
          <ListaItens itens={itens} isLoading={isLoadingItens} />
        </>
      )}

      {/* Dialog de confirmação */}
      <AlertDialog open={showConfirmFinalizar} onOpenChange={setShowConfirmFinalizar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está finalizando a contagem com{" "}
              <strong>{contagemAtiva?.totalItensContados ?? 0} itens</strong> contados.
              <br />
              <span className="text-destructive font-medium">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Contando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => finalizarMutation.mutate()}
              disabled={finalizarMutation.isPending}
            >
              {finalizarMutation.isPending ? "Finalizando..." : "Confirmar Finalização"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
