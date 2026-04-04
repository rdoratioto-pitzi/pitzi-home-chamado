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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Objective, KeyResult, User } from "@shared/schema";

const formSchema = z.object({
  keyResultId: z.string().min(1, "Selecione o KR pai"),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface InitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCycle?: string;
}

export function InitiativeDialog({ open, onOpenChange, defaultCycle }: InitiativeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: allObjectives = [] } = useQuery<Objective[]>({ queryKey: ["/api/objectives"] });
  const { data: allKeyResults = [] } = useQuery<KeyResult[]>({ queryKey: ["/api/key-results"] });

  const activeUsers = users
    .filter((u) => u.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Filter objectives by cycle, only company level
  const cycleObjectives = allObjectives.filter(
    (obj) => obj.level === "company" && (!defaultCycle || obj.cycle === defaultCycle)
  );
  const cycleObjectiveIds = new Set(cycleObjectives.map((o) => o.id));

  // Filter KRs whose objective is in the current cycle
  const selectableKRs = allKeyResults
    .filter((kr) => cycleObjectiveIds.has(kr.objectiveId))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  const getKRLabel = (kr: KeyResult): string => {
    const objective = cycleObjectives.find((o) => o.id === kr.objectiveId);
    return objective ? `${kr.title} — ${objective.title}` : kr.title;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      keyResultId: "",
      title: "",
      description: "",
      ownerId: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        keyResultId: "",
        title: "",
        description: "",
        ownerId: undefined,
      });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const ownerId = data.ownerId && data.ownerId !== "__none__" ? data.ownerId : null;
      return apiRequest("POST", "/api/initiatives", {
        keyResultId: data.keyResultId,
        title: data.title,
        description: data.description || null,
        ownerId,
        dueDate: data.dueDate?.toISOString() ?? null,
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({ title: "Iniciativa criada", description: "A iniciativa foi adicionada ao KR." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar a iniciativa.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Iniciativa</DialogTitle>
          <DialogDescription>
            Adicione uma ação concreta vinculada a um Key Result.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="keyResultId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Result pai</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-initiative-kr">
                        <SelectValue placeholder="Selecione o KR" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectableKRs.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          Nenhum KR disponível neste ciclo
                        </SelectItem>
                      ) : (
                        selectableKRs.map((kr) => (
                          <SelectItem key={kr.id} value={kr.id}>
                            {getKRLabel(kr)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da iniciativa</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Implementar pesquisa de satisfação trimestral"
                      data-testid="input-initiative-title"
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
                    <Input
                      placeholder="Detalhes da iniciativa"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
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
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-initiative"
              >
                {mutation.isPending ? "Criando..." : "Criar Iniciativa"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
