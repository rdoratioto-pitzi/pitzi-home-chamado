// Equipamento do chamado (técnicos): mostra a máquina, abre a ficha e permite trocar ou tirar.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/hooks/use-ticket-fields";
import { cn } from "@/lib/utils";
import { useAssets } from "@/hooks/use-assets";
import { AssetSheetPanel } from "./asset-sheet";

const NONE = "__sem_equipamento__";

interface TicketAssetFieldProps {
  ticketId: string;
  assetId: string | null | undefined;
  /** Avisa a tela do chamado depois de salvar (além de recarregar a lista de equipamentos). */
  onSaved?: (assetId: string | null) => void;
  /** "row": rótulo ao lado (gaveta da lista); "stacked": rótulo em cima (página do chamado). */
  layout?: "row" | "stacked";
  labelStyle?: React.CSSProperties;
}

export function TicketAssetField({ ticketId, assetId, onSaved, layout = "stacked", labelStyle }: TicketAssetFieldProps) {
  const { assets } = useAssets();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const current = assets.find((a) => a.id === assetId) ?? null;

  const mutation = useMutation({
    mutationFn: async (next: string | null) => apiRequest("PATCH", `/api/tickets/${ticketId}`, { assetId: next }),
    onSuccess: (_res, next) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/assets"] });
      onSaved?.(next);
      toast({ title: "Equipamento atualizado" });
    },
    onError: (error: unknown) => {
      toast({ title: apiErrorMessage(error, "Erro ao salvar o equipamento"), variant: "destructive" });
    },
  });

  const choose = (value: string | null) => {
    setOpen(false);
    if (value !== (assetId ?? null)) mutation.mutate(value);
  };

  return (
    <div className={layout === "row" ? "flex items-center gap-3" : undefined}>
      {layout === "row"
        ? <span style={labelStyle}>Equipamento</span>
        : <span className="text-xs text-muted-foreground">Equipamento</span>}
      <div className={cn("flex items-center gap-1 min-w-0", layout === "row" ? "flex-1" : "mt-1")}>
        {current ? (
          <button
            type="button"
            className={cn("flex items-center gap-2 text-primary hover:underline min-w-0", layout === "row" ? "text-xs" : "text-sm")}
            onClick={() => setSheetId(current.id)}
            data-testid="button-ticket-asset"
          >
            <Laptop className="h-4 w-4 shrink-0" />
            <span className="truncate">{current.name}</span>
          </button>
        ) : (
          <span className={cn("text-muted-foreground", layout === "row" ? "text-xs" : "text-sm")}>{assetId ? "Equipamento não encontrado" : "Sem equipamento"}</span>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 ml-auto text-xs"
              disabled={mutation.isPending}
              data-testid="button-ticket-asset-change"
            >
              Trocar <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar por nome, série ou usuário..." />
              <CommandList>
                <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value={NONE} onSelect={() => choose(null)}>
                    <Check className={cn("mr-2 h-4 w-4", !assetId ? "opacity-100" : "opacity-0")} />
                    Sem equipamento
                  </CommandItem>
                  {assets.filter((a) => a.active || a.id === assetId).map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.serial ?? ""} ${a.person?.name ?? a.userLabel ?? ""} ${a.id}`}
                      onSelect={() => choose(a.id)}
                      data-testid={`option-asset-${a.id}`}
                    >
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", a.id === assetId ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0">
                        <div className="truncate">{a.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.person?.name ?? a.userLabel ?? "Sem usuário"}{a.serial ? ` · ${a.serial}` : ""}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <AssetSheetPanel id={sheetId} onClose={() => setSheetId(null)} />
    </div>
  );
}
