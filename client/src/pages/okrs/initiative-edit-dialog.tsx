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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Initiative, KeyResult, Objective, User } from "@shared/schema";

const formSchema = z.object({
  keyResultId: z.string().min(1, "Selecione o KR pai"),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.date().optional(),
  completed: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface InitiativeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative: Initiative;
  defaultCycle?: string;
}

export function InitiativeEditDialog({
  open,
  onOpenChange,
  initiative,
  defaultCycle,
}: InitiativeEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: allObjectives = [] } = useQuery<Objective[]>({ queryKey: ["/api/objectives"] });
  const { data: allKeyResults = [] } = useQuery<KeyResult[]>({ queryKey: ["/api/key-results"] });

  const activeUsers = users
    .filter((u) => u.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // KRs from company-level objectives in the same cycle
  const cycleObjectives = allObjectives.filter(
    (obj) => obj.level === "company" && (!defaultCycle || obj.cycle === defaultCycle),
  );
  const cycleObjectiveIds = new Set(cycleObjectives.map((o) => o.id));
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
      keyResultId: initiative.keyResultId,
      title: initiative.title,
      description: initiative.description || "",
      ownerId: initiative.ownerId ?? undefined,
      dueDate: initiative.dueDate ? new Date(initiative.dueDate) : undefined,
      completed: initiative.completed,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        keyResultId: initiative.keyResultId,
        title: initiative.title,
        description: initiative.description || "",
        ownerId: initiative.ownerId ?? undefined,
        dueDate: initiative.dueDate ? new Date(initiative.dueDate) : undefined,
        completed: initiative.completed,
      });
    }
  }, [open, initiative, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const ownerId = data.ownerId && data.ownerId !== "__none__" ? data.ownerId : null;
      return apiRequest("PATCH", `/api/initiatives/${initiative.id}`, {
        keyResultId: data.keyResultId,
        title: data.title,
        description: data.description || null,
        ownerId,
        dueDate: data.dueDate?.toISOString() ?? null,
        completed: data.completed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/initiatives"] });
      toast({ title: "Iniciativa atualizada", description: "As alterações foram salvas." });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a iniciativa.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Iniciativa</DialogTitle>
          <DialogDescription>
            Altere os dados da iniciativa ou marque como concluída.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">

            {/* KR pai */}
            <FormField
              control={form.control}
              name="keyResultId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Result pai</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o KR" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectableKRs.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          Nenhum KR disponível
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

            {/* Título */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da iniciativa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Implementar pesquisa de satisfação" {...field} />
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

            {/* Toggle concluída */}
            <FormField
              control={form.control}
              name="completed"
              render={({ field }) => (
                <FormItem>
                  <div
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      field.value
                        ? "border-[#378ADD]/40 bg-[#378ADD]/5"
                        : "border-border/40 bg-muted/10"
                    }`}
                    onClick={() => field.onChange(!field.value)}
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-5 w-5"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer text-[13px] font-medium">
                        Marcar como concluída
                      </FormLabel>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {field.value
                          ? "Esta iniciativa está concluída"
                          : "Clique para marcar como concluída"}
                      </p>
                    </div>
                  </div>
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
