import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrencyInputValue, parseCurrencyInputValue } from "@/lib/kr-format";
import type { KeyResult, Objective, User } from "@shared/schema";

const measurementTypes = [
  { value: "percentage", label: "Percentual (%)" },
  { value: "absolute", label: "Absoluto (número)" },
  { value: "monetary", label: "Monetário (R$)" },
  { value: "binary", label: "Binário (sim/não)" },
  { value: "decreasing", label: "Decrescente (menos é melhor)" },
];

const formSchema = z.object({
  objectiveId: z.string().min(1, "Selecione o objetivo pai"),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  measurementType: z.enum(["percentage", "absolute", "monetary", "binary", "decreasing"]),
  startValue: z.coerce.number(),
  targetValue: z.coerce.number(),
  currentValue: z.coerce.number(),
  unit: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface KeyResultEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: KeyResult;
  hasInitiatives?: boolean;
}

export function KeyResultEditDialog({
  open,
  onOpenChange,
  keyResult,
  hasInitiatives = false,
}: KeyResultEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: allObjectives = [] } = useQuery<Objective[]>({ queryKey: ["/api/objectives"] });

  const activeUsers = users
    .filter((u) => u.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Derive cycle from the KR's current parent objective
  const currentParent = allObjectives.find((o) => o.id === keyResult.objectiveId);
  const cycle = currentParent?.cycle;

  // Only company-level objectives in the same cycle
  const parentObjectives = allObjectives
    .filter((o) => o.level === "company" && (!cycle || o.cycle === cycle))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  const parseOwnerId = (): string | undefined => {
    if (!keyResult.responsibleIds) return undefined;
    try {
      const ids = JSON.parse(keyResult.responsibleIds as string);
      return Array.isArray(ids) && ids.length > 0 ? ids[0] : undefined;
    } catch {
      return undefined;
    }
  };

  const measurementTypeValue = (): FormData["measurementType"] => {
    const valid = ["percentage", "absolute", "monetary", "binary", "decreasing"];
    return valid.includes(keyResult.measurementType)
      ? (keyResult.measurementType as FormData["measurementType"])
      : "percentage";
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      objectiveId: keyResult.objectiveId,
      title: keyResult.title,
      description: keyResult.description || "",
      measurementType: measurementTypeValue(),
      startValue: parseFloat(keyResult.startValue || "0"),
      targetValue: parseFloat(keyResult.targetValue || "100"),
      currentValue: parseFloat(keyResult.currentValue || "0"),
      unit: keyResult.unit || "",
      ownerId: parseOwnerId(),
      dueDate: keyResult.dueDate ? new Date(keyResult.dueDate) : undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        objectiveId: keyResult.objectiveId,
        title: keyResult.title,
        description: keyResult.description || "",
        measurementType: measurementTypeValue(),
        startValue: parseFloat(keyResult.startValue || "0"),
        targetValue: parseFloat(keyResult.targetValue || "100"),
        currentValue: parseFloat(keyResult.currentValue || "0"),
        unit: keyResult.unit || "",
        ownerId: parseOwnerId(),
        dueDate: keyResult.dueDate ? new Date(keyResult.dueDate) : undefined,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyResult]);

  const measurementType = form.watch("measurementType");

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const responsibleIds = data.ownerId && data.ownerId !== "__none__"
        ? JSON.stringify([data.ownerId])
        : JSON.stringify([]);
      return apiRequest("PATCH", `/api/key-results/${keyResult.id}`, {
        objectiveId: data.objectiveId,
        title: data.title,
        description: data.description || null,
        measurementType: data.measurementType,
        startValue: String(data.startValue),
        targetValue: String(data.targetValue),
        currentValue: hasInitiatives ? keyResult.currentValue : String(data.currentValue),
        unit: data.unit || null,
        responsibleIds,
        dueDate: data.dueDate?.toISOString() ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({ title: "KR atualizado", description: "As alterações foram salvas." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o KR.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Key Result</DialogTitle>
          <DialogDescription>
            Altere os dados do resultado-chave. O objetivo pai e o ciclo são imutáveis após a criação.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">

            {/* Objetivo pai */}
            <FormField
              control={form.control}
              name="objectiveId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo pai</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o objetivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parentObjectives.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          Nenhum objetivo disponível neste ciclo
                        </SelectItem>
                      ) : (
                        parentObjectives.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {obj.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Título */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do KR</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Atingir NPS de 80 pontos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Descrição{" "}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <RichTextarea
                      placeholder="Contexto adicional sobre este resultado-chave..."
                      className="min-h-[70px]"
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo de medição */}
            <FormField
              control={form.control}
              name="measurementType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Medição</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {measurementTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valores: baseline → atual → meta (formatação por tipo de medição) */}
            {measurementType !== "binary" && (() => {
              const renderValueInput = (
                field: { value: number; onChange: (v: number) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> },
                testId?: string,
              ) => {
                if (measurementType === "monetary") {
                  return (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-9"
                        data-testid={testId}
                        value={formatCurrencyInputValue(field.value)}
                        onChange={(e) => field.onChange(parseCurrencyInputValue(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        placeholder="0"
                      />
                    </div>
                  );
                }
                if (measurementType === "percentage") {
                  return (
                    <div className="relative">
                      <Input
                        type="number"
                        className="pr-8"
                        data-testid={testId}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">%</span>
                    </div>
                  );
                }
                return (
                  <Input
                    type="number"
                    data-testid={testId}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                );
              };

              return (
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="startValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Baseline
                          {measurementType === "decreasing" && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">(inicial)</span>
                          )}
                        </FormLabel>
                        <FormControl>{renderValueInput(field, "input-kr-edit-start")}</FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {hasInitiatives ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[12px] font-medium">Valor Atual</p>
                      <div className="flex items-center h-9 px-3 rounded-md border border-border/40 bg-muted/30">
                        <span className="text-[12px] text-muted-foreground">
                          {parseFloat(keyResult.currentValue || "0")}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Calculado pelas iniciativas
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="currentValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Atual</FormLabel>
                          <FormControl>{renderValueInput(field, "input-kr-edit-current")}</FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Meta
                          {measurementType === "decreasing" && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">(menos é melhor)</span>
                          )}
                        </FormLabel>
                        <FormControl>{renderValueInput(field, "input-kr-edit-target")}</FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              );
            })()}

            {measurementType === "binary" && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                <p className="text-[12px] text-muted-foreground">
                  Métrica binária: 0% (não concluído) ou 100% (concluído).
                </p>
              </div>
            )}

            {/* Unidade */}
            {measurementType !== "binary" && measurementType !== "percentage" && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Unidade{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: pontos, clientes, R$" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Responsável e data limite */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Responsável{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem responsável —</SelectItem>
                        {activeUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data limite{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="date-picker-full"
                        value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                        onChange={(e) =>
                          field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
