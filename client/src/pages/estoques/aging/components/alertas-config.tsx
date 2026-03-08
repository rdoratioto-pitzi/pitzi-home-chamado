import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AlertaEtapa {
  amarelo: number;
  vermelho: number;
  critico: number;
}

type ConfigMap = Record<string, AlertaEtapa>;

const ETAPAS_LABELS: Record<string, string> = {
  voucher_confirmacao: 'Voucher → Confirmação',
  confirmacao_coleta:  'Confirmação → Coleta',
  em_estoque:          'Em Estoque',
  bloqueados:          'Bloqueados',
  manutencao:          'Manutenção',
  divergentes:         'Divergentes',
};

async function fetchConfig(): Promise<ConfigMap> {
  const res = await fetchWithAuth('/api/estoques/aging/alertas/config');
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function saveEtapa(etapa: string, valores: AlertaEtapa): Promise<void> {
  const res = await fetchWithAuth('/api/estoques/aging/alertas/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa, ...valores }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AlertasConfig({ open, onClose }: Props) {
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const [local, setLocal] = useState<ConfigMap>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['aging-alertas-config'],
    queryFn:  fetchConfig,
    enabled:  open,
    onSuccess: (d) => { setLocal(d); setDirty(false); },
  } as any);

  const mutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        Object.entries(local).map(([etapa, vals]) => saveEtapa(etapa, vals))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aging-alertas-config'] });
      toast({ title: 'Alertas salvos com sucesso' });
      setDirty(false);
      onClose();
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  function handleChange(etapa: string, campo: keyof AlertaEtapa, value: string) {
    const num = parseInt(value) || 0;
    setLocal(prev => ({ ...prev, [etapa]: { ...prev[etapa], [campo]: num } }));
    setDirty(true);
  }

  const config = dirty ? local : (data ?? local);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurar Alertas de Aging</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Etapa</th>
                  <th className="text-center py-2 px-2 font-semibold text-yellow-600">🟡 Amarelo</th>
                  <th className="text-center py-2 px-2 font-semibold text-red-600">🔴 Vermelho</th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-600">⚫ Crítico</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ETAPAS_LABELS).map(([key, label]) => {
                  const vals = config[key] ?? { amarelo: 0, vermelho: 0, critico: 0 };
                  return (
                    <tr key={key} className="border-b">
                      <td className="py-2 pr-4 font-medium">{label}</td>
                      {(['amarelo', 'vermelho', 'critico'] as const).map(campo => (
                        <td key={campo} className="py-2 px-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              min={1}
                              value={vals[campo]}
                              onChange={e => handleChange(key, campo, e.target.value)}
                              className="w-16 h-7 text-center text-xs"
                            />
                            <span className="text-xs text-muted-foreground">d</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !dirty}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
