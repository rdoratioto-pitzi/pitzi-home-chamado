import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getQuarterOptions } from "@/lib/quarter";
import type { Objective } from "@shared/schema";

const PARENT_LEVELS: Record<string, string[]> = {
  area: ["company"],
  team: ["company", "area"],
};

const levelLabels: Record<string, string> = {
  company: "Empresa",
  team: "Time",
  area: "Área",
};

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  level: z.string().min(1, "Selecione um nível"),
  cycle: z.string().min(1, "Selecione um ciclo"),
  status: z.string().min(1, "Selecione um status"),
  parentOkrId: z.string().nullable().optional(),
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
  const quarters = getQuarterOptions();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: objective.title,
      description: objective.description || "",
      level: objective.level,
      cycle: objective.cycle,
      status: objective.status,
      parentOkrId: objective.parentOkrId ?? null,
    },
  });

  const selectedLevel = useWatch({ control: form.control, name: "level" });
  const selectedCycle = useWatch({ control: form.control, name: "cycle" });

  const { data: allObjectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
  });

  const validParentLevels = PARENT_LEVELS[selectedLevel] ?? [];
  const parentOptions = allObjectives.filter(
    (obj) =>
      validParentLevels.includes(obj.level) &&
      obj.cycle === selectedCycle &&
      obj.id !== objective.id
  );
  const showParentField = selectedLevel !== "company";

  useEffect(() => {
    if (open) {
      form.reset({
        title: objective.title,
        description: objective.description || "",
        level: objective.level,
        cycle: objective.cycle,
        status: objective.status,
        parentOkrId: objective.parentOkrId ?? null,
      });
    }
  }, [open, objective, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("PATCH", `/api/objectives/${objective.id}`, {
        ...data,
        parentOkrId: data.parentOkrId || null,
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
          <DialogDescription>Altere os dados do objetivo estratégico.</DialogDescription>
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
                  <FormLabel>Descrição (opcional)</FormLabel>
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
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("parentOkrId", null);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Empresa</SelectItem>
                        <SelectItem value="team">Time</SelectItem>
                        <SelectItem value="area">Área</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciclo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {quarters.map((q) => (
                          <SelectItem key={q} value={q}>{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            {showParentField && (
              <FormField
                control={form.control}
                name="parentOkrId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Objetivo Pai{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem objetivo pai —</SelectItem>
                        {parentOptions.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {obj.title} — {levelLabels[obj.level]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
