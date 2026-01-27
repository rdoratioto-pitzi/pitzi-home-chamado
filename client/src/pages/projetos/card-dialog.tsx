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
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columnId: string;
}

export function CardDialog({ open, onOpenChange, projectId, columnId }: CardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      tags: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const tags = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      return apiRequest("POST", "/api/cards", {
        ...data,
        tags,
        projectId,
        columnId,
        order: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cards"] });
      toast({
        title: "Card criado",
        description: "O card foi adicionado ao quadro.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o card.",
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
          <DialogTitle>Novo Card</DialogTitle>
          <DialogDescription>
            Adicione uma nova tarefa ou item ao quadro.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Implementar funcionalidade X" 
                      data-testid="input-card-title"
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
                      placeholder="Detalhes sobre a tarefa..."
                      className="min-h-[80px]"
                      data-testid="input-card-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: bug, feature, urgente (separadas por vírgula)" 
                      data-testid="input-card-tags"
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
                data-testid="button-submit-card"
              >
                {mutation.isPending ? "Criando..." : "Criar Card"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
