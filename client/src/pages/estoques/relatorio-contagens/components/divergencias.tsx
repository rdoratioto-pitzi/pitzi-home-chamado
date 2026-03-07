import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DivergenciaData {
  id: string;
  tipo: string;
  imei: string | null;
  codigoErp: string | null;
  modelo: string | null;
  categoria: string | null;
  marca: string | null;
  ultimaMovimentacao: string | null;
  possivelCausa: string | null;
  statusAnalise: string | null;
  observacaoAnalise: string | null;
}

interface DivergenciasProps {
  divergencias: DivergenciaData[];
  isLoading: boolean;
  contagemId: string;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "resolvido") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolvido</Badge>;
  }
  if (status === "investigando") {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Investigando</Badge>;
  }
  return <Badge variant="secondary">Pendente</Badge>;
}

function DivergenciaTable({
  items,
  isLoading,
  onAjuste,
}: {
  items: DivergenciaData[];
  isLoading: boolean;
  onAjuste: (div: DivergenciaData) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Nenhuma divergência registrada
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>IMEI</TableHead>
          <TableHead>Código ERP</TableHead>
          <TableHead>Modelo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((div) => (
          <TableRow key={div.id}>
            <TableCell className="font-mono text-sm">{div.imei || "—"}</TableCell>
            <TableCell>{div.codigoErp || "—"}</TableCell>
            <TableCell>{div.modelo || "—"}</TableCell>
            <TableCell>{div.categoria || "—"}</TableCell>
            <TableCell>
              <StatusBadge status={div.statusAnalise} />
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                disabled={div.statusAnalise === "resolvido"}
                onClick={() => onAjuste(div)}
              >
                Registrar Ajuste
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Divergencias({ divergencias, isLoading, contagemId }: DivergenciasProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDiv, setSelectedDiv] = useState<DivergenciaData | null>(null);
  const [tipoAjuste, setTipoAjuste] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const faltas = divergencias.filter((d) => d.tipo === "falta");
  const sobras = divergencias.filter((d) => d.tipo === "sobra");

  const ajusteMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetchWithAuth("/api/estoques/ajustes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao registrar ajuste");
      return json.data;
    },
    onSuccess: () => {
      toast({ title: "Ajuste registrado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["contagem-divergencias", contagemId] });
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  function handleCloseModal() {
    setSelectedDiv(null);
    setTipoAjuste("");
    setQuantidade("");
    setJustificativa("");
  }

  function handleSubmitAjuste() {
    if (!tipoAjuste) {
      toast({ title: "Selecione o tipo de ajuste", variant: "destructive" });
      return;
    }
    if (justificativa.length < 20) {
      toast({ title: "Justificativa deve ter no mínimo 20 caracteres", variant: "destructive" });
      return;
    }
    ajusteMutation.mutate({
      contagemId,
      divergenciaId: selectedDiv?.id,
      tipoAjuste,
      imei: selectedDiv?.imei,
      codigoErp: selectedDiv?.codigoErp,
      quantidade: quantidade ? parseInt(quantidade) : undefined,
      justificativa,
    });
  }

  return (
    <>
      <Tabs defaultValue="faltas">
        <TabsList>
          <TabsTrigger value="faltas">Faltas ({faltas.length})</TabsTrigger>
          <TabsTrigger value="sobras">Sobras ({sobras.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="faltas" className="mt-4">
          <DivergenciaTable items={faltas} isLoading={isLoading} onAjuste={setSelectedDiv} />
        </TabsContent>
        <TabsContent value="sobras" className="mt-4">
          <DivergenciaTable items={sobras} isLoading={isLoading} onAjuste={setSelectedDiv} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDiv} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Ajuste de Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Ajuste *</Label>
              <Select value={tipoAjuste} onValueChange={setTipoAjuste}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IMEI</Label>
                <Input className="mt-1" value={selectedDiv?.imei || ""} disabled />
              </div>
              <div>
                <Label>Código ERP</Label>
                <Input className="mt-1" value={selectedDiv?.codigoErp || ""} disabled />
              </div>
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                className="mt-1"
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 1"
              />
            </div>

            <div>
              <Label>Justificativa * (mín. 20 caracteres)</Label>
              <Textarea
                className="mt-1"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo do ajuste detalhadamente..."
                rows={4}
              />
              <p
                className={`text-xs mt-1 ${justificativa.length < 20 ? "text-muted-foreground" : "text-green-600"}`}
              >
                {justificativa.length} / 20 caracteres mínimos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitAjuste} disabled={ajusteMutation.isPending}>
              {ajusteMutation.isPending ? "Registrando..." : "Registrar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
