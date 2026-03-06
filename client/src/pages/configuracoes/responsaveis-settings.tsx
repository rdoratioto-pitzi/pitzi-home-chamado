import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, UserCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TicketResponsavel, User, Setting } from "@shared/schema";

interface FieldItem {
  value: string;
  label: string;
}

const defaultCategories: FieldItem[] = [
  { value: "ti", label: "TI" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacoes", label: "Operações" },
  { value: "comercial", label: "Comercial" },
];

const defaultTypes: FieldItem[] = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "negocio", label: "Negócio" },
];

export function ResponsaveisSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("");
  const [selectedUsuario, setSelectedUsuario] = useState("");

  const { data: responsaveis = [], isLoading } = useQuery<TicketResponsavel[]>({
    queryKey: ["/api/ticket-responsaveis"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: categoriasSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_categories");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: tiposSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_types");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const categorias: FieldItem[] = categoriasSetting?.value 
    ? JSON.parse(categoriasSetting.value) 
    : defaultCategories;

  const tipos: FieldItem[] = tiposSetting?.value 
    ? JSON.parse(tiposSetting.value) 
    : defaultTypes;

  const createMutation = useMutation({
    mutationFn: async (data: { categoria: string; tipo: string; usuarioResponsavelId: string }) => {
      return apiRequest("POST", "/api/ticket-responsaveis", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-responsaveis"] });
      toast({ title: "Regra de responsável criada!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar regra", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      return apiRequest("PATCH", `/api/ticket-responsaveis/${id}`, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-responsaveis"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ticket-responsaveis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-responsaveis"] });
      toast({ title: "Regra removida!" });
    },
  });

  const resetForm = () => {
    setSelectedCategoria("");
    setSelectedTipo("");
    setSelectedUsuario("");
  };

  const handleCreate = () => {
    if (!selectedCategoria || !selectedTipo || !selectedUsuario) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      categoria: selectedCategoria,
      tipo: selectedTipo,
      usuarioResponsavelId: selectedUsuario,
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || "Usuário não encontrado";
  };

  const getCategoriaLabel = (value: string) => {
    const cat = categorias.find(c => c.value === value);
    return cat?.label || value;
  };

  const getTipoLabel = (value: string) => {
    const tipo = tipos.find(t => t.value === value);
    return tipo?.label || value;
  };

  const groupedResponsaveis = responsaveis.reduce((acc, resp) => {
    const key = `${resp.categoria}-${resp.tipo}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(resp);
    return acc;
  }, {} as Record<string, TicketResponsavel[]>);

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Responsáveis por Tipo de Chamado
            </CardTitle>
            <CardDescription className="mt-1">
              Configure quais usuários serão automaticamente atribuídos aos chamados com base na categoria e tipo.
              Quando múltiplos responsáveis estão configurados, o sistema usa balanceamento round-robin.
            </CardDescription>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            size="sm" 
            className="gap-2"
            data-testid="button-add-responsavel"
          >
            <Plus className="h-4 w-4" />
            Adicionar Regra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : responsaveis.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Nenhuma regra configurada</h3>
            <p className="text-muted-foreground mt-1">
              Adicione regras para atribuição automática de chamados
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] font-bold uppercase tracking-wider">Categoria</TableHead>
                <TableHead className="text-[12px] font-bold uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-[12px] font-bold uppercase tracking-wider">Responsável</TableHead>
                <TableHead className="text-[12px] font-bold uppercase tracking-wider">Ativo</TableHead>
                <TableHead className="w-[80px] text-[12px] font-bold uppercase tracking-wider">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responsaveis.map((resp) => (
                <TableRow key={resp.id} data-testid={`row-responsavel-${resp.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {getCategoriaLabel(resp.categoria)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-medium">
                      {getTipoLabel(resp.tipo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {getUserName(resp.usuarioResponsavelId)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={resp.ativo ?? true}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: resp.id, ativo: checked })}
                      data-testid={`switch-ativo-${resp.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(resp.id)}
                      data-testid={`button-delete-${resp.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {Object.keys(groupedResponsaveis).length > 0 && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Resumo do Balanceamento</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              {Object.entries(groupedResponsaveis).map(([key, resps]) => {
                const activeResps = resps.filter(r => r.ativo);
                if (activeResps.length === 0) return null;
                const [categoria, tipo] = key.split("-");
                return (
                  <div key={key}>
                    <span className="font-medium text-foreground">{getCategoriaLabel(categoria)} / {getTipoLabel(tipo)}:</span>{" "}
                    {activeResps.length === 1 
                      ? `Sempre ${getUserName(activeResps[0].usuarioResponsavelId)}`
                      : `Round-robin entre ${activeResps.map(r => getUserName(r.usuarioResponsavelId)).join(", ")}`
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Regra de Responsável</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                <SelectTrigger data-testid="select-categoria">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsável</label>
              <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
                <SelectTrigger data-testid="select-usuario">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.status === "active").sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              data-testid="button-confirm-add"
            >
              {createMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
