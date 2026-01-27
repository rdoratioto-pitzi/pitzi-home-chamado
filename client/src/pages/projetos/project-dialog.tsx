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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDialog({ open, onOpenChange }: ProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/projects", {
        ...data,
        ownerId: "admin",
        status: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Projeto criado",
        description: "O projeto foi criado com sucesso.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o projeto.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
          <DialogDescription>
            Crie um novo projeto para organizar suas tarefas em um quadro Kanban.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Projeto</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Lançamento do Produto" 
                      data-testid="input-project-name"
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
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os objetivos do projeto..."
                      className="min-h-[80px]"
                      data-testid="input-project-description"
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
                data-testid="button-cancel-project"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-submit-project"
              >
                {mutation.isPending ? "Criando..." : "Criar Projeto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
