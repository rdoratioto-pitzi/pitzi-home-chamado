import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface GiroCategoria {
  categoria: string;
  giro: number;
  dias: number;
  qtde: number;
  valor: number;
}

interface GiroDados {
  giroGeral: number;
  diasEmEstoque: number;
  porCategoria: GiroCategoria[];
  comparativoMensal: { mes: string; giro: number; dias: number }[];
  periodo: string;
}

interface Props {
  dados: GiroDados | undefined;
  isLoading: boolean;
  periodo: string;
  onPeriodoChange: (p: string) => void;
}

const PERIODO_LABELS: Record<string, string> = {
  '30d': '30 dias', '60d': '60 dias', '90d': '90 dias', '12m': '12 meses',
};

function getGiroColor(giro: number): string {
  if (giro >= 4) return '#22c55e';
  if (giro >= 2) return '#3b82f6';
  if (giro >= 1) return '#eab308';
  return '#ef4444';
}

function GiroStatus({ giro }: { giro: number }) {
  if (giro >= 4) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Excelente</Badge>;
  if (giro >= 2) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Bom</Badge>;
  if (giro >= 1) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Regular</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Crítico</Badge>;
}

export function GiroEstoque({ dados, isLoading, periodo, onPeriodoChange }: Props) {
  const giroGeral = dados?.giroGeral ?? 0;
  const diasEmEstoque = dados?.diasEmEstoque ?? 0;
  const porCategoria = dados?.porCategoria ?? [];
  const metaDias = 90; // meta de até 90 dias em estoque

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-5 w-5 text-blue-500" />
            Giro de Estoque
          </CardTitle>
          <Select value={periodo} onValueChange={onPeriodoChange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODO_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cards de métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Giro Geral</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{giroGeral.toFixed(1)}x</span>
              {giroGeral >= 2
                ? <TrendingUp className="h-4 w-4 text-green-500" />
                : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <div className="mt-1"><GiroStatus giro={giroGeral} /></div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Dias em Estoque</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{diasEmEstoque}</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {metaDias} dias {diasEmEstoque <= metaDias ? '✓' : '↑'}
            </p>
          </div>
        </div>

        {/* Gráfico de barras por categoria */}
        {porCategoria.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Giro por Categoria</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={porCategoria.slice(0, 8)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}x`, 'Giro']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="giro" radius={[4, 4, 0, 0]}>
                  {porCategoria.slice(0, 8).map((entry, idx) => (
                    <Cell key={idx} fill={getGiroColor(entry.giro)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela resumo */}
        {porCategoria.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Resumo por Categoria</p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">Categoria</TableHead>
                    <TableHead className="text-xs py-2 text-right">Giro</TableHead>
                    <TableHead className="text-xs py-2 text-right">Dias</TableHead>
                    <TableHead className="text-xs py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCategoria.slice(0, 6).map((row) => (
                    <TableRow key={row.categoria}>
                      <TableCell className="text-xs py-1.5">{row.categoria}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-medium">{row.giro.toFixed(2)}x</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">{row.dias}d</TableCell>
                      <TableCell className="text-xs py-1.5"><GiroStatus giro={row.giro} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
