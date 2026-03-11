import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetaAreas } from "@/hooks/use-meta-areas";
import {
  Star,
  StarOff,
  ChevronRight,
  BookOpen,
  FileText,
  Lock,
  Globe,
  Clock,
  ArrowLeft
} from "lucide-react";
import type { KnowledgeDocument, KnowledgeFavorite } from "@shared/schema";
import { getCurrentUser } from "@/lib/permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho", color: "bg-gray-500/10 text-gray-600" },
  { value: "em_analise", label: "Em Análise", color: "bg-yellow-500/10 text-yellow-600" },
  { value: "aprovado", label: "Aprovado", color: "bg-green-500/10 text-green-600" },
  { value: "arquivado", label: "Arquivado", color: "bg-red-500/10 text-red-600" },
];

export default function FavoritosPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getCurrentUser();
  const { data: areas = [] } = useMetaAreas();

  const { data: documents, isLoading: docsLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: ["/api/conhecimento"],
  });

  const { data: favorites, isLoading: favsLoading } = useQuery<KnowledgeFavorite[]>({
    queryKey: ["/api/conhecimento/favoritos", user?.id],
    enabled: !!user?.id,
  });

  const unfavoriteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("DELETE", `/api/conhecimento/${documentId}/favoritar/${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/favoritos", user?.id] });
      toast({ title: "Favorito removido" });
    },
  });

  const favoriteDocuments = useMemo(() => {
    if (!documents || !favorites) return [];
    const favoriteIds = new Set(favorites.map(f => f.documentId));
    return documents.filter(doc => favoriteIds.has(doc.id));
  }, [documents, favorites]);

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option ? (
      <Badge variant="secondary" className={option.color}>
        {option.label}
      </Badge>
    ) : null;
  };

  const getAreaLabel = (area: string) => {
    return areas.find(a => a.name === area)?.name || area;
  };

  const isLoading = docsLoading || favsLoading;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-favoritos">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/conhecimento")} data-testid="button-voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="Meus Favoritos"
          description="Documentos marcados como favoritos para acesso rápido."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            Documentos Favoritos
          </CardTitle>
          <CardDescription>
            {favoriteDocuments.length} documento(s) favoritado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : favoriteDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Você ainda não tem documentos favoritos</p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation("/conhecimento")} data-testid="button-explorar-documentos">
                Explorar documentos
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {favoriteDocuments.map(doc => (
                <div 
                  key={doc.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => setLocation(`/conhecimento/${doc.id}`)}
                  data-testid={`favorite-row-${doc.id}`}
                >
                  <div className="p-2 rounded-lg shrink-0 bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{doc.nomeArquivo}</span>
                      {doc.visibilidade === "departamento" || doc.visibilidade === "funcoes" ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs">{getAreaLabel(doc.area)}</Badge>
                      <span className="text-xs">•</span>
                      <span className="text-xs">{doc.versao}</span>
                      <span className="text-xs">•</span>
                      <span className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {doc.createdAt && format(new Date(doc.createdAt), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(doc.status)}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        unfavoriteMutation.mutate(doc.id);
                      }}
                      data-testid={`button-unfavorite-${doc.id}`}
                    >
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    </Button>
                    
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
