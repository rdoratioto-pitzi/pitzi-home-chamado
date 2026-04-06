import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RichTextarea } from "@/components/rich-textarea";
import { RichContent } from "@/components/rich-content";
import { UserSelect } from "@/components/ui/user-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  Calendar,
  MessageSquare,
  Edit2,
  X,
  Loader2,
  Save,
  FolderKanban,
  Paperclip,
  Maximize2,
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FileArchive,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Anexo {
  name: string;
  url: string;
}

interface TarefaDetail {
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
  dataInicio: string | null;
  progresso: number;
  criadoEm: string | null;
  anexos: Anexo[];
  projeto: {
    id: string;
    codigo: string;
    nome: string;
    cor: string;
  } | null;
}

interface Comentario {
  id: string;
  texto: string;
  autorId: string;
  autorNome: string;
  autorInitials: string;
  criadoEm: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  "a-fazer": "A Fazer",
  "em-andamento": "Em Andamento",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

const statusColors: Record<string, string> = {
  "a-fazer": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "em-andamento": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  concluido: "bg-green-500/10 text-green-600 dark:text-green-400",
  bloqueado: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const formatDateTime = (date: string | null): string => {
  if (!date) return "—";
  const d = new Date(date);
  return (
    d.toLocaleDateString("pt-BR") +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const formatDate = (date: string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
};

function isImageAnexo(anexo: Anexo): boolean {
  if (anexo.url.startsWith("data:image/")) return true;
  const ext = anexo.name.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function TarefaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tarefa, setTarefa] = useState<TarefaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPrioridade, setEditPrioridade] = useState("");
  const [editResponsavelId, setEditResponsavelId] = useState("");
  const [editDataEntrega, setEditDataEntrega] = useState("");
  const [editProgresso, setEditProgresso] = useState(0);

  // Comments
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch tarefa
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchWithAuth(`/api/workspace/tarefas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Tarefa não encontrada");
        return r.json();
      })
      .then((data: TarefaDetail) => {
        setTarefa(data);
        populateEditState(data);
      })
      .catch(() => {
        setTarefa(null);
        toast({ title: "Erro ao carregar tarefa", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch comments
  useEffect(() => {
    if (!id) return;
    fetchWithAuth(`/api/workspace/tarefas/${id}/comentarios`)
      .then((r) => r.json())
      .then((data: { comentarios: Comentario[] }) =>
        setComentarios(data.comentarios || []),
      )
      .catch(() => setComentarios([]));
  }, [id]);

  function populateEditState(t: TarefaDetail) {
    setEditTitulo(t.titulo);
    setEditDescricao(t.descricao || "");
    setEditStatus(t.status);
    setEditPrioridade(t.prioridade);
    setEditResponsavelId(t.responsavelId || "");
    setEditDataEntrega(
      t.dataEntrega ? t.dataEntrega.split("T")[0] : "",
    );
    setEditProgresso(t.progresso);
  }

  function startEditing() {
    if (tarefa) populateEditState(tarefa);
    setIsEditing(true);
  }

  async function handleSave() {
    if (!tarefa) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/workspace/tarefas/${tarefa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: editTitulo,
          descricao: editDescricao,
          status: editStatus,
          prioridade: editPrioridade,
          responsavelId: editResponsavelId || undefined,
          dataEntrega: editDataEntrega || undefined,
          progresso: editProgresso,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const updated: TarefaDetail = await res.json();
      // Re-fetch full detail to get projeto info
      const fullRes = await fetchWithAuth(`/api/workspace/tarefas/${tarefa.id}`);
      if (fullRes.ok) {
        const full: TarefaDetail = await fullRes.json();
        setTarefa(full);
        populateEditState(full);
      } else {
        setTarefa({ ...tarefa, ...updated });
      }
      setIsEditing(false);
      toast({ title: "Atividade atualizada com sucesso" });
    } catch {
      toast({ title: "Erro ao atualizar atividade", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEnviarComentario() {
    if (!id || !novoComentario.trim()) return;
    setEnviando(true);
    try {
      const r = await fetchWithAuth(`/api/workspace/tarefas/${id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: novoComentario.trim() }),
      });
      if (!r.ok) throw new Error("Erro ao comentar");
      const novo: Comentario = await r.json();
      setComentarios((prev) => [...prev, novo]);
      setNovoComentario("");
    } catch {
      toast({ title: "Erro ao adicionar comentário", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/workspace/projetos")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ─── Not found ──────────────────────────────────────────────────────────────

  if (!tarefa) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/workspace/projetos")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Atividade não encontrada</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              A atividade solicitada não foi encontrada.
            </p>
            <Button
              className="mt-4"
              onClick={() => setLocation("/workspace/projetos")}
            >
              Voltar para Projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/workspace/projetos")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tarefa.codigo}</h1>
            <Badge className={statusColors[tarefa.status] || "bg-muted"}>
              {statusLabels[tarefa.status] || tarefa.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Criado em {formatDateTime(tarefa.criadoEm)}
          </p>
        </div>
        <Button
          variant={isEditing ? "default" : "outline"}
          onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Informações da Atividade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Título</label>
                    <Input
                      value={editTitulo}
                      onChange={(e) => setEditTitulo(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={editStatus}
                        onValueChange={setEditStatus}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a-fazer">A Fazer</SelectItem>
                          <SelectItem value="em-andamento">
                            Em Andamento
                          </SelectItem>
                          <SelectItem value="bloqueado">Bloqueado</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Prioridade</label>
                      <Select
                        value={editPrioridade}
                        onValueChange={setEditPrioridade}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Responsável</label>
                      <div className="mt-1">
                        <UserSelect
                          value={editResponsavelId}
                          onValueChange={setEditResponsavelId}
                          placeholder="Selecione..."
                          emptyMessage="Nenhum usuário encontrado"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Data de Entrega
                      </label>
                      <Input
                        type="date"
                        value={editDataEntrega}
                        onChange={(e) => setEditDataEntrega(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Progresso ({editProgresso}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={editProgresso}
                      onChange={(e) =>
                        setEditProgresso(Number(e.target.value))
                      }
                      className="w-full mt-2 accent-[#00c853]"
                    />
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <label className="text-sm font-medium">Descrição</label>
                    <RichTextarea
                      value={editDescricao}
                      onChange={setEditDescricao}
                      className="min-h-[200px]"
                    />
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !editTitulo.trim()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-2">
                    {tarefa.titulo}
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge
                      className={
                        statusColors[tarefa.status] || "bg-muted"
                      }
                    >
                      {statusLabels[tarefa.status] || tarefa.status}
                    </Badge>
                    <Badge variant="outline">
                      {priorityLabels[tarefa.prioridade] ||
                        tarefa.prioridade}
                    </Badge>
                    {tarefa.dataEntrega && (
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(tarefa.dataEntrega)}
                      </Badge>
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {tarefa.descricao ? (
                      <RichContent content={tarefa.descricao} />
                    ) : (
                      <p className="text-muted-foreground">Sem descrição</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Anexos */}
          {tarefa.anexos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Anexos ({tarefa.anexos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {tarefa.anexos.map((anexo, idx) =>
                    isImageAnexo(anexo) ? (
                      <Dialog key={idx}>
                        <DialogTrigger asChild>
                          <div className="rounded-lg overflow-hidden border hover:border-primary/50 transition-colors cursor-pointer relative group aspect-video bg-muted/50">
                            <img
                              src={anexo.url}
                              alt={anexo.name || `Anexo ${idx + 1}`}
                              className="w-full h-full object-cover"
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
                      <a
                        key={idx}
                        href={anexo.url}
                        download={anexo.name}
                        className="flex items-center gap-2 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                      >
                        {(() => {
                          const { Icon, color } = getFileIcon(anexo.name);
                          return <Icon className="h-5 w-5 flex-shrink-0" style={{ color }} />;
                        })()}
                        <span className="text-sm truncate flex-1">{anexo.name}</span>
                        <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </a>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comentários ({comentarios.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comentarios.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhum comentário ainda.
                </p>
              ) : (
                comentarios.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {c.autorInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {c.autorNome}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(c.criadoEm)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.texto}</p>
                    </div>
                  </div>
                ))
              )}

              <Separator />

              <div className="space-y-3">
                <Textarea
                  ref={textareaRef}
                  placeholder="Adicione um comentário..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleEnviarComentario();
                    }
                  }}
                />
                <Button
                  onClick={handleEnviarComentario}
                  disabled={!novoComentario.trim() || enviando}
                >
                  {enviando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar Comentário
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  className={statusColors[tarefa.status] || "bg-muted"}
                >
                  {statusLabels[tarefa.status] || tarefa.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Progresso
                </span>
                <span className="text-sm font-medium">
                  {tarefa.progresso}%
                </span>
              </div>
              <Progress value={tarefa.progresso} className="h-1.5" />

              <Separator />

              <div className="space-y-3">
                {tarefa.projeto && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Projeto
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <FolderKanban
                        className="h-4 w-4"
                        style={{ color: tarefa.projeto.cor }}
                      />
                      <span className="text-sm font-medium">
                        {tarefa.projeto.nome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tarefa.projeto.codigo}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-xs text-muted-foreground">
                    Responsável
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {tarefa.responsavelInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{tarefa.responsavel}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">
                    Prioridade
                  </span>
                  <p className="text-sm mt-1">
                    {priorityLabels[tarefa.prioridade] || tarefa.prioridade}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">
                    Criado em
                  </span>
                  <p className="text-sm mt-1">
                    {formatDateTime(tarefa.criadoEm)}
                  </p>
                </div>

                {tarefa.dataEntrega && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Data de Entrega
                    </span>
                    <p className="text-sm mt-1">
                      {formatDate(tarefa.dataEntrega)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
