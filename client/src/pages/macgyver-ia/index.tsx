import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/permissions";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Loader2,
  Bot,
  User,
  Clock,
  ArrowLeft,
  Sparkles,
  Zap,
  Search,
  X,
  ChevronDown,
  Copy,
  Check,
  Download,
  TicketCheck,
  FolderKanban,
  ListTodo,
  Target,
  TrendingUp,
  FileText,
  BarChart3,
  Lightbulb,
  Code,
  BrainCircuit,
  FileDown,
  Paperclip,
  Image as ImageIcon,
  PanelRightOpen,
  PanelRightClose,
  Hash,
  Command,
  Bookmark,
  Upload,
  MoreHorizontal,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { AiConversation, AiMessage, AiSpace } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import MacGyverIcon from "@/components/Chat/MacGyverIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
  };
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: typeof TicketCheck;
  prompt: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/tickets",
    label: "Tickets",
    description: "Resumo completo dos tickets (abertos, SLA, prioridades)",
    icon: TicketCheck,
    prompt: "Faca uma analise completa dos tickets do sistema. Inclua: total por status, tickets criticos/urgentes, taxa de resolucao, tempo medio de resposta estimado, e identifique gargalos ou padroes. Apresente em tabelas quando possivel."
  },
  {
    command: "/projetos",
    label: "Projetos",
    description: "Status e progresso dos projetos",
    icon: FolderKanban,
    prompt: "Analise o status de todos os projetos. Inclua: projetos ativos, progresso geral, prazos proximos, e identifique riscos ou atrasos. Sugira acoes para otimizar a entrega."
  },
  {
    command: "/tarefas",
    label: "Tarefas",
    description: "Tarefas pendentes e produtividade",
    icon: ListTodo,
    prompt: "Faca uma analise das tarefas do sistema. Inclua: tarefas pendentes vs concluidas, distribuicao por area, tarefas de alta prioridade, e calcule a taxa de produtividade. Sugira como priorizar o trabalho."
  },
  {
    command: "/metas",
    label: "Metas e OKRs",
    description: "Acompanhamento de metas e objetivos",
    icon: Target,
    prompt: "Apresente um painel completo de metas e OKRs. Inclua: percentual de atingimento por meta, metas em risco, OKRs pendentes, e faca uma projecao de atingimento ate o fim do periodo. Use tabelas e indicadores visuais."
  },
  {
    command: "/pricing",
    label: "Pricing",
    description: "Analise de precos e tendencias",
    icon: TrendingUp,
    prompt: "Analise os dados de pricing dos dispositivos monitorados. Inclua: dispositivos com alertas ativos, tendencias de preco, comparativos entre modelos, e identifique oportunidades de compra ou venda."
  },
  {
    command: "/relatorio",
    label: "Relatorio Geral",
    description: "Relatorio consolidado de todos os modulos",
    icon: BarChart3,
    prompt: "Gere um relatorio executivo consolidado da plataforma Renov Home. Inclua: KPIs principais de cada modulo (tickets, projetos, tarefas, metas, OKRs, pricing, logistica), tendencias, pontos de atencao e recomendacoes estrategicas. Formate com secoes claras, tabelas e destaques."
  },
  {
    command: "/codigo",
    label: "Gerar Codigo",
    description: "Solicite geracao de codigo ou scripts",
    icon: Code,
    prompt: "Estou precisando de ajuda com codigo. Me diga qual tipo de codigo voce precisa (SQL, JavaScript, Python, API call, etc.) e eu vou gerar para voce com explicacoes detalhadas."
  },
  {
    command: "/prompt",
    label: "Criar Prompt",
    description: "Crie prompts otimizados para outras IAs",
    icon: BrainCircuit,
    prompt: "Me ajude a criar um prompt otimizado. Descreva o que voce precisa que uma IA faca e eu vou criar um prompt estruturado e eficiente, usando tecnicas como chain-of-thought, few-shot examples e instrucoes claras."
  },
];

const QUICK_PROMPTS = [
  {
    label: "Analisar produtividade",
    icon: BarChart3,
    prompt: "Analise a produtividade geral da equipe com base nos dados disponiveis: tickets resolvidos, tarefas concluidas, metas atingidas. Identifique pontos fortes e areas de melhoria. Apresente em formato de dashboard textual."
  },
  {
    label: "Relatorio semanal",
    icon: FileText,
    prompt: "Gere um relatorio semanal executivo com os principais eventos e metricas da plataforma. Inclua destaques positivos, pontos de atencao, e acoes recomendadas para a proxima semana."
  },
  {
    label: "Sugerir melhorias",
    icon: Lightbulb,
    prompt: "Com base nos dados atuais da plataforma, identifique 5 oportunidades de melhoria nos processos internos. Para cada uma, explique o problema identificado, o impacto estimado e a acao recomendada."
  },
  {
    label: "Tickets criticos",
    icon: TicketCheck,
    prompt: "Liste e analise todos os tickets com prioridade critica ou urgente. Para cada um, indique ha quanto tempo esta aberto, quem e o responsavel, e sugira acoes para resolucao rapida."
  },
];

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atras`;
  return d.toLocaleDateString("pt-BR");
}

function isFreeModel(model: OpenRouterModel): boolean {
  return (
    model.id.endsWith(":free") ||
    (parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0)
  );
}

function getProviderName(modelId: string): string {
  const provider = modelId.split("/")[0];
  const names: Record<string, string> = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "meta-llama": "Meta",
    "deepseek": "DeepSeek",
    "qwen": "Qwen",
    "mistralai": "Mistral",
    "cohere": "Cohere",
    "microsoft": "Microsoft",
    "nvidia": "NVIDIA",
    "x-ai": "xAI",
    "perplexity": "Perplexity",
    "moonshotai": "Moonshot",
    "openrouter": "OpenRouter",
    "stepfun": "StepFun",
    "arcee-ai": "Arcee AI",
    "z-ai": "Zhipu AI",
    "minimax": "MiniMax",
    "writer": "Writer",
    "liquid": "LiquidAI",
  };
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatPrice(price: string): string {
  const val = parseFloat(price);
  if (val === 0) return "Gratis";
  const perMillion = val * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  if (perMillion < 1) return `$${perMillion.toFixed(2)}/M`;
  return `$${perMillion.toFixed(0)}/M`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover-elevate"
      data-testid="button-copy-code"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-border my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{language || "code"}</span>
        <CopyButton text={children} />
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
          borderRadius: 0,
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) {
              return <CodeBlock language={match[1]}>{codeStr}</CodeBlock>;
            }
            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SlashCommandMenu({
  commands,
  filter,
  onSelect,
  selectedIndex,
}: {
  commands: SlashCommand[];
  filter: string;
  onSelect: (cmd: SlashCommand) => void;
  selectedIndex: number;
}) {
  const filtered = commands.filter(c =>
    c.command.includes(filter.toLowerCase()) ||
    c.label.toLowerCase().includes(filter.toLowerCase().replace("/", ""))
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50" data-testid="slash-command-menu">
      <div className="p-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Comandos Rapidos</span>
      </div>
      <div className="max-h-[300px] overflow-auto p-1">
        {filtered.map((cmd, idx) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.command}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover-elevate",
                idx === selectedIndex ? "bg-primary/10" : ""
              )}
              onClick={() => onSelect(cmd)}
              data-testid={`slash-command-${cmd.command.slice(1)}`}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">{cmd.command}</span>
                  <span className="font-medium text-sm">{cmd.label}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModelPickerPopup({
  models,
  isLoading,
  onSelect,
  onClose,
  selectedModel,
}: {
  models: OpenRouterModel[];
  isLoading: boolean;
  onSelect: (modelId: string) => void;
  onClose: () => void;
  selectedModel: string;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "free" | "premium">("free");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    let list = models;
    if (tab === "free") list = list.filter(isFreeModel);
    if (tab === "premium") list = list.filter(m => !isFreeModel(m));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        getProviderName(m.id).toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      // Relevance score: DeepSeek > Gemini > Claude > GPT > Llama > Qwen
      const getRelevance = (m: OpenRouterModel) => {
        const id = m.id.toLowerCase();
        const name = m.name.toLowerCase();

        // Prioritize specific high-value free/open models
        if (id.includes("deepseek")) return 20;
        if (id.includes("gemini")) return 18;
        if (id.includes("claude")) return 16;
        if (id.includes("gpt")) return 14;
        if (id.includes("llama")) return 12;
        if (id.includes("qwen")) return 10;
        if (id.includes("mistral")) return 8;

        return 0;
      };

      const relA = getRelevance(a);
      const relB = getRelevance(b);

      if (relA !== relB) return relB - relA;

      // Secondary sort: free models first if same relevance
      const freeA = isFreeModel(a) ? 1 : 0;
      const freeB = isFreeModel(b) ? 1 : 0;
      if (freeA !== freeB) return freeB - freeA;

      return a.name.localeCompare(b.name);
    });

    return sorted.slice(0, 50);
  }, [models, search, tab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Selecionar Modelo</h3>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-model-picker">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar modelos... (ex: claude, gpt, gemini)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-models"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "free", "premium"] as const).map(t => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                data-testid={`button-tab-${t}`}
              >
                {t === "all" ? "Todos" : t === "free" ? "Gratuitos" : "Premium"}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando modelos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum modelo encontrado
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(model => {
                const free = isFreeModel(model);
                const isSelected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3",
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/70 border border-transparent"
                    )}
                    onClick={() => {
                      onSelect(model.id);
                      onClose();
                    }}
                    data-testid={`model-option-${model.id}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {free ? (
                        <Zap className="h-4 w-4 text-green-500" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{model.name}</span>
                        <span className="text-xs text-muted-foreground">({getProviderName(model.id)})</span>
                        {free && (
                          <span className="text-[10px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                            FREE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>{(model.context_length / 1000).toFixed(0)}K ctx</span>
                        <span>In: {formatPrice(model.pricing.prompt)}</span>
                        <span>Out: {formatPrice(model.pricing.completion)}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary mt-1 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {models.length} modelos disponiveis via OpenRouter
          </p>
        </div>
      </div>
    </div>
  );
}

function exportConversationMarkdown(messages: AiMessage[], title: string) {
  let md = `# ${title || "Conversa Macgyver IA"}\n\n`;
  md += `*Exportado em ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR")}*\n\n---\n\n`;

  for (const msg of messages) {
    if (msg.role === "user") {
      md += `## Usuario\n\n${msg.content}\n\n`;
    } else {
      md += `## Macgyver IA\n\n${msg.content}\n\n`;
    }
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `macgyver-ia-${(title || "conversa").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function RightSidebar({
  isOpen,
  onClose,
  conversations,
  conversationsLoading,
  spaces,
  userId,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onQuickPrompt,
  onSlashCommand,
  queryClient,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversations: AiConversation[];
  conversationsLoading: boolean;
  spaces: AiSpace[];
  userId: string;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onQuickPrompt: (prompt: string) => void;
  onSlashCommand: (cmd: SlashCommand) => void;
  queryClient: any;
}) {
  const [activeTab, setActiveTab] = useState<"historico" | "atalhos" | "comandos" | "espacos">("historico");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [showNewSpace, setShowNewSpace] = useState(false);

  const tabs = [
    { id: "historico" as const, label: "Historico", icon: Clock },
    { id: "atalhos" as const, label: "Atalhos", icon: Bookmark },
    { id: "comandos" as const, label: "Comandos", icon: Command },
    { id: "espacos" as const, label: "Espacos", icon: Hash },
  ];

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    try {
      const res = await apiRequest("POST", "/api/ai/spaces", { userId, name: newSpaceName.trim() });
      await queryClient.invalidateQueries({ queryKey: ["/api/ai/spaces", userId] });
      setNewSpaceName("");
      setShowNewSpace(false);
    } catch (error) {
      console.error("Failed to create space:", error);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    try {
      await apiRequest("DELETE", `/api/ai/spaces/${spaceId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/ai/spaces", userId] });
    } catch (error) {
      console.error("Failed to delete space:", error);
    }
  };

  const handleAddToSpace = async (spaceId: string) => {
    if (!selectedConversationId) return;
    try {
      await apiRequest("POST", `/api/ai/spaces/${spaceId}/conversations`, { conversationId: selectedConversationId });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/spaces", userId] });
    } catch (error) {
      console.error("Failed to add to space:", error);
    }
  };

  return (
    <div className={cn(
      "border-l bg-background transition-all duration-200 shrink-0 overflow-hidden flex flex-col",
      isOpen ? "w-80" : "w-0 border-l-0"
    )}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-3 border-b space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Painel de Auxílio</h3>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "justify-start gap-3 h-10 w-full px-3",
                    !isActive && "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`sidebar-tab-${tab.id}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left font-medium">{tab.label}</span>
                  {isActive && <ChevronDown className="h-4 w-4 opacity-50" />}
                </Button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            <div className="mb-4 flex items-center gap-2 px-1">
              <div className="h-1 w-1 rounded-full bg-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {tabs.find(t => t.id === activeTab)?.label}
              </h4>
            </div>
            {activeTab === "historico" && (
              <>
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 px-4 border border-dashed rounded-lg">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground">Nenhuma conversa iniciada</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map(conv => {
                      const isSelected = conv.id === selectedConversationId;
                      return (
                        <div key={conv.id} className="group relative">
                          <button
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-0.5",
                              isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"
                            )}
                            onClick={() => onSelectConversation(conv.id)}
                            data-testid={`conversation-item-${conv.id}`}
                          >
                            <span className="text-sm font-medium truncate pr-6">{conv.title || "Nova Conversa"}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(conv.createdAt)}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => onDeleteConversation(conv.id, e)}
                            data-testid={`button-delete-conversation-${conv.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === "atalhos" && (
              <div className="grid grid-cols-1 gap-2">
                {QUICK_PROMPTS.map(qp => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={qp.label}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 text-left hover-elevate transition-all"
                      onClick={() => onQuickPrompt(qp.prompt)}
                      data-testid={`quick-prompt-${qp.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium leading-tight">{qp.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "comandos" && (
              <div className="grid grid-cols-1 gap-2">
                {SLASH_COMMANDS.map(cmd => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.command}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 text-left hover-elevate transition-all"
                      onClick={() => onSlashCommand(cmd)}
                      data-testid={`command-item-${cmd.command.slice(1)}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-primary font-bold">{cmd.command}</span>
                          <span className="text-sm font-medium">{cmd.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "espacos" && (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-9 border-dashed"
                  onClick={() => setShowNewSpace(true)}
                  data-testid="button-create-space"
                >
                  <Plus className="h-4 w-4" />
                  Nova Pasta de IA
                </Button>

                {showNewSpace && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <Input
                      placeholder="Nome da pasta..."
                      value={newSpaceName}
                      onChange={e => setNewSpaceName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8" onClick={handleCreateSpace}>Criar</Button>
                      <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => setShowNewSpace(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {spaces.map(space => (
                    <div key={space.id} className="space-y-1">
                      <div className="flex items-center justify-between group px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary/40" />
                          <span className="text-xs font-bold text-muted-foreground uppercase">{space.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteSpace(space.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="pl-4 space-y-1 border-l ml-1 mt-1">
                        {conversations
                          .filter(c => (spaces.find(s => s.id === space.id) as any)?.conversations?.some((sc: any) => sc.conversationId === c.id))
                          .map(conv => (
                            <button
                              key={conv.id}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors truncate",
                                conv.id === selectedConversationId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              )}
                              onClick={() => onSelectConversation(conv.id)}
                            >
                              {conv.title || "Nova Conversa"}
                            </button>
                          ))}
                        {selectedConversationId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-7 text-[10px] text-muted-foreground hover:text-primary"
                            onClick={() => handleAddToSpace(space.id)}
                          >
                            <Plus className="h-3 w-3" />
                            Adicionar conversa atual
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default function MacgyverIA() {
  const queryClient = useQueryClient();
  const user = getCurrentUser();
  const userId = user?.id || "default-user";

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("google/gemini-2.0-flash-001");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file: File;
    preview: string;
    base64: string;
    name: string;
    type: string;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: models = [], isLoading: modelsLoading } = useQuery<OpenRouterModel[]>({
    queryKey: ["/api/ai/models"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AiConversation[]>({
    queryKey: ["/api/ai/conversations", userId],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<AiMessage[]>({
    queryKey: ["/api/ai/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const { data: spaces = [] } = useQuery<AiSpace[]>({
    queryKey: ["/api/ai/spaces", userId],
  });

  const selectedModelInfo = useMemo(() => {
    return models.find(m => m.id === selectedModel);
  }, [models, selectedModel]);

  const selectedModelName = selectedModelInfo?.name || selectedModel.split("/").pop() || selectedModel;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES = 5;
  const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "text/csv"];

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter(f => {
      if (f.size > MAX_FILE_SIZE) return false;
      if (!SUPPORTED_TYPES.some(t => f.type.startsWith(t.split("/")[0]) || f.type === t)) return false;
      return true;
    });

    const remaining = MAX_FILES - attachedFiles.length;
    const filesToProcess = validFiles.slice(0, remaining);

    const newAttachments = await Promise.all(
      filesToProcess.map(async (file) => {
        const base64 = await fileToBase64(file);
        const preview = file.type.startsWith("image/") ? base64 : "";
        return { file, preview, base64, name: file.name, type: file.type };
      })
    );

    setAttachedFiles(prev => [...prev, ...newAttachments]);
  }, [attachedFiles.length]);

  const handleFileSelect = useCallback((fileList: FileList) => {
    const files = Array.from(fileList);
    processFiles(files);
  }, [processFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        imageItems.push(items[i]);
      }
    }

    if (imageItems.length > 0) {
      e.preventDefault();
      const files: File[] = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      processFiles(files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const removeAttachment = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setInputMessage("");
    setStreamingContent("");
    setAttachedFiles([]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/ai/conversations/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", userId] });
      if (selectedConversationId === id) {
        setSelectedConversationId(null);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    if (val.trim() === "/model" || val.trim() === "/models") {
      setShowModelPicker(true);
      setInputMessage("");
      setShowSlashMenu(false);
      return;
    }

    if (val.startsWith("/") && val.length >= 1) {
      setShowSlashMenu(true);
      setSlashFilter(val);
      setSlashSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSlashCommand = (cmd: SlashCommand) => {
    setShowSlashMenu(false);
    setInputMessage(cmd.prompt);
    textareaRef.current?.focus();
    setTimeout(() => {
      handleSendMessageDirect(cmd.prompt);
    }, 50);
  };

  const handleSendMessageDirect = async (messageText: string) => {
    if ((!messageText.trim() && attachedFiles.length === 0) || isStreaming) return;

    const message = messageText.trim() || (attachedFiles.length > 0 ? "Analise os arquivos anexados." : "");
    const currentAttachments = attachedFiles.map(f => ({
      type: f.type,
      name: f.name,
      base64: f.base64,
    }));

    setInputMessage("");
    setAttachedFiles([]);
    setIsStreaming(true);
    setStreamingContent("");
    setShowSlashMenu(false);

    const displayContent = currentAttachments.length > 0
      ? `${currentAttachments.map(a => `[Imagem anexada: ${a.name}]`).join("\n")}\n\n${message}`
      : message;

    const isNewConversation = !selectedConversationId;
    const tempConversationId = selectedConversationId || "temp-" + Date.now();

    if (isNewConversation) {
      queryClient.setQueryData<AiMessage[]>(["/api/ai/conversations", tempConversationId, "messages"], [
        { id: "temp-user", conversationId: tempConversationId, role: "user", content: displayContent, createdAt: new Date(), tenantId: null }
      ]);
    } else {
      queryClient.setQueryData<AiMessage[]>(["/api/ai/conversations", selectedConversationId, "messages"], (old = []) => [
        ...old,
        { id: "temp-user-" + Date.now(), conversationId: selectedConversationId!, role: "user", content: displayContent, createdAt: new Date(), tenantId: null }
      ]);
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId || "new",
          userId,
          message,
          isNewConversation,
          model: selectedModel,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let actualConversationId = selectedConversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "conversation_id") {
                actualConversationId = data.id;
                setSelectedConversationId(data.id);
              } else if (data.type === "chunk") {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === "title") {
                queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", userId] });
              } else if (data.type === "done") {
                if (actualConversationId) {
                  queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", actualConversationId, "messages"] });
                }
              } else if (data.type === "error") {
                console.error("Stream error:", data.error);
              }
            } catch {
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", userId] });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleSendMessage = async () => {
    await handleSendMessageDirect(inputMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu) {
      const filteredCmds = SLASH_COMMANDS.filter(c =>
        c.command.includes(slashFilter.toLowerCase()) ||
        c.label.toLowerCase().includes(slashFilter.toLowerCase().replace("/", ""))
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.min(prev + 1, filteredCmds.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && filteredCmds.length > 0) {
        e.preventDefault();
        handleSlashCommand(filteredCmds[slashSelectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const displayMessages = selectedConversationId ? messages : [];
  const showWelcome = !selectedConversationId && displayMessages.length === 0 && !isStreaming;
  const isInConversation = selectedConversationId !== null;
  const currentConversation = conversations.find(c => c.id === selectedConversationId);

  const modelDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-muted/50 transition-colors text-xs whitespace-nowrap"
          data-testid="button-model-dropdown"
        >
          {selectedModelInfo && isFreeModel(selectedModelInfo) ? (
            <Zap className="h-3 w-3 text-green-500 shrink-0" />
          ) : (
            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
          )}
          <span className="font-medium truncate max-w-[120px]">Modelo</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-auto">
        <div className="px-2 py-1.5 border-b">
          <p className="text-xs font-medium text-muted-foreground">Modelo atual: {selectedModelName}</p>
        </div>
        {modelsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            {models.slice(0, 15).map(model => {
              const free = isFreeModel(model);
              const isSelected = model.id === selectedModel;
              return (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(isSelected && "bg-primary/10")}
                  data-testid={`dropdown-model-${model.id}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    {free ? <Zap className="h-3 w-3 text-green-500 shrink-0" /> : <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span className="text-xs font-medium truncate flex-1">{model.name}</span>
                    {free && <span className="text-[9px] bg-green-500/10 text-green-600 px-1 rounded">FREE</span>}
                    {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowModelPicker(true)} data-testid="button-open-model-picker">
              <Search className="h-3 w-3 mr-2" />
              <span className="text-xs">Ver todos os modelos...</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const plusMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-lg shrink-0" data-testid="button-plus-menu">
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} data-testid="plus-menu-upload">
          <Upload className="h-4 w-4 mr-2" />
          Upload de arquivos ou imagens
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {QUICK_PROMPTS.slice(0, 3).map(qp => {
          const Icon = qp.icon;
          return (
            <DropdownMenuItem key={qp.label} onClick={() => handleSendMessageDirect(qp.prompt)} data-testid={`plus-menu-${qp.label.replace(/\s+/g, '-').toLowerCase()}`}>
              <Icon className="h-4 w-4 mr-2" />
              {qp.label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowRightSidebar(true)} data-testid="plus-menu-sidebar">
          <PanelRightOpen className="h-4 w-4 mr-2" />
          Abrir painel lateral
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const chatInput = (isWelcome: boolean) => (
    <div className="relative" onDragOver={handleDragOver} onDrop={handleDrop}>
      {showSlashMenu && (
        <SlashCommandMenu
          commands={SLASH_COMMANDS}
          filter={slashFilter}
          onSelect={handleSlashCommand}
          selectedIndex={slashSelectedIndex}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFileSelect(e.target.files);
          e.target.value = "";
        }}
        data-testid="input-file-upload"
      />
      <div className={cn(
        "bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl transition-all focus-within:border-primary/40 focus-within:shadow-sm",
        isWelcome && "shadow-sm"
      )}>
        {attachedFiles.length > 0 && (
          <div className="flex items-center gap-2 px-3 pt-3 pb-1 flex-wrap" data-testid="attachments-preview-row">
            {attachedFiles.map((att, idx) => (
              <div
                key={idx}
                className="relative group flex items-center gap-2 bg-background border border-border rounded-lg p-1.5"
                data-testid={`attachment-preview-${idx}`}
              >
                {att.type.startsWith("image/") ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs text-muted-foreground max-w-[60px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-remove-attachment-${idx}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end px-2">
          <textarea
            ref={textareaRef}
            placeholder="Pergunte qualquer coisa. Digite / para comandos..."
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isStreaming}
            className={cn(
              "flex-1 bg-transparent border-0 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0",
              isWelcome ? "py-4 pl-2 text-base min-h-[56px] max-h-[200px]" : "py-3 pl-2 text-sm min-h-[44px] max-h-[200px]"
            )}
            rows={1}
            data-testid={isWelcome ? "input-chat-message" : "input-chat-message-bottom"}
          />
        </div>
        <div className="flex items-center justify-between px-2 pb-2 gap-2">
          <div className="flex items-center gap-1">
            {plusMenu}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || attachedFiles.length >= MAX_FILES}
              data-testid="button-attach-file"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {modelDropdown}
            <Button
              size="icon"
              className="rounded-xl shrink-0"
              disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isStreaming}
              onClick={handleSendMessage}
              data-testid={isWelcome ? "button-send-message" : "button-send-message-bottom"}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        {isInConversation && (
          <header className="h-12 border-b flex items-center px-4 bg-background shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConversation}
              className="gap-1.5"
              data-testid="button-back-to-home"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Voltar</span>
            </Button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <MacGyverIcon size={20} />
              <span className="font-semibold text-sm">{currentConversation?.title || "Macgyver IA"}</span>
            </div>
            <div className="flex items-center gap-1">
              {displayMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => exportConversationMarkdown(displayMessages, currentConversation?.title || "")}
                  title="Exportar conversa"
                  data-testid="button-export-conversation"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewConversation}
                data-testid="button-new-conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                data-testid="button-toggle-sidebar"
              >
                {showRightSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-auto">
          {showWelcome ? (
            <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-full max-w-2xl space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <MacGyverIcon size={56} />
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight" data-testid="text-welcome-heading">
                      Macgyver IA Renov
                    </h1>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Seu assistente estrategico com IA. Analise dados, gere relatorios e obtenha insights em tempo real.
                    </p>
                  </div>
                </div>

                <div className="w-full">
                  {chatInput(true)}
                </div>

                {!showRightSidebar && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRightSidebar(true)}
                      className="text-xs text-muted-foreground gap-1.5"
                      data-testid="button-show-sidebar-welcome"
                    >
                      <PanelRightOpen className="h-3.5 w-3.5" />
                      Abrir painel lateral
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
                {displayMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                    data-testid={`message-${msg.role}-${msg.id}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[85%]",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownContent content={msg.content} />
                      ) : (
                        <div>
                          {msg.content.includes("[Imagem anexada:") && (
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              {msg.content.match(/\[Imagem anexada: ([^\]]+)\]/g)?.map((match, i) => {
                                const filename = match.replace("[Imagem anexada: ", "").replace("]", "");
                                return (
                                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary-foreground/20 px-2 py-0.5 rounded" data-testid={`attachment-marker-${i}`}>
                                    <ImageIcon className="h-3 w-3" />
                                    {filename}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content.replace(/\[Imagem anexada: [^\]]+\]\n*/g, "").trim()}</p>
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-1">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {isStreaming && streamingContent && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 max-w-[85%] bg-muted/60">
                      <MarkdownContent content={streamingContent} />
                    </div>
                  </div>
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-muted/60">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      </div>
                    </div>
                  </div>
                )}

                {!isStreaming && displayMessages.length > 0 && displayMessages[displayMessages.length - 1]?.role === "assistant" && (
                  <div className="flex flex-wrap gap-2 pl-10" data-testid="follow-up-suggestions">
                    {[
                      "Aprofunde essa analise",
                      "Gere um relatorio sobre isso",
                      "Quais os proximos passos?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        className="px-3 py-1.5 text-xs font-medium bg-muted/40 dark:bg-muted/20 border border-border rounded-full hover:bg-muted transition-colors"
                        onClick={() => handleSendMessageDirect(suggestion)}
                        data-testid={`button-followup-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        {isInConversation && (
          <div className="border-t p-3 bg-background shrink-0">
            <div className="max-w-3xl mx-auto">
              {chatInput(false)}
            </div>
          </div>
        )}
      </div>

      <RightSidebar
        isOpen={showRightSidebar}
        onClose={() => setShowRightSidebar(false)}
        conversations={conversations}
        conversationsLoading={conversationsLoading}
        spaces={spaces}
        userId={userId}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onDeleteConversation={handleDeleteConversation}
        onQuickPrompt={handleSendMessageDirect}
        onSlashCommand={handleSlashCommand}
        queryClient={queryClient}
      />

      {showModelPicker && (
        <ModelPickerPopup
          models={models}
          isLoading={modelsLoading}
          onSelect={setSelectedModel}
          onClose={() => setShowModelPicker(false)}
          selectedModel={selectedModel}
        />
      )}
    </div>
  );
}
