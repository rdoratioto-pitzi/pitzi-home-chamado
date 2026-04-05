import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Objective, KeyResult } from "@shared/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type KrStatus = "achieved" | "partial" | "not_achieved";
type CloseStatus = KrStatus;

function calcWorstStatus(statuses: KrStatus[]): CloseStatus {
  if (statuses.includes("not_achieved")) return "not_achieved";
  if (statuses.includes("partial")) return "partial";
  return "achieved";
}

function calcKRProgressPercent(kr: KeyResult): number {
  const start = parseFloat(kr.startValue ?? "0");
  const target = parseFloat(kr.targetValue);
  const current = parseFloat(kr.currentValue);
  let p: number;
  if (kr.measurementType === "decreasing") {
    p = target !== start ? ((start - current) / (start - target)) * 100 : 0;
  } else if (kr.measurementType === "binary") {
    p = current > 0 ? 100 : 0;
  } else {
    p = target !== start ? ((current - start) / (target - start)) * 100 : 0;
  }
  return Math.round(Math.max(0, Math.min(100, p)));
}

const krStatusLabels: Record<KrStatus, string> = {
  achieved: "Atingido",
  partial: "Parcialmente Atingido",
  not_achieved: "Não Atingido",
};

const closeStatusConfig: Record<
  CloseStatus,
  { label: string; className: string }
> = {
  achieved: {
    label: "Atingido",
    className: "bg-green-500/10 text-green-600 border-green-500/30",
  },
  partial: {
    label: "Parcialmente Atingido",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  },
  not_achieved: {
    label: "Não Atingido",
    className: "bg-red-500/10 text-red-600 border-red-500/30",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObjectiveRetrospectiveDialogProps {
  objective: Objective;
  keyResults: KeyResult[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ObjectiveRetrospectiveDialog({
  objective,
  keyResults,
  open,
  onClose,
  onSuccess,
  readOnly = false,
}: ObjectiveRetrospectiveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado por KR — mapeado por id
  const [krStatuses, setKrStatuses] = useState<Record<string, KrStatus>>({});
  const [closeComment, setCloseComment] = useState("");

  const allKrsEvaluated =
    keyResults.length === 0 ||
    keyResults.every((kr) => krStatuses[kr.id] !== undefined);
  const commentValid = closeComment.trim().length >= 20;
  const canSubmit = allKrsEvaluated && commentValid;

  const closeMutation = useMutation({
    mutationFn: async () => {
      const closeStatus =
        keyResults.length === 0
          ? "achieved"
          : calcWorstStatus(keyResults.map((kr) => krStatuses[kr.id]));
      return apiRequest("POST", `/api/objectives/${objective.id}/close`, {
        closeStatus,
        closeComment: closeComment.trim(),
      });
    },
    onSuccess: () => {
      toast({ title: "Objetivo encerrado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Erro ao encerrar objetivo";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  // ── Read-only view ────────────────────────────────────────────────────────
  if (readOnly) {
    const status = objective.closeStatus as CloseStatus | null;
    const statusCfg = status ? closeStatusConfig[status] : null;
    const closedDate = objective.closedAt
      ? format(new Date(objective.closedAt), "dd/MM/yyyy", { locale: ptBR })
      : null;

    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Retrospectiva — {objective.title}</DialogTitle>
            {closedDate && (
              <DialogDescription>Encerrado em {closedDate}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {statusCfg && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Resultado:</span>
                <Badge
                  variant="outline"
                  className={statusCfg.className}
                >
                  {statusCfg.label}
                </Badge>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Aprendizado</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                {objective.closeComment || "—"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Edit (encerrar) view ──────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar Quarter</DialogTitle>
          <DialogDescription className="text-[var(--l3)]">
            {objective.title}
          </DialogDescription>
        </DialogHeader>

        {/* Aviso permanente */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Esta ação é permanente. O objetivo ficará visível como histórico
            mas não poderá ser editado após o encerramento.
          </span>
        </div>

        <div className="space-y-5 py-1">
          {/* Avaliação dos KRs */}
          <div>
            <p className="text-sm font-semibold mb-3">Avaliação dos KRs</p>
            {keyResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este objetivo não possui KRs cadastrados.
              </p>
            ) : (
              <div className="space-y-4">
                {keyResults.map((kr) => (
                  <div
                    key={kr.id}
                    className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {kr.title}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {calcKRProgressPercent(kr)}%
                      </span>
                    </div>
                    <RadioGroup
                      value={krStatuses[kr.id] ?? ""}
                      onValueChange={(v) =>
                        setKrStatuses((prev) => ({ ...prev, [kr.id]: v as KrStatus }))
                      }
                    >
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {(["achieved", "partial", "not_achieved"] as KrStatus[]).map(
                          (status) => (
                            <div
                              key={status}
                              className="flex items-center gap-1.5"
                            >
                              <RadioGroupItem
                                value={status}
                                id={`${kr.id}-${status}`}
                              />
                              <Label
                                htmlFor={`${kr.id}-${status}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                {krStatusLabels[status]}
                              </Label>
                            </div>
                          )
                        )}
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aprendizado */}
          <div>
            <Label htmlFor="close-comment" className="text-sm font-semibold">
              O que aprendemos com este objetivo?
            </Label>
            <Textarea
              id="close-comment"
              className="mt-2 min-h-[100px] text-sm"
              placeholder="Descreva o que funcionou, o que não funcionou e o que faremos diferente no próximo quarter."
              value={closeComment}
              onChange={(e) => setCloseComment(e.target.value)}
            />
            <p
              className={`mt-1 text-xs ${
                closeComment.trim().length >= 20
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              }`}
            >
              {closeComment.trim().length} caracteres (mínimo 20)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={closeMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canSubmit || closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending ? "Encerrando..." : "Encerrar Objetivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
