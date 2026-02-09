import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { RichTextarea } from "@/components/rich-textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Globe, X, UserPlus } from "lucide-react";
import { format } from "date-fns";
import type { User, Project, ProjectMember } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  ownerId: z.string().min(1, "Responsável é obrigatório"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  visibility: z.enum(["private", "shared"]).default("private"),
});

type FormData = z.infer<typeof formSchema>;

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearchInput, setMemberSearchInput] = useState("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: existingMembers = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects", project?.id, "members"],
    queryFn: async () => {
      if (!project?.id) return [];
      const res = await fetch(`/api/projects/${project.id}/members`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!project?.id,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      ownerId: "admin",
      startDate: "",
      endDate: "",
      visibility: "private",
    },
  });

  const visibility = form.watch("visibility");
  const ownerId = form.watch("ownerId");

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        ownerId: project.ownerId,
        startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
        endDate: project.endDate ? format(new Date(project.endDate), "yyyy-MM-dd") : "",
        visibility: (project.visibility as "private" | "shared") || "private",
      });
      setMemberIds(existingMembers.map(m => m.userId));
    } else {
      form.reset({
        name: "",
        description: "",
        ownerId: "admin",
        startDate: "",
        endDate: "",
        visibility: "private",
      });
      setMemberIds([]);
    }
  }, [project, form, existingMembers]);

  const filteredUsersForMembers = useMemo(() => {
    return users.filter(u => {
      if (u.id === ownerId) return false;
      if (memberIds.includes(u.id)) return false;
      if (!memberSearchInput) return true;
      const search = memberSearchInput.toLowerCase();
      return u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
    });
  }, [users, ownerId, memberIds, memberSearchInput]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        status: project?.status || "active",
        memberIds: data.visibility === "shared" ? memberIds : [],
      };
      
      if (project) {
        return apiRequest("PATCH", `/api/projects/${project.id}`, payload);
      }
      return apiRequest("POST", "/api/projects", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (project?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "members"] });
      }
      toast({
        title: project ? "Projeto atualizado" : "Projeto criado",
        description: `O projeto foi ${project ? "atualizado" : "criado"} com sucesso.`,
      });
      form.reset();
      setMemberIds([]);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: `Não foi possível ${project ? "atualizar" : "criar"} o projeto.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          <DialogDescription>
            {project ? "Atualize as informações do seu projeto." : "Crie um novo projeto para organizar suas tarefas em um quadro Kanban."}
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
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-project-owner">
                        <SelectValue placeholder="Selecione um responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
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
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Visibilidade</FormLabel>
                    <div className="flex items-center gap-2">
                      {field.value === "private" ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Globe className="h-4 w-4 text-primary" />
                      )}
                      <Label htmlFor="visibility-toggle" className="text-sm text-muted-foreground">
                        {field.value === "private" ? "Privado" : "Compartilhado"}
                      </Label>
                      <Switch
                        id="visibility-toggle"
                        data-testid="switch-project-visibility"
                        checked={field.value === "shared"}
                        onCheckedChange={(checked) => field.onChange(checked ? "shared" : "private")}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.value === "private" 
                      ? "Apenas o responsável pode ver este projeto." 
                      : "O responsável e os membros selecionados podem ver este projeto."}
                  </p>
                </FormItem>
              )}
            />

            {visibility === "shared" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Membros</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário para adicionar..."
                      value={memberSearchInput}
                      onChange={(e) => setMemberSearchInput(e.target.value)}
                      className="pl-9"
                      data-testid="input-project-member-search"
                    />
                  </div>
                </div>
                {memberSearchInput && filteredUsersForMembers.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {filteredUsersForMembers.slice(0, 5).map(user => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover-elevate"
                        data-testid={`button-add-project-member-${user.id}`}
                        onClick={() => {
                          setMemberIds(prev => [...prev, user.id]);
                          setMemberSearchInput("");
                        }}
                      >
                        {user.name} <span className="text-muted-foreground">({user.email})</span>
                      </button>
                    ))}
                  </div>
                )}
                {memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {memberIds.map(uid => {
                      const user = users.find(u => u.id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="gap-1">
                          {user?.name || uid}
                          <button
                            type="button"
                            onClick={() => setMemberIds(prev => prev.filter(id => id !== uid))}
                            data-testid={`button-remove-project-member-${uid}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-project-start-date"
                        className="date-picker-full"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Fim</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-project-end-date"
                        className="date-picker-full"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <RichTextarea
                      placeholder="Descreva os objetivos do projeto..."
                      className="min-h-[80px]"
                      data-testid="input-project-description"
                      value={field.value || ""}
                      onChange={field.onChange}
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
                {mutation.isPending ? (project ? "Salvando..." : "Criando...") : (project ? "Salvar Alterações" : "Criar Projeto")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
