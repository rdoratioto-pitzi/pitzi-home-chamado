import { ReactNode } from "react";
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiFormato = "numero" | "moeda" | "percentual" | "dias";
export type KpiStatus  = "dentro" | "acima" | "abaixo";

interface KpiCardProps {
  titulo: string;
  subtitulo?: string;
  valor: number | string;
  variacao?: number;
  variacaoBoa?: boolean;  // true = variação positiva é boa (default), false = variação positiva é ruim
  meta?: number;
  metaLabel?: string;
  status?: KpiStatus;
  formato: KpiFormato;
  icone: ReactNode;
  isLoading?: boolean;
  highlight?: boolean;
}

export function formatarValor(valor: number | string, formato: KpiFormato): string {
  const num = typeof valor === "string" ? parseFloat(valor) : valor;
  if (isNaN(num)) return String(valor);
  switch (formato) {
    case "moeda":
      return num >= 1_000_000
        ? `R$ ${(num / 1_000_000).toFixed(1)}M`
        : num >= 1_000
        ? `R$ ${(num / 1_000).toFixed(0)}k`
        : num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "percentual":
      return `${num.toFixed(1)}%`;
    case "dias":
      return `${num.toFixed(1)}d`;
    case "numero":
    default:
      return num.toLocaleString("pt-BR");
  }
}

export function KpiCard({
  titulo, subtitulo, valor, variacao, variacaoBoa = true,
  meta, metaLabel, status, formato, icone, isLoading, highlight,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-3 px-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  const valorFormatado = formatarValor(valor, formato);

  // Cor da variação
  const positivaBoa = variacaoBoa;
  const variacaoPositiva = (variacao ?? 0) > 0;
  const variacaoBomCor   = variacaoPositiva === positivaBoa ? "text-green-600" : "text-red-600";

  // Cor e ícone de status
  const statusConfig: Record<KpiStatus, { cor: string; icone: ReactNode }> = {
    dentro: { cor: "text-green-600", icone: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> },
    acima:  { cor: "text-amber-600", icone: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> },
    abaixo: { cor: "text-red-600",   icone: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> },
  };

  return (
    <Card
      className={cn("hover:shadow-md transition-shadow", highlight ? "" : "border")}
      style={highlight
        ? { background: 'var(--vf)', border: 'none' }
        : { background: 'var(--bg2)', borderColor: 'var(--sep)' }
      }
    >
      <CardContent className="pt-4 pb-3 px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wide leading-tight"
              style={{ color: highlight ? '#FFFFFF' : 'var(--l3)' }}
            >
              {titulo}
            </p>
            {subtitulo && (
              <p className="text-[10px] leading-tight" style={{ color: highlight ? 'rgba(255,255,255,0.8)' : undefined }}>{subtitulo}</p>
            )}
          </div>
          <div style={{ color: highlight ? '#FFFFFF' : undefined }} className={highlight ? '' : 'text-muted-foreground/60'}>{icone}</div>
        </div>

        {/* Valor principal */}
        <p className="text-[28px] font-bold tracking-tight mb-1" style={{ color: highlight ? '#FFFFFF' : 'var(--l1)' }}>{valorFormatado}</p>

        {/* Variação */}
        {variacao !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium", variacaoBomCor)}>
            {variacaoPositiva
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />}
            <span>{variacao > 0 ? "+" : ""}{variacao.toFixed(1)}{formato === "percentual" || formato === "dias" ? "" : "%"} vs anterior</span>
          </div>
        )}

        {/* Meta */}
        {meta !== undefined && status && (
          <div className="flex items-center gap-1 mt-1.5">
            {statusConfig[status].icone}
            <span className={cn("text-[10px] font-medium", statusConfig[status].cor)}>
              Meta: {formatarValor(meta, formato)}{metaLabel ? ` ${metaLabel}` : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
