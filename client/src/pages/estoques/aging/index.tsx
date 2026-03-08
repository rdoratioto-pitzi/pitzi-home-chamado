import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  RefreshCw, AlertCircle, Settings, ListFilter, Download, ClipboardList,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/permissions";
import { MatrizAging } from "./components/matriz-aging";
import { ListaFifo, type FifoItem } from "./components/lista-fifo";
import { AlertasConfig } from "./components/alertas-config";

// ── tipos ─────────────────────────────────────────────────────────────────────

interface MatrizData {
  tipo: string;
  faixas: Array<{ nome: string; cor: string; etapas: Record<string, number>; total: number }>;
  totaisPorEtapa: Record<string, number>;
  totalGeral: number;
  criticos: number;
}

interface EstoqueData {
  faixas: Array<{ nome: string; cor: string; quantidade: number; valor: number; percentual: number }>;
  total:  { quantidade: number; valor: number };
}

interface FifoData {
  itens:       FifoItem[];
  total:       number;
  pagina:      number;
  totalPaginas: number;
  limite:      number;
}

// ── fetchers ──────────────────────────────────────────────────────────────────

async function fetchMatriz(): Promise<MatrizData> {
  const res = await fetchWithAuth('/api/estoques/aging/matriz');
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return (await res.json()).data;
}

async function fetchEstoque(): Promise<EstoqueData> {
  const res = await fetchWithAuth('/api/estoques/aging/estoque');
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return (await res.json()).data;
}

async function fetchFifo(pagina: number, etapa?: string, faixa?: string): Promise<FifoData> {
  const qs = new URLSearchParams({ pagina: String(pagina), limite: '50' });
  if (etapa) qs.set('etapa', etapa);
  if (faixa) qs.set('faixa', faixa);
  const res = await fetchWithAuth(`/api/estoques/aging/fifo?${qs}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return (await res.json()).data;
}

async function criarTarefa(payload: { imeis: string[]; titulo: string; descricao: string }) {
  const res = await fetchWithAuth('/api/estoques/aging/criar-tarefa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return (await res.json()).data;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const COR_ESTOQUE: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  black:  'bg-gray-800',
};

const TOGGLE_VIEWS = [
  { key: 'pre-estoque', label: 'Pré-Estoque' },
  { key: 'em-estoque',  label: 'Em Estoque'  },
] as const;
type View = typeof TOGGLE_VIEWS[number]['key'];

// ── componente principal ──────────────────────────────────────────────────────

export default function AgingPage() {
  const user    = getCurrentUser();
  const isAdmin = user?.isAdmin === true;
  const { toast } = useToast();

  // view toggle
  const [view, setView] = useState<View>('pre-estoque');

  // filtro de drill-down na lista FIFO
  const [filtro, setFiltro] = useState<{ faixa: string; etapa: string } | null>(null);
  const [pagina, setPagina] = useState(1);

  // modais
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [tarefaOpen,  setTarefaOpen]  = useState(false);
  const [tarefaTitulo, setTarefaTitulo] = useState('');
  const [tarefaDesc,   setTarefaDesc]   = useState('');

  // seleção múltipla
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // ── queries ────────────────────────────────────────────────────────────────

  const matrizQ = useQuery({
    queryKey:  ['aging-matriz'],
    queryFn:   fetchMatriz,
    enabled:   isAdmin && view === 'pre-estoque',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const estoqueQ = useQuery({
    queryKey:  ['aging-estoque'],
    queryFn:   fetchEstoque,
    enabled:   isAdmin && view === 'em-estoque',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const fifoQ = useQuery({
    queryKey:  ['aging-fifo', pagina, filtro?.etapa, filtro?.faixa],
    queryFn:   () => fetchFifo(pagina, filtro?.etapa, filtro?.faixa),
    enabled:   isAdmin,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // ── mutation criar tarefa ──────────────────────────────────────────────────

  const tarefaMutation = useMutation({
    mutationFn: criarTarefa,
    onSuccess: (data) => {
      toast({ title: data.mensagem ?? 'Tarefa criada com sucesso' });
      setTarefaOpen(false);
      setSelecionados([]);
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar tarefa', description: err.message, variant: 'destructive' });
    },
  });

  // ── handlers ───────────────────────────────────────────────────────────────

  function handleClickCelula(faixa: string, etapa: string) {
    const igual = filtro?.faixa === faixa && filtro?.etapa === etapa;
    setFiltro(igual ? null : { faixa, etapa });
    setPagina(1);
  }

  function handleLimparFiltro() {
    setFiltro(null);
    setPagina(1);
  }

  function handleRefresh() {
    matrizQ.refetch();
    estoqueQ.refetch();
    fifoQ.refetch();
  }

  function abrirCriarTarefa() {
    const qtd = selecionados.length;
    setTarefaTitulo(`Ação urgente – ${qtd} dispositivo(s) crítico(s)`);
    setTarefaDesc(`Dispositivos aguardando ação há muitos dias. IMEIs serão listados automaticamente.`);
    setTarefaOpen(true);
  }

  function handleCriarTarefa() {
    tarefaMutation.mutate({
      imeis:    selecionados,
      titulo:   tarefaTitulo,
      descricao: tarefaDesc,
    });
  }

  // ── acesso restrito ────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Aging Report – FIFO" description="Controle de itens antigos com priorização FIFO" />
        <div className="flex items-center justify-center mt-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>Esta tela é exclusiva para administradores.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const criticos = matrizQ.data?.criticos ?? 0;
  const isError  = matrizQ.isError || estoqueQ.isError || fifoQ.isError;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <PageHeader
            title="Aging Report – Controle FIFO"
            description="Priorize os dispositivos mais antigos para evitar perda de valor na revenda."
          />
          {criticos > 0 && (
            <Badge variant="destructive" className="mt-1 shrink-0">
              🔴 {criticos.toLocaleString('pt-BR')} críticos
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAlertasOpen(true)}>
            <Settings className="h-4 w-4" />
            Alertas
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={matrizQ.isLoading}>
            <RefreshCw className={`h-4 w-4 ${matrizQ.isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            Não foi possível obter os dados das APIs.
            <Button variant="outline" size="sm" onClick={handleRefresh}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Toggle view ── */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border bg-background overflow-hidden">
          {TOGGLE_VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => { setView(v.key); handleLimparFiltro(); }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {filtro && (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1"
            onClick={handleLimparFiltro}
          >
            <ListFilter className="h-3 w-3" />
            {filtro.faixa} · {filtro.etapa}
            <span className="ml-1 text-muted-foreground">✕</span>
          </Badge>
        )}
      </div>

      {/* ── Pré-Estoque: Matriz ── */}
      {view === 'pre-estoque' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Matriz de Aging – Pré-Estoque
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (dias desde Voucher Utilizado)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-3">
            <MatrizAging
              faixas={matrizQ.data?.faixas ?? []}
              totaisPorEtapa={matrizQ.data?.totaisPorEtapa ?? {}}
              totalGeral={matrizQ.data?.totalGeral ?? 0}
              isLoading={matrizQ.isLoading}
              onClickCelula={handleClickCelula}
              filtroAtivo={filtro}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Em Estoque: Cards ── */}
      {view === 'em-estoque' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Aging em Estoque
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (dias desde Triagem Finalizada)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estoqueQ.isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : (
              <div className="space-y-3">
                {(estoqueQ.data?.faixas ?? []).map(faixa => (
                  <div key={faixa.nome} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium shrink-0">{faixa.nome}</div>
                    <div className="flex-1 relative h-7 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${COR_ESTOQUE[faixa.cor] ?? 'bg-gray-400'}`}
                        style={{ width: `${faixa.percentual}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-white mix-blend-difference">
                        {faixa.quantidade.toLocaleString('pt-BR')} un · {formatCurrency(faixa.valor)}
                      </span>
                    </div>
                    <div className="w-12 text-right text-sm font-bold shrink-0">{faixa.percentual}%</div>
                  </div>
                ))}
                <div className="pt-2 border-t text-sm text-muted-foreground">
                  Total: <strong>{estoqueQ.data?.total.quantidade.toLocaleString('pt-BR')} un</strong>
                  {' · '}
                  <strong>{formatCurrency(estoqueQ.data?.total.valor ?? 0)}</strong>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Lista FIFO ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              ⚠️ Lista FIFO – Prioridade de Ação
              <span className="ml-2 text-xs font-normal text-muted-foreground">(mais antigos primeiro)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {selecionados.length > 0 && (
                <Button size="sm" variant="default" className="gap-2" onClick={abrirCriarTarefa}>
                  <ClipboardList className="h-4 w-4" />
                  Criar Tarefa ({selecionados.length})
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-2" disabled>
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ListaFifo
            itens={fifoQ.data?.itens ?? []}
            total={fifoQ.data?.total ?? 0}
            pagina={fifoQ.data?.pagina ?? 1}
            totalPaginas={fifoQ.data?.totalPaginas ?? 1}
            isLoading={fifoQ.isLoading}
            selecionados={selecionados}
            onSelecionar={setSelecionados}
            onMudarPagina={p => { setPagina(p); }}
          />
        </CardContent>
      </Card>

      {/* ── Modal Alertas ── */}
      <AlertasConfig open={alertasOpen} onClose={() => setAlertasOpen(false)} />

      {/* ── Modal Criar Tarefa ── */}
      <Dialog open={tarefaOpen} onOpenChange={v => !v && setTarefaOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Tarefa em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={tarefaTitulo} onChange={e => setTarefaTitulo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={tarefaDesc} onChange={e => setTarefaDesc(e.target.value)} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              {selecionados.length} IMEI(s) serão vinculados automaticamente à tarefa.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTarefaOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCriarTarefa}
              disabled={tarefaMutation.isPending || !tarefaTitulo}
            >
              {tarefaMutation.isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
