import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Star, ExternalLink, Bot, Wrench, Code, Database, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { PromptLibrary, PromptUserFavorite } from "@shared/schema";

interface PromptModalProps {
  prompt: PromptLibrary | null;
  favorite?: PromptUserFavorite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onUse: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "development-team": <Bot className="h-5 w-5" />,
  "development-tools": <Wrench className="h-5 w-5" />,
  "programming-languages": <Code className="h-5 w-5" />,
  "database": <Database className="h-5 w-5" />,
};

const categoryLabels: Record<string, string> = {
  "development-team": "Equipe de Desenvolvimento",
  "development-tools": "Ferramentas de Desenvolvimento",
  "programming-languages": "Linguagens de Programação",
  "database": "Banco de Dados",
};

export function PromptModal({
  prompt,
  favorite,
  open,
  onOpenChange,
  onToggleFavorite,
  onCopy,
  onUse,
}: PromptModalProps) {
  const [copied, setCopied] = useState(false);
  
  if (!prompt) return null;

  const Icon = categoryIcons[prompt.category] || <Bot className="h-5 w-5" />;
  const categoryLabel = categoryLabels[prompt.category] || prompt.category;
  
  // Parse tools from JSON string
  const tools = prompt.tools ? JSON.parse(prompt.tools) : [];

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                {Icon}
              </div>
              <div>
                <Badge variant="secondary" className="mb-1">
                  {categoryLabel}
                </Badge>
                <DialogTitle className="text-xl font-bold">
                  {prompt.title}
                </DialogTitle>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 shrink-0",
                favorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
              )}
              onClick={onToggleFavorite}
            >
              <Star className={cn("h-5 w-5", favorite && "fill-current")} />
            </Button>
          </div>
          
          <DialogDescription className="pt-2 text-base">
            {prompt.description}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Conteúdo do Prompt</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 my-4">
            <TabsContent value="content" className="mt-0">
              <div className="relative">
                <pre className="p-4 rounded-lg bg-muted/50 text-sm font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-auto">
                  {prompt.content}
                </pre>
              </div>
            </TabsContent>
            
            <TabsContent value="info" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Categoria
                  </p>
                  <p className="text-sm">{categoryLabel}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Subcategoria
                  </p>
                  <p className="text-sm capitalize">{prompt.subcategory.replace(/-/g, " ")}</p>
                </div>
                
                {prompt.model && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Modelo Recomendado
                    </p>
                    <p className="text-sm capitalize">{prompt.model}</p>
                  </div>
                )}
                
                {tools.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Ferramentas
                    </p>
                    <p className="text-sm">{tools.join(", ")}</p>
                  </div>
                )}
                
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Última Sincronização
                  </p>
                  <p className="text-sm">
                    {prompt.lastSyncedAt 
                      ? new Date(prompt.lastSyncedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"
                    }
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Usos
                  </p>
                  <p className="text-sm">{prompt.usageCount || 0}</p>
                </div>
              </div>
              
              {prompt.sourceUrl && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Fonte
                  </p>
                  <a
                    href={prompt.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ver no GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
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
                Copiar Prompt
              </>
            )}
          </Button>
          
          <Button onClick={onUse} className="gap-2">
            <Bot className="h-4 w-4" />
            Usar em Melhoria
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
