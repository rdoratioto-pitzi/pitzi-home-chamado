import { Skeleton } from "@/components/ui/skeleton";

export interface TimelineEvento {
  etapa:       string;
  label:       string;
  data:        string | null;
  responsavel: string | null;
  local:       string | null;
  detalhes:    Record<string, any> | null;
  desvio?:     boolean;
}

interface Props {
  eventos:   TimelineEvento[];
  isLoading: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  try {
    const n = iso.includes('T') ? iso : iso.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
    const d = new Date(n);
    if (isNaN(d.getTime())) return iso;
    const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dia} ${hora}`;
  } catch { return iso; }
}

function diffDias(dateA: string | null, dateB: string | null): number | null {
  if (!dateA || !dateB) return null;
  try {
    const normalize = (s: string) =>
      s.includes('T') ? s : s.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
    const diff = new Date(normalize(dateB)).getTime() - new Date(normalize(dateA)).getTime();
    if (isNaN(diff) || diff < 0) return null;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

const ETAPA_CONFIG: Record<string, { icon: string; cor: string; corBg: string }> = {
  VOUCHER_UTILIZADO:   { icon: '🏷️',  cor: 'text-blue-600',   corBg: 'bg-blue-100'   },
  CONFIRMACAO_GERENTE: { icon: '✅',  cor: 'text-green-600',  corBg: 'bg-green-100'  },
  COLETA_SOLICITADA:   { icon: '📦',  cor: 'text-indigo-600', corBg: 'bg-indigo-100' },
  RECEBIMENTO:         { icon: '📥',  cor: 'text-violet-600', corBg: 'bg-violet-100' },
  TRIAGEM_DIVERGENTE:  { icon: '⚠️',  cor: 'text-yellow-600', corBg: 'bg-yellow-100' },
  BLOQUEADO:           { icon: '🔒',  cor: 'text-red-600',    corBg: 'bg-red-100'    },
  MANUTENCAO:          { icon: '🔧',  cor: 'text-orange-600', corBg: 'bg-orange-100' },
  TRIAGEM_FINALIZADA:  { icon: '🏭',  cor: 'text-teal-600',   corBg: 'bg-teal-100'   },
  VENDIDO:             { icon: '💰',  cor: 'text-emerald-600',corBg: 'bg-emerald-100'},
};

function detalheTexto(evento: TimelineEvento): string[] {
  const linhas: string[] = [];
  const d = evento.detalhes;

  if (!d) return linhas;

  if (evento.etapa === 'VOUCHER_UTILIZADO') {
    if (d.rede)   linhas.push(`Rede: ${d.rede}`);
    if (d.filial) linhas.push(`Filial: ${d.filial}`);
  } else if (evento.etapa === 'COLETA_SOLICITADA') {
    if (d.operador) linhas.push(`Operador: ${d.operador}`);
    if (d.awb)      linhas.push(`AWB: ${d.awb}`);
  } else if (evento.etapa === 'TRIAGEM_DIVERGENTE' || evento.etapa === 'BLOQUEADO') {
    if (d.motivo) linhas.push(`Motivo: ${d.motivo}`);
  } else if (evento.etapa === 'MANUTENCAO') {
    if (d.tipo) linhas.push(`Tipo: ${d.tipo}`);
  } else if (evento.etapa === 'TRIAGEM_FINALIZADA') {
    if (d.nfEntrada) linhas.push(`NF Entrada: ${d.nfEntrada}`);
    if (d.grade)     linhas.push(`Grade: ${d.grade}`);
  } else if (evento.etapa === 'VENDIDO') {
    if (d.nfSaida)    linhas.push(`NF Saída: ${d.nfSaida}`);
    if (d.valorVenda) linhas.push(`Valor: R$ ${Number(d.valorVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  return linhas;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function Timeline({ eventos, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum evento na timeline.
      </p>
    );
  }

  return (
    <div className="relative">
      {eventos.map((ev, idx) => {
        const isLast   = idx === eventos.length - 1;
        const cfg      = ETAPA_CONFIG[ev.etapa] ?? { icon: '●', cor: 'text-muted-foreground', corBg: 'bg-muted' };
        const diasAte  = diffDias(ev.data, eventos[idx + 1]?.data ?? null);
        const detalhes = detalheTexto(ev);

        return (
          <div key={idx} className="flex gap-3">
            {/* ── Coluna esquerda: linha + ícone ── */}
            <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${cfg.corBg} ${ev.desvio ? 'ring-2 ring-yellow-400' : ''}`}>
                {cfg.icon}
              </div>
              {!isLast && (
                <div className="flex-1 w-px bg-border mt-1 mb-1 min-h-[28px]" />
              )}
            </div>

            {/* ── Conteúdo ── */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
                <div className="min-w-0">
                  <p className={`font-semibold text-sm leading-tight ${cfg.cor}`}>
                    {ev.label}
                    {ev.desvio && <span className="ml-1.5 text-yellow-500">⚠️</span>}
                  </p>

                  {/* data + responsável + local */}
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-2 flex flex-wrap gap-y-0.5">
                    {ev.data && (
                      <span>{formatDateTime(ev.data)}</span>
                    )}
                    {ev.responsavel && (
                      <span>· {ev.responsavel}</span>
                    )}
                    {ev.local && (
                      <span>· {ev.local}</span>
                    )}
                  </div>

                  {/* detalhes */}
                  {detalhes.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      {detalhes.map((txt, i) => <span key={i}>{txt}</span>)}
                    </div>
                  )}

                  {/* marcador de entrada no estoque */}
                  {ev.etapa === 'TRIAGEM_FINALIZADA' && (
                    <p className="mt-1 text-xs font-medium text-teal-700">↳ Entrou no Estoque</p>
                  )}
                </div>

                {/* Tempo até próxima etapa */}
                {diasAte !== null && (
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      {diasAte}d
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
