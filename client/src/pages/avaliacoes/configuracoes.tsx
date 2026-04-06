import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
import {
  useAvaliacoesConfiguracoes,
  useUpdateConfiguracoes,
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
        <SecaoGrades />
        <SecaoCuradores />
        <SecaoSobre />
      </div>
    </div>
  );
}
