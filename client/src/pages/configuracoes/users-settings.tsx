import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Input } from "@/components/ui/input";
import { Plus, MoreHorizontal, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

const MODULES = [
  { key: "chamados", label: "Chamados" },
  { key: "projetos", label: "Projetos" },
  { key: "tarefas", label: "Tarefas" },
  { key: "okrs", label: "OKRs" },
  { key: "logistica", label: "Logística" },
  { key: "apis", label: "APIs Log" },
  { key: "configuracoes", label: "Configurações" },
] as const;

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  isAdmin: z.boolean().default(false),
  modulePermissions: z.object({
    chamados: z.boolean(),
    projetos: z.boolean(),
    tarefas: z.boolean(),
    okrs: z.boolean(),
    logistica: z.boolean(),
    apis: z.boolean(),
    configuracoes: z.boolean(),
  }),
});

type FormData = z.infer<typeof formSchema>;

export function UsersSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      isAdmin: false,
      modulePermissions: {
        chamados: true,
        projetos: true,
        tarefas: true,
        okrs: true,
        logistica: true,
        apis: false,
        configuracoes: false,
      },
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        email: data.email,
        ...(data.password ? { password: data.password } : {}),
        isAdmin: data.isAdmin,
        status: editingUser?.status || "active",
        authMethod: editingUser?.authMethod || "email",
        modulePermissions: JSON.stringify(data.modulePermissions),
      };

      if (editingUser) {
        return apiRequest("PATCH", `/api/users/${editingUser.id}`, payload);
      }
      return apiRequest("POST", "/api/users", payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Se o usuário editado for o próprio usuário logado, atualiza o sessionStorage
      const currentUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (editingUser && editingUser.id === currentUser.id) {
        // O backend retorna o usuário atualizado
        const updatedUser = { 
          ...currentUser, 
          ...data,
          // Garante que modulePermissions seja tratado corretamente
          modulePermissions: typeof data.modulePermissions === 'string' 
            ? data.modulePermissions 
            : JSON.stringify(data.modulePermissions)
        };
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        // Dispara evento para o sidebar atualizar
        window.dispatchEvent(new Event("storage"));
      }

      toast({ 
        title: editingUser ? "Usuário atualizado" : "Usuário criado", 
        description: editingUser ? "O usuário foi atualizado com sucesso." : "O usuário foi criado com sucesso." 
      });
      form.reset();
      setEditingUser(null);
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar o usuário.", variant: "destructive" });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    let perms = {
      chamados: true,
      projetos: true,
      tarefas: true,
      okrs: true,
      logistica: true,
      apis: false,
      configuracoes: false,
    };

    try {
      if (user.modulePermissions) {
        perms = JSON.parse(user.modulePermissions);
      }
    } catch (e) {
      console.error("Error parsing permissions", e);
    }

    form.reset({
      name: user.name,
      email: user.email,
      password: "",
      isAdmin: user.isAdmin || false,
      modulePermissions: perms,
    });
    setIsDialogOpen(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    form.reset({
      name: "",
      email: "",
      password: "",
      isAdmin: false,
      modulePermissions: {
        chamados: true,
        projetos: true,
        tarefas: true,
        okrs: true,
        logistica: true,
        apis: false,
        configuracoes: false,
      },
    });
    setIsDialogOpen(true);
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Status atualizado" });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getModuleCount = (user: User) => {
    if (!user.modulePermissions) return 0;
    try {
      const perms = JSON.parse(user.modulePermissions);
      return Object.values(perms).filter(Boolean).length;
    } catch {
      return 0;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Usuários e Acessos</CardTitle>
          <CardDescription>
            Gerencie os usuários que têm acesso ao sistema
          </CardDescription>
        </div>
        <Button onClick={handleNewUser} data-testid="button-new-user">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário cadastrado ainda
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Método de Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isAdmin ? "default" : "secondary"} className={user.isAdmin ? "bg-primary text-white" : ""}>
                      {user.isAdmin ? "Administrador" : `${getModuleCount(user)} módulos`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {user.authMethod}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "active" ? "outline" : "secondary"} 
                      className={user.status === "active" ? "bg-green-500/10 text-green-600" : ""}>
                      {user.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${user.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleEdit(user)}
                          data-testid={`menu-edit-${user.id}`}
                        >
                          Editar / Acessos
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => toggleStatusMutation.mutate({ 
                            id: user.id, 
                            status: user.status === "active" ? "inactive" : "active" 
                          })}
                          data-testid={`menu-toggle-${user.id}`}
                        >
                          {user.status === "active" ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setEditingUser(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Atualize as informações e permissões do usuário." : "Adicione um novo usuário ao sistema."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" data-testid="input-user-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@empresa.com" data-testid="input-user-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha {editingUser && "(deixe em branco para manter a atual)"}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder={editingUser ? "Nova senha" : "Mínimo 6 caracteres"} 
                          data-testid="input-user-password" 
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-admin"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">Administrador</FormLabel>
                      <FormDescription>
                        Administradores têm acesso total a todos os módulos e configurações.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <Label>Acesso aos Módulos</Label>
                <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                  {MODULES.map((module) => (
                    <FormField
                      key={module.key}
                      control={form.control}
                      name={`modulePermissions.${module.key}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`checkbox-module-${module.key}`}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm cursor-pointer">
                            {module.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-user">
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-user">
                  {mutation.isPending ? "Salvando..." : (editingUser ? "Salvar Alterações" : "Criar Usuário")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
