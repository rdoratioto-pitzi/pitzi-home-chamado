import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ProjetoKpis {
  ativos: number;
  tarefasAbertas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface ProjetoItem {
  id: string;
  codigo: string;
  nome: string;
  status: string | null;
  progresso: number | null;
  cor: string | null;
  responsavel: string;
  responsavelInitials: string;
  dataInicio: string | null;
  dataFim: string | null;
  tarefas: { id: string }[];
}

interface VisaoEstrategicaProps {
  open: boolean;
  projetos: ProjetoItem[];
  kpis: ProjetoKpis;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  "em-andamento": "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  pausado: "Pausado",
};

const kpiConfig = [
  { key: "ativos" as const, label: "Projetos Ativos" },
  { key: "tarefasAbertas" as const, label: "Tarefas Abertas" },
  { key: "emAndamento" as const, label: "Em Andamento" },
  { key: "concluidas" as const, label: "Concluídas" },
];

function KpiItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="px-4 py-3">
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: "9px",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.35)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "21px",
          fontWeight: 600,
          color: color || "rgba(255,255,255,0.85)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ProjetoCard({ projeto }: { projeto: ProjetoItem }) {
  const cor = projeto.cor || "#00c853";
  const prog = projeto.progresso ?? 0;
  const status = projeto.status || "backlog";

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: cor,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: `${cor}15`,
            color: cor,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {statusLabels[status] || status}
        </span>
      </div>

      {/* Nome */}
      <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
        {projeto.nome}
      </span>

      {/* Barra de progresso */}
      <div className="flex flex-col gap-1">
        <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
          <div
            style={{
              width: `${Math.min(prog, 100)}%`,
              height: "100%",
              borderRadius: 2,
              background: cor,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span
          className="text-[10px]"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.4)" }}
        >
          {prog}% concluído · {projeto.tarefas.length} tarefas
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-full text-[10px] font-semibold"
            style={{
              width: 22,
              height: 22,
              background: `${cor}25`,
              color: cor,
            }}
          >
            {projeto.responsavelInitials}
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {projeto.responsavel}
          </span>
        </div>
        {projeto.dataFim && (
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date(projeto.dataFim).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

export function VisaoEstrategica({ open, projetos, kpis, onClose }: VisaoEstrategicaProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="w-full max-h-[85vh] overflow-auto"
        style={{
          maxWidth: 1100,
          background: "#111811",
          border: "1px solid rgba(0,200,83,0.15)",
          borderRadius: 14,
          margin: "0 24px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            Visão Estratégica
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-0 px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {kpiConfig.map((k) => (
            <KpiItem
              key={k.key}
              label={k.label}
              value={kpis[k.key]}
              color={k.key === "concluidas" ? "#00c853" : undefined}
            />
          ))}
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-6">
          {projetos.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">
              Nenhum projeto cadastrado
            </div>
          ) : (
            projetos.map((p) => <ProjetoCard key={p.id} projeto={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
