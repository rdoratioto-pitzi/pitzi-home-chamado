import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Warehouse, ShoppingCart, ArrowRightLeft, Search, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OmieComprasEstoque() {
  // Estados para Produtos
  const [produtosFilters, setProdutosFilters] = useState({
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_codigo: '',
    filtrar_por_descricao: ''
  });
  const [produtosData, setProdutosData] = useState<any[]>([]);
  const [produtosLoading, setProdutosLoading] = useState(false);

  // Estados para Estoque
  const [estoqueFilters, setEstoqueFilters] = useState({
    codigo_produto: '',
    codigo_local_estoque: ''
  });
  const [estoqueData, setEstoqueData] = useState<any[]>([]);
  const [estoqueLoading, setEstoqueLoading] = useState(false);

  // Estados para Ordens de Compra
  const [ordensFilters, setOrdensFilters] = useState({
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_status: '',
    ordenar_por: 'DATA',
    ordem_decrescente: 'S'
  });
  const [ordensData, setOrdensData] = useState<any[]>([]);
  const [ordensLoading, setOrdensLoading] = useState(false);

  // Estados para Movimentação
  const [movimentacaoFilters, setMovimentacaoFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDtIni: '',
    dDtFin: '',
    cTipo: 'T'
  });
  const [movimentacaoData, setMovimentacaoData] = useState<any[]>([]);
  const [movimentacaoLoading, setMovimentacaoLoading] = useState(false);

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

  // Handler Produtos
  const handleBuscarProdutos = async () => {
    setProdutosLoading(true);
    setMessage(null);
    try {
      const params = [{
        pagina: produtosFilters.pagina,
        registros_por_pagina: produtosFilters.registros_por_pagina,
        apenas_importado_api: 'N'
      }];

      if (produtosFilters.filtrar_por_codigo) {
        params[0].filtrar_por_codigo = produtosFilters.filtrar_por_codigo;
      }
      if (produtosFilters.filtrar_por_descricao) {
        params[0].filtrar_por_descricao = produtosFilters.filtrar_por_descricao;
      }

      const result = await callOmieApi('geral/produtos/', 'ListarProdutos', params, 'compras');
      setProdutosData(result.produto_servico_cadastro || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} produto(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setProdutosData([]);
    } finally {
      setProdutosLoading(false);
    }
  };

  // Handler Estoque
  const handleConsultarEstoque = async () => {
    if (!estoqueFilters.codigo_produto) {
      setMessage({ type: 'error', text: 'Código do produto é obrigatório' });
      return;
    }

    setEstoqueLoading(true);
    setMessage(null);
    try {
      const params = [{
        codigo_produto: parseInt(estoqueFilters.codigo_produto)
      }];

      if (estoqueFilters.codigo_local_estoque) {
        params[0].codigo_local_estoque = parseInt(estoqueFilters.codigo_local_estoque);
      }

      const result = await callOmieApi('estoque/consulta/', 'ConsultarEstoque', params, 'compras');
      setEstoqueData(Array.isArray(result) ? result : [result]);
      setMessage({ type: 'success', text: 'Estoque consultado com sucesso' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setEstoqueData([]);
    } finally {
      setEstoqueLoading(false);
    }
  };

  // Handler Ordens de Compra
  const handleBuscarOrdens = async () => {
    setOrdensLoading(true);
    setMessage(null);
    try {
      const params = [{
        pagina: ordensFilters.pagina,
        registros_por_pagina: ordensFilters.registros_por_pagina,
        apenas_importado_api: 'N',
        ordenar_por: ordensFilters.ordenar_por,
        ordem_decrescente: ordensFilters.ordem_decrescente
      }];

      if (ordensFilters.filtrar_por_status) {
        params[0].filtrar_por_status = ordensFilters.filtrar_por_status;
      }

      const result = await callOmieApi('produtos/pedidocompra/', 'ListarPedidosCompra', params, 'compras');
      setOrdensData(result.pedido_compra_produto || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} ordem(ns) encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setOrdensData([]);
    } finally {
      setOrdensLoading(false);
    }
  };

  // Handler Movimentação
  const handleBuscarMovimentacao = async () => {
    setMovimentacaoLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: movimentacaoFilters.nPagina,
        nRegPorPagina: movimentacaoFilters.nRegPorPagina,
        cTipo: movimentacaoFilters.cTipo
      }];

      if (movimentacaoFilters.dDtIni) {
        params[0].dDtIni = movimentacaoFilters.dDtIni;
      }
      if (movimentacaoFilters.dDtFin) {
        params[0].dDtFin = movimentacaoFilters.dDtFin;
      }

      const result = await callOmieApi('estoque/movimento/', 'ListarMovimentos', params, 'compras');
      setMovimentacaoData(result.movimentos || []);
      setMessage({ type: 'success', text: `${result.nTotalRegistros || 0} movimento(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setMovimentacaoData([]);
    } finally {
      setMovimentacaoLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* PRODUTOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos
          </CardTitle>
          <CardDescription>Consultar cadastro de produtos e serviços</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Código do Produto</Label>
              <Input
                placeholder="Ex: 12345"
                value={produtosFilters.filtrar_por_codigo}
                onChange={(e) => setProdutosFilters(prev => ({ ...prev, filtrar_por_codigo: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                placeholder="Nome do produto"
                value={produtosFilters.filtrar_por_descricao}
                onChange={(e) => setProdutosFilters(prev => ({ ...prev, filtrar_por_descricao: e.target.value }))}
              />
            </div>
            <div>
              <Label>Registros por página</Label>
              <Input
                type="number"
                value={produtosFilters.registros_por_pagina}
                onChange={(e) => setProdutosFilters(prev => ({ ...prev, registros_por_pagina: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarProdutos} disabled={produtosLoading}>
            {produtosLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Produtos
          </Button>

          {produtosLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : produtosData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosData.map((produto, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{produto.codigo_produto}</TableCell>
                      <TableCell>{produto.descricao}</TableCell>
                      <TableCell>{produto.unidade}</TableCell>
                      <TableCell>{produto.ncm}</TableCell>
                      <TableCell>{produto.quantidade_estoque || 0}</TableCell>
                      <TableCell>R$ {produto.valor_unitario?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        <Badge variant={produto.inativo === 'S' ? 'destructive' : 'default'}>
                          {produto.inativo === 'S' ? 'Inativo' : 'Ativo'}
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

      {/* ESTOQUE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Consulta de Estoque
          </CardTitle>
          <CardDescription>Verificar saldo disponível de produtos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Código do Produto *</Label>
              <Input
                placeholder="Ex: 12345"
                value={estoqueFilters.codigo_produto}
                onChange={(e) => setEstoqueFilters(prev => ({ ...prev, codigo_produto: e.target.value }))}
              />
            </div>
            <div>
              <Label>Código Local Estoque (opcional)</Label>
              <Input
                placeholder="Ex: 1"
                value={estoqueFilters.codigo_local_estoque}
                onChange={(e) => setEstoqueFilters(prev => ({ ...prev, codigo_local_estoque: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleConsultarEstoque} disabled={estoqueLoading}>
            {estoqueLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Consultar Estoque
          </Button>

          {estoqueLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : estoqueData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Saldo Total</TableHead>
                    <TableHead>Reservado</TableHead>
                    <TableHead>Disponível</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estoqueData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.codigo_produto}</TableCell>
                      <TableCell>{item.descricao}</TableCell>
                      <TableCell>{item.descricao_local || 'Principal'}</TableCell>
                      <TableCell>{item.saldo || 0}</TableCell>
                      <TableCell>{item.saldo_reservado || 0}</TableCell>
                      <TableCell className="font-bold">{item.saldo_disponivel || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ORDENS DE COMPRA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Ordens de Compra
          </CardTitle>
          <CardDescription>Consultar pedidos de compra</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={ordensFilters.filtrar_por_status} onValueChange={(v) => setOrdensFilters(prev => ({ ...prev, filtrar_por_status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="ATENDIDO">Atendido</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordenar por</Label>
              <Select value={ordensFilters.ordenar_por} onValueChange={(v) => setOrdensFilters(prev => ({ ...prev, ordenar_por: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DATA">Data</SelectItem>
                  <SelectItem value="NUMERO">Número</SelectItem>
                  <SelectItem value="CODIGO">Código</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Registros</Label>
              <Input
                type="number"
                value={ordensFilters.registros_por_pagina}
                onChange={(e) => setOrdensFilters(prev => ({ ...prev, registros_por_pagina: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarOrdens} disabled={ordensLoading}>
            {ordensLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Ordens
          </Button>

          {ordensLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : ordensData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordensData.map((ordem, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{ordem.numero_pedido}</TableCell>
                      <TableCell>{ordem.razao_social_fornecedor}</TableCell>
                      <TableCell>R$ {ordem.valor_total_pedido?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{ordem.data_previsao}</TableCell>
                      <TableCell>
                        <Badge variant={ordem.status === 'CANCELADO' ? 'destructive' : ordem.status === 'ATENDIDO' ? 'default' : 'secondary'}>
                          {ordem.status}
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

      {/* MOVIMENTAÇÃO DE ESTOQUE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Movimentação de Estoque
          </CardTitle>
          <CardDescription>Histórico de entradas e saídas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={movimentacaoFilters.dDtIni}
                onChange={(e) => setMovimentacaoFilters(prev => ({ ...prev, dDtIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={movimentacaoFilters.dDtFin}
                onChange={(e) => setMovimentacaoFilters(prev => ({ ...prev, dDtFin: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={movimentacaoFilters.cTipo} onValueChange={(v) => setMovimentacaoFilters(prev => ({ ...prev, cTipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">Todos</SelectItem>
                  <SelectItem value="E">Entrada</SelectItem>
                  <SelectItem value="S">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Registros</Label>
              <Input
                type="number"
                value={movimentacaoFilters.nRegPorPagina}
                onChange={(e) => setMovimentacaoFilters(prev => ({ ...prev, nRegPorPagina: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          <Button onClick={handleBuscarMovimentacao} disabled={movimentacaoLoading}>
            {movimentacaoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Movimentações
          </Button>

          {movimentacaoLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : movimentacaoData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Local</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacaoData.map((mov, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{mov.cNumero}</TableCell>
                      <TableCell>{mov.dDataMovimento}</TableCell>
                      <TableCell>{mov.cDescricaoProduto}</TableCell>
                      <TableCell>
                        <Badge variant={mov.cTipo === 'E' ? 'default' : 'secondary'}>
                          {mov.cTipo === 'E' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell>{mov.nQuantidade}</TableCell>
                      <TableCell>{mov.nCodLocal}</TableCell>
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
