import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Copy, ExternalLink, Bot, Wrench, Code, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptLibrary, PromptUserFavorite } from "@shared/schema";

interface PromptCardProps {
  prompt: PromptLibrary;
  favorite?: PromptUserFavorite;
  onView: () => void;
  onToggleFavorite: () => void;
  onCopy: (e: React.MouseEvent) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "development-team": <Bot className="h-5 w-5" />,
  "development-tools": <Wrench className="h-5 w-5" />,
  "programming-languages": <Code className="h-5 w-5" />,
  "database": <Database className="h-5 w-5" />,
};

const categoryLabels: Record<string, string> = {
  "development-team": "Equipe de Desenvolvimento",
  "development-tools": "Ferramentas",
  "programming-languages": "Linguagens",
  "database": "Banco de Dados",
};

export function PromptCard({ prompt, favorite, onView, onToggleFavorite, onCopy }: PromptCardProps) {
  const Icon = categoryIcons[prompt.category] || <Bot className="h-5 w-5" />;
  const categoryLabel = categoryLabels[prompt.category] || prompt.category;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 bg-gradient-to-br from-card to-card/95">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {Icon}
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {categoryLabel}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-colors",
              favorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Star className={cn("h-4 w-4", favorite && "fill-current")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <h3 className="font-semibold text-base mb-2 line-clamp-1 group-hover:text-primary transition-colors">
          {prompt.title}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3.5rem]">
          {prompt.description}
        </p>
        
        <div className="flex items-center justify-between gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={onView}
          >
            Ver Detalhes
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={onCopy}
            title="Copiar prompt"
          >
            <Copy className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              window.open(prompt.sourceUrl || "#", "_blank");
            }}
            title="Ver no GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        
        {(prompt.usageCount ?? 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Usado {prompt.usageCount} {(prompt.usageCount ?? 0) === 1 ? "vez" : "vezes"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
