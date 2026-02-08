import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronDown,
  Sparkles,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { AiConversation, AiMessage } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import MacGyverIcon from "@/components/Chat/MacGyverIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  free: boolean;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google", free: true },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "Google", free: true },
  { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick", provider: "Meta", free: true },
  { id: "meta-llama/llama-4-scout:free", name: "Llama 4 Scout", provider: "Meta", free: true },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", provider: "DeepSeek", free: true },
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B", provider: "Qwen", free: true },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", free: false },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", free: false },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", free: false },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", provider: "Google", free: false },
];

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atrás`;
  return d.toLocaleDateString("pt-BR");
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AiConversation[]>({
    queryKey: ["/api/ai/conversations", userId],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<AiMessage[]>({
    queryKey: ["/api/ai/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setInputMessage("");
    setStreamingContent("");
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const message = inputMessage.trim();
    setInputMessage("");
    setIsStreaming(true);
    setStreamingContent("");

    const isNewConversation = !selectedConversationId;
    const tempConversationId = selectedConversationId || "temp-" + Date.now();

    if (isNewConversation) {
      queryClient.setQueryData<AiMessage[]>(["/api/ai/conversations", tempConversationId, "messages"], [
        { id: "temp-user", conversationId: tempConversationId, role: "user", content: message, createdAt: new Date(), tenantId: null }
      ]);
    } else {
      queryClient.setQueryData<AiMessage[]>(["/api/ai/conversations", selectedConversationId, "messages"], (old = []) => [
        ...old,
        { id: "temp-user-" + Date.now(), conversationId: selectedConversationId!, role: "user", content: message, createdAt: new Date(), tenantId: null }
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
              // Skip invalid JSON
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const displayMessages = selectedConversationId ? messages : [];
  const showWelcome = !selectedConversationId && displayMessages.length === 0 && !isStreaming;
  const isInConversation = selectedConversationId !== null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header - Only show when in conversation */}
      {isInConversation && (
        <header className="h-14 border-b flex items-center px-4 bg-background shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            className="gap-2"
            data-testid="button-back-to-home"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <MacGyverIcon size={24} />
            <span className="font-semibold text-sm">Macgyver IA Renov</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewConversation}
            className="gap-2"
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova</span>
          </Button>
        </header>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {showWelcome ? (
          /* Welcome Screen with centered input */
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-2xl space-y-8">
              {/* Logo and Title */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <MacGyverIcon size={72} />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Macgyver IA Renov
                  </h1>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                    MacGyver resolvia qualquer problema com clipe de papel e criatividade. 
                    Eu faço o mesmo, mas com IA e sem gambiarras!
                  </p>
                </div>
              </div>

              {/* Main Question */}
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                  Como posso te ajudar hoje?
                </h2>
              </div>

              {/* Model Selector */}
              <div className="w-full flex justify-center">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-auto gap-2 border-border/60 bg-muted/30 rounded-full px-4" data-testid="select-model">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Modelos Gratuitos</div>
                    {AVAILABLE_MODELS.filter(m => m.free).map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <span className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-green-500 shrink-0" />
                          <span>{model.name}</span>
                          <span className="text-xs text-muted-foreground">({model.provider})</span>
                        </span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Modelos Premium</div>
                    {AVAILABLE_MODELS.filter(m => !m.free).map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                          <span>{model.name}</span>
                          <span className="text-xs text-muted-foreground">({model.provider})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Input Box - Modern Design */}
              <div className="w-full">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative bg-muted/50 dark:bg-muted/30 border border-border rounded-2xl overflow-hidden shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                    <textarea
                      ref={textareaRef}
                      placeholder="Pergunte qualquer coisa..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isStreaming}
                      className="w-full bg-transparent border-0 resize-none px-4 py-4 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-0 min-h-[56px] max-h-[200px]"
                      rows={1}
                      data-testid="input-chat-message"
                    />
                  </div>
                  <Button
                    size="icon"
                    className="h-[56px] w-[56px] rounded-2xl bg-primary hover:bg-primary/90 shrink-0 shadow-sm transition-all hover:scale-105 active:scale-95"
                    disabled={!inputMessage.trim() || isStreaming}
                    onClick={handleSendMessage}
                    data-testid="button-send-message"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Send className="h-6 w-6" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Tickets em aberto",
                  "Resumo das metas",
                  "Documentos recentes",
                  "Criar projeto"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="px-4 py-2 text-sm font-medium bg-muted/50 dark:bg-muted/30 border border-border rounded-full hover:bg-muted transition-colors"
                    onClick={() => {
                      setInputMessage(suggestion);
                      textareaRef.current?.focus();
                    }}
                    data-testid={`button-suggestion-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Histórico Section */}
              <div className="w-full pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Histórico
                  </h3>
                </div>
                
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl border border-border/50">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma conversa ainda</p>
                    <p className="text-xs mt-1">Inicie uma conversa para ver o histórico aqui</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {conversations.slice(0, 6).map((conv) => (
                      <div
                        key={conv.id}
                        className="group relative flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm"
                        onClick={() => setSelectedConversationId(conv.id)}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate pr-6">{conv.title || "Nova conversa"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(conv.updatedAt)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          data-testid={`button-delete-conversation-${conv.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {conversations.length > 6 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    +{conversations.length - 6} conversas anteriores
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation View */
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
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[85%]",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isStreaming && streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 max-w-[85%] bg-muted">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && !streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-muted">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Bottom Input - Only show when in conversation */}
      {isInConversation && (
        <div className="border-t p-4 bg-background shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-auto gap-2 border-border/60 bg-muted/30 rounded-full px-3 h-7 text-xs" data-testid="select-model-bottom">
                  <Sparkles className="h-3 w-3 text-primary shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Modelos Gratuitos</div>
                  {AVAILABLE_MODELS.filter(m => m.free).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-green-500 shrink-0" />
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">({model.provider})</span>
                      </span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Modelos Premium</div>
                  {AVAILABLE_MODELS.filter(m => !m.free).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">({model.provider})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 relative bg-muted/50 dark:bg-muted/30 border border-border rounded-2xl overflow-hidden focus-within:border-primary/50">
                <textarea
                  ref={textareaRef}
                  placeholder="Pergunte qualquer coisa..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  className="w-full bg-transparent border-0 resize-none px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 min-h-[48px] max-h-[200px]"
                  rows={1}
                  data-testid="input-chat-message-bottom"
                />
              </div>
              <Button
                size="icon"
                className="h-[48px] w-[48px] rounded-xl bg-primary hover:bg-primary/90 shrink-0 shadow-sm"
                disabled={!inputMessage.trim() || isStreaming}
                onClick={handleSendMessage}
                data-testid="button-send-message-bottom"
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
      )}
    </div>
  );
}
