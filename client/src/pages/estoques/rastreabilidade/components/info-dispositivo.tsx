import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Dispositivo {
  imei:       string;
  modelo:     string;
  categoria:  string;
  grade:      string | null;
  mesTradeIn: string;
}

interface Origem {
  voucher:      string;
  rede:         string;
  filial:       string;
  valorVoucher: number;
}

interface StatusAtual {
  status:     string;
  nfVenda?:   string | null;
  valorVenda?: number;
  dataVenda?:  string | null;
}

interface Props {
  dispositivo: Dispositivo;
  origem:      Origem;
  statusAtual: StatusAtual;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  VENDIDO:           { label: 'Vendido',          cor: 'bg-emerald-500' },
  EM_ESTOQUE:        { label: 'Em Estoque',        cor: 'bg-blue-500'   },
  TRIAGEM_FINALIZADA:{ label: 'Em Estoque',        cor: 'bg-blue-500'   },
  BLOQUEADO:         { label: 'Bloqueado',         cor: 'bg-red-500'    },
  MANUTENCAO:        { label: 'Manutenção',        cor: 'bg-orange-500' },
  DIVERGENTE:        { label: 'Divergente',        cor: 'bg-yellow-500' },
  EM_PROCESSAMENTO:  { label: 'Em Processamento',  cor: 'bg-gray-400'   },
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const n = iso.includes('T') ? iso : iso.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
    return new Date(n).toLocaleDateString('pt-BR');
  } catch { return iso; }
}

export function InfoDispositivo({ dispositivo, origem, statusAtual }: Props) {
  const cfg = STATUS_CONFIG[statusAtual.status] ?? { label: statusAtual.status, cor: 'bg-gray-400' };

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">

        {/* ── Dispositivo ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Dispositivo
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-base">{dispositivo.modelo || 'Modelo desconhecido'}</span>
            {dispositivo.categoria && (
              <Badge variant="secondary">{dispositivo.categoria}</Badge>
            )}
            {dispositivo.grade && (
              <Badge variant="outline">Grade {dispositivo.grade}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span className="font-mono">{dispositivo.imei}</span>
            <span className="flex items-center gap-1">
              📅 Mês Trade-in:
              <strong className="text-foreground">{dispositivo.mesTradeIn}</strong>
            </span>
          </div>
        </div>

        <Separator />

        {/* ── Origem ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Origem
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {origem.voucher && (
              <span>Voucher: <strong className="font-mono">{origem.voucher}</strong></span>
            )}
            {origem.rede && (
              <span>Rede: <strong>{origem.rede}</strong></span>
            )}
            {origem.filial && (
              <span>Filial: <strong>{origem.filial}</strong></span>
            )}
            {origem.valorVoucher > 0 && (
              <span>Valor: <strong className="text-primary">{formatCurrency(origem.valorVoucher)}</strong></span>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Status atual ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Status Atual
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.cor}`} />
              <strong>{cfg.label}</strong>
            </span>
            {statusAtual.dataVenda && (
              <span>Data Venda: <strong>{formatDate(statusAtual.dataVenda)}</strong></span>
            )}
            {statusAtual.nfVenda && (
              <span>NF: <strong className="font-mono">{statusAtual.nfVenda}</strong></span>
            )}
            {statusAtual.valorVenda != null && statusAtual.valorVenda > 0 && (
              <span>Valor Venda: <strong className="text-emerald-600">{formatCurrency(statusAtual.valorVenda)}</strong></span>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
