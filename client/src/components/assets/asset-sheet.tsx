// Ficha do equipamento (inventário do OCS) em painel lateral: tela Equipamentos e chamado.
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Laptop } from "lucide-react";
import { useAssetSheet } from "@/hooks/use-assets";
import { formatMemory } from "@shared/assets";
import { statusLabelOf } from "@/lib/workspace-status";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm mt-0.5 break-words">{children || "—"}</dd>
    </div>
  );
}

/** Ficha do equipamento em painel lateral (também aberta a partir do chamado). */
export function AssetSheetPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: asset, isLoading } = useAssetSheet(id);
  const details = (asset?.details ?? { disks: [], monitors: [] }) as {
    disks: { name: string | null; type: string | null; sizeMb: number | null }[];
    monitors: { manufacturer: string | null; model: string | null; serial: string | null }[];
  };

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading || !asset ? (
          <div className="space-y-3 mt-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Laptop className="h-5 w-5" />{asset.name}
                {!asset.active && <Badge variant="outline">Inativo</Badge>}
              </SheetTitle>
              <SheetDescription>Último inventário: {formatDateTime(asset.lastInventoryAt)}</SheetDescription>
            </SheetHeader>

            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Field label="Usuário">
                {asset.person ? `${asset.person.name}` : asset.userLabel}
              </Field>
              <Field label="Série">{asset.serial}</Field>
              <Field label="Fabricante / modelo">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</Field>
              <Field label="Sistema">{asset.osName}</Field>
              <Field label="Processador">{asset.cpu}</Field>
              <Field label="Memória">{formatMemory(asset.memoryMb)}</Field>
              <Field label="IP">{asset.ipAddress}</Field>
            </dl>

            {details.disks.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Discos</h3>
                <ul className="text-sm space-y-1">
                  {details.disks.map((d, i) => (
                    <li key={i}>{[d.name, d.type].filter(Boolean).join(" · ")}{d.sizeMb ? ` — ${formatMemory(d.sizeMb)}` : ""}</li>
                  ))}
                </ul>
              </section>
            )}

            {details.monitors.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Monitores</h3>
                <ul className="text-sm space-y-1">
                  {details.monitors.map((m, i) => (
                    <li key={i}>{[m.manufacturer, m.model].filter(Boolean).join(" ") || "Monitor"}{m.serial ? ` (${m.serial})` : ""}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Chamados deste equipamento ({asset.tickets.length})</h3>
              {asset.tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum chamado ligado a este equipamento.</p>
              ) : (
                <ul className="space-y-2">
                  {asset.tickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/chamados/${t.id}`} className="block rounded-md border p-2 hover:border-primary/40" data-testid={`link-asset-ticket-${t.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{t.code} · {t.title}</span>
                          <Badge variant="secondary" className="shrink-0">{statusLabelOf(t.status)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.requesterName ?? "—"} · {formatDateTime(t.createdAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
