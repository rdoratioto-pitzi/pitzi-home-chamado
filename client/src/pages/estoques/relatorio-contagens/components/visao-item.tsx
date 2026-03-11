import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ItemData {
  id: string;
  imei: string;
  codigoErp: string | null;
  modelo: string | null;
  categoria: string | null;
  marca: string | null;
  metodoLeitura: string;
  contadoEm: string | null;
}

interface VisaoItemProps {
  itens: ItemData[];
  isLoading: boolean;
}

const PAGE_SIZE = 20;

export function VisaoItem({ itens, isLoading }: VisaoItemProps) {
  const [page, setPage] = useState(1);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(itens.length / PAGE_SIZE);
  const paged = itens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Total: <strong>{itens.length.toLocaleString("pt-BR")}</strong> itens
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>IMEI</TableHead>
            <TableHead>Código ERP</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Contado Em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Nenhum item encontrado
              </TableCell>
            </TableRow>
          ) : (
            paged.map((item, idx) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground text-sm">
                  {(page - 1) * PAGE_SIZE + idx + 1}
                </TableCell>
                <TableCell className="font-mono text-sm">{item.imei}</TableCell>
                <TableCell>{item.codigoErp || "—"}</TableCell>
                <TableCell>{item.modelo || "—"}</TableCell>
                <TableCell>{item.categoria || "—"}</TableCell>
                <TableCell>{item.marca || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {item.metodoLeitura === "barcode" ? "Barcode" : "Manual"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {item.contadoEm
                    ? new Date(item.contadoEm).toLocaleString("pt-BR")
                    : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
