import { useState, useEffect, useRef } from "react";
import { X, Send, Paperclip, ExternalLink, Download, Maximize2, FileText, FileSpreadsheet, FileImage, File, FileArchive } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { ChamadoItem, UnifiedItem } from "./WorkspaceTable";
import { fetchWithAuth } from "@/lib/queryClient";
import { RichContent } from "@/components/rich-content";
import { useToast } from "@/hooks/use-toast";
import {
  statusOptionsForKind,
  statusLabelOf,
  statusColorOf,
  priorityOptionsForKind,
  priorityLabelOf,
  priorityClassOf,
  type ItemKind,
} from "@/lib/workspace-status";

interface ItemDetailDrawerProps {
  open: boolean;
  item: ChamadoItem | UnifiedItem | null;
  onClose: () => void;
  onUpdate?: (updatedItem: ChamadoItem | UnifiedItem) => void;
}

interface TarefaDetailExtras {
  projetoId: string | null;
  responsavelId: string | null;
}

interface ProjetoOption {
  id: string;
  nome: string;
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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function isImageAnexo(anexo: { name: string; url: string }): boolean {
  if (anexo.url.startsWith("data:image/")) return true;
  const ext = anexo.name.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

function downloadAnexo(url: string, filename: string) {
  if (url.startsWith("data:")) {
    const [header, b64] = url.split(",");
    const mime = header.match(/data:(.*?);/)?.[1] || "application/octet-stream";
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } else {
    window.open(url, "_blank");
  }
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, color: "#22c55e" };
  if (["doc", "docx"].includes(ext)) return { Icon: FileText, color: "#3b82f6" };
  if (["pdf"].includes(ext)) return { Icon: FileText, color: "#ef4444" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return { Icon: FileArchive, color: "#f59e0b" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { Icon: FileImage, color: "#8b5cf6" };
  return { Icon: File, color: "rgba(255,255,255,0.5)" };
}

export function ItemDetailDrawer({ open, item, onClose, onUpdate }: ItemDetailDrawerProps) {
  const [, setLocation] = useLocation();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [descricaoDraft, setDescricaoDraft] = useState<string>("");
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string; name: string}>>([]);
  const [availableProjetos, setAvailableProjetos] = useState<ProjetoOption[]>([]);
  const [tarefaExtras, setTarefaExtras] = useState<TarefaDetailExtras>({ projetoId: null, responsavelId: null });
  const [isPatching, setIsPatching] = useState(false);
  const { toast } = useToast();
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
  const kind: ItemKind = isChamado ? "chamado" : "tarefa";

  // Comentários: chamados e tarefas têm endpoints separados, ambos suportados.
  useEffect(() => {
    if (!item || !open) { setComentarios([]); return; }
    const url = isChamado
      ? `/api/workspace/chamados/${item.id}/comentarios`
      : `/api/workspace/tarefas/${item.id}/comentarios`;
    fetchWithAuth(url)
      .then((r) => r.json())
      .then((data: { comentarios: Comentario[] }) => setComentarios(data.comentarios || []))
      .catch(() => setComentarios([]));
  }, [item?.id, open, isChamado]);

  // Lista de usuários para o select de Responsável (chamados e tarefas).
  useEffect(() => {
    if (!open) return;
    fetchWithAuth("/api/users")
      .then((r) => r.json())
      .then((data: Array<{id: string; name: string}>) => setAvailableUsers(data || []))
      .catch(() => {});
  }, [open]);

  // Para tarefa: busca projetoId/responsavelId atuais (não vêm em UnifiedItem)
  // e a lista de projetos disponíveis para o select de Projeto.
  useEffect(() => {
    if (!open || !item || isChamado) {
      setTarefaExtras({ projetoId: null, responsavelId: null });
      return;
    }
    fetchWithAuth(`/api/workspace/tarefas/${item.id}`)
      .then((r) => r.json())
      .then((data: { projeto?: { id: string } | null; responsavelId?: string | null }) => {
        setTarefaExtras({
          projetoId: data.projeto?.id ?? null,
          responsavelId: data.responsavelId ?? null,
        });
      })
      .catch(() => setTarefaExtras({ projetoId: null, responsavelId: null }));
  }, [item?.id, open, isChamado]);

  useEffect(() => {
    if (!open || isChamado) return;
    fetchWithAuth("/api/workspace/projetos")
      .then((r) => r.json())
      .then((data: { projetos?: Array<{ id: string; nome: string }> }) => {
        setAvailableProjetos(data.projetos ?? []);
      })
      .catch(() => setAvailableProjetos([]));
  }, [open, isChamado]);

  // Mapeia a resposta do PATCH /tarefas/:id de volta para o shape UnifiedItem,
  // preservando campos que o backend não retorna (contexto, badge, sla...).
  function mergeTarefaResponseIntoUnified(prev: UnifiedItem, resp: {
    id: string;
    codigo: string;
    titulo: string;
    descricao: string | null;
    status: string;
    prioridade: string;
    responsavelId: string | null;
    responsavel: string;
    responsavelInitials: string;
    dataEntrega: string | null;
    progresso: number | null;
    criadoEm: string | null;
  }): UnifiedItem {
    return {
      ...prev,
      id: resp.id,
      codigo: resp.codigo,
      titulo: resp.titulo,
      descricao: resp.descricao,
      status: resp.status,
      prioridade: resp.prioridade,
      responsavel: resp.responsavel,
      responsavelInitials: resp.responsavelInitials,
      dataEntrega: resp.dataEntrega,
      progresso: resp.progresso,
      criadoEm: resp.criadoEm,
    };
  }

  async function handlePatch(field: string, value: string | number | null) {
    if (!item) return;
    setIsPatching(true);
    try {
      const url = isChamado
        ? `/api/workspace/chamados/${item.id}`
        : `/api/workspace/tarefas/${item.id}`;
      const r = await fetchWithAuth(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error("Erro ao atualizar");
      const updated = await r.json();

      if (isChamado) {
        onUpdate?.(updated as ChamadoItem);
      } else {
        const merged = mergeTarefaResponseIntoUnified(item as UnifiedItem, updated);
        onUpdate?.(merged);
        if (field === "responsavelId") {
          setTarefaExtras((prev) => ({ ...prev, responsavelId: value === "" ? null : (value as string) }));
        }
      }
      setEditingField(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao atualizar", description: msg, variant: "destructive" });
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

  const statusColor = item ? statusColorOf(item.status) : "rgba(255,255,255,0.3)";
  const statusLabel = item ? statusLabelOf(item.status) : "";

  const prioClass = item ? priorityClassOf(item.prioridade) : priorityClassOf("media");
  const prioLabel = item ? priorityLabelOf(item.prioridade) : "";

  const abertura = isChamado
    ? formatDateTime((item as ChamadoItem).abertura)
    : formatDateTime((item as UnifiedItem | null)?.criadoEm);

  const descricao = item
    ? isChamado
      ? (item as ChamadoItem).descricao
      : (item as UnifiedItem).descricao || null
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
            background: "hsl(var(--background))",
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
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  {editingField === "titulo" ? (
                    <input
                      autoFocus
                      defaultValue={item.titulo}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== item.titulo) {
                          handlePatch("titulo", v);
                        } else {
                          setEditingField(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v && v !== item.titulo) {
                            handlePatch("titulo", v);
                          } else {
                            setEditingField(null);
                          }
                        } else if (e.key === "Escape") {
                          setEditingField(null);
                        }
                      }}
                      className="flex-1 text-sm rounded px-2 py-0.5 outline-none min-w-0"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(0,200,83,0.3)",
                        color: "rgba(255,255,255,0.95)",
                      }}
                    />
                  ) : (
                    <span
                      className="truncate text-sm cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 flex-1 min-w-0"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                      onClick={() => setEditingField("titulo")}
                      title="Clique para editar"
                    >
                      {item.titulo}
                    </span>
                  )}
                  {isPatching && editingField === "titulo" && (
                    <span
                      className="text-[10px] flex-shrink-0"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      salvando...
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {item && (
                <button
                  onClick={() => { onClose(); setLocation(isChamado ? `/chamados/${item!.id}` : `/workspace/tarefas/${item!.id}`); }}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  title={isChamado ? "Abrir detalhe" : "Editar atividade"}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
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
                      {editingField === "status" ? (
                        <select
                          autoFocus
                          defaultValue={item!.status}
                          onChange={(e) => { handlePatch("status", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(0,200,83,0.3)", color: "#00c853" }}
                        >
                          {statusOptionsForKind(kind).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          onClick={() => setEditingField("status")}
                          style={{
                            background: `${statusColor}1a`,
                            color: statusColor,
                            border: `1px solid ${statusColor}33`,
                            cursor: "pointer",
                          }}
                        >
                          {statusLabel}
                        </span>
                      )}
                    </div>

                    {/* Prioridade */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Prioridade</span>
                      {editingField === "prioridade" ? (
                        <select
                          autoFocus
                          defaultValue={item!.prioridade}
                          onChange={(e) => { handlePatch("prioridade", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                        >
                          {priorityOptionsForKind(kind).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border ${prioClass}`}
                          onClick={() => setEditingField("prioridade")}
                          style={{ cursor: "pointer" }}
                        >
                          {prioLabel}
                        </Badge>
                      )}
                    </div>

                    {/* Tipo — só chamados */}
                    {isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Tipo</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as ChamadoItem).tipo || "—"}
                        </span>
                      </div>
                    )}

                    {/* Categoria — só chamados */}
                    {isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Categoria</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as ChamadoItem).categoria || "—"}
                        </span>
                      </div>
                    )}

                    {/* Projeto — só tarefas */}
                    {!isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Projeto</span>
                        {editingField === "projeto" ? (
                          <select
                            autoFocus
                            defaultValue={tarefaExtras.projetoId ?? ""}
                            onChange={(e) => { if (e.target.value) handlePatch("projetoId", e.target.value); }}
                            onBlur={() => setEditingField(null)}
                            className="text-xs rounded px-2 py-0.5 outline-none"
                            style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                          >
                            {availableProjetos.map((p) => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="text-xs font-medium"
                            onClick={() => setEditingField("projeto")}
                            style={{ color: "rgba(255,255,255,0.65)", cursor: "pointer" }}
                          >
                            {(item as UnifiedItem).contexto || "—"}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Sprint — só tarefas */}
                    {!isChamado && (item as UnifiedItem).sprint && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Sprint</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as UnifiedItem).sprint}
                        </span>
                      </div>
                    )}

                    {/* Responsável */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Responsável</span>
                      {editingField === "responsavel" ? (
                        <select
                          autoFocus
                          defaultValue={isChamado ? "" : (tarefaExtras.responsavelId ?? "")}
                          onChange={(e) => { if (e.target.value) handlePatch("responsavelId", e.target.value); }}
                          onBlur={() => setEditingField(null)}
                          className="text-xs rounded px-2 py-0.5 outline-none"
                          style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                        >
                          {isChamado && <option value="">Manter atual</option>}
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={() => setEditingField("responsavel")}
                          style={{ cursor: "pointer" }}
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

                    {/* Solicitante — só chamados */}
                    {isChamado && (item as ChamadoItem).solicitante && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Solicitante</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {(item as ChamadoItem).solicitante}
                        </span>
                      </div>
                    )}

                    {/* Abertura */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Abertura</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                        {abertura}
                      </span>
                    </div>

                    {/* Data Entrega — só tarefas */}
                    {!isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Entrega</span>
                        {editingField === "entrega" ? (
                          <input
                            autoFocus
                            type="date"
                            defaultValue={(item as UnifiedItem).dataEntrega ? String((item as UnifiedItem).dataEntrega).split("T")[0] : ""}
                            onChange={(e) => { handlePatch("dataEntrega", e.target.value || null); }}
                            onBlur={() => setEditingField(null)}
                            className="text-xs rounded px-2 py-0.5 outline-none"
                            style={{ background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                          />
                        ) : (
                          <span
                            className="text-xs"
                            onClick={() => setEditingField("entrega")}
                            style={{ color: "rgba(255,255,255,0.55)", cursor: "pointer" }}
                          >
                            {formatDate((item as UnifiedItem).dataEntrega)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progresso — só tarefas */}
                    {!isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>Progresso</span>
                        {editingField === "progresso" ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={(item as UnifiedItem).progresso ?? 0}
                            onBlur={(e) => {
                              const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              handlePatch("progresso", n);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = Math.max(0, Math.min(100, Number((e.target as HTMLInputElement).value) || 0));
                                handlePatch("progresso", n);
                              } else if (e.key === "Escape") {
                                setEditingField(null);
                              }
                            }}
                            className="text-xs rounded px-2 py-0.5 outline-none"
                            style={{ width: 64, background: "#1a201a", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                          />
                        ) : (
                          <div
                            className="flex items-center gap-2"
                            onClick={() => setEditingField("progresso")}
                            style={{ cursor: "pointer" }}
                          >
                            <div style={{ width: 80, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                              <div
                                style={{
                                  width: `${Math.min((item as UnifiedItem).progresso ?? 0, 100)}%`,
                                  height: "100%",
                                  borderRadius: 3,
                                  background: "#00c853",
                                }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace" }}>
                              {(item as UnifiedItem).progresso ?? 0}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SLA — só chamados */}
                    {isChamado && (
                      <div className="flex items-center gap-3">
                        <span style={ROW_LABEL_STYLE}>SLA</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {item.sla ? `${item.sla}h` : "—"}
                        </span>
                      </div>
                    )}
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
                  <div style={{ ...SECTION_LABEL_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Descrição</span>
                    {editingField !== "descricao" && (
                      <button
                        onClick={() => {
                          setDescricaoDraft(descricao || "");
                          setEditingField("descricao");
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          textTransform: "none",
                          letterSpacing: "0",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  {editingField === "descricao" ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={descricaoDraft}
                        onChange={(e) => setDescricaoDraft(e.target.value)}
                        rows={6}
                        className="w-full text-sm p-2 rounded outline-none resize-y"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(0,200,83,0.3)",
                          color: "rgba(255,255,255,0.85)",
                          minHeight: 100,
                          lineHeight: 1.5,
                        }}
                        placeholder="Descreva..."
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingField(null); setDescricaoDraft(""); }}
                          disabled={isPatching}
                          className="text-xs px-2.5 py-1 rounded"
                          style={{
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handlePatch("descricao", descricaoDraft)}
                          disabled={isPatching}
                          className="text-xs px-2.5 py-1 rounded"
                          style={{
                            background: "rgba(0,200,83,0.15)",
                            color: "#00c853",
                            border: "1px solid rgba(0,200,83,0.3)",
                          }}
                        >
                          {isPatching ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : descricao ? (
                    <RichContent
                      content={descricao}
                      className="text-sm [&_*]:!text-[rgba(255,255,255,0.55)] !leading-relaxed"
                    />
                  ) : (
                    <p
                      className="text-sm"
                      style={{ color: "rgba(255,255,255,0.55)", lineHeight: "1.6" }}
                    >
                      —
                    </p>
                  )}
                </div>

                {/* ANEXOS */}
                {(() => {
                  const anexos = isChamado
                    ? (item as ChamadoItem).anexos
                    : (item as UnifiedItem).anexos || [];
                  if (!anexos || anexos.length === 0) return null;
                  return (
                  <div
                    style={{
                      marginBottom: 24,
                      paddingTop: 20,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={SECTION_LABEL_STYLE}>
                      <Paperclip size={12} style={{ display: "inline", marginRight: 6 }} />
                      Anexos ({anexos.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {anexos.map((anexo, idx) =>
                        isImageAnexo(anexo) ? (
                          <Dialog key={idx}>
                            <DialogTrigger asChild>
                              <div
                                className="rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors cursor-pointer relative group"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                              >
                                <img
                                  src={anexo.url}
                                  alt={anexo.name || `Anexo ${idx + 1}`}
                                  className="w-full h-32 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Maximize2 className="h-5 w-5 text-white" />
                                </div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                              <VisuallyHidden>
                                <DialogTitle>Visualização de Imagem</DialogTitle>
                              </VisuallyHidden>
                              <img
                                src={anexo.url}
                                alt={anexo.name || `Anexo ${idx + 1}`}
                                className="max-w-full max-h-full object-contain"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <button
                            key={idx}
                            onClick={() => downloadAnexo(anexo.url, anexo.name || `Arquivo_${idx + 1}`)}
                            className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/30 transition-colors text-left w-full cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)" }}
                          >
                            {(() => { const { Icon, color } = getFileIcon(anexo.name); return <Icon size={20} style={{ color }} className="flex-shrink-0" />; })()}
                            <span className="text-xs truncate flex-1">{anexo.name || `Arquivo ${idx + 1}`}</span>
                            <Download size={14} className="flex-shrink-0 opacity-40" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  );
                })()}

                {/* COMENTÁRIOS section — só chamados */}
                {isChamado && (
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
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
