import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UsersRound, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSupportGroups, type SupportGroup } from "@/hooks/use-support-groups";
import type { User } from "@shared/schema";

export function SupportGroupsSettings() {
  const { toast } = useToast();
  const { groups, isLoading } = useSupportGroups();
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const [editing, setEditing] = useState<SupportGroup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const activeUsers = users.filter(u => u.status === "active");
  const userName = (id: string) => users.find(u => u.id === id)?.name ?? "Usuário removido";

  const saveMutation = useMutation({
    mutationFn: async ({ groupId, userIds }: { groupId: string; userIds: string[] }) =>
      apiRequest("PUT", `/api/v1/support-groups/${groupId}/members`, { userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/support-groups"] });
      toast({ title: "Membros atualizados!" });
      setEditing(null);
    },
    onError: () => {
      toast({ title: "Não foi possível salvar os membros", variant: "destructive" });
    },
  });

  const openEditor = (group: SupportGroup) => {
    setEditing(group);
    setSelected(new Set(group.memberIds));
    setSearch("");
  };

  const toggle = (userId: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const term = search.trim().toLowerCase();
  const visibleUsers = activeUsers.filter(u =>
    !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
  );

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-primary" />
          Grupos de atendimento
        </CardTitle>
        <CardDescription className="mt-1">
          Quem abre o chamado escolhe o grupo. Os membros de cada grupo formam a fila que atende esses chamados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(group => (
              <div key={group.id} className="rounded-lg border border-border/60 p-4" data-testid={`group-${group.key}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => openEditor(group)}
                    data-testid={`button-edit-members-${group.key}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Membros
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.memberIds.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhum membro ainda</span>
                  ) : (
                    group.memberIds.map(id => (
                      <Badge key={id} variant="secondary" className="font-medium">{userName(id)}</Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membros de {editing?.name}</DialogTitle>
            <DialogDescription>Marque quem atende os chamados deste grupo.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-members"
          />
          <div className="max-h-72 overflow-y-auto space-y-1 py-1">
            {visibleUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
            ) : (
              visibleUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={checked => toggle(u.id, checked === true)}
                    data-testid={`checkbox-member-${u.id}`}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground"> · {u.email}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && saveMutation.mutate({ groupId: editing.id, userIds: Array.from(selected) })}
              disabled={saveMutation.isPending}
              data-testid="button-save-members"
            >
              {saveMutation.isPending ? "Salvando..." : `Salvar (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
