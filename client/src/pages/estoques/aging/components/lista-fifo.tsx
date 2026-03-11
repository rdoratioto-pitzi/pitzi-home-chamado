import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface FifoItem {
  imei:       string;
  modelo:     string;
  categoria:  string;
  mesTradeIn: string;
  diasTotal:  number;
  status:     string;
  etapa:      string;
  valor:      number;
  rede:       string;
  filial:     string;
  faixa:      string;
  cor:        string;
}

interface ListaFifoProps {
  itens:            FifoItem[];
  total:            number;
  pagina:           number;
  totalPaginas:     number;
  isLoading:        boolean;
  selecionados:     string[];
  onSelecionar:     (imeis: string[]) => void;
  onMudarPagina:    (p: number) => void;
}

const ROW_BG: Record<string, string> = {
  green:  'bg-green-50/60 dark:bg-green-950/20',
  yellow: 'bg-yellow-50/60 dark:bg-yellow-950/20',
  orange: 'bg-orange-50/60 dark:bg-orange-950/20',
  red:    'bg-red-50/60 dark:bg-red-950/20',
  black:  'bg-red-100/80 dark:bg-red-950/40',
};

const DIAS_BADGE: Record<string, string> = {
  green:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  black:  'bg-gray-900 text-gray-100 dark:bg-gray-100 dark:text-gray-900 font-bold',
};

function formatCurrency(val: number) {
  return val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
}

export function ListaFifo({
  itens,
  total,
  pagina,
  totalPaginas,
  isLoading,
  selecionados,
  onSelecionar,
  onMudarPagina,
}: ListaFifoProps) {
  const todosImeis    = itens.map(i => i.imei).filter(Boolean);
  const todosSelecionados = todosImeis.length > 0 && todosImeis.every(imei => selecionados.includes(imei));

  function toggleTodos() {
    if (todosSelecionados) {
      onSelecionar(selecionados.filter(s => !todosImeis.includes(s)));
    } else {
      const novos = [...new Set([...selecionados, ...todosImeis])];
      onSelecionar(novos);
    }
  }

  function toggleItem(imei: string) {
    if (selecionados.includes(imei)) {
      onSelecionar(selecionados.filter(s => s !== imei));
    } else {
      onSelecionar([...selecionados, imei]);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum item encontrado com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-2 px-3 w-10">
                <Checkbox checked={todosSelecionados} onCheckedChange={toggleTodos} />
              </th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">IMEI</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Modelo</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground hidden md:table-cell">Categoria</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Mês Trade-in</th>
              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Dias</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground hidden lg:table-cell">Valor</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground hidden lg:table-cell">Rede</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => {
              const selecionado = selecionados.includes(item.imei);
              return (
                <tr
                  key={item.imei || idx}
                  className={cn(
                    'border-t transition-colors',
                    ROW_BG[item.cor] ?? '',
                    selecionado && 'ring-1 ring-primary/30',
                  )}
                >
                  <td className="py-2 px-3">
                    <Checkbox
                      checked={selecionado}
                      onCheckedChange={() => toggleItem(item.imei)}
                      disabled={!item.imei}
                    />
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                    {item.imei || <span className="italic">N/D</span>}
                  </td>
                  <td className="py-2 px-3 font-medium max-w-[180px] truncate">
                    {item.modelo || <span className="text-muted-foreground italic">N/D</span>}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">
                    {item.categoria || '—'}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {item.mesTradeIn}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-bold', DIAS_BADGE[item.cor] ?? '')}>
                      {item.diasTotal}d
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{item.status}</td>
                  <td className="py-2 px-3 text-right tabular-nums hidden lg:table-cell">
                    {formatCurrency(item.valor)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">
                    {item.rede || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString('pt-BR')} itens
          {selecionados.length > 0 && (
            <span className="ml-2 text-primary font-medium">· {selecionados.length} selecionados</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMudarPagina(pagina - 1)}
            disabled={pagina <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs">{pagina} / {totalPaginas}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMudarPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
