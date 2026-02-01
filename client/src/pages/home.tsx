import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { AiConversation, AiMessage } from "@shared/schema";
import ReactMarkdown from "react-markdown";

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

export default function Home() {
  const queryClient = useQueryClient();
  const user = getCurrentUser();
  const userId = user?.id || "default-user";
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div 
        className={cn(
          "border-r bg-muted/30 flex flex-col transition-all duration-300 w-72"
        )}
      >
        <div className="p-3 border-b">
          <Button 
            className="w-full justify-start gap-2" 
            variant="outline"
            onClick={handleNewConversation}
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma conversa ainda
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover-elevate",
                    selectedConversationId === conv.id 
                      ? "bg-accent text-accent-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedConversationId(conv.id)}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title || "Nova conversa"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    data-testid={`button-delete-conversation-${conv.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>


      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {showWelcome && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                    <Sparkles className="h-10 w-10 text-primary-foreground" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    Macgyver IA Renov
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Inspirado no agente que resolvia o impossível com o mínimo, estou aqui para transformar suas dúvidas em soluções práticas. Sem clipes de papel, só respostas inteligentes!
                    <br />
                    Como posso te ajudar hoje?
                  </p>
                </div>

                <div className="flex flex-col w-full max-w-lg mt-4 space-y-2">
                  {[
                    "Quais são os tickets em aberto?",
                    "Resumo das metas deste mês",
                    "Documentos aprovados recentes",
                    "Como criar um novo projeto?"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="text-left py-2 px-0 hover:text-primary transition-colors text-sm font-medium border-none bg-transparent cursor-pointer flex items-center gap-2 group"
                      onClick={() => {
                        setInputMessage(suggestion);
                        textareaRef.current?.focus();
                      }}
                      data-testid={`button-suggestion-${suggestion.slice(0, 20)}`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4",
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
                    "rounded-2xl px-4 py-3 max-w-[80%]",
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
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 max-w-[80%] bg-muted">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {isStreaming && !streamingContent && (
              <div className="flex gap-4 justify-start">
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

        <div className="border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                placeholder="Digite sua mensagem..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                className="min-h-[52px] max-h-[200px] resize-none pr-12"
                rows={1}
                data-testid="input-chat-message"
              />
              <Button
                size="icon"
                className="absolute right-2 bottom-2 h-8 w-8"
                disabled={!inputMessage.trim() || isStreaming}
                onClick={handleSendMessage}
                data-testid="button-send-message"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Assistente alimentado por IA • Renov Home
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
