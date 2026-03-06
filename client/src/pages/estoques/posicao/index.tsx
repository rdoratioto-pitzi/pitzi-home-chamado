/**
 * Página de Posição de Estoques
 * Exibe dados de estoque em tempo real via integração Omie
 * Acesso conforme permissões configuradas no cadastro de usuários
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TotaisCards } from "./components/totais-cards";
import { Filtros, type EstoqueFilters } from "./components/filtros";
import { Tabela, type EstoqueItem } from "./components/tabela";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, type CurrentUser } from "@/lib/permissions";

interface EstoqueTotais {
  qtdeTotal: number;
  valorTotal: number;
  custoMedioUnitario: number;
}

// Fetch posição de estoques
async function fetchPosicaoEstoque(filters: EstoqueFilters): Promise<EstoqueItem[]> {
  const params = new URLSearchParams();
  
  if (filters.categoria && filters.categoria !== "all") {
    params.append("categoria", filters.categoria);
  }
  if (filters.marca && filters.marca !== "all") {
    params.append("marca", filters.marca);
  }
  if (filters.modelo && filters.modelo !== "all") {
    params.append("modelo", filters.modelo);
  }
  if (filters.codigoErp) {
    params.append("codigoErp", filters.codigoErp);
  }
  
  const response = await fetch(`/api/estoques/posicao?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch stock position");
  }
  const result = await response.json();
  return result.data || [];
}

// Fetch totais de estoques
async function fetchTotaisEstoque(): Promise<EstoqueTotais> {
  const response = await fetch("/api/estoques/posicao/totais");
  if (!response.ok) {
    throw new Error("Failed to fetch totals");
  }
  const result = await response.json();
  return result.data || { qtdeTotal: 0, valorTotal: 0, custoMedioUnitario: 0 };
}

// Fetch categorias
async function fetchCategorias(): Promise<string[]> {
  const response = await fetch("/api/estoques/filtros/categorias");
  if (!response.ok) {
    throw new Error("Failed to fetch categorias");
  }
  const result = await response.json();
  return result.data || [];
}

// Fetch marcas
async function fetchMarcas(): Promise<string[]> {
  const response = await fetch("/api/estoques/filtros/marcas");
  if (!response.ok) {
    throw new Error("Failed to fetch marcas");
  }
  const result = await response.json();
  return result.data || [];
}

// Fetch modelos
async function fetchModelos(): Promise<string[]> {
  const response = await fetch("/api/estoques/filtros/modelos");
  if (!response.ok) {
    throw new Error("Failed to fetch modelos");
  }
  const result = await response.json();
  return result.data || [];
}

// Exportar para Excel
async function exportToExcel() {
  const response = await fetch("/api/estoques/posicao/export");
  if (!response.ok) {
    throw new Error("Failed to export");
  }
  
  // Criar blob e fazer download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "posicao-estoques.xlsx";
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Verifica se o usuário tem acesso ao módulo de estoques
 * baseado nas permissões configuradas
 */
function hasEstoqueAccess(user: CurrentUser | null): boolean {
  if (!user) return false;

  // Administradores têm acesso total
  if (user.isAdmin) return true;

  // Verifica se o módulo 'estoques' está nas permissões do usuário (JSON)
  if (user.modulePermissions) {
    try {
      const permissions = typeof user.modulePermissions === "string"
        ? JSON.parse(user.modulePermissions)
        : user.modulePermissions;
      return permissions.estoques === true;
    } catch {
      return false;
    }
  }

  return false;
}

export default function EstoquesPosicaoPage() {
  const { toast } = useToast();
  
  // Estado local
  const [filters, setFilters] = useState<EstoqueFilters>({
    imei: "",
    codigoErp: "",
    categoria: "",
    marca: "",
    modelo: "",
    capacidade: "",
  });
  const [viewMode, setViewMode] = useState<"categoria" | "item">("item");
  
  // Obter usuário atual do sistema de autenticação
  const user = getCurrentUser();
  
  // Verificar acesso
  const hasAccess = hasEstoqueAccess(user);
  
  // Fetch dados de estoques (apenas se tiver acesso)
  const { data: estoqueData, isLoading: isLoadingEstoque } = useQuery({
    queryKey: ["estoquePosicao", filters],
    queryFn: () => fetchPosicaoEstoque(filters),
    enabled: hasAccess,
  });
  
  // Fetch totais
  const { data: totais, isLoading: isLoadingTotais } = useQuery({
    queryKey: ["estoqueTotais"],
    queryFn: fetchTotaisEstoque,
    enabled: hasAccess,
  });
  
  // Fetch filtros dinâmicos
  const { data: categorias } = useQuery({
    queryKey: ["estoqueCategorias"],
    queryFn: fetchCategorias,
    enabled: hasAccess,
  });
  
  const { data: marcas } = useQuery({
    queryKey: ["estoqueMarcas"],
    queryFn: fetchMarcas,
    enabled: hasAccess,
  });
  
  const { data: modelos } = useQuery({
    queryKey: ["estoqueModelos"],
    queryFn: fetchModelos,
    enabled: hasAccess,
  });
  
  // Handler de exportação
  const handleExport = async () => {
    try {
      await exportToExcel();
      toast({
        title: "Exportação concluída",
        description: "O arquivo Excel foi baixado com sucesso.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Falha ao gerar arquivo Excel.",
        variant: "destructive",
      });
    }
  };
  
  // Verificação de permissão
  if (!hasAccess) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Posição de Estoques"
          description="Consulta em tempo real do estoque via integração Omie"
        />
        <div className="flex items-center justify-center h-full">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>
              Você não possui permissão para acessar este módulo. 
              Entre em contato com o administrador para solicitar acesso.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Posição de Estoques"
        description="Consulta em tempo real do estoque via integração Omie"
      />
      
      {/* Cards Totalizadores */}
      <TotaisCards
        qtdeTotal={totais?.qtdeTotal || 0}
        valorTotal={totais?.valorTotal || 0}
        custoMedioUnitario={totais?.custoMedioUnitario || 0}
        isLoading={isLoadingTotais}
      />
      
      {/* Filtros */}
      <Filtros
        filters={filters}
        onFilterChange={setFilters}
        categorias={categorias || []}
        marcas={marcas || []}
        modelos={modelos || []}
      />
      
      {/* Tabela */}
      <Tabela
        data={estoqueData || []}
        isLoading={isLoadingEstoque}
        viewMode={viewMode}
        onExport={handleExport}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}
