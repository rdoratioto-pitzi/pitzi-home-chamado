import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, FileText, Receipt, Search, Loader2, Info } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OmieVendas() {
  // Estados para Pedidos de Venda
  const [pedidosFilters, setPedidosFilters] = useState({
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_numero_pedido: '',
    filtrar_por_status: 'ALL',
    filtrar_por_data_de: '',
    filtrar_por_data_ate: ''
  });
  const [pedidosData, setPedidosData] = useState<any[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);

  // Estados para NF-e Produtos
  const [nfeFilters, setNfeFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10
  });
  const [nfeData, setNfeData] = useState<any[]>([]);
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
  const handleBuscarPedidos = async () => {
    setPedidosLoading(true);
    setMessage(null);
    try {
      const params: any = [{
        pagina: pedidosFilters.pagina,
        registros_por_pagina: pedidosFilters.registros_por_pagina,
        apenas_importado_api: 'N'
      }];

      if (pedidosFilters.filtrar_por_numero_pedido) {
        params[0].filtrar_por_numero_pedido = pedidosFilters.filtrar_por_numero_pedido;
      }
      if (pedidosFilters.filtrar_por_status !== 'ALL') {
        params[0].filtrar_por_status = pedidosFilters.filtrar_por_status;
      }
      if (pedidosFilters.filtrar_por_data_de) {
        params[0].filtrar_por_data_de = pedidosFilters.filtrar_por_data_de;
      }
      if (pedidosFilters.filtrar_por_data_ate) {
        params[0].filtrar_por_data_ate = pedidosFilters.filtrar_por_data_ate;
      }

      const result = await callOmieApi('produtos/pedido/', 'ListarPedidos', params, 'vendas');
      setPedidosData(result.pedido_venda_produto || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} pedido(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setPedidosData([]);
    } finally {
      setPedidosLoading(false);
    }
  };

  // Handler NF-e Produtos — endpoint: produtos/nfe/ + ListarNFe
  const handleBuscarNFe = async () => {
    setNfeLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: nfeFilters.nPagina,
        nRegPorPagina: nfeFilters.nRegPorPagina
      }];

      const result = await callOmieApi('produtos/nfe/', 'ListarNFe', params, 'vendas');
      setNfeData(result.listagemNfe || []);
      setMessage({ type: 'success', text: `${result.nTotRegistros || 0} NF-e encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setNfeData([]);
    } finally {
      setNfeLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('cancelad')) return 'destructive';
    if (statusLower?.includes('faturad') || statusLower?.includes('autoriz')) return 'default';
    if (statusLower?.includes('pendent') || statusLower?.includes('abert')) return 'secondary';
    return 'outline';
  };

  // Traduz etapa do pedido
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
              <Label>Status</Label>
              <Select value={pedidosFilters.filtrar_por_status} onValueChange={(v) => setPedidosFilters(prev => ({ ...prev, filtrar_por_status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="A">Aberto</SelectItem>
                  <SelectItem value="F">Faturado</SelectItem>
                  <SelectItem value="C">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={pedidosFilters.filtrar_por_data_de}
                onChange={(e) => setPedidosFilters(prev => ({ ...prev, filtrar_por_data_de: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={pedidosFilters.filtrar_por_data_ate}
                onChange={(e) => setPedidosFilters(prev => ({ ...prev, filtrar_por_data_ate: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarPedidos} disabled={pedidosLoading}>
            {pedidosLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Pedidos
          </Button>

          {pedidosLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pedidosData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cód. Cliente</TableHead>
                    <TableHead>Qtde. Itens</TableHead>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Página</Label>
              <Input
                type="number"
                value={nfeFilters.nPagina}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, nPagina: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label>Registros por Página</Label>
              <Input
                type="number"
                value={nfeFilters.nRegPorPagina}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, nRegPorPagina: parseInt(e.target.value) || 10 }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarNFe} disabled={nfeLoading}>
            {nfeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar NF-e
          </Button>

          {nfeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : nfeData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Série</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Chave NFe</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfeData.map((nfe, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{nfe.cNumNF}</TableCell>
                      <TableCell>{nfe.cSerie}</TableCell>
                      <TableCell>{nfe.cNomeCli || nfe.cRazaoSocialCli || '-'}</TableCell>
                      <TableCell>R$ {nfe.nValorNF?.toFixed(2) || '0.00'}</TableCell>
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
