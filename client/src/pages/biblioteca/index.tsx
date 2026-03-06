import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileBrowser } from "@/components/conhecimento/file-browser";
import { useMetaAreas } from "@/hooks/use-meta-areas";
import {
  Search,
  Plus,
  FileText,
  BookOpen,
  FileCheck,
  Workflow,
  Users,
  ClipboardList,
  HelpCircle,
} from "lucide-react";

const TIPOS = [
  { value: 'politica', label: 'Políticas Internas', icon: FileText, color: 'bg-blue-500' },
  { value: 'pop', label: 'POPs', icon: FileCheck, color: 'bg-green-500' },
  { value: 'fluxograma', label: 'Fluxogramas', icon: Workflow, color: 'bg-purple-500' },
  { value: 'mapa-cargo', label: 'Mapas de Cargo', icon: Users, color: 'bg-orange-500' },
  { value: 'template', label: 'Templates', icon: BookOpen, color: 'bg-cyan-500' },
  { value: 'checklist', label: 'Checklists', icon: ClipboardList, color: 'bg-yellow-500' },
  { value: 'faq', label: 'FAQs', icon: HelpCircle, color: 'bg-pink-500' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Em Revisão' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivado' },
];

export default function BibliotecaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: areas = [] } = useMetaAreas();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['/api/knowledge/documents'],
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc: any) => {
      const matchesSearch = !searchTerm || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesArea = areaFilter === "all" || doc.area === areaFilter;
      const matchesType = typeFilter === "all" || doc.type === typeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;

      return matchesSearch && matchesArea && matchesType && matchesStatus;
    });
  }, [documents, searchTerm, areaFilter, typeFilter, statusFilter]);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-conhecimento">
      <PageHeader
        title="Biblioteca"
        description="Acesse políticas, procedimentos, templates e documentos internos da organização."
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, área, tipo, tag ou conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-area">
              <SelectValue placeholder="Filtrar por Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {areas.map((area: any) => (
                <SelectItem key={area.name} value={area.name}>{area.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-type">
              <SelectValue placeholder="Filtrar por Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {TIPOS.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-status">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {STATUS_OPTIONS.map(status => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button asChild>
            <Link href="/conhecimento/novo">
              <Plus className="h-4 w-4 mr-2" />
              Novo Documento
            </Link>
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {TIPOS.map((tipo) => {
          const count = filteredDocuments.filter((doc: any) => doc.type === tipo.value).length;
          return (
            <Card key={tipo.value} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-4 pb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tipo.color}`}>
                  <tipo.icon className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-sm font-medium">{tipo.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista de Documentos - Estilo GitHub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documentos</h2>
          <span className="text-sm text-muted-foreground">
            {filteredDocuments.length} documento(s) encontrado(s)
          </span>
        </div>
        
        <FileBrowser
          files={filteredDocuments.map((doc: any) => ({
            type: 'file' as const,
            name: doc.title,
            description: doc.description || 'Sem descrição',
            updatedAt: new Date(doc.updatedAt),
            path: `/conhecimento/${doc.id}`,
          }))}
          breadcrumbs={[
            { name: 'Biblioteca', path: '/conhecimento' }
          ]}
        />
      </div>
    </div>
  );
}