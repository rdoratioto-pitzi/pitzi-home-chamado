import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, Wallet, Search, Loader2, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const isVencido = (dataVenc: string) => {
  if (!dataVenc) return false;
  const [dia, mes, ano] = dataVenc.split('/');
  return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)) < new Date();
};

const getStatusVariant = (status: string): 'destructive' | 'default' | 'secondary' | 'outline' => {
  const s = status?.toLowerCase();
  if (s?.includes('vencid')) return 'destructive';
  if (s?.includes('pag') || s?.includes('receb')) return 'default';
  if (s?.includes('abert') || s?.includes('pendent')) return 'secondary';
  return 'outline';
};

const defaultFilters = {
  nPagina: 1,
  nRegPorPagina: 20,
  dDtVencIni: '',
  dDtVencFim: '',
  cStatus: 'ALL',
};

export default function OmieFinancas() {
  // Resumo
  const [resumo, setResumo] = useState<any | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [resumoError, setResumoError] = useState<string | null>(null);

  // Contas a Pagar
  const [pagarFilters, setPagarFilters] = useState({ ...defaultFilters });
  const [pagarResult, setPagarResult] = useState<any | null>(null);
  const [pagarLoading, setPagarLoading] = useState(false);

  // Contas a Receber
  const [receberFilters, setReceberFilters] = useState({ ...defaultFilters });
  const [receberResult, setReceberResult] = useState<any | null>(null);
  const [receberLoading, setReceberLoading] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Resumo Financeiro ──────────────────────────────────────────────────────
  const handleCarregarResumo = async () => {
    setResumoLoading(true);
    setResumoError(null);
    try {
      const { data } = await axios.post('/api/omie/financas/resumo', {}, { withCredentials: true });
      if (data.sucesso) {
        setResumo(data.resumo);
      } else {
        throw new Error(data.error || 'Erro ao carregar resumo');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      setResumoError(msg);
    } finally {
      setResumoLoading(false);
    }
  };

  // ── Contas a Pagar ─────────────────────────────────────────────────────────
  const handleBuscarPagar = async () => {
    setPagarLoading(true);
    setMessage(null);
    try {
      const payload: any = {
        nPagina: pagarFilters.nPagina,
        nRegPorPagina: pagarFilters.nRegPorPagina,
      };
      if (pagarFilters.dDtVencIni) payload.dDtVencIni = pagarFilters.dDtVencIni;
      if (pagarFilters.dDtVencFim) payload.dDtVencFim = pagarFilters.dDtVencFim;
      if (pagarFilters.cStatus !== 'ALL') payload.cStatus = pagarFilters.cStatus;

      const { data } = await axios.post('/api/omie/financas/contas-pagar', payload, { withCredentials: true });
      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setPagarResult(data);
      setMessage({ type: 'success', text: `${data.totalRegistros || 0} conta(s) a pagar encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setPagarResult(null);
    } finally {
      setPagarLoading(false);
    }
  };

  // ── Contas a Receber ───────────────────────────────────────────────────────
  const handleBuscarReceber = async () => {
    setReceberLoading(true);
    setMessage(null);
    try {
      const payload: any = {
        nPagina: receberFilters.nPagina,
        nRegPorPagina: receberFilters.nRegPorPagina,
      };
      if (receberFilters.dDtVencIni) payload.dDtVencIni = receberFilters.dDtVencIni;
      if (receberFilters.dDtVencFim) payload.dDtVencFim = receberFilters.dDtVencFim;
      if (receberFilters.cStatus !== 'ALL') payload.cStatus = receberFilters.cStatus;

      const { data } = await axios.post('/api/omie/financas/contas-receber', payload, { withCredentials: true });
      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setReceberResult(data);
      setMessage({ type: 'success', text: `${data.totalRegistros || 0} conta(s) a receber encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setReceberResult(null);
    } finally {
      setReceberLoading(false);
    }
  };

  const FilterRow = ({
    filters,
    onChange,
    prefix,
  }: {
    filters: typeof defaultFilters;
    onChange: (f: typeof defaultFilters) => void;
    prefix: string;
  }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <Label>Vencimento Inicial</Label>
        <Input
          placeholder="DD/MM/YYYY"
          value={filters.dDtVencIni}
          onChange={(e) => onChange({ ...filters, dDtVencIni: e.target.value })}
        />
      </div>
      <div>
        <Label>Vencimento Final</Label>
        <Input
          placeholder="DD/MM/YYYY"
          value={filters.dDtVencFim}
          onChange={(e) => onChange({ ...filters, dDtVencFim: e.target.value })}
        />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={filters.cStatus} onValueChange={(v) => onChange({ ...filters, cStatus: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ABERTO">Aberto</SelectItem>
            {prefix === 'pagar' ? (
              <SelectItem value="PAGO">Pago</SelectItem>
            ) : (
              <SelectItem value="RECEBIDO">Recebido</SelectItem>
            )}
            <SelectItem value="VENCIDO">Vencido</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Registros por página</Label>
        <Select
          value={String(filters.nRegPorPagina)}
          onValueChange={(v) => onChange({ ...filters, nRegPorPagina: parseInt(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* RESUMO FINANCEIRO */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-500" />
                Resumo Financeiro
              </CardTitle>
              <CardDescription>Visão consolidada das finanças no Omie</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCarregarResumo} disabled={resumoLoading}>
              {resumoLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Carregar Resumo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {resumoLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : resumoError ? (
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Resumo não disponível</p>
                <p className="text-sm text-muted-foreground">{resumoError}</p>
              </div>
            </div>
          ) : resumo ? (
            <pre className="text-xs bg-muted/50 rounded p-4 overflow-auto max-h-64">
              {JSON.stringify(resumo, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Clique em "Carregar Resumo" para obter a visão consolidada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* CONTAS A PAGAR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Contas a Pagar
          </CardTitle>
          <CardDescription>Consultar contas a pagar e fornecedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pagarResult && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold">{fmt(pagarResult.resumo.totalValor)}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-green-600">{fmt(pagarResult.resumo.totalPago)}</div>
                  <p className="text-xs text-muted-foreground">Pago</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-orange-500">{fmt(pagarResult.resumo.saldoAberto)}</div>
                  <p className="text-xs text-muted-foreground">Saldo Aberto</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-red-600">{pagarResult.resumo.qtdVencidas}</div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-green-600">{pagarResult.resumo.qtdPagas}</div>
                  <p className="text-xs text-muted-foreground">Pagas</p>
                </CardContent>
              </Card>
            </div>
          )}

          <FilterRow filters={pagarFilters} onChange={setPagarFilters} prefix="pagar" />

          <Button onClick={handleBuscarPagar} disabled={pagarLoading}>
            {pagarLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar Contas a Pagar
          </Button>

          {pagarLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pagarResult?.contas?.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número Doc.</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagarResult.contas.map((conta: any, idx: number) => (
                    <TableRow
                      key={idx}
                      className={
                        isVencido(conta.dataVencimento) && conta.statusTitulo !== 'PAGO'
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : ''
                      }
                    >
                      <TableCell className="font-medium">{conta.numeroDocumento}</TableCell>
                      <TableCell className="text-xs">
                        {conta.nomeFornecedor || (
                          <span className="font-mono text-muted-foreground">{conta.codigoFornecedor}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fmt(conta.valorDocumento)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(conta.valorBaixado)}</TableCell>
                      <TableCell>
                        {conta.dataVencimento}
                        {isVencido(conta.dataVencimento) && conta.statusTitulo !== 'PAGO' && (
                          <AlertTriangle className="h-3 w-3 inline ml-1 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(conta.statusTitulo)}>
                          {conta.statusTitulo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                Página {pagarResult.pagina} de {pagarResult.totalPaginas} · {pagarResult.totalRegistros} registros
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* CONTAS A RECEBER */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Contas a Receber
          </CardTitle>
          <CardDescription>Consultar contas a receber de clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {receberResult && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold">{fmt(receberResult.resumo.totalValor)}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-green-600">{fmt(receberResult.resumo.totalRecebido)}</div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-orange-500">{fmt(receberResult.resumo.saldoAberto)}</div>
                  <p className="text-xs text-muted-foreground">Saldo Aberto</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-red-600">{receberResult.resumo.qtdVencidas}</div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-green-600">{receberResult.resumo.qtdRecebidas}</div>
                  <p className="text-xs text-muted-foreground">Recebidas</p>
                </CardContent>
              </Card>
            </div>
          )}

          <FilterRow filters={receberFilters} onChange={setReceberFilters} prefix="receber" />

          <Button onClick={handleBuscarReceber} disabled={receberLoading}>
            {receberLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar Contas a Receber
          </Button>

          {receberLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : receberResult?.contas?.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número Doc.</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receberResult.contas.map((conta: any, idx: number) => (
                    <TableRow
                      key={idx}
                      className={
                        isVencido(conta.dataVencimento) && conta.statusTitulo !== 'RECEBIDO'
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : ''
                      }
                    >
                      <TableCell className="font-medium">{conta.numeroDocumento}</TableCell>
                      <TableCell className="text-xs">
                        {conta.nomeCliente || (
                          <span className="font-mono text-muted-foreground">{conta.codigoCliente}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fmt(conta.valorDocumento)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(conta.valorBaixado)}</TableCell>
                      <TableCell>
                        {conta.dataVencimento}
                        {isVencido(conta.dataVencimento) && conta.statusTitulo !== 'RECEBIDO' && (
                          <AlertTriangle className="h-3 w-3 inline ml-1 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(conta.statusTitulo)}>
                          {conta.statusTitulo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                Página {receberResult.pagina} de {receberResult.totalPaginas} · {receberResult.totalRegistros} registros
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* MOVIMENTO DE CAIXA — não disponível */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Movimento de Caixa</span>
          </CardTitle>
          <CardDescription>Consultar entradas e saídas de caixa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Endpoint não disponível</p>
              <p className="text-sm text-muted-foreground">
                A API de Movimento de Caixa do Omie não está habilitada para esta conta.
                Consulte diretamente no ERP Omie ou entre em contato com o suporte para habilitar o acesso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
