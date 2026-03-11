import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface CategoriaData {
  categoria: string;
  qtdeContada: number;
}

interface VisaoCategoriaProps {
  categorias: CategoriaData[];
  isLoading: boolean;
}

export function VisaoCategoria({ categorias, isLoading }: VisaoCategoriaProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const totalContado = categorias.reduce((sum, c) => sum + c.qtdeContada, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Qtd Contada</TableHead>
          <TableHead className="text-right">% do Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categorias.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
              Nenhum item contado
            </TableCell>
          </TableRow>
        ) : (
          categorias.map((c) => (
            <TableRow key={c.categoria}>
              <TableCell className="font-medium">{c.categoria}</TableCell>
              <TableCell className="text-right">{c.qtdeContada.toLocaleString("pt-BR")}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {totalContado > 0 ? ((c.qtdeContada / totalContado) * 100).toFixed(1) : "0.0"}%
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      {categorias.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">
              {totalContado.toLocaleString("pt-BR")}
            </TableCell>
            <TableCell className="text-right font-bold">100%</TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
