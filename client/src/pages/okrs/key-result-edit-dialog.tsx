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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { KeyResult, User } from "@shared/schema";

const measurementTypes = [
  { value: "percentage", label: "Percentual (%)", example: "0% → 100%" },
  { value: "absolute", label: "Absoluto (número)", example: "0 → 1000 clientes" },
  { value: "monetary", label: "Monetário (R$)", example: "R$ 0 → R$ 50.000" },
  { value: "temporal", label: "Temporal (dias/horas)", example: "10 dias → 5 dias" },
  { value: "binary", label: "Binário (sim/não)", example: "Não → Sim" },
  { value: "decreasing", label: "Decrescente", example: "100 → 20 (menos é melhor)" },
];

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  measurementType: z.enum(["percentage", "absolute", "monetary", "temporal", "binary", "decreasing"]),
  startValue: z.coerce.number().min(0),
  targetValue: z.coerce.number().min(0),
  currentValue: z.coerce.number().min(0),
  unit: z.string().optional(),
  dueDate: z.date().optional(),
  ownerIds: z.array(z.string()).min(1, "Selecione pelo menos um responsável"),
});

type FormData = z.infer<typeof formSchema>;

interface KeyResultEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: KeyResult;
}

export function KeyResultEditDialog({ open, onOpenChange, keyResult }: KeyResultEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const parseOwnerIds = (): string[] => {
    if (!keyResult.responsibleIds) return [];
    if (Array.isArray(keyResult.responsibleIds)) return keyResult.responsibleIds as string[];
    try { return JSON.parse(keyResult.responsibleIds); } catch { return []; }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: keyResult.title,
      measurementType: keyResult.measurementType as FormData["measurementType"],
      startValue: parseFloat(keyResult.startValue || "0"),
      targetValue: parseFloat(keyResult.targetValue || "100"),
      currentValue: parseFloat(keyResult.currentValue || "0"),
      unit: keyResult.unit || "",
      dueDate: keyResult.dueDate ? new Date(keyResult.dueDate) : undefined,
      ownerIds: parseOwnerIds(),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: keyResult.title,
        measurementType: keyResult.measurementType as FormData["measurementType"],
        startValue: parseFloat(keyResult.startValue || "0"),
        targetValue: parseFloat(keyResult.targetValue || "100"),
        currentValue: parseFloat(keyResult.currentValue || "0"),
        unit: keyResult.unit || "",
        dueDate: keyResult.dueDate ? new Date(keyResult.dueDate) : undefined,
        ownerIds: parseOwnerIds(),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyResult]);

  const measurementType = form.watch("measurementType");

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("PATCH", `/api/key-results/${keyResult.id}`, {
        ...data,
        startValue: String(data.startValue),
        targetValue: String(data.targetValue),
        currentValue: String(data.currentValue),
        dueDate: data.dueDate?.toISOString(),
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Resultado-Chave</DialogTitle>
          <DialogDescription>Altere os dados do resultado-chave.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do KR</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Atingir NPS de 80 pontos" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="startValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Inicial</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Atual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                      <FormLabel>Valor Alvo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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

            {measurementType !== "binary" && measurementType !== "percentage" && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: pontos, clientes, R$" {...field} />
                    </FormControl>
                    <FormDescription>
                      {measurementType === "monetary" && "Ex: R$, USD, EUR"}
                      {measurementType === "temporal" && "Ex: dias, horas, minutos"}
                      {measurementType === "absolute" && "Ex: clientes, vendas, tickets"}
                      {measurementType === "decreasing" && "Ex: bugs, reclamações, tempo de espera"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data Estimada de Conclusão</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="date-picker-full"
                      value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerIds"
              render={() => (
                <FormItem>
                  <FormLabel>Responsáveis</FormLabel>
                  <FormDescription>Selecione as pessoas responsáveis por este resultado-chave</FormDescription>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {users
                      .filter((u) => u.status === "active")
                      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                      .map((user) => (
                        <FormField
                          key={user.id}
                          control={form.control}
                          name="ownerIds"
                          render={({ field }) => (
                            <FormItem key={user.id} className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(user.id)}
                                  onCheckedChange={(checked) =>
                                    checked
                                      ? field.onChange([...field.value, user.id])
                                      : field.onChange(field.value?.filter((v) => v !== user.id))
                                  }
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">{user.name}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

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
