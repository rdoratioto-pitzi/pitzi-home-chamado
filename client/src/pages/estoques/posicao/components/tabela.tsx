/**
 * Componente de Tabela para Posição de Estoques
 * Exibe dados em formato tabular com ordenação, paginação e toggle categoria/item
 */
import { useState, useMemo, Fragment } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "../../utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EstoqueItem {
  codigoErp: string;
  descricao: string;
  categoria: string;
  marca: string;
  modelo: string;
  unidade: string;
  estoqueDisponivel: number;
  custoUnitario: number;
  valorVenda: number;
  custoTotal: number;
  markup: number;
}

interface TabelaProps {
  data: EstoqueItem[];
  isLoading: boolean;
  viewMode: "categoria" | "item";
  onExport: () => void;
  onViewModeChange: (mode: "categoria" | "item") => void;
}

type SortField = keyof EstoqueItem;
type SortDirection = "asc" | "desc";


export function Tabela({
  data,
  isLoading,
  viewMode,
  onExport,
  onViewModeChange,
}: TabelaProps) {
  const [sortField, setSortField] = useState<SortField>("codigoErp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Calcula custoTotal e markup para cada item
  const processedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      custoTotal: item.estoqueDisponivel * item.custoUnitario,
      markup: item.custoUnitario > 0 
        ? ((item.valorVenda - item.custoUnitario) / item.custoUnitario) * 100 
        : 0,
    }));
  }, [data]);

  // Ordena dados
  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [processedData, sortField, sortDirection]);

  // Agrupa por categoria se viewMode for 'categoria'
  const groupedData = useMemo(() => {
    if (viewMode !== "categoria") return null;
    
    const groups: Record<string, EstoqueItem[]> = {};
    sortedData.forEach((item) => {
      const cat = item.categoria || "Sem Categoria";
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    });
    
    return groups;
  }, [sortedData, viewMode]);

  // Paginação
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código ERP</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Custo Unit.</TableHead>
              <TableHead>Custo Total</TableHead>
              <TableHead>Valor Venda</TableHead>
              <TableHead>Markup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Toggle View Mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Visualização:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {viewMode === "categoria" ? "Por Categoria" : "Por Item"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onViewModeChange("item")}>
                Por Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewModeChange("categoria")}>
                Por Categoria
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Botão Exportar */}
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("codigoErp")}
              >
                Código ERP{getSortIndicator("codigoErp")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("categoria")}
              >
                Categoria{getSortIndicator("categoria")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("marca")}
              >
                Marca{getSortIndicator("marca")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("modelo")}
              >
                Modelo{getSortIndicator("modelo")}
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:text-primary"
                onClick={() => handleSort("estoqueDisponivel")}
              >
                Estoque Disponível{getSortIndicator("estoqueDisponivel")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("custoUnitario")}
              >
                Custo Unit.{getSortIndicator("custoUnitario")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("custoTotal")}
              >
                Custo Total{getSortIndicator("custoTotal")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("valorVenda")}
              >
                Valor Venda{getSortIndicator("valorVenda")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-primary"
                onClick={() => handleSort("markup")}
              >
                Markup{getSortIndicator("markup")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {viewMode === "item" ? (
              // Modo Item: lista simples
              paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={`${item.codigoErp}-${index}`}>
                    <TableCell className="font-mono">{item.codigoErp}</TableCell>
                    <TableCell>{item.categoria}</TableCell>
                    <TableCell>{item.marca}</TableCell>
                    <TableCell>{item.modelo}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.estoqueDisponivel)}</TableCell>
                    <TableCell>{formatCurrency(item.custoUnitario)}</TableCell>
                    <TableCell>{formatCurrency(item.custoTotal)}</TableCell>
                    <TableCell>{formatCurrency(item.valorVenda)}</TableCell>
                    <TableCell>{item.markup.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )
            ) : (
              // Modo Categoria: agrupado
              groupedData && Object.keys(groupedData).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : (
                groupedData && Object.entries(groupedData).map(([categoria, items]) => (
                  <Fragment key={categoria}>
                    {/* Linha de cabeçalho da categoria */}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={9} className="font-bold">
                        {categoria} ({items.length} itens)
                      </TableCell>
                    </TableRow>
                    {/* Itens da categoria */}
                    {items.map((item, index) => (
                      <TableRow key={`${item.codigoErp}-${index}`}>
                        <TableCell className="font-mono">{item.codigoErp}</TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell>{item.marca}</TableCell>
                        <TableCell>{item.modelo}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.estoqueDisponivel)}</TableCell>
                        <TableCell>{formatCurrency(item.custoUnitario)}</TableCell>
                        <TableCell>{formatCurrency(item.custoTotal)}</TableCell>
                        <TableCell>{formatCurrency(item.valorVenda)}</TableCell>
                        <TableCell>{item.markup.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                    {/* Subtotal da categoria */}
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={4}>Subtotal</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(items.reduce((sum, i) => sum + i.estoqueDisponivel, 0))}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        {formatCurrency(items.reduce((sum, i) => sum + (i.estoqueDisponivel * i.custoUnitario), 0))}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </Fragment>
                ))
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Itens por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages || 1}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
