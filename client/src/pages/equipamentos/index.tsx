// Equipamentos (/equipamentos): inventário vindo do OCS, com a ficha e os chamados de cada máquina.
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Laptop, Search } from "lucide-react";
import { useAssets, type AssetItem } from "@/hooks/use-assets";
import { AssetSheetPanel, formatDateTime } from "@/components/assets/asset-sheet";
import { formatMemory, normalizePersonName } from "@shared/assets";

function matchesSearch(asset: AssetItem, q: string): boolean {
  if (!q) return true;
  const haystack = [asset.name, asset.serial, asset.userLabel, asset.person?.name, asset.person?.email, asset.ipAddress, asset.model]
    .map((v) => normalizePersonName(v))
    .join(" ");
  return normalizePersonName(q).split(" ").every((token) => haystack.includes(token));
}

export default function EquipamentosPage() {
  const { assets, isLoading, isError } = useAssets();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () => assets.filter((a) => (showInactive || a.active) && matchesSearch(a, search.trim())),
    [assets, search, showInactive],
  );
  const lastSync = assets.reduce<string | null>((max, a) => (!max || a.syncedAt > max ? a.syncedAt : max), null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Equipamentos" breadcrumbs={[{ label: "Equipamentos" }]} />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight">Equipamentos</h1>
          <p className="text-muted-foreground mt-2">
            Inventário do OCS. {lastSync ? `Última sincronização: ${formatDateTime(lastSync)}.` : ""}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, série, usuário ou IP"
              className="pl-9"
              data-testid="input-assets-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="assets-inactive" checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
            <Label htmlFor="assets-inactive" className="text-sm font-normal cursor-pointer">Mostrar inativos</Label>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : isError ? (
          <p className="text-center py-16 text-destructive">Não foi possível carregar os equipamentos.</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Laptop className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {assets.length === 0 ? "Nenhum equipamento sincronizado ainda." : "Nenhum equipamento encontrado para essa busca."}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Memória</TableHead>
                  <TableHead>Último inventário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(a.id)}
                    data-testid={`row-asset-${a.id}`}
                  >
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      {!a.active && <Badge variant="outline" className="mt-1">Inativo</Badge>}
                    </TableCell>
                    <TableCell>
                      {a.person ? a.person.name : <span className="text-muted-foreground">{a.userLabel || "—"}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.serial || "—"}</TableCell>
                    <TableCell className="text-sm">{a.osName || "—"}</TableCell>
                    <TableCell className="text-sm">{formatMemory(a.memoryMb)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(a.lastInventoryAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AssetSheetPanel id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
