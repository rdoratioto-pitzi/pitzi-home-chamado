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
import type { Objective, User } from "@shared/schema";

// Only editable fields for a company-level objective.
// cycle, level and parentOkrId are immutable after creation.
const formSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  status: z.string().min(1, "Selecione um status"),
  ownerId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ObjectiveEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective;
}

export function ObjectiveEditDialog({ open, onOpenChange, objective }: ObjectiveEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const activeUsers = users
    .filter((u) => u.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: objective.title,
      description: objective.description || "",
      status: objective.status,
      ownerId: objective.ownerId ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: objective.title,
        description: objective.description || "",
        status: objective.status,
        ownerId: objective.ownerId ?? undefined,
      });
    }
  }, [open, objective, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const ownerId = data.ownerId && data.ownerId !== "__none__"
        ? data.ownerId
        : activeUsers[0]?.id ?? undefined;
      return apiRequest("PATCH", `/api/objectives/${objective.id}`, {
        title: data.title,
        description: data.description || null,
        status: data.status,
        ownerId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      toast({ title: "Objetivo atualizado", description: "As alterações foram salvas." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o objetivo.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Objetivo</DialogTitle>
          <DialogDescription>
            Altere o título, descrição, status ou responsável.
            Ciclo e nível são imutáveis após a criação.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aumentar a satisfação do cliente" {...field} />
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
                    <RichTextarea
                      placeholder="Descreva mais detalhes sobre o objetivo..."
                      className="min-h-[80px]"
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="on_track">No Caminho</SelectItem>
                        <SelectItem value="at_risk">Em Risco</SelectItem>
                        <SelectItem value="off_track">Fora do Caminho</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            {/* Read-only cycle badge — immutable */}
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/40">
              <span className="text-[12px] text-muted-foreground">Ciclo:</span>
              <span className="text-[12px] font-semibold">{objective.cycle}</span>
              <span className="text-[12px] text-muted-foreground ml-auto">
                Imutável após criação
              </span>
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
