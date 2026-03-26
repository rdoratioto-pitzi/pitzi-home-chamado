import { useState, useEffect, useRef } from "react";
import { X, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChamadoItem, UnifiedItem } from "./WorkspaceTable";
import { fetchWithAuth } from "@/lib/queryClient";

interface ItemDetailDrawerProps {
  open: boolean;
  item: ChamadoItem | UnifiedItem | null;
  onClose: () => void;
  onUpdate?: (updatedItem: ChamadoItem) => void;
}

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase",
  fontSize: "9px",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.25)",
  marginBottom: "12px",
};

const ROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.35)",
  minWidth: "90px",
};

const statusColors: Record<string, string> = {
  open: "#f59e0b",
  in_progress: "#00c853",
  blocked: "#ef4444",
  resolved: "#4ade80",
  closed: "#4ade80",
  "a-fazer": "#f59e0b",
  "em-andamento": "#00c853",
  concluido: "#4ade80",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  blocked: "Bloqueado",
  resolved: "Resolvido",
  closed: "Fechado",
  "a-fazer": "A Fazer",
  "em-andamento": "Em Andamento",
  concluido: "Concluído",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-400 border-slate-700",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  high: "bg-orange-500/10 text-orange-400 border-orange-700",
  critical: "bg-red-500/10 text-red-400 border-red-700",
  baixa: "bg-slate-500/10 text-slate-400 border-slate-700",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  alta: "bg-orange-500/10 text-orange-400 border-orange-700",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

interface Comentario {
  id: string;
  texto: string;
  autorId: string;
  autorNome: string;
  autorInitials: string;
  criadoEm: string | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "blocked", label: "Bloqueado" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
];

const PRIORIDADE_OPTIONS_EDIT = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export function ItemDetailDrawer({ open, item, onClose, onUpdate }: ItemDetailDrawerProps) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string; name: string}>>([]);
  const [isPatching, setIsPatching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isChamado = item !== null && "tipo" in item && typeof (item as ChamadoItem).categoria === "string";

  useEffect(() => {
    if (!item || !open) { setComentarios([]); return; }
    if (!isChamado) { setComentarios([]); return; }
    fetchWithAuth(`/api/workspace/chamados/${item.id}/comentarios`)
      .then((r) => r.json())
      .then((data: { comentarios: Comentario[] }) => setComentarios(data.comentarios || []))
      .catch(() => setComentarios([]));
  }, [item?.id, open]);

  useEffect(() => {
    if (!open || !isChamado) return;
    fetchWithAuth("/api/users")
      .then((r) => r.json())
      .then((data: Array<{id: string; name: string}>) => setAvailableUsers(data || []))
      .catch(() => {});
  }, [open, isChamado]);

  async function handlePatch(field: string, value: string) {
    if (!item || !isChamado) return;
    setIsPatching(true);
    try {
      const r = await fetchWithAuth(`/api/workspace/chamados/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error("Erro ao atualizar");
      const updated: ChamadoItem = await r.json();
      onUpdate?.(updated);
      setEditingField(null);
    } catch {
      // silently ignore
    } finally {
      setIsPatching(false);
    }
  }

  async function handleEnviarComentario() {
    if (!item || !novoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      const r = await fetchWithAuth(`/api/workspace/chamados/${item.id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: novoComentario.trim() }),
      });
      if (!r.ok) throw new Error("Erro ao comentar");
      const novo: Comentario = await r.json();
      setComentarios((prev) => [...prev, novo]);
      setNovoComentario("");
    } catch {
      // silently ignore for now
    } finally {
      setEnviandoComentario(false);
    }
  }

  const statusColor = item ? (statusColors[item.status] ?? "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.3)";
  const statusLabel = item ? (statusLabels[item.status] ?? item.status) : "";

  const prioColor = item ? (priorityColors[item.prioridade] ?? priorityColors.medium) : priorityColors.medium;
  const prioLabel = item ? (priorityLabels[item.prioridade] ?? item.prioridade) : "";

  const abertura = isChamado
    ? formatDate((item as ChamadoItem).abertura)
    : formatDate((item as UnifiedItem | null)?.criadoEm);

  const descricao = item
    ? isChamado
      ? (item as ChamadoItem).descricao
      : (item as UnifiedItem).contexto
    : "";

  return (
    <>
      {/* Full-screen overlay container — pointer-events none so main content stays interactive */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        {/* Semi-transparent backdrop — pointer-events all only when open */}
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            opacity: open ? 1 : 0,
            transition: "opacity 300ms ease",
            pointerEvents: open ? "all" : "none",
          }}
        />

        {/* Slide-in panel */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: 480,
            height: "100vh",
            background: "#111411",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            transform: open ? "translateX(0)" : "translateX(100%)",
            transition: "transform 300ms ease",
            pointerEvents: "all",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item && (
                <>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    {item.codigo}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                  <span
                    className="truncate text-sm"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {item.titulo}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
            {item && (
              <>
                {/* DETALHES section */}
                <div style={{ marginBottom: 24 }}>
                  <div style={SECTION_LABEL_STYLE}>Detalhes</div>

                  <div className="flex flex-col gap-3">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Status</span>
                      {isChamado && editingField === "status" ? (
                        <select
                          autoFocus
                          defaultValue={item!.status}
                          onChange={(e) => { handlePatch("status", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(0,200,83,0.3)", color: "#00c853" }}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          onClick={() => isChamado && setEditingField("status")}
                          style={{
                            background: `${statusColor}1a`,
                            color: statusColor,
                            border: `1px solid ${statusColor}33`,
                            cursor: isChamado ? "pointer" : "default",
                          }}
                        >
                          {statusLabel}
                        </span>
                      )}
                    </div>

                    {/* Prioridade */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Prioridade</span>
                      {isChamado && editingField === "prioridade" ? (
                        <select
                          autoFocus
                          defaultValue={item!.prioridade}
                          onChange={(e) => { handlePatch("prioridade", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                        >
                          {PRIORIDADE_OPTIONS_EDIT.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border ${prioColor}`}
                          onClick={() => isChamado && setEditingField("prioridade")}
                          style={{ cursor: isChamado ? "pointer" : "default" }}
                        >
                          {prioLabel}
                        </Badge>
                      )}
                    </div>

                    {/* Tipo */}
                    {isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Tipo</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as ChamadoItem).tipo || "—"}
                        </span>
                      </div>
                    )}

                    {/* Categoria */}
                    {isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Categoria</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as ChamadoItem).categoria || "—"}
                        </span>
                      </div>
                    )}

                    {/* Responsável */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Responsável</span>
                      {isChamado && editingField === "responsavel" ? (
                        <select
                          autoFocus
                          defaultValue={""}
                          onChange={(e) => { if (e.target.value) handlePatch("responsavelId", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                        >
                          <option value="">Manter atual</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={() => isChamado && setEditingField("responsavel")}
                          style={{ cursor: isChamado ? "pointer" : "default" }}
                        >
                          <div
                            className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold"
                            style={{ width: 22, height: 22, background: "rgba(0,200,83,0.15)", color: "#00c853" }}
                          >
                            {item!.responsavelInitials}
                          </div>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                            {item!.responsavel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Abertura */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Abertura</span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {abertura}
                      </span>
                    </div>

                    {/* SLA */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>SLA</span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {item.sla ? `${item.sla}h` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DESCRIÇÃO section */}
                <div
                  style={{
                    marginBottom: 24,
                    paddingTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={SECTION_LABEL_STYLE}>Descrição</div>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.55)", lineHeight: "1.6" }}
                  >
                    {descricao || "—"}
                  </p>
                </div>

                {/* COMENTÁRIOS section */}
                <div
                  style={{
                    paddingTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={SECTION_LABEL_STYLE}>Comentários</div>

                  {/* Existing comments */}
                  <div className="flex flex-col gap-3 mb-4">
                    {comentarios.length === 0 ? (
                      <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.25)" }}>
                        Nenhum comentário ainda
                      </p>
                    ) : (
                      comentarios.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <div
                            className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold mt-0.5"
                            style={{ width: 24, height: 24, background: "rgba(0,200,83,0.15)", color: "#00c853" }}
                          >
                            {c.autorInitials}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                                {c.autorNome}
                              </span>
                              {c.criadoEm && (
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                                  {new Date(c.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)", lineHeight: "1.5" }}>
                              {c.texto}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* New comment input */}
                  {isChamado && (
                    <div className="flex gap-2 mt-2">
                      <textarea
                        ref={textareaRef}
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        placeholder="Adicionar comentário..."
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleEnviarComentario();
                          }
                        }}
                        className="flex-1 text-xs p-2 rounded resize-none outline-none"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      />
                      <button
                        onClick={handleEnviarComentario}
                        disabled={enviandoComentario || !novoComentario.trim()}
                        className="flex-shrink-0 p-2 rounded transition-colors self-end"
                        style={{
                          background: novoComentario.trim() ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(0,200,83,0.2)",
                          color: novoComentario.trim() ? "#00c853" : "rgba(255,255,255,0.2)",
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
