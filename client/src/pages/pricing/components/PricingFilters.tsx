import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Metadata {
  networks: string[];
  categories: Array<{ Id: string | number; Name: string }>;
  weeks: Array<{ label: string; value: string }>;
}

interface FilterState {
  networks?: string[];
  categories?: Array<string | number>;
  weeks?: string[];
  limit: number;
}

interface PricingFiltersProps {
  metadata?: Metadata;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function PricingFilters({
  metadata,
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing,
}: PricingFiltersProps) {
  const handleNetworkToggle = (network: string) => {
    const current = filters.networks || [];
    const updated = current.includes(network)
      ? current.filter((n) => n !== network)
      : [...current, network];
    onFiltersChange({ ...filters, networks: updated });
  };

  const handleCategoryToggle = (categoryId: string | number) => {
    const current = filters.categories || [];
    const updated = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId];
    onFiltersChange({ ...filters, categories: updated });
  };

  const handleWeekToggle = (week: string) => {
    const current = filters.weeks || [];
    const updated = current.includes(week)
      ? current.filter((w) => w !== week)
      : [...current, week];
    onFiltersChange({ ...filters, weeks: updated });
  };

  const handleClearFilters = () => {
    onFiltersChange({ limit: 50 });
  };

  const activeFiltersCount =
    (filters.networks?.length || 0) +
    (filters.categories?.length || 0) +
    (filters.weeks?.length || 0);

  return (
    <Card className="shadow-sm border-border/70 bg-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Filtros</h3>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <>
                <Badge variant="secondary">{activeFiltersCount} ativos</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Linha de filtros visíveis */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Top N */}
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">
              Exibir Top
            </label>
            <Select
              value={filters.limit.toString()}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, limit: parseInt(value) })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
                <SelectItem value="100">Top 100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Redes */}
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">
              Redes ({filters.networks?.length || 0})
            </label>
            <Select>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione redes..." />
              </SelectTrigger>
              <SelectContent>
                {metadata?.networks?.map((network) => (
                  <div
                    key={network}
                    className="px-2 py-1.5 cursor-pointer hover:bg-accent"
                    onClick={() => handleNetworkToggle(network)}
                  >
                    <input
                      type="checkbox"
                      checked={filters.networks?.includes(network) || false}
                      readOnly
                      className="mr-2"
                    />
                    {network}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categorias */}
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">
              Categorias ({filters.categories?.length || 0})
            </label>
            <Select>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione categorias..." />
              </SelectTrigger>
              <SelectContent>
                {metadata?.categories?.map((category) => (
                  <div
                    key={category.Id}
                    className="px-2 py-1.5 cursor-pointer hover:bg-accent"
                    onClick={() => handleCategoryToggle(category.Id)}
                  >
                    <input
                      type="checkbox"
                      checked={filters.categories?.includes(category.Id) || false}
                      readOnly
                      className="mr-2"
                    />
                    {category.Name}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Semanas */}
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">
              Semanas ({filters.weeks?.length || 0})
            </label>
            <Select>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione semanas..." />
              </SelectTrigger>
              <SelectContent>
                {metadata?.weeks?.map((week) => (
                  <div
                    key={week.value}
                    className="px-2 py-1.5 cursor-pointer hover:bg-accent"
                    onClick={() => handleWeekToggle(week.value)}
                  >
                    <input
                      type="checkbox"
                      checked={filters.weeks?.includes(week.value) || false}
                      readOnly
                      className="mr-2"
                    />
                    {week.label}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtros selecionados como badges */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 pt-4 border-t border-border/70">
            <div className="flex flex-wrap gap-2">
              {filters.networks?.map((network) => (
                <Badge
                  key={network}
                  variant="outline"
                  className="gap-1 cursor-pointer hover:bg-accent"
                  onClick={() => handleNetworkToggle(network)}
                >
                  Rede: {network}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
              {filters.categories?.map((categoryId) => {
                const categoryName = metadata?.categories?.find(
                  (c) => c.Id === categoryId
                )?.Name;
                return (
                  <Badge
                    key={categoryId}
                    variant="outline"
                    className="gap-1 cursor-pointer hover:bg-accent"
                    onClick={() => handleCategoryToggle(categoryId)}
                  >
                    Categoria: {categoryName}
                    <X className="w-3 h-3" />
                  </Badge>
                );
              })}
              {filters.weeks?.map((week) => {
                const weekLabel = metadata?.weeks?.find(
                  (w) => w.value === week
                )?.label;
                return (
                  <Badge
                    key={week}
                    variant="outline"
                    className="gap-1 cursor-pointer hover:bg-accent"
                    onClick={() => handleWeekToggle(week)}
                  >
                    {weekLabel}
                    <X className="w-3 h-3" />
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
