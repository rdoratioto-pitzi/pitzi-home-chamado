import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, Wallet, Search, Loader2, AlertTriangle, Info } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OmieFinancas() {
  // Estados para Contas a Pagar
  const [pagarFilters, setPagarFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDtVencIni: '',
    dDtVencFim: '',
    cStatus: 'ALL'
  });
  const [pagarData, setPagarData] = useState<any[]>([]);
  const [pagarLoading, setPagarLoading] = useState(false);
  const [pagarTotals, setPagarTotals] = useState({ total: 0, vencidas: 0, pagas: 0 });

  // Estados para Contas a Receber
  const [receberFilters, setReceberFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDtVencIni: '',
    dDtVencFim: '',
    cStatus: 'ALL'
  });
  const [receberData, setReceberData] = useState<any[]>([]);
  const [receberLoading, setReceberLoading] = useState(false);
  const [receberTotals, setReceberTotals] = useState({ total: 0, vencidas: 0, recebidas: 0 });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Função genérica para chamar API
  const callOmieApi = async (endpoint: string, call: string, params: any[], category: string) => {
    try {
      const { data } = await axios.post('/api/omie/call', {
        endpoint,
        call,
        params,
        category
      }, { withCredentials: true });

      if (data.success) {
        return data.data;
      }
      throw new Error(data.error || 'Erro na requisição');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  // Handler Contas a Pagar
  const handleBuscarPagar = async () => {
    setPagarLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: pagarFilters.nPagina,
        nRegPorPagina: pagarFilters.nRegPorPagina
      }];

      if (pagarFilters.dDtVencIni) {
        params[0].dDtVencIni = pagarFilters.dDtVencIni;
      }
      if (pagarFilters.dDtVencFim) {
        params[0].dDtVencFim = pagarFilters.dDtVencFim;
      }
      if (pagarFilters.cStatus !== 'ALL') {
        params[0].cStatus = pagarFilters.cStatus;
      }

      const result = await callOmieApi('financas/contapagar/', 'ListarContasPagar', params, 'financas');
      const contas = result.conta_pagar_cadastro || [];
      setPagarData(contas);

      // Calcular totais
      const total = contas.reduce((sum: number, c: any) => sum + (c.valor_documento || 0), 0);
      const vencidas = contas.filter((c: any) => c.status_titulo === 'VENCIDO').length;
      const pagas = contas.filter((c: any) => c.status_titulo === 'PAGO').length;
      setPagarTotals({ total, vencidas, pagas });

      setMessage({ type: 'success', text: `${result.total_de_registros || 0} conta(s) encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setPagarData([]);
      setPagarTotals({ total: 0, vencidas: 0, pagas: 0 });
    } finally {
      setPagarLoading(false);
    }
  };

  // Handler Contas a Receber
  const handleBuscarReceber = async () => {
    setReceberLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: receberFilters.nPagina,
        nRegPorPagina: receberFilters.nRegPorPagina
      }];

      if (receberFilters.dDtVencIni) {
        params[0].dDtVencIni = receberFilters.dDtVencIni;
      }
      if (receberFilters.dDtVencFim) {
        params[0].dDtVencFim = receberFilters.dDtVencFim;
      }
      if (receberFilters.cStatus !== 'ALL') {
        params[0].cStatus = receberFilters.cStatus;
      }

      const result = await callOmieApi('financas/contareceber/', 'ListarContasReceber', params, 'financas');
      const contas = result.conta_receber_cadastro || [];
      setReceberData(contas);

      // Calcular totais
      const total = contas.reduce((sum: number, c: any) => sum + (c.valor_documento || 0), 0);
      const vencidas = contas.filter((c: any) => c.status_titulo === 'VENCIDO').length;
      const recebidas = contas.filter((c: any) => c.status_titulo === 'RECEBIDO').length;
      setReceberTotals({ total, vencidas, recebidas });

      setMessage({ type: 'success', text: `${result.total_de_registros || 0} conta(s) encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setReceberData([]);
      setReceberTotals({ total: 0, vencidas: 0, recebidas: 0 });
    } finally {
      setReceberLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('vencid')) return 'destructive';
    if (statusLower?.includes('pag') || statusLower?.includes('receb')) return 'default';
    if (statusLower?.includes('abert') || statusLower?.includes('pendent')) return 'secondary';
    return 'outline';
  };

  const isVencido = (dataVenc: string) => {
    if (!dataVenc) return false;
    const [dia, mes, ano] = dataVenc.split('/');
    const vencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return vencimento < new Date();
  };

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

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
          {/* KPIs */}
          {pagarData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">R$ {pagarTotals.total.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Total a Pagar</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">{pagarTotals.vencidas}</div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{pagarTotals.pagas}</div>
                  <p className="text-xs text-muted-foreground">Pagas</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Vencimento Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={pagarFilters.dDtVencIni}
                onChange={(e) => setPagarFilters(prev => ({ ...prev, dDtVencIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Vencimento Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={pagarFilters.dDtVencFim}
                onChange={(e) => setPagarFilters(prev => ({ ...prev, dDtVencFim: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={pagarFilters.cStatus} onValueChange={(v) => setPagarFilters(prev => ({ ...prev, cStatus: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ABERTO">Aberto</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleBuscarPagar} disabled={pagarLoading}>
            {pagarLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Contas a Pagar
          </Button>

          {pagarLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pagarData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número Doc.</TableHead>
                    <TableHead>Cód. Fornecedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagarData.map((conta, idx) => (
                    <TableRow key={idx} className={isVencido(conta.data_vencimento) && conta.status_titulo !== 'PAGO' ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{conta.numero_documento_fiscal || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{conta.codigo_cliente_fornecedor}</TableCell>
                      <TableCell>R$ {conta.valor_documento?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        {conta.data_vencimento}
                        {isVencido(conta.data_vencimento) && conta.status_titulo !== 'PAGO' && (
                          <AlertTriangle className="h-3 w-3 inline ml-1 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>{conta.data_previsao || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(conta.status_titulo)}>
                          {conta.status_titulo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
          {/* KPIs */}
          {receberData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">R$ {receberTotals.total.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Total a Receber</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">{receberTotals.vencidas}</div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{receberTotals.recebidas}</div>
                  <p className="text-xs text-muted-foreground">Recebidas</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Vencimento Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={receberFilters.dDtVencIni}
                onChange={(e) => setReceberFilters(prev => ({ ...prev, dDtVencIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Vencimento Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={receberFilters.dDtVencFim}
                onChange={(e) => setReceberFilters(prev => ({ ...prev, dDtVencFim: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={receberFilters.cStatus} onValueChange={(v) => setReceberFilters(prev => ({ ...prev, cStatus: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ABERTO">Aberto</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleBuscarReceber} disabled={receberLoading}>
            {receberLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Contas a Receber
          </Button>

          {receberLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : receberData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número Doc.</TableHead>
                    <TableHead>Cód. Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receberData.map((conta, idx) => (
                    <TableRow key={idx} className={isVencido(conta.data_vencimento) && conta.status_titulo !== 'RECEBIDO' ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{conta.numero_documento_fiscal || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{conta.codigo_cliente_fornecedor}</TableCell>
                      <TableCell>R$ {conta.valor_documento?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        {conta.data_vencimento}
                        {isVencido(conta.data_vencimento) && conta.status_titulo !== 'RECEBIDO' && (
                          <AlertTriangle className="h-3 w-3 inline ml-1 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>{conta.data_previsao || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(conta.status_titulo)}>
                          {conta.status_titulo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
