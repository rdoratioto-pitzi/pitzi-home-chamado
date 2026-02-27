import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, FileText, Receipt, Search, Loader2, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    nRegPorPagina: 10,
    dDtEmiIni: '',
    dDtEmiFim: '',
    cNumNF: '',
    cSerie: ''
  });
  const [nfeData, setNfeData] = useState<any[]>([]);
  const [nfeLoading, setNfeLoading] = useState(false);

  // Estados para NFS-e Serviços
  const [nfseFilters, setNfseFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDtEmiIni: '',
    dDtEmiFim: '',
    cNumRPS: ''
  });
  const [nfseData, setNfseData] = useState<any[]>([]);
  const [nfseLoading, setNfseLoading] = useState(false);

  // Estados gerais
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [selectedXml, setSelectedXml] = useState('');

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
      const params = [{
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

  // Handler NF-e Produtos
  const handleBuscarNFe = async () => {
    setNfeLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: nfeFilters.nPagina,
        nRegPorPagina: nfeFilters.nRegPorPagina
      }];

      if (nfeFilters.dDtEmiIni) {
        params[0].dDtEmiIni = nfeFilters.dDtEmiIni;
      }
      if (nfeFilters.dDtEmiFim) {
        params[0].dDtEmiFim = nfeFilters.dDtEmiFim;
      }
      if (nfeFilters.cNumNF) {
        params[0].cNumNF = nfeFilters.cNumNF;
      }
      if (nfeFilters.cSerie) {
        params[0].cSerie = nfeFilters.cSerie;
      }

      const result = await callOmieApi('produtos/nfconsultar/', 'ConsultarNF', params, 'vendas');
      setNfeData(result.nfCadastro || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} NF-e encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setNfeData([]);
    } finally {
      setNfeLoading(false);
    }
  };

  // Handler NFS-e Serviços
  const handleBuscarNFSe = async () => {
    setNfseLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: nfseFilters.nPagina,
        nRegPorPagina: nfseFilters.nRegPorPagina
      }];

      if (nfseFilters.dDtEmiIni) {
        params[0].dDtEmiIni = nfseFilters.dDtEmiIni;
      }
      if (nfseFilters.dDtEmiFim) {
        params[0].dDtEmiFim = nfseFilters.dDtEmiFim;
      }
      if (nfseFilters.cNumRPS) {
        params[0].cNumRPS = nfseFilters.cNumRPS;
      }

      const result = await callOmieApi('servicos/nfse/', 'ConsultarNFSe', params, 'vendas');
      setNfseData(result.nfseEncontradas || []);
      setMessage({ type: 'success', text: `${result.nTotalRegistros || 0} NFS-e encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setNfseData([]);
    } finally {
      setNfseLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('cancelad')) return 'destructive';
    if (statusLower?.includes('faturad') || statusLower?.includes('autoriz')) return 'default';
    if (statusLower?.includes('pendent') || statusLower?.includes('abert')) return 'secondary';
    return 'outline';
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
                placeholder="Ex: 12345"
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Data Previsão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosData.map((pedido, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{pedido.numero_pedido}</TableCell>
                      <TableCell>{pedido.nome_cliente}</TableCell>
                      <TableCell>R$ {pedido.valor_total_pedido?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{pedido.data_previsao}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(pedido.etapa)}>
                          {pedido.etapa}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Número NF-e</Label>
              <Input
                placeholder="Ex: 12345"
                value={nfeFilters.cNumNF}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, cNumNF: e.target.value }))}
              />
            </div>
            <div>
              <Label>Série</Label>
              <Input
                placeholder="Ex: 1"
                value={nfeFilters.cSerie}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, cSerie: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={nfeFilters.dDtEmiIni}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, dDtEmiIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={nfeFilters.dDtEmiFim}
                onChange={(e) => setNfeFilters(prev => ({ ...prev, dDtEmiFim: e.target.value }))}
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
                      <TableCell>{nfe.cNomeCli}</TableCell>
                      <TableCell>R$ {nfe.nValorNF?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{nfe.dDtEmis}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {nfe.cChaveNFe ? (
                          <span className="truncate max-w-[200px] inline-block" title={nfe.cChaveNFe}>
                            {nfe.cChaveNFe}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(nfe.cSituacao)}>
                          {nfe.cSituacao}
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

      {/* NFS-e SERVIÇOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Notas Fiscais de Serviço (NFS-e)
          </CardTitle>
          <CardDescription>Consultar notas fiscais de serviço emitidas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Número RPS</Label>
              <Input
                placeholder="Ex: 12345"
                value={nfseFilters.cNumRPS}
                onChange={(e) => setNfseFilters(prev => ({ ...prev, cNumRPS: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={nfseFilters.dDtEmiIni}
                onChange={(e) => setNfseFilters(prev => ({ ...prev, dDtEmiIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={nfseFilters.dDtEmiFim}
                onChange={(e) => setNfseFilters(prev => ({ ...prev, dDtEmiFim: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarNFSe} disabled={nfseLoading}>
            {nfseLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar NFS-e
          </Button>

          {nfseLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : nfseData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RPS</TableHead>
                    <TableHead>Número NFS-e</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfseData.map((nfse, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{nfse.cNumRPS}</TableCell>
                      <TableCell>{nfse.cNumNFSe}</TableCell>
                      <TableCell>{nfse.cNomeTomador}</TableCell>
                      <TableCell>R$ {nfse.nValorNFSe?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{nfse.dDtEmis}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(nfse.cSituacao)}>
                          {nfse.cSituacao}
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
    </div>
  );
}
