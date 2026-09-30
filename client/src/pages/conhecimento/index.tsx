// Base de Conhecimento: busca e lista de artigos (/conhecimento).
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { useSupportGroups } from "@/hooks/use-support-groups";
import type { KnowledgeArticleWithAuthor } from "@shared/schema";

export interface ArticleListResponse {
  items: KnowledgeArticleWithAuthor[];
  canCreate: boolean;
}

const ALL = "__todos__";

/** Texto do artigo sem HTML, para o resumo da lista. */
export function articleExcerpt(html: string, max = 180): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ConhecimentoPage() {
  const { groups, groupName } = useSupportGroups();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState(ALL);
  const q = useDebounced(search.trim());

  const { data, isLoading } = useQuery<ArticleListResponse>({
    queryKey: ["/api/conhecimento/artigos", q, group],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (group !== ALL) params.set("grupo", group);
      const res = await fetchWithAuth(`/api/conhecimento/artigos?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar a Base de Conhecimento");
      return res.json();
    },
  });
  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Base de Conhecimento"
        breadcrumbs={[{ label: "Base de Conhecimento" }]}
        actions={data?.canCreate ? (
          <Button asChild size="sm" data-testid="button-kb-new">
            <Link href="/conhecimento/novo"><Plus className="h-4 w-4 mr-1" />Novo artigo</Link>
          </Button>
        ) : undefined}
      />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground mt-2">
            Soluções e tutoriais para dúvidas comuns. Procure aqui antes de abrir um chamado.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou conteúdo"
              className="pl-9"
              data-testid="input-kb-search"
            />
          </div>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="sm:w-[220px]" data-testid="select-kb-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {q || group !== ALL ? "Nenhum artigo encontrado para essa busca." : "Ainda não há artigos publicados."}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <Link key={a.id} href={`/conhecimento/${a.id}`}>
                <Card className="cursor-pointer transition-all hover-elevate border hover:border-primary/30" data-testid={`card-kb-${a.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        {a.status === "rascunho" && <Badge variant="outline">Rascunho</Badge>}
                        {a.groupKey && <Badge variant="secondary">{groupName(a.groupKey)}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{articleExcerpt(a.content)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {a.authorName ? `${a.authorName} · ` : ""}atualizado em {formatDate(a.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
