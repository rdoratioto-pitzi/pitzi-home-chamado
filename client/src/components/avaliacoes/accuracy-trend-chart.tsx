import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, Plus, Save } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EvolucaoPonto, AvaliacoesFilters, VersaoIA } from "@/hooks/use-avaliacoes";
import { useAvaliacoesEvolucao, useVersoesIA, useAddVersaoIA } from "@/hooks/use-avaliacoes";
import { useToast } from "@/hooks/use-toast";

interface AccuracyTrendChartProps {
  filtros?: Omit<AvaliacoesFilters, "granularidade">;
}

type Granularidade = "diaria" | "semanal" | "mensal";

function formatAxisDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mensal") return format(d, "MMM/yy", { locale: ptBR });
    if (gran === "semanal") return format(d, "dd/MM", { locale: ptBR });
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return value;
  }
}

function formatTooltipDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mensal") return format(d, "MMMM yyyy", { locale: ptBR });
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return value;
  }
}

// Converte "YYYY-MM-DD" para o formato do eixo X conforme granularidade
function versaoToAxisKey(data: string, gran: Granularidade): string {
  if (gran === "mensal") return data.slice(0, 7);
  if (gran === "semanal") {
    try {
      return format(parseISO(data), "RRRR-'W'ww");
    } catch {
      return data;
    }
  }
  return data; // diaria: YYYY-MM-DD
}

// ─── Dialog para registrar nova versão IA ────────────────────────────────────

function NovaVersaoDialog({ onSalvo }: { onSalvo: () => void }) {
  const { toast } = useToast();
  const addMutation = useAddVersaoIA();
  const [aberto, setAberto] = useState(false);
  const [novaData, setNovaData] = useState(new Date().toISOString().slice(0, 10));
  const [novaVersao, setNovaVersao] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  async function handleSalvar() {
    if (!novaData || !novaVersao.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha data e versão.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync({ data: novaData, versao: novaVersao.trim(), descricao: novaDescricao.trim() });
      setNovaData(new Date().toISOString().slice(0, 10));
      setNovaVersao("");
      setNovaDescricao("");
      setAberto(false);
      toast({ title: "Versão registrada", description: `${novaVersao.trim()} adicionada ao histórico.` });
      onSalvo();
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only">Registrar atualização IA</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">Registrar atualização IA</p>
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar atualização IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="versao-data">Data da atualização</Label>
            <Input
              id="versao-data"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="versao-nome">Versão (ex: v2.3)</Label>
            <Input
              id="versao-nome"
              placeholder="v2.3"
              value={novaVersao}
              onChange={(e) => setNovaVersao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="versao-descricao">
              Descrição <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Textarea
              id="versao-descricao"
              placeholder="Ajuste no modelo de carcaça..."
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <Button
            className="w-full gap-2"
            onClick={handleSalvar}
            disabled={addMutation.isPending}
            style={{ background: "var(--accent, #00A137)", color: "#fff" }}
          >
            <Save className="h-4 w-4" />
            {addMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tooltip customizado para ReferenceLine ───────────────────────────────────

interface VersaoTooltipProps {
  versao: VersaoIA;
}

function VersaoLabel({ versao }: VersaoTooltipProps) {
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <text
          style={{ cursor: "default", fontSize: 9, fill: "var(--accent, #00A137)" }}
        >
          {versao.versao}
        </text>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-xs">{versao.versao}</p>
        {versao.descricao && <p className="text-xs text-muted-foreground">{versao.descricao}</p>}
        <p className="text-xs text-muted-foreground">
          {(() => { try { return format(parseISO(versao.data), "dd/MM/yyyy"); } catch { return versao.data; } })()}
        </p>
      </TooltipContent>
    </UITooltip>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AccuracyTrendChart({ filtros = {} }: AccuracyTrendChartProps) {
  const [granularidade, setGranularidade] = useState<Granularidade>("diaria");
  const { data, isLoading } = useAvaliacoesEvolucao({ ...filtros, granularidade });
  const { data: versoesData, refetch: refetchVersoes } = useVersoesIA();

  const pontos: EvolucaoPonto[] = data?.data ?? [];
  const versoes: VersaoIA[] = versoesData?.data ?? [];

  // Filtrar versões dentro do range de datas do gráfico
  const versoesFiltradas = (() => {
    if (!versoes.length || !pontos.length) return versoes;
    const keys = pontos.map((p) => versaoToAxisKey(p.data, granularidade));
    const min = keys[0];
    const max = keys[keys.length - 1];
    return versoes.filter((v) => {
      const k = versaoToAxisKey(v.data, granularidade);
      return k >= min && k <= max;
    });
  })();

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução de Acurácia
            </CardTitle>
            <CardDescription>Comparativo IA vs Avaliador Humano ao longo do tempo</CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
            <NovaVersaoDialog onSalvo={() => refetchVersoes()} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : pontos.length > 0 ? (
          <TooltipProvider>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={pontos} margin={{ top: 16, right: 4, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sep)" />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 10, fill: "var(--l3)" }}
                  tickFormatter={(v) => formatAxisDate(v, granularidade)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--l3)" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--bg2)", border: "1px solid var(--sep)", borderRadius: 6 }}
                  labelStyle={{ color: "var(--l1)", fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                  labelFormatter={(v) => formatTooltipDate(v, granularidade)}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--l2)" }} />
                {versoesFiltradas.map((v) => (
                  <ReferenceLine
                    key={v.data + v.versao}
                    x={versaoToAxisKey(v.data, granularidade)}
                    stroke="var(--accent, #00A137)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: v.versao,
                      position: "top",
                      fontSize: 9,
                      fill: "var(--accent, #00A137)",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="acuraciaIa"
                  name="IA (Lapisco)"
                  stroke="#00A137"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#00A137" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="acuraciaHumano"
                  name="Humano"
                  stroke="#378ADD"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#378ADD" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TooltipProvider>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            Nenhum dado de curadoria ainda. Inicie a curadoria para ver métricas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
