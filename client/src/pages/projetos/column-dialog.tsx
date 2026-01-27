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
  name: z.string().min(1, "Nome é obrigatório"),
});

type FormData = z.infer<typeof formSchema>;

interface ColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingColumnsCount: number;
}

export function ColumnDialog({ open, onOpenChange, projectId, existingColumnsCount }: ColumnDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/columns", {
        ...data,
        projectId,
        order: existingColumnsCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "columns"] });
      toast({
        title: "Coluna criada",
        description: "A coluna foi adicionada ao quadro.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a coluna.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Nova Coluna</DialogTitle>
          <DialogDescription>
            Adicione uma nova coluna ao quadro Kanban.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Coluna</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Em Andamento, Revisão, Concluído" 
                      data-testid="input-column-name"
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
                data-testid="button-submit-column"
              >
                {mutation.isPending ? "Criando..." : "Criar Coluna"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
