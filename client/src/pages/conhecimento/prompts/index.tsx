import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Wrench, Code, Database } from "lucide-react";
import type { PromptLibrary } from "@shared/schema";

export default function PromptsPage() {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<PromptLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, [selectedCategory]);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const url = selectedCategory 
        ? `/api/prompts?category=${selectedCategory}`
        : '/api/prompts';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao carregar prompts');
      const data = await response.json();
      setPrompts(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prompts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const copyPrompt = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copiado!",
        description: "Prompt copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Biblioteca de Prompts"
        description="Prompts prontos para usar com Claude Code."
      />

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          Todas ({prompts.length})
        </Button>
        {["development-team", "development-tools", "programming-languages", "database"].map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {categoryLabels[cat]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map((prompt) => (
            <Card key={prompt.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {categoryIcons[prompt.category] || <Bot className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <Badge variant="secondary" className="mb-1">
                      {categoryLabels[prompt.category]}
                    </Badge>
                    <h3 className="font-semibold">{prompt.title}</h3>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {prompt.description}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyPrompt(prompt.content)}
                >
                  Copiar Prompt
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
