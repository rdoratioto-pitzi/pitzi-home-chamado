import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface ResultadoBusca {
  imei:       string;
  voucher:    string;
  modelo:     string;
  status:     string;
  etapaAtual: string;
}

interface Props {
  onResultado: (imei: string) => void;
  isLoading:   boolean;
}

const TABS = [
  { key: 'imei',    label: 'IMEI',          placeholder: 'Digite o IMEI (15 dígitos)'          },
  { key: 'voucher', label: 'Voucher',        placeholder: 'Digite o código do voucher'          },
  { key: 'awb',     label: 'AWB',            placeholder: 'Digite o código de rastreamento AWB' },
  { key: 'coleta',  label: 'Código Coleta',  placeholder: 'Digite o código da coleta'           },
] as const;

type TipoTab = typeof TABS[number]['key'];

const STATUS_LABEL: Record<string, string> = {
  VOUCHER_UTILIZADO:   'Voucher',
  CONFIRMACAO_GERENTE: 'Confirmação',
  COLETA_SOLICITADA:   'Coleta',
  RECEBIMENTO:         'Recebimento',
  TRIAGEM_FINALIZADA:  'Triagem',
  BLOQUEADO:           'Bloqueado',
  MANUTENCAO:          'Manutenção',
  DIVERGENTE:          'Divergente',
};

const STATUS_COLOR: Record<string, string> = {
  BLOQUEADO:  'destructive',
  MANUTENCAO: 'secondary',
  DIVERGENTE: 'outline',
};

export function BuscaDispositivo({ onResultado, isLoading }: Props) {
  const [tipo,        setTipo]        = useState<TipoTab>('imei');
  const [termo,       setTermo]       = useState('');
  const [buscando,    setBuscando]    = useState(false);
  const [resultados,  setResultados]  = useState<ResultadoBusca[] | null>(null);
  const [erroMsg,     setErroMsg]     = useState<string | null>(null);

  const tabAtiva = TABS.find(t => t.key === tipo)!;

  async function handleBuscar() {
    if (!termo.trim()) return;
    setBuscando(true);
    setErroMsg(null);
    setResultados(null);

    try {
      const { fetchWithAuth } = await import('@/lib/queryClient');
      const qs  = new URLSearchParams({ termo: termo.trim(), tipo });
      const res = await fetchWithAuth(`/api/estoques/rastreabilidade/busca?${qs}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

      const lista: ResultadoBusca[] = json.data?.resultados ?? [];
      setResultados(lista);

      if (lista.length === 1) {
        onResultado(lista[0].imei);
      }
    } catch (err: any) {
      setErroMsg(err.message ?? 'Erro ao buscar dispositivo');
    } finally {
      setBuscando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBuscar();
  }

  function handleTrocarTipo(novo: TipoTab) {
    setTipo(novo);
    setTermo('');
    setResultados(null);
    setErroMsg(null);
  }

  const ocupado = buscando || isLoading;

  return (
    <div className="space-y-4">
      {/* ── Tabs ── */}
      <div className="flex items-center rounded-lg border bg-background overflow-hidden w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTrocarTipo(t.key)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              tipo === t.key
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Campo de busca ── */}
      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder={tabAtiva.placeholder}
            value={termo}
            onChange={e => setTermo(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={ocupado}
            maxLength={tipo === 'imei' ? 15 : 50}
            inputMode={tipo === 'imei' ? 'numeric' : 'text'}
          />
        </div>
        <Button onClick={handleBuscar} disabled={ocupado || !termo.trim()}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
        </Button>
      </div>

      {/* ── Erro ── */}
      {erroMsg && (
        <p className="text-sm text-destructive">{erroMsg}</p>
      )}

      {/* ── Resultados múltiplos ── */}
      {resultados !== null && resultados.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum dispositivo encontrado para "{termo}".
        </p>
      )}

      {resultados !== null && resultados.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {resultados.length} resultado(s) encontrado(s). Selecione um:
          </p>
          {resultados.map(r => (
            <Card
              key={r.imei}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onResultado(r.imei)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium font-mono">{r.imei}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.modelo || 'Modelo desconhecido'}
                    {r.voucher ? ` · ${r.voucher}` : ''}
                  </p>
                </div>
                <Badge variant={(STATUS_COLOR[r.status] as any) ?? 'secondary'}>
                  {STATUS_LABEL[r.status] ?? r.etapaAtual}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
