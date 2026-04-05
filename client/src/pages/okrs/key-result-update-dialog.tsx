import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RichTextarea } from "@/components/rich-textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { KeyResult, KeyResultUpdate } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, Clock, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  newValue: z.coerce.number().min(0, "Valor deve ser 0 ou maior"),
  comment: z.string().optional(),
  checkInDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface KeyResultUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: KeyResult | null;
  cycle?: string;
}

function getQuarterTimeElapsed(cycle: string | null | undefined): number {
  if (!cycle) return 50;
  const match = cycle.match(/(\d{4})\s+Q(\d)/);
  if (!match) return 50;
  const year = parseInt(match[1]);
  const q = parseInt(match[2]);
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 1);
  const now = new Date();
  if (now < start) return 0;
  if (now >= end) return 100;
  return Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

function calcProgress(current: number, start: number, target: number, type: string | null): number {
  if (type === "decreasing") {
    return target !== start ? ((start - current) / (start - target)) * 100 : 0;
  } else if (type === "binary") {
    return current > 0 ? 100 : 0;
  } else {
    return target !== start ? ((current - start) / (target - start)) * 100 : 0;
  }
}

export function KeyResultUpdateDialog({ open, onOpenChange, keyResult, cycle }: KeyResultUpdateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  const { data: updates = [], isLoading: updatesLoading } = useQuery<(KeyResultUpdate & { user?: { name: string } })[]>({
    queryKey: ["/api/key-results", keyResult?.id, "updates"],
    enabled: !!keyResult?.id,
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newValue: parseFloat(keyResult?.currentValue || "0"),
      comment: "",
      checkInDate: todayStr,
    },
  });

  // Sync form value when keyResult changes
  if (keyResult && form.getValues("newValue") === 0 && parseFloat(keyResult.currentValue || "0") > 0) {
    form.setValue("newValue", parseFloat(keyResult.currentValue || "0"));
  }

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", `/api/key-results/${keyResult?.id}/updates`, {
        newValue: String(data.newValue),
        comment: data.comment,
        userId: authUser?.id || "system",
        checkInDate: data.checkInDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-results", keyResult?.id, "updates"] });
      toast({ title: "Check-in registrado", description: "O progresso do KR foi atualizado." });
      form.reset({ newValue: 0, comment: "", checkInDate: todayStr });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível registrar o check-in.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  if (!keyResult) return null;

  const currentValue = parseFloat(keyResult.currentValue || "0");
  const targetValue = parseFloat(keyResult.targetValue || "100");
  const startValue = parseFloat(keyResult.startValue || "0");

  const watchedValue = form.watch("newValue");
  const previewProgress = Math.min(100, Math.max(0,
    calcProgress(watchedValue || 0, startValue, targetValue, keyResult.measurementType)
  ));
  const timeElapsed = getQuarterTimeElapsed(cycle);
  const progressColor =
    previewProgress >= timeElapsed * 0.9 ? "text-green-500"
    : previewProgress >= timeElapsed * 0.6 ? "text-amber-500"
    : "text-red-500";

  const getProgressIcon = (prev: number, next: number) => {
    if (next > prev) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (next < prev) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Check-in — {keyResult.title}</DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: "var(--l3)" }}>
            De {startValue} → Para {targetValue}{keyResult.unit ? ` ${keyResult.unit}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor atual</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={String(currentValue)}
                        data-testid="input-update-value"
                        {...field}
                      />
                    </FormControl>
                    {keyResult.measurementType === "binary" ? (
                      <FormDescription>0 = Não concluído, 1 = Concluído</FormDescription>
                    ) : (
                      <p className={`text-[12px] font-medium ${progressColor}`}>
                        Isso representa {Math.round(previewProgress)}% da meta
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>O que aconteceu? O que vai mudar?</FormLabel>
                    <FormControl>
                      <RichTextarea
                        placeholder="Opcional — descreva o contexto deste resultado"
                        data-testid="input-update-comment"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do check-in</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-update">
                  {mutation.isPending ? "Salvando..." : "Registrar Check-in"}
                </Button>
              </DialogFooter>
            </form>
          </Form>

          <div className="border-t pt-4">
            <h4 className="text-sm font-bold mb-3">Histórico de Atualizações</h4>
            {updatesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : updates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum check-in registrado ainda.
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-4">
                  {[...updates]
                    .sort((a, b) => {
                      const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      return dB - dA;
                    })
                    .map((update) => {
                      const prevVal = parseFloat(update.previousValue || "0");
                      const newVal = parseFloat(update.newValue || "0");
                      return (
                        <div
                          key={update.id}
                          className="p-3 bg-muted/20 rounded-lg border border-border/40"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getProgressIcon(prevVal, newVal)}
                              <span className="font-medium">{prevVal} → {newVal}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{update.user?.name || "Sistema"}</span>
                              <span className="mx-1">•</span>
                              <Clock className="h-3 w-3" />
                              {update.createdAt && formatDistanceToNow(new Date(update.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </div>
                          </div>
                          {update.comment && (
                            <p className="text-sm text-muted-foreground mt-1">{update.comment}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
