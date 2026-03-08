import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePrompts, useSyncPrompts } from "@/hooks/use-prompts";
import { PromptModal } from "@/components/PromptModal";
import { Bot, Wrench, Code, Database, RefreshCw, Eye } from "lucide-react";

export default function PromptsPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<{
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    translatedContent?: string | null;
    isTranslated?: boolean;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Usar o hook usePrompts com credenciais corretas
  const { data: prompts = [], isLoading, refetch } = usePrompts({
    category: selectedCategory ?? undefined,
  });

  // Hook de sincronização
  const syncMutation = useSyncPrompts();

  const syncPrompts = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      
      toast({
        title: "Sincronização concluída!",
        description: `${result.created} criados, ${result.updated} atualizados`,
      });
      
      // Recarregar lista
      await refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível sincronizar.",
        variant: "destructive",
      });
    }
  };

  const openPromptModal = (prompt: typeof prompts[0]) => {
    setSelectedPrompt({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      category: prompt.category,
      translatedContent: (prompt as any).translatedContent || null,
      isTranslated: (prompt as any).isTranslated || false,
    });
    setModalOpen(true);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Biblioteca de Prompts"
        description="Prompts prontos para usar com Claude Code. Clique em 'Ver Prompt' para visualizar, traduzir e copiar."
        actions={
          <Button 
            onClick={syncPrompts} 
            variant="outline" 
            size="sm"
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar GitHub"}
          </Button>
        }
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              Nenhum prompt encontrado. Clique em "Sincronizar GitHub" para carregar os prompts.
            </p>
          </CardContent>
        </Card>
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
                      {categoryLabels[prompt.category] || prompt.category}
                    </Badge>
                    <h3 className="font-semibold">{prompt.title}</h3>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {prompt.description}
                </p>

                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => openPromptModal(prompt)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Prompt
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromptModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        prompt={selectedPrompt}
      />
    </div>
  );
}
