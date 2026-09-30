// Artigo da Base de Conhecimento (/conhecimento/:id), com edição para o autor e admins.
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RichContent } from "@/components/rich-content";
import { ArticleEditor, type ArticleFormValues } from "@/components/knowledge/article-editor";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { ArrowLeft, Pencil, Trash2, EyeOff, Eye } from "lucide-react";
import type { KnowledgeArticleWithAuthor } from "@shared/schema";
import { formatDate } from "./index";

type ArticleResponse = KnowledgeArticleWithAuthor & {
  canEdit: boolean;
  sourceTicket: { id: string; code: string } | null;
};

async function send(method: string, url: string, body?: unknown) {
  const res = await fetchWithAuth(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
  return data;
}

/** /conhecimento/novo — artigo do zero. */
export function NovoArtigoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const save = async (values: ArticleFormValues, status: "publicado" | "rascunho") => {
    setSaving(true);
    try {
      const created = await send("POST", "/api/conhecimento/artigos", { ...values, status });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/artigos"] });
      toast({ title: status === "publicado" ? "Artigo publicado" : "Rascunho salvo" });
      setLocation(`/conhecimento/${created.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Novo artigo"
        breadcrumbs={[{ label: "Base de Conhecimento", href: "/conhecimento" }, { label: "Novo artigo" }]}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card><CardContent className="pt-6">
          <ArticleEditor
            initial={{ title: "", content: "", groupKey: null }}
            saving={saving}
            onSubmit={save}
            onCancel={() => setLocation("/conhecimento")}
          />
        </CardContent></Card>
      </div>
    </div>
  );
}

export default function ArtigoPage() {
  const [, params] = useRoute("/conhecimento/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { groupName } = useSupportGroups();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: article, isLoading, error } = useQuery<ArticleResponse>({
    queryKey: ["/api/conhecimento/artigos", id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/conhecimento/artigos/${id}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Artigo não encontrado" : "Erro ao carregar o artigo");
      return res.json();
    },
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/artigos"] });
  };

  const update = async (body: Record<string, unknown>, message: string) => {
    setSaving(true);
    try {
      await send("PUT", `/api/conhecimento/artigos/${id}`, body);
      refresh();
      toast({ title: message });
      setEditing(false);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Excluir este artigo? Essa ação não pode ser desfeita.")) return;
    try {
      await send("DELETE", `/api/conhecimento/artigos/${id}`);
      refresh();
      toast({ title: "Artigo excluído" });
      setLocation("/conhecimento");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao excluir", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={article?.title ?? "Artigo"}
        breadcrumbs={[{ label: "Base de Conhecimento", href: "/conhecimento" }, { label: article?.title ?? "Artigo" }]}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/conhecimento"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : error || !article ? (
          <p className="text-muted-foreground">{error instanceof Error ? error.message : "Artigo não encontrado"}</p>
        ) : editing ? (
          <Card><CardContent className="pt-6">
            <ArticleEditor
              initial={{ title: article.title, content: article.content, groupKey: article.groupKey }}
              saving={saving}
              onSubmit={(values, status) => update({ ...values, status }, status === "publicado" ? "Artigo publicado" : "Rascunho salvo")}
              onCancel={() => setEditing(false)}
            />
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <h1 className="text-[22px] font-bold tracking-tight">{article.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {article.status === "rascunho" && <Badge variant="outline">Rascunho</Badge>}
                    {article.groupKey && <Badge variant="secondary">{groupName(article.groupKey)}</Badge>}
                    <span>{article.authorName ? `${article.authorName} · ` : ""}atualizado em {formatDate(article.updatedAt)}</span>
                    {article.sourceTicket && (
                      <Link href={`/chamados/${article.sourceTicket.id}`} className="text-primary hover:underline">
                        Origem: {article.sourceTicket.code}
                      </Link>
                    )}
                  </div>
                </div>
                {article.canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-kb-edit">
                      <Pencil className="h-4 w-4 mr-1" />Editar
                    </Button>
                    {article.status === "publicado" ? (
                      <Button size="sm" variant="outline" disabled={saving}
                        onClick={() => update({ status: "rascunho" }, "Artigo despublicado")} data-testid="button-kb-unpublish">
                        <EyeOff className="h-4 w-4 mr-1" />Despublicar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={saving}
                        onClick={() => update({ status: "publicado" }, "Artigo publicado")} data-testid="button-kb-republish">
                        <Eye className="h-4 w-4 mr-1" />Publicar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={remove} data-testid="button-kb-delete">
                      <Trash2 className="h-4 w-4 mr-1" />Excluir
                    </Button>
                  </div>
                )}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <RichContent content={article.content} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
