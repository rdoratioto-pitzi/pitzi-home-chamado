import { useOperators, useCreateOperator, useUpdateOperator } from "@/hooks/use-logistics";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";

const operatorSchema = z.object({
  razaoSocial: z.string().min(3, "Razão Social muito curta"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  email: z.string().email("Email inválido"),
  contato: z.string().optional(),
  telefone: z.string().optional(),
});

type OperatorForm = z.infer<typeof operatorSchema>;

export default function OperadoresPage() {
  const { data: operators, isLoading } = useOperators();
  const { mutateAsync: createOperator, isPending } = useCreateOperator();
  const { mutateAsync: updateOperator } = useUpdateOperator();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<OperatorForm>({
    resolver: zodResolver(operatorSchema)
  });

  const onSubmit = async (data: OperatorForm) => {
    try {
      await createOperator({ ...data, ativo: true });
      toast({ title: "Operador cadastrado com sucesso!" });
      setOpen(false);
      reset();
    } catch (err) {
      toast({ 
        title: "Erro ao cadastrar", 
        description: "Verifique os dados e tente novamente.", 
        variant: "destructive" 
      });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      await updateOperator({ id, data: { ativo: !currentStatus } });
      toast({ title: currentStatus ? "Operador desativado" : "Operador ativado" });
    } catch (err) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const filteredOperators = operators?.filter(op => 
    op.razaoSocial.toLowerCase().includes(search.toLowerCase()) || 
    op.cnpj.includes(search)
  );

  return (
    <div className="space-y-8" data-testid="page-operadores">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operadores Logísticos</h2>
          <p className="text-muted-foreground mt-1">Gerencie os parceiros de transporte e suas tabelas.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-operator">
              <Plus className="mr-2 h-4 w-4" /> Novo Operador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Operador Logístico</DialogTitle>
              <DialogDescription>
                Cadastre um novo parceiro para realizar entregas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input id="razaoSocial" {...register("razaoSocial")} data-testid="input-razao-social" />
                {errors.razaoSocial && <p className="text-xs text-red-500">{errors.razaoSocial.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" placeholder="00.000.000/0000-00" {...register("cnpj")} data-testid="input-cnpj" />
                  {errors.cnpj && <p className="text-xs text-red-500">{errors.cnpj.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" {...register("telefone")} data-testid="input-telefone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Corporativo</Label>
                <Input id="email" type="email" {...register("email")} data-testid="input-email" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contato">Pessoa de Contato</Label>
                <Input id="contato" {...register("contato")} data-testid="input-contato" />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending} data-testid="button-submit-operator">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou CNPJ..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-operators"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Operador</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredOperators?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum operador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredOperators?.map((op) => (
                <TableRow key={op.id} className="hover-elevate" data-testid={`row-operator-${op.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{op.razaoSocial}</p>
                        <p className="text-xs text-muted-foreground">{op.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{op.cnpj}</TableCell>
                  <TableCell>{op.contato || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={op.ativo ? "default" : "secondary"}>
                      {op.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleToggleStatus(op.id, op.ativo)}
                      data-testid={`button-toggle-${op.id}`}
                    >
                      {op.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
