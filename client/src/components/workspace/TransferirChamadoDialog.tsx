import { useEffect, useState } from "react";
import { isTechnician } from "@shared/user-type";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupportGroups } from "@/hooks/use-support-groups";
import type { ChamadoItem } from "./WorkspaceTable";

const SEM_RESPONSAVEL = "__none__";

interface TransferirChamadoDialogProps {
  item: ChamadoItem | null;
  onClose: () => void;
  onConfirm: (item: ChamadoItem, category: string, assigneeId: string | null) => Promise<void>;
}

/** Transferência de chamado para outro grupo (e, se quiser, para um membro do grupo). */
export function TransferirChamadoDialog({ item, onClose, onConfirm }: TransferirChamadoDialogProps) {
  const { groups } = useSupportGroups();
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const [category, setCategory] = useState("");
  const [assigneeId, setAssigneeId] = useState(SEM_RESPONSAVEL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setCategory(item.categoria);
    setAssigneeId(SEM_RESPONSAVEL);
  }, [item]);

  const target = groups.find(g => g.key === category);
  const members = users
    .filter(u => target?.memberIds.includes(u.id) && u.status === "active" && isTechnician(u))
    .sort((a, b) => a.name.localeCompare(b.name));

  const confirm = async () => {
    if (!item || !category) return;
    setSaving(true);
    try {
      await onConfirm(item, category, assigneeId === SEM_RESPONSAVEL ? null : assigneeId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={item !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir {item?.codigo}</DialogTitle>
          <DialogDescription>
            Escolha o grupo que vai atender o chamado. O responsável é opcional e precisa ser membro do grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select
              value={category}
              onValueChange={value => { setCategory(value); setAssigneeId(SEM_RESPONSAVEL); }}
            >
              <SelectTrigger data-testid="select-transferir-grupo">
                <SelectValue placeholder="Selecione o grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!target}>
              <SelectTrigger data-testid="select-transferir-responsavel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_RESPONSAVEL}>Sem responsável (fila do grupo)</SelectItem>
                {members.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={!category || saving} data-testid="button-transferir-confirmar">
            {saving ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
