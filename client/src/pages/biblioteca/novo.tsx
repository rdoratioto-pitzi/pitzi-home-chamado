import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextarea } from "@/components/rich-textarea";
import { useMetaAreas } from "@/hooks/use-meta-areas";
import {
  Save,
  Send,
  ArrowLeft,
  X,
  Plus,
  Upload,
  FileText,
  AlertCircle,
  File,
  Image,
  FileType,
  Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const TIPOS = [
  { value: "politica", label: "Política Interna", code: "POL" },
  { value: "pop", label: "POP", code: "POP" },
  { value: "fluxograma", label: "Fluxograma", code: "FLX" },
  { value: "mapa_cargo", label: "Mapa de Cargo", code: "MCG" },
  { value: "template", label: "Template", code: "TPL" },
  { value: "checklist", label: "Checklist", code: "CHK" },
  { value: "faq", label: "FAQ", code: "FAQ" },
];

const VERSOES = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"];

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf")) return FileType;
  return File;
};

interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export default function NovoDocumentoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: areas = [] } = useMetaAreas();

  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [versao, setVersao] = useState("V1");
  const [dataMesAno, setDataMesAno] = useState(format(new Date(), "yyyy-MM"));
  const [conteudo, setConteudo] = useState("");
  const [conteudoImages, setConteudoImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibilidade, setVisibilidade] = useState("todos");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const nomeArquivo = useMemo(() => {
    if (!area || !tipo || !titulo) return "";
    const tipoInfo = TIPOS.find(t => t.value === tipo);
    const tituloFormatado = titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/\s+/g, "");
    return `${area}_${tipoInfo?.code || tipo.toUpperCase()}${Math.floor(Math.random() * 900) + 100}_${tituloFormatado}_${versao}_${dataMesAno}`;
  }, [area, tipo, titulo, versao, dataMesAno]);

  const isValid = area && tipo && titulo && versao && dataMesAno;

  const handleAttachmentSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({
          title: "Formato não suportado",
          description: `O arquivo ${file.name} não é suportado. Formatos aceitos: PDF, Word, Excel, PowerPoint, imagens.`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `O arquivo ${file.name} excede o limite de 10MB.`,
          variant: "destructive",
        });
        continue;
      }

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      });
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      toast({
        title: "Anexos adicionados",
        description: `${newAttachments.length} arquivo(s) anexado(s) com sucesso.`,
      });
    }

    setIsUploadingAttachment(false);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }, [toast]);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const createMutation = useMutation({
    mutationFn: async (sendForApproval: boolean) => {
      const document = await apiRequest("POST", "/api/conhecimento", {
        area,
        tipo,
        titulo,
        versao,
        dataMesAno,
        nomeArquivo,
        conteudo,
        conteudoImages: conteudoImages.length > 0 ? JSON.stringify(conteudoImages) : null,
        anexos: attachments.length > 0 ? JSON.stringify(attachments) : null,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        visibilidade,
        criadorId: user?.id,
        status: sendForApproval ? "em_analise" : "rascunho",
      });
      return document;
    },
    onSuccess: (doc, sendForApproval) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/stats"] });
      toast({ 
        title: "Sucesso!", 
        description: sendForApproval 
          ? "Documento enviado para aprovação." 
          : "Rascunho salvo com sucesso."
      });
      setLocation("/conhecimento");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Falha ao criar documento.",
        variant: "destructive"
      });
    },
  });

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-novo-documento">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/conhecimento")} data-testid="button-voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="Novo Documento"
          description="Preencha os campos obrigatórios para criar um novo documento na base de conhecimento."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Documento</CardTitle>
              <CardDescription>Campos obrigatórios para identificação do documento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area">Área *</Label>
                  <Select value={area} onValueChange={setArea}>
                    <SelectTrigger id="area" data-testid="select-area">
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a: any) => (
                        <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger id="tipo" data-testid="select-tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value.replace(/[^a-zA-Z0-9\s]/g, ""))}
                  placeholder="Digite o título (sem acentos ou caracteres especiais)"
                  data-testid="input-titulo"
                />
                <p className="text-xs text-muted-foreground">Apenas letras, números e espaços são permitidos.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="versao">Versão *</Label>
                  <Select value={versao} onValueChange={setVersao}>
                    <SelectTrigger id="versao" data-testid="select-versao">
                      <SelectValue placeholder="Versão" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERSOES.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data">Data (YYYY-MM) *</Label>
                  <Input
                    id="data"
                    type="month"
                    value={dataMesAno}
                    onChange={(e) => setDataMesAno(e.target.value)}
                    data-testid="input-data"
                  />
                </div>
              </div>

              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Nome do arquivo (gerado automaticamente)</Label>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm font-mono">
                    {nomeArquivo || "Preencha os campos acima..."}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
              <CardDescription>Escreva o conteúdo do documento. Você pode adicionar imagens e prints de tela.</CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextarea
                value={conteudo}
                onChange={setConteudo}
                images={conteudoImages}
                onImagesChange={setConteudoImages}
                placeholder="Digite o conteúdo do documento aqui..."
                data-testid="textarea-conteudo"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anexos</CardTitle>
              <CardDescription>Anexe documentos PDF, Word, Excel, PowerPoint ou imagens (máx. 10MB cada)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={attachmentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
                multiple
                className="hidden"
                onChange={handleAttachmentSelect}
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={isUploadingAttachment}
                data-testid="button-adicionar-anexo"
              >
                {isUploadingAttachment ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Adicionar Anexo
              </Button>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => {
                    const IconComponent = getFileIcon(attachment.type);
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <IconComponent className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeAttachment(index)}
                          data-testid={`button-remove-anexo-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Adicione tags para facilitar a busca</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Nova tag..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  data-testid="input-tag"
                />
                <Button type="button" size="icon" onClick={handleAddTag} data-testid="button-add-tag">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibilidade</CardTitle>
              <CardDescription>Defina quem pode visualizar este documento</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={visibilidade} onValueChange={setVisibilidade}>
                <SelectTrigger data-testid="select-visibilidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  <SelectItem value="departamento">Apenas meu departamento</SelectItem>
                  <SelectItem value="funcoes">Funções específicas</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 space-y-4">
              {!isValid && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Preencha todos os campos obrigatórios para salvar ou enviar.</span>
                </div>
              )}
              
              <Button
                className="w-full"
                variant="outline"
                disabled={!isValid || createMutation.isPending}
                onClick={() => createMutation.mutate(false)}
                data-testid="button-salvar-rascunho"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar como Rascunho
              </Button>
              
              <Button
                className="w-full"
                disabled={!isValid || createMutation.isPending}
                onClick={() => createMutation.mutate(true)}
                data-testid="button-enviar-aprovacao"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar para Aprovação
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
