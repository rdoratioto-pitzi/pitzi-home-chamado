import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrompts } from "@/hooks/use-prompts";
import { SimplePromptCard } from "./components/simple-card";
import { Search } from "lucide-react";
import type { PromptLibrary } from "@shared/schema";

export default function PromptsPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptLibrary | null>(null);

  const { data: prompts = [], isLoading: isLoadingPrompts } = usePrompts({
    category: selectedCategory ?? undefined,
    search: searchQuery || undefined,
  });

  const handleViewPrompt = (prompt: PromptLibrary) => {
    setSelectedPrompt(prompt);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Biblioteca de Prompts"
        description="Prompts prontos para usar com Claude Code. Organizados por categoria para facilitar seu desenvolvimento."
      />

      <div className="relative w-full max-w-[250px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Buscar prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoadingPrompts ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))
        ) : prompts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum prompt encontrado</p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <SimplePromptCard
              key={prompt.id}
              prompt={prompt}
              onView={() => handleViewPrompt(prompt)}
            />
          ))
        )}
      </div>
    </div>
  );
}
