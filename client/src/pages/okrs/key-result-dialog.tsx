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
  FormDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Objective, User } from "@shared/schema";

const measurementTypes = [
  { value: "absolute", label: "Absoluto (número)", example: "0 → 1000 clientes" },
  { value: "percentage", label: "Percentual (%)", example: "0% → 100%" },
  { value: "monetary", label: "Monetário (R$)", example: "R$ 0 → R$ 50.000" },
  { value: "decreasing", label: "Decrescente", example: "100 → 20 (menos é melhor)" },
  { value: "binary", label: "Binário (sim/não)", example: "Não → Sim" },
];

const formSchema = z.object({
  selectedObjectiveId: z.string().min(1, "Selecione o objetivo pai"),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  measurementType: z.enum(["percentage", "absolute", "monetary", "binary", "decreasing"]),
  startValue: z.coerce.number(),
  targetValue: z.coerce.number(),
  unit: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface KeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId?: string;
  defaultCycle?: string;
}

export function KeyResultDialog({
  open,
  onOpenChange,
  objectiveId,
  defaultCycle,
}: KeyResultDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: allObjectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
  });

  const activeUsers = users
    .filter((u) => u.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Objectives available for selection: company level, filtered by cycle
  const selectableObjectives = allObjectives
    .filter((obj) => obj.level === "company" && (!defaultCycle || obj.cycle === defaultCycle))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  const showObjectiveSelector = !objectiveId;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedObjectiveId: objectiveId ?? "",
      title: "",
      description: "",
      measurementType: "absolute",
      startValue: 0,
      targetValue: 100,
      unit: "",
      ownerId: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        selectedObjectiveId: objectiveId ?? "",
        title: "",
        description: "",
        measurementType: "absolute",
        startValue: 0,
        targetValue: 100,
        unit: "",
        ownerId: undefined,
      });
    }
  }, [open, objectiveId, form]);

  const measurementType = form.watch("measurementType");

  const handleMeasurementTypeChange = (value: string) => {
    form.setValue("measurementType", value as FormData["measurementType"]);
    if (value === "percentage") {
      form.setValue("unit", "%");
      form.setValue("startValue", 0);
      form.setValue("targetValue", 100);
    } else if (value === "monetary") {
      form.setValue("unit", "R$");
    } else if (value === "binary") {
      form.setValue("unit", "");
      form.setValue("startValue", 0);
      form.setValue("targetValue", 1);
    } else {
      form.setValue("unit", "");
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const responsibleIds = data.ownerId && data.ownerId !== "__none__"
        ? JSON.stringify([data.ownerId])
        : null;
      return apiRequest("POST", "/api/key-results", {
        objectiveId: data.selectedObjectiveId,
        title: data.title,
        description: data.description || null,
        measurementType: data.measurementType,
        startValue: String(data.startValue),
        targetValue: String(data.targetValue),
        currentValue: "0",
        unit: data.unit || null,
        responsibleIds,
        dueDate: data.dueDate?.toISOString() ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({ title: "Key Result criado", description: "O resultado-chave foi adicionado." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar o resultado-chave.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Key Result</DialogTitle>
          <DialogDescription>
            Defina uma métrica quantitativa para medir o progresso do objetivo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            {showObjectiveSelector && (
              <FormField
                control={form.control}
                name="selectedObjectiveId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo pai</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-kr-objective">
                          <SelectValue placeholder="Selecione o objetivo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectableObjectives.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {obj.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do KR</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Atingir NPS de 80 pontos"
                      data-testid="input-kr-title"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Input placeholder="Contexto adicional sobre o KR" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="measurementType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Medição</FormLabel>
                  <Select onValueChange={handleMeasurementTypeChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-measurement-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {measurementTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.example}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {measurementType !== "binary" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>De (baseline)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="input-kr-start"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Para (meta)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="input-kr-target"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {measurementType === "binary" && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Para métricas binárias, o progresso será 0% (Não concluído) ou 100% (Concluído).
                </p>
              </div>
            )}

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
                    <Input
                      placeholder='Ex: "%", "R$", "dispositivos/mês"'
                      data-testid="input-kr-unit"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    {measurementType === "monetary" && "Ex: R$, USD, EUR"}
                    {measurementType === "absolute" && "Ex: clientes, vendas, tickets"}
                    {measurementType === "decreasing" && "Ex: bugs, reclamações"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <SelectItem value="__none__">— Nenhum —</SelectItem>
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
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-kr">
                {mutation.isPending ? "Criando..." : "Criar KR"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
