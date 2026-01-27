import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  targetValue: z.coerce.number().min(1, "Valor alvo deve ser maior que 0"),
  currentValue: z.coerce.number().min(0, "Valor atual deve ser 0 ou maior"),
  unit: z.string().optional(),
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      targetValue: 100,
      currentValue: 0,
      unit: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/key-results", {
        ...data,
        objectiveId,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
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

            <div className="grid grid-cols-2 gap-4">
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
                        {...field} 
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
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: pontos, %, clientes" 
                      data-testid="input-kr-unit"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
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
