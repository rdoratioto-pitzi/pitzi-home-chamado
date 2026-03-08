import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, FileText, Receipt, Search, Loader2, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function OmieVendas() {
  // Estados para Pedidos de Venda
  const [pedidosFilters, setPedidosFilters] = useState({
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_numero_pedido: '',
    filtrar_por_etapa: 'ALL',
    filtrar_por_data_de: '',
    filtrar_por_data_ate: ''
  });
  const [pedidosData, setPedidosData] = useState<any[]>([]);
  const [pedidosMeta, setPedidosMeta] = useState<{ total: number; paginas: number } | null>(null);
  const [pedidosLoading, setPedidosLoading] = useState(false);

  // Estados para NF-e Produtos
  const [nfeFilters, setNfeFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDataInicial: '',
    dDataFinal: ''
  });
  const [nfeData, setNfeData] = useState<any[]>([]);
  const [nfeMeta, setNfeMeta] = useState<{ total: number; paginas: number } | null>(null);
  const [nfeLoading, setNfeLoading] = useState(false);

  // Estados gerais
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

  // Handler Pedidos de Venda
  const handleBuscarPedidos = async (paginaOverride?: number) => {
    const pagina = paginaOverride ?? pedidosFilters.pagina;
    setPedidosLoading(true);
    setMessage(null);
    try {
      const params: any = [{
        pagina,
        registros_por_pagina: pedidosFilters.registros_por_pagina,
        apenas_importado_api: 'N'
      }];

      if (pedidosFilters.filtrar_por_numero_pedido) {
        params[0].filtrar_por_numero_pedido = pedidosFilters.filtrar_por_numero_pedido;
      }
      if (pedidosFilters.filtrar_por_etapa !== 'ALL') {
        params[0].filtrar_por_etapa = pedidosFilters.filtrar_por_etapa;
      }
      if (pedidosFilters.filtrar_por_data_de) {
        params[0].filtrar_por_data_de = pedidosFilters.filtrar_por_data_de;
      }
      if (pedidosFilters.filtrar_por_data_ate) {
        params[0].filtrar_por_data_ate = pedidosFilters.filtrar_por_data_ate;
      }

      const result = await callOmieApi('produtos/pedido/', 'ListarPedidos', params, 'vendas');
      setPedidosData(result.pedido_venda_produto || []);
      setPedidosMeta({
        total: result.total_de_registros || 0,
        paginas: result.total_de_paginas || 1
      });
      if (paginaOverride) {
        setPedidosFilters(prev => ({ ...prev, pagina }));
      }
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} pedido(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setPedidosData([]);
      setPedidosMeta(null);
    } finally {
      setPedidosLoading(false);
    }
  };

  // Handler NF-e Produtos — endpoint: produtos/nfe/ + ListarNFe
  const handleBuscarNFe = async (paginaOverride?: number) => {
    const pagina = paginaOverride ?? nfeFilters.nPagina;
    setNfeLoading(true);
    setMessage(null);
    try {
      const params: any = [{
        nPagina: pagina,
        nRegPorPagina: nfeFilters.nRegPorPagina
      }];

      if (nfeFilters.dDataInicial) params[0].dDataInicial = nfeFilters.dDataInicial;
      if (nfeFilters.dDataFinal) params[0].dDataFinal = nfeFilters.dDataFinal;

      const result = await callOmieApi('produtos/nfe/', 'ListarNFe', params, 'vendas');
      setNfeData(result.listagemNfe || []);
      setNfeMeta({
        total: result.nTotRegistros || 0,
        paginas: result.nTotPaginas || 1
      });
      if (paginaOverride) {
        setNfeFilters(prev => ({ ...prev, nPagina: pagina }));
      }
      setMessage({ type: 'success', text: `${result.nTotRegistros || 0} NF-e encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setNfeData([]);
      setNfeMeta(null);
    } finally {
      setNfeLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const s = status?.toLowerCase();
    if (s?.includes('cancelad')) return 'destructive' as const;
    if (s?.includes('faturad') || s?.includes('autoriz') || s?.includes('emitid')) return 'default' as const;
    if (s?.includes('pendent') || s?.includes('abert')) return 'secondary' as const;
    return 'outline' as const;
  };

  const traduzEtapa = (etapa: string) => {
    const etapas: Record<string, string> = {
      '10': 'Em aberto',
      '20': 'Em andamento',
      '40': 'Faturado parcial',
      '50': 'Faturado',
      '60': 'Entregue',
      '70': 'Cancelado'
    };
    return etapas[etapa] || etapa || '-';
  };

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* PEDIDOS DE VENDA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Pedidos de Venda
          </CardTitle>
          <CardDescription>Consultar pedidos de venda emitidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Número do Pedido</Label>
              <Input
                placeholder="Ex: 15"
                value={pedidosFilters.filtrar_por_numero_pedido}
                onChange={(e) => setPedidosFilters(prev => ({ ...prev, filtrar_por_numero_pedido: e.target.value }))}
              />
            </div>
            <div>
              <Label>Etapa</Label>
              <Select
                value={pedidosFilters.filtrar_por_etapa}
                onValueChange={(v) => setPedidosFilters(prev => ({ ...prev, filtrar_por_etapa: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="10">Em aberto</SelectItem>
                  <SelectItem value="20">Em andamento</SelectItem>
                  <SelectItem value="40">Faturado parcial</SelectItem>
                  <SelectItem value="50">Faturado</SelectItem>
                  <SelectItem value="60">Entregue</SelectItem>
                  <SelectItem value="70">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Inicial (DD/MM/AAAA)</Label>
              <Input
                placeholder="01/01/2026"
                value={pedidosFilters.filtrar_por_data_de}
                onChange={(e) => setPedidosFilters(prev => ({ ...prev, filtrar_por_data_de: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/AAAA)</Label>
              <Input
                placeholder="31/01/2026"
                value={pedidosFilters.filtrar_por_data_ate}
                onChange={(e) => setPedidosFilters(prev => ({ ...prev, filtrar_por_data_ate: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={() => handleBuscarPedidos(1)} disabled={pedidosLoading}>
            {pedidosLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Pedidos
          </Button>

          {pedidosLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pedidosData.length > 0 ? (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cód. Cliente</TableHead>
                      <TableHead>Qtde. Itens</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Data Previsão</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Etapa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosData.map((pedido, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{pedido.cabecalho?.numero_pedido}</TableCell>
                        <TableCell>{pedido.cabecalho?.codigo_cliente}</TableCell>
                        <TableCell>{pedido.cabecalho?.quantidade_itens}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(pedido.total_pedido?.valor_total_pedido)}
                        </TableCell>
                        <TableCell>{pedido.cabecalho?.data_previsao}</TableCell>
                        <TableCell>{pedido.cabecalho?.origem_pedido || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(pedido.cabecalho?.etapa)}>
                            {traduzEtapa(pedido.cabecalho?.etapa)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pedidosMeta && pedidosMeta.paginas > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Página {pedidosFilters.pagina} de {pedidosMeta.paginas} — {pedidosMeta.total} registro(s)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pedidosFilters.pagina <= 1 || pedidosLoading}
                      onClick={() => handleBuscarPedidos(pedidosFilters.pagina - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pedidosFilters.pagina >= pedidosMeta.paginas || pedidosLoading}
                      onClick={() => handleBuscarPedidos(pedidosFilters.pagina + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* NF-e PRODUTOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas Fiscais de Produto (NF-e)
          </CardTitle>
          <CardDescription>Consultar notas fiscais eletrônicas emitidas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Data Inicial (DD/MM/AAAA)</Label>
              <Input
                placeholder="01/01/2026"
                value={nfeFilters.dDataInicial}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, dDataInicial: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/AAAA)</Label>
              <Input
                placeholder="31/01/2026"
                value={nfeFilters.dDataFinal}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, dDataFinal: e.target.value }))}
              />
            </div>
            <div>
              <Label>Registros por Página</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={nfeFilters.nRegPorPagina}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, nRegPorPagina: parseInt(e.target.value) || 10 }))}
              />
            </div>
          </div>
          <Button onClick={() => handleBuscarNFe(1)} disabled={nfeLoading}>
            {nfeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar NF-e
          </Button>

          {nfeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : nfeData.length > 0 ? (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Série</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead>Chave NF-e</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nfeData.map((nfe, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{nfe.cNumNF}</TableCell>
                        <TableCell>{nfe.cSerie}</TableCell>
                        <TableCell>{nfe.cNomeCli || nfe.cRazaoSocialCli || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(nfe.nValorNF)}
                        </TableCell>
                        <TableCell>{nfe.dDtEmis}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {nfe.cChaveNFe ? (
                            <span className="truncate max-w-[200px] inline-block" title={nfe.cChaveNFe}>
                              {nfe.cChaveNFe.substring(0, 20)}...
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(nfe.cSituacao)}>
                            {nfe.cSituacao || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {nfeMeta && nfeMeta.paginas > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Página {nfeFilters.nPagina} de {nfeMeta.paginas} — {nfeMeta.total} registro(s)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={nfeFilters.nPagina <= 1 || nfeLoading}
                      onClick={() => handleBuscarNFe(nfeFilters.nPagina - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={nfeFilters.nPagina >= nfeMeta.paginas || nfeLoading}
                      onClick={() => handleBuscarNFe(nfeFilters.nPagina + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* NFS-e SERVIÇOS — não disponível */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Notas Fiscais de Serviço (NFS-e)</span>
          </CardTitle>
          <CardDescription>Consultar notas fiscais de serviço emitidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Endpoint não disponível</p>
              <p className="text-sm text-muted-foreground">
                A API de NFS-e do Omie não está habilitada para esta conta.
                Consulte diretamente no ERP Omie ou entre em contato com o suporte para habilitar o acesso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
