import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/rich-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, X, ChevronDown, ChevronUp, User as UserIcon, Users, Globe, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/queryClient";
import { UserSelect } from "@/components/ui/user-select";
import { ApplicationSelect } from "@/components/shared/ApplicationSelect";

export type ItemType = "chamado" | "tarefa" | "projeto";

interface Attachment {
  name: string;
  url: string;
}

interface UserOption {
  id: string;
  name: string;
  status?: string;
}

interface ProjetoOption {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
  applicationKey?: string | null;
}

interface NovoItemModalProps {
  open: boolean;
  defaultType: ItemType;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_CONFIG: Record<ItemType, { prefix: string; label: string; titlePlaceholder: string }> = {
  chamado: { prefix: "REN", label: "Novo Chamado", titlePlaceholder: "Título do chamado..." },
  tarefa: { prefix: "PRO", label: "Nova Atividade", titlePlaceholder: "Título da atividade..." },
  projeto: { prefix: "PRO", label: "Novo Projeto", titlePlaceholder: "Nome do projeto..." },
};

const DESC_PLACEHOLDER: Record<ItemType, string> = {
  chamado:
    "Descreva detalhadamente: o que ocorreu, onde, quando e como reproduzir.\nQuanto mais contexto, mais rápido o diagnóstico por IA.",
  tarefa: "Descreva o que precisa ser feito e os critérios de aceite da atividade.",
  projeto: "Descreva o objetivo e escopo do projeto.",
};

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

// ─── Chip subcomponents ───────────────────────────────────────────────────────

interface ChipSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  greenStyle?: boolean;
}

function ChipSelect({ value, onValueChange, placeholder, options, greenStyle }: ChipSelectProps) {
  return (
    <Select value={value || "none"} onValueChange={(v) => onValueChange(v === "none" ? "" : v)}>
      <SelectTrigger
        className="h-7 px-3 text-xs rounded-full w-auto min-w-[90px] border focus:ring-0 focus:ring-offset-0"
        style={
          greenStyle
            ? {
                background: "rgba(0,200,83,0.06)",
                borderColor: "rgba(0,200,83,0.25)",
                color: "#5B62EC",
              }
            : {
                background: "transparent",
                borderColor: "rgba(255,255,255,0.12)",
                color: value ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
              }
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {placeholder && (
          <SelectItem value="none" style={{ color: "rgba(255,255,255,0.35)" }}>
            {placeholder}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ChipDateProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

function ChipDate({ value, onChange, placeholder }: ChipDateProps) {
  return (
    <div
      className="flex items-center h-7 px-2 rounded-full text-xs"
      style={{ border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <span
        className="mr-1 whitespace-nowrap"
        style={{ color: value ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)", fontSize: "10px" }}
      >
        {!value && placeholder}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-xs"
        style={{
          color: "rgba(255,255,255,0.7)",
          colorScheme: "dark",
          width: value ? "100px" : "16px",
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NovoItemModal({ open, defaultType, onClose, onSuccess }: NovoItemModalProps) {
  const { toast } = useToast();
  const [type, setType] = useState<ItemType>(defaultType);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [criarMais, setCriarMais] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  // Tarefa chip state
  const [statusTarefa, setStatusTarefa] = useState("a-fazer");
  const [projetoId, setProjetoId] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [sprint, setSprint] = useState("");
  const [estimativa, setEstimativa] = useState("");
  const [etapa, setEtapa] = useState("");

  // Chamado chip state
  const [categoriaChamado, setCategoriaChamado] = useState("");
  const [tipoChamado, setTipoChamado] = useState("");
  const [prioridadeChamado, setPrioridadeChamado] = useState("media");
  const [applicationKeyChamado, setApplicationKeyChamado] = useState<string | null>(null);

  // Tarefa applicationKey (opcional, herda do projeto pai)
  const [applicationKeyTarefa, setApplicationKeyTarefa] = useState<string | null>(null);
  const [applicationKeyTarefaTouched, setApplicationKeyTarefaTouched] = useState(false);

  // Projeto applicationKey (obrigatório)
  const [applicationKeyProjeto, setApplicationKeyProjeto] = useState<string | null>(null);

  // Marca quando submit foi tentado pra mostrar erro visual
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Projeto chip state
  const [statusProjeto, setStatusProjeto] = useState("backlog");
  const [prioridadeProjeto, setPrioridadeProjeto] = useState("");
  const [responsavelProjeto, setResponsavelProjeto] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [categoriaProjeto, setCategoriaProjeto] = useState("");
  const [budget, setBudget] = useState("");
  const [visibilityProjeto, setVisibilityProjeto] = useState<"private" | "shared" | "public">("private");
  const [memberIdsProjeto, setMemberIdsProjeto] = useState<string[]>([]);
  const [memberSearchProjeto, setMemberSearchProjeto] = useState("");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [projetos, setProjetos] = useState<ProjetoOption[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form and sync type when modal opens
  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setTitulo("");
    setDescricao("");
    setAttachments([]);
    setExtraOpen(false);
    setCategoriaChamado("");
    setTipoChamado("");
    setPrioridadeChamado("media");
    setApplicationKeyChamado(null);
    setApplicationKeyTarefa(null);
    setApplicationKeyTarefaTouched(false);
    setApplicationKeyProjeto(null);
    setSubmitAttempted(false);
    setStatusTarefa("a-fazer");
    setProjetoId("");
    setPrioridade("");
    setResponsavelId("");
    setDataEntrega("");
    setSprint("");
    setEstimativa("");
    setEtapa("");
    setStatusProjeto("backlog");
    setPrioridadeProjeto("");
    setResponsavelProjeto("");
    setDataInicio("");
    setDataFim("");
    setCategoriaProjeto("");
    setBudget("");
    setVisibilityProjeto("private");
    setMemberIdsProjeto([]);
    setMemberSearchProjeto("");
  }, [open, defaultType]);

  // Fetch users and projetos on open
  useEffect(() => {
    if (!open) return;
    fetchWithAuth("/api/users")
      .then((r) => r.json())
      .then((data: UserOption[]) => setUsers(data || []))
      .catch(() => {});
    fetchWithAuth("/api/workspace/projetos")
      .then((r) => r.json())
      .then((data: { projetos: ProjetoOption[] }) => setProjetos(data.projetos || []))
      .catch(() => {});
  }, [open]);

  // Herança: ao selecionar projeto na aba Tarefa, auto-preenche applicationKey
  // (a menos que o usuário já tenha escolhido manualmente).
  useEffect(() => {
    if (type !== "tarefa") return;
    if (applicationKeyTarefaTouched) return;
    if (!projetoId) {
      setApplicationKeyTarefa(null);
      return;
    }
    const projeto = projetos.find((p) => p.id === projetoId);
    setApplicationKeyTarefa(projeto?.applicationKey ?? null);
  }, [projetoId, projetos, type, applicationKeyTarefaTouched]);

  // Paste handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image")) {
          const file = item.getAsFile();
          if (file) readAttachment(file);
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [open]);

  function readAttachment(file: File) {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo: 50MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name || "arquivo",
          url: e.target?.result as string,
        },
      ]);
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(readAttachment);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(readAttachment);
    e.target.value = "";
  }

  function resetForm() {
    setTitulo("");
    setDescricao("");
    setAttachments([]);
    setExtraOpen(false);
    setCategoriaChamado("");
    setTipoChamado("");
    setPrioridadeChamado("media");
    setApplicationKeyChamado(null);
    setApplicationKeyTarefa(null);
    setApplicationKeyTarefaTouched(false);
    setApplicationKeyProjeto(null);
    setSubmitAttempted(false);
    setStatusTarefa("a-fazer");
    setProjetoId("");
    setPrioridade("");
    setResponsavelId("");
    setDataEntrega("");
    setSprint("");
    setEstimativa("");
    setEtapa("");
    setStatusProjeto("backlog");
    setPrioridadeProjeto("");
    setResponsavelProjeto("");
    setDataInicio("");
    setDataFim("");
    setCategoriaProjeto("");
    setBudget("");
    setVisibilityProjeto("private");
    setMemberIdsProjeto([]);
    setMemberSearchProjeto("");
  }

  async function handleSubmit() {
    setSubmitAttempted(true);
    if (!titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    if (type === "chamado" && !categoriaChamado) {
      toast({ title: "Selecione a categoria", variant: "destructive" });
      return;
    }
    if (type === "chamado" && !tipoChamado) {
      toast({ title: "Selecione o tipo", variant: "destructive" });
      return;
    }
    if (type === "chamado" && !applicationKeyChamado) {
      toast({ title: "Selecione a aplicação", variant: "destructive" });
      return;
    }
    if (type === "projeto" && !applicationKeyProjeto) {
      toast({ title: "Selecione a aplicação", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let response: Response;

      if (type === "chamado") {
        response = await fetchWithAuth("/api/workspace/chamados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: titulo.trim(),
            descricao,
            categoria: categoriaChamado,
            tipo: tipoChamado,
            prioridade: prioridadeChamado || undefined,
            applicationKey: applicationKeyChamado,
            attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
          }),
        });
      } else if (type === "tarefa") {
        response = await fetchWithAuth("/api/workspace/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: titulo.trim(),
            descricao,
            projetoId: projetoId || undefined,
            prioridade: prioridade || undefined,
            responsavelId: responsavelId || undefined,
            dataEntrega: dataEntrega || undefined,
            sprint: sprint || undefined,
            // Se usuário tocou no campo, manda explicitamente; senão deixa o backend herdar do projeto
            ...(applicationKeyTarefaTouched ? { applicationKey: applicationKeyTarefa } : {}),
          }),
        });
      } else {
        response = await fetchWithAuth("/api/workspace/projetos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: titulo.trim(),
            descricao,
            status: statusProjeto || undefined,
            prioridade: prioridadeProjeto || undefined,
            responsavelId: responsavelProjeto || undefined,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined,
            categoria: categoriaProjeto || undefined,
            visibility: visibilityProjeto,
            applicationKey: applicationKeyProjeto,
            memberIds: visibilityProjeto === "shared" ? memberIdsProjeto : [],
          }),
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao criar item");
      }

      const created = await response.json();
      const codigo: string = created.codigo || "";
      let toastTitle = "";
      if (type === "chamado") {
        toastTitle = codigo ? `Chamado ${codigo} criado com sucesso` : "Chamado criado com sucesso";
      } else if (type === "tarefa") {
        const projetoCtx = created.contexto && created.contexto !== "Sem projeto" ? ` no projeto ${created.contexto}` : "";
        toastTitle = `Atividade criada${projetoCtx}`;
      } else {
        toastTitle = codigo ? `Projeto ${codigo} criado com sucesso` : "Projeto criado com sucesso";
      }
      toast({ title: toastTitle });

      if (criarMais) {
        resetForm();
        onSuccess();
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao criar", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = type === "chamado" ? "Criar Chamado" : type === "tarefa" ? "Criar Atividade" : "Criar Projeto";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden"
        style={{
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        // hide the default X button from shadcn
        hideClose
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Type Bar */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(["chamado", "tarefa", "projeto"] as ItemType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setTitulo("");
                setDescricao("");
                setAttachments([]);
              }}
              className="px-3 py-1 text-xs font-medium rounded border transition-all"
              style={
                t === type
                  ? {
                      background: "rgba(0,200,83,0.08)",
                      borderColor: "rgba(0,200,83,0.28)",
                      color: "#5B62EC",
                    }
                  : {
                      background: "transparent",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.3)",
                    }
              }
            >
              {t === "chamado" ? "Chamado" : t === "tarefa" ? "Atividade" : "Projeto"}
            </button>
          ))}
        </div>

        {/* Header Row */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "#5B62EC",
                border: "1px solid rgba(59,66,222,0.3)",
                padding: "1px 6px",
                borderRadius: "4px",
              }}
            >
              {TYPE_CONFIG[type].prefix}
            </span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
              {TYPE_CONFIG[type].label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {/* Title */}
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={TYPE_CONFIG[type].titlePlaceholder}
            className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-medium shadow-none"
            style={{ fontSize: "19px", color: "rgba(255,255,255,0.9)" }}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          />

          {/* Description */}
          <RichTextarea
            value={descricao}
            onChange={setDescricao}
            placeholder={DESC_PLACEHOLDER[type]}
            hideAttachments
            data-testid="novo-item-descricao"
          />

          {/* AI hint — chamado only */}
          {type === "chamado" && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2 rounded"
              style={{
                background: "rgba(0,200,83,0.05)",
                border: "1px solid rgba(59,66,222,0.15)",
                color: "#5B62EC",
              }}
            >
              <span>⏱</span>
              <span>Agente de diagnóstico lerá esta descrição automaticamente</span>
            </div>
          )}

          {/* Chips — chamado */}
          {type === "chamado" && (
            <div className="flex items-center gap-2 flex-wrap">
              <ChipSelect
                value={categoriaChamado}
                onValueChange={setCategoriaChamado}
                placeholder="Categoria *"
                options={[
                  { value: "ti-sistemas", label: "TI/Sistemas" },
                  { value: "comercial", label: "Comercial" },
                  { value: "logistica", label: "Logística" },
                  { value: "financeiro", label: "Financeiro" },
                  { value: "operacoes", label: "Operações" },
                  { value: "rh", label: "RH" },
                ]}
              />
              <ChipSelect
                value={tipoChamado}
                onValueChange={setTipoChamado}
                placeholder="Tipo *"
                options={[
                  { value: "bug", label: "Bug" },
                  { value: "melhoria", label: "Melhoria" },
                  { value: "processo", label: "Processo" },
                  { value: "negocio", label: "Negócio" },
                ]}
              />
              <ChipSelect
                value={prioridadeChamado}
                onValueChange={setPrioridadeChamado}
                placeholder="Prioridade"
                options={PRIORIDADE_OPTIONS}
              />
              <div className="min-w-[180px]">
                <ApplicationSelect
                  value={applicationKeyChamado}
                  onChange={setApplicationKeyChamado}
                  required
                  size="sm"
                  placeholder="Aplicação *"
                  hasError={submitAttempted && !applicationKeyChamado}
                />
              </div>
            </div>
          )}

          {/* Attachment row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
            >
              <Paperclip className="h-3 w-3" />
              Anexar
            </button>

            {attachments.map((att, idx) => (
              <div key={idx} className="relative group" title={att.name}>
                {att.url.startsWith("data:image/") ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-11 h-11 object-cover rounded"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded flex items-center justify-center"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
                  >
                    <Paperclip className="h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                )}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(220,50,50,0.9)", color: "white", fontSize: "10px", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}

            <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              Ctrl+V ou arraste arquivos
            </span>
          </div>

          {/* Chips — tarefa */}
          {type === "tarefa" && (
            <div className="flex items-center gap-2 flex-wrap">
              <ChipSelect
                value={statusTarefa}
                onValueChange={setStatusTarefa}
                options={[
                  { value: "a-fazer", label: "A Fazer" },
                  { value: "em-andamento", label: "Em Andamento" },
                  { value: "concluido", label: "Concluído" },
                ]}
              />
              {/* Projeto chip — green style */}
              <Select
                value={projetoId || "none"}
                onValueChange={(v) => setProjetoId(v === "none" ? "" : v)}
              >
                <SelectTrigger
                  className="h-7 px-3 text-xs rounded-full w-auto min-w-[100px] border focus:ring-0 focus:ring-offset-0"
                  style={{
                    background: "rgba(0,200,83,0.06)",
                    borderColor: "rgba(0,200,83,0.25)",
                    color: "#5B62EC",
                  }}
                >
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Sem projeto
                  </SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ChipSelect
                value={prioridade}
                onValueChange={setPrioridade}
                placeholder="Prioridade"
                options={PRIORIDADE_OPTIONS}
              />
              <div style={{ minWidth: 160 }}>
                <UserSelect
                  value={responsavelId}
                  onValueChange={setResponsavelId}
                />
              </div>
              <ChipDate value={dataEntrega} onChange={setDataEntrega} placeholder="Data Entrega" />
              <input
                type="text"
                value={sprint}
                onChange={(e) => setSprint(e.target.value)}
                placeholder="Sprint"
                className="h-7 px-3 text-xs rounded-full bg-transparent outline-none"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: sprint ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                  width: "70px",
                }}
              />
              <div className="min-w-[180px]">
                <ApplicationSelect
                  value={applicationKeyTarefa}
                  onChange={(v) => {
                    setApplicationKeyTarefa(v);
                    setApplicationKeyTarefaTouched(true);
                  }}
                  size="sm"
                  placeholder="Aplicação"
                />
              </div>
            </div>
          )}

          {/* Chips — projeto */}
          {type === "projeto" && (
            <div className="flex items-center gap-2 flex-wrap">
              <ChipSelect
                value={statusProjeto}
                onValueChange={setStatusProjeto}
                options={[
                  { value: "backlog", label: "Backlog" },
                  { value: "ativo", label: "Ativo" },
                  { value: "pausado", label: "Pausado" },
                  { value: "concluido", label: "Concluído" },
                ]}
              />
              <ChipSelect
                value={prioridadeProjeto}
                onValueChange={setPrioridadeProjeto}
                placeholder="Prioridade"
                options={PRIORIDADE_OPTIONS}
              />
              <div style={{ minWidth: 160 }}>
                <UserSelect
                  value={responsavelProjeto}
                  onValueChange={setResponsavelProjeto}
                />
              </div>
              <ChipDate value={dataInicio} onChange={setDataInicio} placeholder="Data Início" />
              <ChipDate value={dataFim} onChange={setDataFim} placeholder="Data Fim" />
              <input
                type="text"
                value={categoriaProjeto}
                onChange={(e) => setCategoriaProjeto(e.target.value)}
                placeholder="Categoria"
                className="h-7 px-3 text-xs rounded-full bg-transparent outline-none"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: categoriaProjeto ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                  width: "90px",
                }}
              />
              <div
                className="flex items-center h-7 px-2 rounded-full text-xs"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <span
                  className="mr-1 whitespace-nowrap"
                  style={{ color: budget ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)", fontSize: "10px" }}
                >
                  R$
                </span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min="0"
                  step="100"
                  placeholder="Budget"
                  className="bg-transparent outline-none text-xs"
                  style={{ color: "rgba(255,255,255,0.7)", width: "70px" }}
                />
              </div>
              <div className="min-w-[180px]">
                <ApplicationSelect
                  value={applicationKeyProjeto}
                  onChange={setApplicationKeyProjeto}
                  required
                  size="sm"
                  placeholder="Aplicação *"
                  hasError={submitAttempted && !applicationKeyProjeto}
                />
              </div>
              {/* Visibilidade — 3 botões compactos chip-style */}
              <div
                className="flex items-center h-7 rounded-full overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                title={
                  visibilityProjeto === "private"
                    ? "Apenas o responsável pode ver este projeto."
                    : visibilityProjeto === "shared"
                      ? "O responsável e os membros selecionados podem ver este projeto."
                      : "Todos os usuários podem ver este projeto."
                }
              >
                {(["private", "shared", "public"] as const).map((v) => {
                  const isActive = visibilityProjeto === v;
                  const Icon = v === "private" ? UserIcon : v === "shared" ? Users : Globe;
                  const label = v === "private" ? "Privada" : v === "shared" ? "Comp." : "Pública";
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibilityProjeto(v)}
                      className="flex items-center gap-1 px-2 h-full text-xs transition-colors"
                      style={{
                        background: isActive ? "rgba(0,200,83,0.08)" : "transparent",
                        color: isActive ? "#5B62EC" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible — tarefa (Estimativa/Etapa) e projeto (Membros quando shared).
              Categoria, Budget e Visibilidade do projeto agora vivem na linha principal
              de chips para manter consistência visual com tabs Chamado/Tarefa. */}
          {type === "tarefa" && (
            <div>
              <button
                onClick={() => setExtraOpen((v) => !v)}
                className="flex items-center gap-2 text-xs w-full py-2 transition-colors hover:opacity-70"
                style={{
                  color: "rgba(255,255,255,0.3)",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {extraOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                campos adicionais
              </button>
              {extraOpen && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label
                      className="text-xs mb-1 block"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      Estimativa (h)
                    </label>
                    <input
                      type="number"
                      value={estimativa}
                      onChange={(e) => setEstimativa(e.target.value)}
                      min="0"
                      step="0.5"
                      className="w-full h-8 px-3 text-sm rounded outline-none"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs mb-1 block"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      Etapa
                    </label>
                    <input
                      type="text"
                      value={etapa}
                      onChange={(e) => setEtapa(e.target.value)}
                      placeholder="Ex: Design, Dev, QA..."
                      className="w-full h-8 px-3 text-sm rounded outline-none"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Membros — só aparece quando projeto+shared. Sem collapsible: a seleção
              de membros precisa estar visível assim que o usuário escolhe "Comp.". */}
          {type === "projeto" && visibilityProjeto === "shared" && (
            <div className="pt-3 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <label className="text-xs mb-2 block" style={{ color: "rgba(255,255,255,0.35)" }}>
                Membros do projeto
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário para adicionar..."
                    value={memberSearchProjeto}
                    onChange={(e) => setMemberSearchProjeto(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                {memberSearchProjeto && (
                  <div
                    className="rounded-md max-h-32 overflow-y-auto"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {users
                      .filter((u) => u.status === "active")
                      .filter((u) => !memberIdsProjeto.includes(u.id))
                      .filter((u) =>
                        u.name.toLowerCase().includes(memberSearchProjeto.toLowerCase()),
                      )
                      .slice(0, 5)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover-elevate"
                          onClick={() => {
                            setMemberIdsProjeto((prev) => [...prev, u.id]);
                            setMemberSearchProjeto("");
                          }}
                        >
                          {u.name}
                        </button>
                      ))}
                  </div>
                )}
                {memberIdsProjeto.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {memberIdsProjeto.map((uid) => {
                      const u = users.find((x) => x.id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="gap-1">
                          {u?.name || uid}
                          <button
                            type="button"
                            onClick={() => setMemberIdsProjeto((prev) => prev.filter((id) => id !== uid))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <label
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <input
              type="checkbox"
              checked={criarMais}
              onChange={(e) => setCriarMais(e.target.checked)}
              className="rounded"
            />
            Criar mais
          </label>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="sm"
            className="bg-[#3B42DE] hover:bg-[#3B42DE]/90 text-white"
          >
            {submitting ? "Criando..." : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
