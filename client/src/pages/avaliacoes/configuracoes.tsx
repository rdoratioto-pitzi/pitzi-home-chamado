import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2,
  SlidersHorizontal,
  Info,
  Users,
  BookOpen,
  Save,
  Plus,
  Trash2,
  Cpu,
} from "lucide-react";
import {
  useAvaliacoesConfiguracoes,
  useUpdateConfiguracoes,
  useVersoesIA,
  useAddVersaoIA,
  useDeleteVersaoIA,
  type VersaoIA,
} from "@/hooks/use-avaliacoes";

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADES_INFO = [
  {
    grade: "A",
    display: "0%",
    carcaca: "0%",
    definicao: "Excelente condição, sinais mínimos de uso",
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    grade: "B",
    display: "25%",
    carcaca: "25%",
    definicao: "Bom estado, uso moderado visível",
    color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  },
  {
    grade: "C",
    display: "70%",
    carcaca: "70%",
    definicao: "Desgaste severo, danos visíveis",
    color: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
] as const;

// ─── Seção 1: Amostragem ──────────────────────────────────────────────────────

function SecaoAmostragem() {
  const { toast } = useToast();
  const { data: configData, isLoading } = useAvaliacoesConfiguracoes();
  const updateMutation = useUpdateConfiguracoes();

  const [percentual, setPercentual] = useState<number>(15);
  const [modo, setModo] = useState<string>("aleatorio");

  // Sync com dados do banco quando carregado
  useEffect(() => {
    if (configData?.data) {
      const p = Number(configData.data.percentualAmostragem);
      if (!isNaN(p)) setPercentual(p);
      if (configData.data.modoPrioridade) setModo(configData.data.modoPrioridade);
    }
  }, [configData]);

  const handleSalvar = async () => {
    try {
      await updateMutation.mutateAsync({
        percentualAmostragem: percentual,
        modoPrioridade: modo,
      });
      toast({ title: "Configurações atualizadas", description: "Mudanças salvas com sucesso." });
    } catch {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as configurações. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" />
          Amostragem de Curadoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slider percentual */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="slider-amostragem" className="text-sm font-medium">
              Percentual de amostragem
            </label>
            <span
              className="text-xl font-bold tabular-nums"
              aria-live="polite"
              style={{ color: "var(--accent, #00A137)" }}
            >
              {percentual}%
            </span>
          </div>
          <Slider
            id="slider-amostragem"
            min={5}
            max={50}
            step={5}
            value={[percentual]}
            onValueChange={([v]) => setPercentual(v)}
            aria-label="Percentual de amostragem para curadoria"
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>50%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Percentual de trade-ins do dia anterior selecionados para curadoria. Valor atual:{" "}
            <strong>{percentual}%</strong>.
          </p>
        </div>

        {/* Select modo */}
        <div className="space-y-2">
          <label htmlFor="select-modo" className="text-sm font-medium">
            Modo de prioridade
          </label>
          <Select value={modo} onValueChange={setModo}>
            <SelectTrigger id="select-modo" aria-label="Modo de prioridade de curadoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aleatorio">Aleatório</SelectItem>
              <SelectItem value="divergencias_primeiro">Divergências primeiro</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {modo === "aleatorio"
              ? "Amostra puramente aleatória dos trade-ins disponíveis."
              : "Prioriza trade-ins onde IA ≠ Humano, completa com aleatórios até atingir o percentual."}
          </p>
        </div>

        <Button
          onClick={handleSalvar}
          disabled={updateMutation.isPending}
          className="gap-2"
          style={{ background: "var(--accent, #00A137)", color: "#fff" }}
        >
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Seção: Versão do Modelo IA ───────────────────────────────────────────────

function SecaoVersaoIA() {
  const { toast } = useToast();
  const { data: versoesData, isLoading } = useVersoesIA();
  const addMutation = useAddVersaoIA();
  const deleteMutation = useDeleteVersaoIA();

  const versoes: VersaoIA[] = versoesData?.data ?? [];

  const [dialogAberto, setDialogAberto] = useState(false);
  const [novaData, setNovaData] = useState(new Date().toISOString().slice(0, 10));
  const [novaVersao, setNovaVersao] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  async function handleAdicionar() {
    if (!novaData || !novaVersao.trim() || !novaDescricao.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha data, versão e descrição.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync({ data: novaData, versao: novaVersao.trim(), descricao: novaDescricao.trim() });
      setNovaData(new Date().toISOString().slice(0, 10));
      setNovaVersao("");
      setNovaDescricao("");
      setDialogAberto(false);
      toast({ title: "Versão adicionada", description: `${novaVersao} registrada com sucesso.` });
    } catch {
      toast({ title: "Erro ao adicionar", description: "Tente novamente.", variant: "destructive" });
    }
  }

  async function handleRemover(index: number) {
    try {
      await deleteMutation.mutateAsync(index);
      toast({ title: "Versão removida" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" />
          Versão do Modelo IA
        </CardTitle>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova versão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar nova versão IA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="nova-data">Data da atualização</Label>
                <Input
                  id="nova-data"
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-versao">Versão (ex: v2.3)</Label>
                <Input
                  id="nova-versao"
                  placeholder="v2.3"
                  value={novaVersao}
                  onChange={(e) => setNovaVersao(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-descricao">Descrição</Label>
                <Input
                  id="nova-descricao"
                  placeholder="Ajuste no modelo de carcaça"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleAdicionar}
                disabled={addMutation.isPending}
                style={{ background: "var(--accent, #00A137)", color: "#fff" }}
              >
                <Save className="h-4 w-4" />
                {addMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : versoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma versão registrada. Adicione a versão atual do modelo IA da Lapisco.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Versão</TableHead>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Descrição</TableHead>
                <TableHead className="text-xs text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versoes.map((v, idx) => (
                <TableRow key={v.data + v.versao + idx}>
                  <TableCell className="text-sm font-medium">
                    {v.versao}
                    {idx === 0 && (
                      <Badge className="ml-2 text-[10px] py-0" variant="outline">atual</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {(() => { try { return format(parseISO(v.data), "dd/MM/yyyy"); } catch { return v.data; } })()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{v.descricao}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover versão {v.versao}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A versão será removida do histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemover(idx)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção 2: Percentuais por Grade ──────────────────────────────────────────

function SecaoGrades() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          Percentuais de Desconto por Grade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grade</TableHead>
              <TableHead>Display</TableHead>
              <TableHead>Carcaça</TableHead>
              <TableHead className="hidden md:table-cell">Definição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {GRADES_INFO.map(({ grade, display, carcaca, definicao, color }) => (
              <TableRow key={grade}>
                <TableCell>
                  <Badge className={color}>{grade}</Badge>
                </TableCell>
                <TableCell className="font-medium tabular-nums">{display}</TableCell>
                <TableCell className="font-medium tabular-nums">{carcaca}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {definicao}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-1">
            <p>
              Percentuais conforme <strong>POP 101 — Avaliação Estética de Dispositivos V3</strong>.
            </p>
            <p>
              Alterações devem ser feitas via revisão do POP com aprovação da Renov.
            </p>
            <p className="text-muted-foreground">
              Última revisão: Dezembro 2025 · Próxima revisão: Junho 2026
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// ─── Seção 3: Curadores Ativos ────────────────────────────────────────────────

function SecaoCuradores() {
  const [, navigate] = useLocation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Curadores Ativos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Usuários com permissão <strong>avaliacoes</strong> podem realizar curadorias de
          trade-ins.
        </p>
        <p className="text-sm text-muted-foreground">
          As permissões de curadoria são gerenciadas em Configurações → Usuários.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/configuracoes")}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Ir para Configurações
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Seção 4: Sobre o Módulo ──────────────────────────────────────────────────

const SOBRE_ITEMS = [
  { label: "Módulo", value: "Avaliações v1.0" },
  { label: "Base", value: "POP 101 — Avaliação Estética de Dispositivos V3" },
  { label: "Responsáveis", value: "Gabriel Campos / Matheus Mundstock" },
  { label: "IA de Avaliação", value: "Lapisco (parceiro externo)" },
  { label: "Categorias avaliadas", value: "Smartphone, iPhone, Console" },
  { label: "Áreas de avaliação", value: "Display & Tela, Carcaça" },
  { label: "Grades", value: "A (0%), B (25%), C (70%)" },
];

function SecaoSobre() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Sobre o Módulo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {SOBRE_ITEMS.map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvaliacoesConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Configurações" />

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/avaliacoes/dashboard">Avaliações</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Configurações</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <SecaoAmostragem />
        <SecaoVersaoIA />
        <SecaoGrades />
        <SecaoCuradores />
        <SecaoSobre />
      </div>
    </div>
  );
}
