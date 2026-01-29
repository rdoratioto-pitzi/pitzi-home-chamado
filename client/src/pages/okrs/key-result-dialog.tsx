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
import type { User } from "@shared/schema";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  startValue: z.coerce.number().min(0, "Valor inicial deve ser 0 ou maior"),
  targetValue: z.coerce.number().min(0, "Valor alvo deve ser 0 ou maior"),
  currentValue: z.coerce.number().min(0, "Valor atual deve ser 0 ou maior"),
  unit: z.string().optional(),
  dueDate: z.date().optional(),
  ownerIds: z.array(z.string()).min(1, "Selecione pelo menos um responsável"),
});

type FormData = z.infer<typeof formSchema>;

interface KeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
}

export function KeyResultDialog({ open, onOpenChange, objectiveId }: KeyResultDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      measurementType: "percentage",
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      unit: "%",
      ownerIds: [],
    },
  });

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset({
        title: "",
        measurementType: "percentage",
        startValue: 0,
        targetValue: 100,
        currentValue: 0,
        unit: "%",
        ownerIds: [],
      });
    }
    onOpenChange(isOpen);
  };

  const measurementType = form.watch("measurementType");

  // Update unit based on measurement type
  const handleMeasurementTypeChange = (value: string) => {
    form.setValue("measurementType", value as any);
    switch (value) {
      case "percentage":
        form.setValue("unit", "%");
        form.setValue("startValue", 0);
        form.setValue("targetValue", 100);
        break;
      case "monetary":
        form.setValue("unit", "R$");
        break;
      case "temporal":
        form.setValue("unit", "dias");
        break;
      case "binary":
        form.setValue("unit", "");
        form.setValue("startValue", 0);
        form.setValue("targetValue", 1);
        form.setValue("currentValue", 0);
        break;
      case "decreasing":
      case "absolute":
        form.setValue("unit", "");
        break;
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/key-results", {
        ...data,
        objectiveId,
        startValue: String(data.startValue),
        targetValue: String(data.targetValue),
        currentValue: String(data.currentValue),
        dueDate: data.dueDate?.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({
        title: "Key Result criado",
        description: "O resultado-chave foi adicionado ao objetivo.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o resultado-chave.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Resultado-Chave</DialogTitle>
          <DialogDescription>
            Adicione uma métrica quantitativa para medir o progresso do objetivo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do KR</FormLabel>
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
              name="measurementType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Medição</FormLabel>
                  <Select 
                    onValueChange={handleMeasurementTypeChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-measurement-type">
                        <SelectValue placeholder="Selecione o tipo" />
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
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Atual</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          data-testid="input-kr-current"
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

            {measurementType !== "binary" && measurementType !== "percentage" && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: pontos, clientes, R$" 
                        data-testid="input-kr-unit"
                        {...field} 
                      />
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-due-date"
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
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
                  <FormDescription>
                    Selecione as pessoas responsáveis por este resultado-chave
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {users.map((user) => (
                      <FormField
                        key={user.id}
                        control={form.control}
                        name="ownerIds"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={user.id}
                              className="flex flex-row items-center space-x-2 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, user.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== user.id
                                          )
                                        );
                                  }}
                                  data-testid={`checkbox-owner-${user.id}`}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {user.name}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-submit-kr"
              >
                {mutation.isPending ? "Criando..." : "Criar KR"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
