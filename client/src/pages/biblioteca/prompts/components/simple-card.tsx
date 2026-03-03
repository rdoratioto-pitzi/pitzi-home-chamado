import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Wrench, Code, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptLibrary } from "@shared/schema";

interface PromptCardProps {
  prompt: PromptLibrary;
  onView: () => void;
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

export function SimplePromptCard({ prompt, onView }: PromptCardProps) {
  const Icon = categoryIcons[prompt.category] || <Bot className="h-5 w-5" />;
  const categoryLabel = categoryLabels[prompt.category] || prompt.category;

  return (
    <Card className="group transition-all duration-300 hover:shadow-lg hover:border-primary/50">
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
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <h3 className="font-semibold text-base mb-2">
          {prompt.title}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {prompt.description}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onView}
        >
          Ver Detalhes
        </Button>
      </CardContent>
    </Card>
  );
}
