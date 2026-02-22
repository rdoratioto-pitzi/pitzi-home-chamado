import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Copy, Languages, Loader2, Check, Globe } from "lucide-react";

interface PromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    translatedContent?: string | null;
    isTranslated?: boolean;
  } | null;
}

export function PromptModal({ open, onOpenChange, prompt }: PromptModalProps) {
  const { toast } = useToast();
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when prompt changes
  useEffect(() => {
    if (prompt) {
      setTranslatedContent(prompt.translatedContent || null);
      setShowTranslated(false);
      setCopied(false);
    }
  }, [prompt]);

  const handleTranslate = async () => {
    if (!prompt) return;

    // Se já tem tradução, apenas alterna
    if (translatedContent) {
      setShowTranslated(!showTranslated);
      return;
    }

    setIsTranslating(true);
    try {
      // Usar a rota com query param ?translate=true
      const response = await fetch(`/api/prompts/${prompt.id}?translate=true`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Erro ao traduzir prompt");
      }
      
      const data = await response.json();
      setTranslatedContent(data.translatedContent);
      setShowTranslated(true);
      
      toast({
        title: "Tradução concluída!",
        description: "Prompt traduzido para português brasileiro.",
      });
    } catch (error) {
      console.error("Erro na tradução:", error);
      toast({
        title: "Erro na tradução",
        description: "Não foi possível traduzir o prompt. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = async () => {
    if (!prompt) return;
    
    const contentToCopy = showTranslated && translatedContent 
      ? translatedContent 
      : prompt.content;
    
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: showTranslated 
          ? "Prompt traduzido copiado para a área de transferência."
          : "Prompt original copiado para a área de transferência.",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o prompt.",
        variant: "destructive",
      });
    }
  };

  const currentContent = showTranslated && translatedContent 
    ? translatedContent 
    : prompt?.content || "";

  const categoryLabels: Record<string, string> = {
    "development-team": "Equipe de Desenvolvimento",
    "development-tools": "Ferramentas",
    "programming-languages": "Linguagens",
    "database": "Banco de Dados",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {categoryLabels[prompt?.category || ""] || prompt?.category}
                </Badge>
                {showTranslated && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    <Globe className="h-3 w-3 mr-1" />
                    PT-BR
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl">{prompt?.title}</DialogTitle>
              <DialogDescription className="mt-2">
                {prompt?.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 py-3 border-y">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslate}
            disabled={isTranslating}
            className="gap-2"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Traduzindo...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4" />
                {translatedContent 
                  ? (showTranslated ? "Ver Original" : "Ver Traduzido") 
                  : "Traduzir para PT-BR"}
              </>
            )}
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar {showTranslated ? "Traduzido" : "Original"}
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg border overflow-x-auto">
              {currentContent}
            </pre>
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t text-sm text-muted-foreground">
          <span>
            {showTranslated && translatedContent 
              ? "Conteúdo traduzido automaticamente por Claude via OpenRouter" 
              : "Conteúdo original do prompt"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
