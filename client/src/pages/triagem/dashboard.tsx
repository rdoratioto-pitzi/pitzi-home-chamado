import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Filter, Package, ShieldAlert, Wrench, AlertTriangle, ArrowUpRight, BarChart3, Network } from "lucide-react";
import { useTriagemResumo } from "@/hooks/use-triagem";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TriagemDashboardPage() {
  const { data, isLoading, error } = useTriagemResumo();
  const resumo = data?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Triagem — Dashboard" />
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !resumo) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Triagem — Dashboard" />
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center text-muted-foreground">
              Erro ao carregar dados de triagem. Verifique a conexão com a API Admin Logística.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Dashboard" />
      <div className="container mx-auto px-4 py-8 space-y-8">

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card style={{ background: "var(--vf)", border: "none" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFFFFF" }}>
                Recebidos Hoje
              </CardTitle>
              <Package className="h-4 w-4" style={{ color: "#FFFFFF" }} />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "#FFFFFF" }}>
                {resumo.recebidosHoje}
              </div>
              <p className="text-xs mt-1 flex items-center" style={{ color: "rgba(255,255,255,0.8)" }}>
                <ArrowUpRight className="h-3 w-3 mr-1" />
                dispositivos recebidos hoje
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Em Triagem
              </CardTitle>
              <Filter className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {resumo.emTriagem}
              </div>
              <p className="text-xs text-muted-foreground mt-1">aguardando processamento</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Bloqueados
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {resumo.bloqueados}
              </div>
              <p className="text-xs text-muted-foreground mt-1">iCloud / Google Lock</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Em Manutenção
              </CardTitle>
              <Wrench className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {resumo.emManutencao}
              </div>
              <p className="text-xs text-muted-foreground mt-1">em reparo</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Divergentes
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {resumo.divergentes}
              </div>
              <p className="text-xs text-muted-foreground mt-1">estética / funcional</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Bar chart: recebimentos por dia */}
          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Recebimentos — Últimos 30 dias
              </CardTitle>
              <CardDescription>Volume diário de dispositivos recebidos</CardDescription>
            </CardHeader>
            <CardContent>
              {resumo.recebimentosPorDia.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={resumo.recebimentosPorDia} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--sep)" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 10, fill: "var(--l3)" }}
                      tickFormatter={(v) => {
                        try { return format(parseISO(v), "dd/MM", { locale: ptBR }); }
                        catch { return v; }
                      }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "var(--l3)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg2)", border: "1px solid var(--sep)", borderRadius: 6 }}
                      labelStyle={{ color: "var(--l1)", fontSize: 12 }}
                      itemStyle={{ color: "var(--l2)", fontSize: 12 }}
                      labelFormatter={(v) => {
                        try { return format(parseISO(v), "dd 'de' MMM", { locale: ptBR }); }
                        catch { return v; }
                      }}
                    />
                    <Bar dataKey="quantidade" fill="var(--vf)" radius={[3, 3, 0, 0]} name="Recebimentos" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum recebimento nos últimos 30 dias.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top redes */}
          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Top Redes por Volume
              </CardTitle>
              <CardDescription>Redes com maior número de recebimentos</CardDescription>
            </CardHeader>
            <CardContent>
              {resumo.topRedes.length > 0 ? (
                <div className="space-y-3">
                  {resumo.topRedes.slice(0, 8).map((item) => {
                    const max = resumo.topRedes[0]?.quantidade || 1;
                    const pct = Math.round((item.quantidade / max) * 100);
                    return (
                      <div key={item.rede} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[180px]" style={{ color: "var(--l1)" }}>
                            {item.rede || "—"}
                          </span>
                          <span className="text-muted-foreground font-mono">{item.quantidade}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--sep)" }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${pct}%`, background: "var(--vf)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado de rede disponível.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
