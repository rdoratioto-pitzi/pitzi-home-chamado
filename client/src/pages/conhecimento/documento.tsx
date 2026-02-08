import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichTextarea } from "@/components/rich-textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft,
  Star,
  StarOff,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  Tag,
  Globe,
  Lock,
  Edit,
  History,
  Eye,
  FileText,
  Shield,
  AlertTriangle,
  Download
} from "lucide-react";
import type { KnowledgeDocument, KnowledgeDocumentVersion, KnowledgeAuditLog, User as UserType } from "@shared/schema";
import { getCurrentUser, isAdmin } from "@/lib/permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AREAS = [
  { value: "LAB", label: "Laboratório" },
  { value: "RH", label: "Recursos Humanos" },
  { value: "COM", label: "Comercial" },
  { value: "FIN", label: "Financeiro" },
  { value: "MKT", label: "Marketing" },
  { value: "OPS", label: "Operações" },
  { value: "TI", label: "Tecnologia" },
];

const TIPOS = [
  { value: "politica", label: "Política Interna" },
  { value: "pop", label: "POP" },
  { value: "fluxograma", label: "Fluxograma" },
  { value: "mapa_cargo", label: "Mapa de Cargo" },
  { value: "template", label: "Template" },
  { value: "checklist", label: "Checklist" },
  { value: "faq", label: "FAQ" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-600", icon: Edit },
  em_analise: { label: "Em Análise", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-green-500/10 text-green-600", icon: CheckCircle },
  arquivado: { label: "Arquivado", color: "bg-red-500/10 text-red-600", icon: AlertTriangle },
};

const ACAO_LABELS: Record<string, string> = {
  criou: "Criou o documento",
  editou: "Editou o documento",
  visualizou: "Visualizou o documento",
  enviou_aprovacao: "Enviou para aprovação",
  aprovou: "Aprovou o documento",
  rejeitou: "Rejeitou o documento",
  restaurou: "Restaurou versão",
  arquivou: "Arquivou o documento",
};

export default function DocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getCurrentUser();
  const userIsAdmin = isAdmin();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: document, isLoading } = useQuery<KnowledgeDocument>({
    queryKey: ["/api/conhecimento", id],
    enabled: !!id,
  });

  const { data: versions } = useQuery<KnowledgeDocumentVersion[]>({
    queryKey: ["/api/conhecimento", id, "versoes"],
    enabled: !!id,
  });

  const { data: auditLogs } = useQuery<KnowledgeAuditLog[]>({
    queryKey: ["/api/conhecimento", id, "auditoria"],
    enabled: !!id,
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: favorites } = useQuery<{ documentId: string }[]>({
    queryKey: ["/api/conhecimento/favoritos", user?.id],
    enabled: !!user?.id,
  });

  const isFavorite = favorites?.some(f => f.documentId === id);

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/conhecimento/${id}/aprovar`, { userId: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento", id, "auditoria"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento"] });
      toast({ title: "Sucesso!", description: "Documento aprovado com sucesso." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/conhecimento/${id}/rejeitar`, { userId: user?.id, motivo: rejectReason });
    },
    onSuccess: () => {
      setShowRejectDialog(false);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento", id, "auditoria"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento"] });
      toast({ title: "Documento rejeitado", description: "O criador foi notificado." });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (action: "add" | "remove") => {
      if (action === "add") {
        return apiRequest("POST", `/api/conhecimento/${id}/favoritar`, { userId: user?.id });
      } else {
        return apiRequest("DELETE", `/api/conhecimento/${id}/favoritar/${user?.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/favoritos", user?.id] });
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "Sistema";
    const u = users?.find(u => u.id === userId);
    return u?.name || "Usuário desconhecido";
  };

  const getAreaLabel = (area: string) => AREAS.find(a => a.value === area)?.label || area;
  const getTipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label || tipo;

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
          <div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Documento não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/conhecimento")} data-testid="button-voltar-lista">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[document.status] || STATUS_CONFIG.rascunho;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-documento">
      {document.status === "em_analise" && userIsAdmin && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Documento aguardando aprovação</p>
              <p className="text-sm text-muted-foreground">Revise o conteúdo e aprove ou rejeite este documento.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRejectDialog(true)}
              data-testid="button-rejeitar"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeitar
            </Button>
            <Button 
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-aprovar"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/conhecimento")} data-testid="button-voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Base de Conhecimento</span>
            <span>/</span>
            <span>{getAreaLabel(document.area)}</span>
            <span>/</span>
            <span>{getTipoLabel(document.tipo)}</span>
          </div>
          <h1 className="text-2xl font-bold">{document.nomeArquivo}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => favoriteMutation.mutate(isFavorite ? "remove" : "add")}
          data-testid="button-favorite"
        >
          {isFavorite ? (
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
          ) : (
            <StarOff className="h-5 w-5" />
          )}
        </Button>
      </div>

      {document.status === "aprovado" && document.aprovadoPor && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm">
              Aprovado por <strong>{getUserName(document.aprovadoPor)}</strong> em{" "}
              {document.aprovadoEm && format(new Date(document.aprovadoEm), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              toast({
                title: "Exportar PDF",
                description: "Funcionalidade de exportação em PDF será implementada em breve.",
              });
            }}
            data-testid="button-exportar-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      )}

      {document.motivoRejeicao && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Documento rejeitado</p>
            <p className="text-sm text-muted-foreground mt-1">{document.motivoRejeicao}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {document.conteudo || <span className="text-muted-foreground italic">Sem conteúdo</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {document.anexos ? (
                <div className="space-y-2">
                  {JSON.parse(document.anexos).map((anexo: any, index: number) => {
                    const IconComponent = FileText; // Simplificado para o exemplo, pode-se usar a lógica de ícone
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <IconComponent className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{anexo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {anexo.size < 1024 ? `${anexo.size} B` : 
                             anexo.size < 1024 * 1024 ? `${(anexo.size / 1024).toFixed(1)} KB` : 
                             `${(anexo.size / (1024 * 1024)).toFixed(1)} MB`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={anexo.dataUrl} download={anexo.name}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum anexo disponível.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions && versions.length > 0 ? (
                <div className="space-y-3">
                  {versions.map((version, index) => (
                    <div key={version.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {version.versao}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getUserName(version.alteradoPor)}</span>
                          {index === 0 && <Badge variant="secondary" className="text-xs">Atual</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {version.createdAt && format(new Date(version.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {version.resumoAlteracoes && (
                          <p className="text-sm mt-1">{version.resumoAlteracoes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum histórico de versões disponível.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Trilha de Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 p-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium">{getUserName(log.userId)}</span>
                      <span className="text-muted-foreground">{ACAO_LABELS[log.acao] || log.acao}</span>
                      {log.detalhes && <span className="text-muted-foreground">- {log.detalhes}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {log.createdAt && format(new Date(log.createdAt), "dd/MM/yy HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum registro de auditoria.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Área:</span>
                  <span className="font-medium">{getAreaLabel(document.area)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{getTipoLabel(document.tipo)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Versão:</span>
                  <span className="font-medium">{document.versao}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">{document.dataMesAno}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Criador:</span>
                  <span className="font-medium">{getUserName(document.criadorId)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {document.visibilidade === "todos" ? (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">Visibilidade:</span>
                  <span className="font-medium capitalize">{document.visibilidade}</span>
                </div>
              </div>
              {document.tags && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {JSON.parse(document.tags).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Documento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O criador do documento será notificado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="motivo">Motivo da rejeição</Label>
            <RichTextarea
              value={rejectReason}
              onChange={(val: string) => setRejectReason(val)}
              placeholder="Descreva o motivo da rejeição..."
              data-testid="textarea-motivo-rejeicao"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} data-testid="button-cancelar-rejeicao">
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirmar-rejeicao"
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
