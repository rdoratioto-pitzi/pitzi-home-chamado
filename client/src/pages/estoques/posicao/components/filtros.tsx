/**
 * Componente de Filtros para Posição de Estoques
 * Permite filtrar por IMEI, Código ERP, Categoria, Marca, Modelo e Capacidade
 */
import { useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EstoqueFilters {
  imei: string;
  codigoErp: string;
  categoria: string;
  marca: string;
  modelo: string;
  capacidade: string;
}

interface FiltrosProps {
  filters: EstoqueFilters;
  onFilterChange: (filters: EstoqueFilters) => void;
  onClear?: () => void;
  categorias: string[];
  marcas: string[];
  modelos: string[];
}

export function Filtros({
  filters,
  onFilterChange,
  onClear,
  categorias,
  marcas,
  modelos,
}: FiltrosProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const handleFilterChange = (key: keyof EstoqueFilters, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      imei: "",
      codigoErp: "",
      categoria: "",
      marca: "",
      modelo: "",
      capacidade: "",
    });
    onClear?.();
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== "all");

  return (
    <div className="bg-card rounded-lg border p-4 mb-6">
      {/* Header mobile com toggle */}
      <div className="flex items-center justify-between md:hidden mb-3">
        <button
          type="button"
          aria-expanded={mobileExpanded}
          aria-controls="filtros-content"
          onClick={() => setMobileExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {Object.values(filters).filter((v) => v !== "" && v !== "all").length}
            </span>
          )}
          {mobileExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 px-2 text-xs gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Conteúdo dos filtros — sempre visível em md+, colapsável em mobile */}
      <div id="filtros-content" className={`${mobileExpanded ? "block" : "hidden"} md:block`}>
      {/* Linha 1: IMEI, Código ERP, Categoria, Marca */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {/* Input IMEI */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por IMEI..."
            value={filters.imei}
            onChange={(e) => handleFilterChange("imei", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Input Código ERP */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código ERP..."
            value={filters.codigoErp}
            onChange={(e) => handleFilterChange("codigoErp", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select Categoria */}
        <Select
          value={filters.categoria}
          onValueChange={(value) => handleFilterChange("categoria", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Select Marca */}
        <Select
          value={filters.marca}
          onValueChange={(value) => handleFilterChange("marca", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Marcas</SelectItem>
            {marcas.map((marca) => (
              <SelectItem key={marca} value={marca}>
                {marca}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Linha 2: Modelo, Capacidade, Botão Limpar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Select Modelo */}
        <Select
          value={filters.modelo}
          onValueChange={(value) => handleFilterChange("modelo", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Modelos</SelectItem>
            {modelos.map((modelo) => (
              <SelectItem key={modelo} value={modelo}>
                {modelo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Input Capacidade */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Capacidade (ex: 128GB)..."
            value={filters.capacidade}
            onChange={(e) => handleFilterChange("capacidade", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Botão Limpar Filtros — oculto no mobile (já tem no header) */}
        <Button
          variant="outline"
          onClick={handleClearFilters}
          className="hidden md:flex items-center gap-2"
          aria-label="Limpar todos os filtros"
        >
          <X className="h-4 w-4" />
          Limpar Filtros
        </Button>
      </div>
      </div>
    </div>
  );
}
