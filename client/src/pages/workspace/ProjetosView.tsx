import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { KpiStrip } from "@/components/workspace/KpiStrip";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjetosKpis {
  ativos: number;
  tarefasAbertas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface TarefaItem {
  id: string;
  codigo: string;
  projetoId: string | null;
  titulo: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  responsavel: string;
  responsavelInitials: string;
  dataEntrega: string | null;
  sprint: string | null;
  progresso: number | null;
  criadoEm: string | null;
}

interface ProjetoComTarefas {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  responsavel: string;
  responsavelInitials: string;
  dataInicio: string | null;
  dataFim: string | null;
  progresso: number | null;
  cor: string | null;
  categoria: string | null;
  criadoEm: string | null;
  tarefas: TarefaItem[];
}

interface WorkspaceProjetosResponse {
  kpis: ProjetosKpis;
  projetos: ProjetoComTarefas[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  "a-fazer": "A Fazer",
  "em-andamento": "Em Andamento",
  "em-revisao": "Em Revisão",
  "concluido": "Concluído",
  "bloqueado": "Bloqueado",
  backlog: "Backlog",
};

const statusDotColors: Record<string, string> = {
  "em-andamento": "#00c853",
  "em-revisao": "#2196f3",
  "concluido": "#4ade80",
  "a-fazer": "#f59e0b",
  bloqueado: "#ef4444",
  backlog: "rgba(255,255,255,0.25)",
};

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const priorityColors: Record<string, string> = {
  baixa: "bg-slate-500/10 text-slate-400 border-slate-700",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  alta: "bg-orange-500/10 text-orange-400 border-orange-700",
  critica: "bg-red-500/10 text-red-400 border-red-700",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProjectGroupHeader({ projeto }: { projeto: ProjetoComTarefas }) {
  const cor = projeto.cor || "#00c853";
  const prog = projeto.progresso ?? 0;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cor,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: "10px",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {projeto.nome}
      </span>
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 border"
        style={{
          background: `${cor}15`,
          color: cor,
          borderColor: `${cor}40`,
        }}
      >
        {prog}%
      </Badge>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "rgba(255,255,255,0.2)",
        }}
      >
        {projeto.codigo}
      </span>
    </div>
  );
}

function HeaderRow() {
  const headers = [
    "Código",
    "Título",
    "Categoria / Tipo",
    "Responsável",
    "Status",
    "Prioridade",
    "Progresso",
    "Data Início",
    "",
  ];
  return (
    <div
      className="grid items-center px-4 py-2 gap-2"
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 98px 30px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {headers.map((h, i) => (
        <span
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function TarefaRow({ tarefa, projetoCor }: { tarefa: TarefaItem; projetoCor: string }) {
  const status = tarefa.status || "a-fazer";
  const dotColor = statusDotColors[status] || "rgba(255,255,255,0.2)";
  const prioridade = tarefa.prioridade || "media";
  const prioColor = priorityColors[prioridade] || priorityColors.media;
  const prog = tarefa.progresso ?? 0;

  const dataInicio = tarefa.criadoEm
    ? new Date(tarefa.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";

  return (
    <div
      className="group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-default"
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 98px 30px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141814")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Código */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block flex-shrink-0"
          style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }}
        />
        <span
          className="text-xs text-muted-foreground truncate"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {tarefa.codigo}
        </span>
      </div>

      {/* Título */}
      <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
        {tarefa.titulo}
      </span>

      {/* Categoria / Tipo */}
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: projetoCor, opacity: 0.7 }}>
          {tarefa.sprint || "—"}
        </span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-slate-500/10 text-slate-400">
          tarefa
        </Badge>
      </div>

      {/* Responsável */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold"
          style={{ width: 22, height: 22, background: "rgba(0,200,83,0.15)", color: "#00c853" }}
        >
          {tarefa.responsavelInitials}
        </div>
      </div>

      {/* Status */}
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        {statusLabels[status] || status}
      </span>

      {/* Prioridade */}
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[prioridade] || prioridade}
      </Badge>

      {/* Progresso */}
      <div className="flex items-center gap-1">
        <div style={{ width: 56, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
          <div
            style={{
              width: `${Math.min(prog, 100)}%`,
              height: "100%",
              borderRadius: 2,
              background: projetoCor,
            }}
          />
        </div>
        <span
          className="text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {prog}%
        </span>
      </div>

      {/* Data Início */}
      <span className="text-xs text-muted-foreground">{dataInicio}</span>

      {/* Spacer */}
      <div />
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center px-4 py-3 gap-2 animate-pulse"
          style={{
            gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 98px 30px",
          }}
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-16" />
          <div />
        </div>
      ))}
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProjetosView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<ProjetosKpis>({
    ativos: 0,
    tarefasAbertas: 0,
    emAndamento: 0,
    concluidas: 0,
    atrasadas: 0,
  });
  const [projetos, setProjetos] = useState<ProjetoComTarefas[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [projetoFilter, setProjetoFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWithAuth("/api/workspace/projetos")
      .then((res) => res.json())
      .then((data: WorkspaceProjetosResponse) => {
        if (cancelled) return;
        setKpis(data.kpis);
        setProjetos(data.projetos);
      })
      .catch(() => {
        if (cancelled) return;
        setKpis({ ativos: 0, tarefasAbertas: 0, emAndamento: 0, concluidas: 0, atrasadas: 0 });
        setProjetos([]);
        toast({ title: "Não foi possível carregar os dados. Tente novamente.", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Map KPIs to the WorkspaceKpis shape expected by KpiStrip
  const kpiStripData = {
    total: kpis.ativos,
    abertos: kpis.tarefasAbertas,
    andamento: kpis.emAndamento,
    bloqueados: 0,
    resolvidos: kpis.concluidas,
    noPrazo: 0,
    emAtraso: kpis.atrasadas,
  };

  // Filter projetos
  const filteredProjetos = projetos
    .filter((p) => projetoFilter === "all" || p.id === projetoFilter)
    .map((p) => {
      if (!searchQuery) return p;
      const q = searchQuery.toLowerCase();
      const tarefasFiltradas = p.tarefas.filter(
        (t) =>
          t.codigo.toLowerCase().includes(q) ||
          t.titulo.toLowerCase().includes(q) ||
          t.responsavel.toLowerCase().includes(q),
      );
      return { ...p, tarefas: tarefasFiltradas };
    })
    .filter((p) => p.tarefas.length > 0 || !searchQuery);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Strip */}
      <KpiStrip kpis={kpiStripData} variant="projetos" loading={loading} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Projeto filter */}
        <Select value={projetoFilter} onValueChange={setProjetoFilter}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projetos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="w-full">
        <HeaderRow />
        {loading ? (
          <SkeletonRows />
        ) : filteredProjetos.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Nenhum projeto encontrado
          </div>
        ) : (
          filteredProjetos.map((projeto) => (
            <div key={projeto.id}>
              <ProjectGroupHeader projeto={projeto} />
              {projeto.tarefas.map((tarefa) => (
                <TarefaRow
                  key={tarefa.id}
                  tarefa={tarefa}
                  projetoCor={projeto.cor || "#00c853"}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
