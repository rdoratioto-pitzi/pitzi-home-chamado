import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, List, Warehouse, ShoppingCart, ArrowRightLeft, Search, Loader2, Info, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

export default function OmieComprasEstoque() {
  // Estados para Consulta de Produto
  const [produtoCodigo, setProdutoCodigo] = useState('');
  const [produtoData, setProdutoData] = useState<any>(null);
  const [produtoLoading, setProdutoLoading] = useState(false);

  // Estados para Listagem de Produtos
  const [listarFiltros, setListarFiltros] = useState({
    codigo: '',
    descricao_like: '',
    ncm: '',
    pagina: 1,
    registros_por_pagina: 10,
  });
  const [listarData, setListarData] = useState<any[]>([]);
  const [listarMeta, setListarMeta] = useState({ total: 0, totalPaginas: 1, pagina: 1 });
  const [listarLoading, setListarLoading] = useState(false);

  // Estados para Consulta de Estoque
  const [estoqueCodigo, setEstoqueCodigo] = useState('');
  const [estoqueData, setEstoqueData] = useState<any>(null);
  const [estoqueLoading, setEstoqueLoading] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connectionReady, setConnectionReady] = useState<boolean | null>(null);

  // Verificar conexão automaticamente ao montar o componente
  useEffect(() => {
    axios.post('/api/omie/test', {}, { withCredentials: true })
      .then(({ data }) => setConnectionReady(!!data.connected))
      .catch(() => setConnectionReady(false));
  }, []);

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

  // Handler Consultar Produto por Código
  const handleConsultarProduto = async () => {
    if (!produtoCodigo.trim()) {
      setMessage({ type: 'error', text: 'Informe o código do produto' });
      return;
    }
    setProdutoLoading(true);
    setMessage(null);
    try {
      const result = await callOmieApi('geral/produtos/', 'ConsultarProduto', [{ codigo: produtoCodigo.trim() }], 'compras');
      setProdutoData(result);
      setMessage({ type: 'success', text: `Produto "${result.descricao}" encontrado com sucesso` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setProdutoData(null);
    } finally {
      setProdutoLoading(false);
    }
  };

  // Handler Listar Produtos com filtros e paginação
  const handleListarProdutos = async (pagina = listarFiltros.pagina) => {
    setListarLoading(true);
    setMessage(null);
    try {
      const params: any = {
        pagina,
        registros_por_pagina: listarFiltros.registros_por_pagina,
        apenas_importado_api: 'N',
      };
      if (listarFiltros.codigo.trim()) params.codigo = listarFiltros.codigo.trim();
      if (listarFiltros.descricao_like.trim()) params.descricao_like = listarFiltros.descricao_like.trim();
      if (listarFiltros.ncm.trim()) params.ncm = listarFiltros.ncm.trim();

      const result = await callOmieApi('geral/produtos/', 'ListarProdutos', [params], 'compras');
      setListarData(result.produto_servico_cadastro || []);
      setListarMeta({
        total: result.total_de_registros || 0,
        totalPaginas: result.total_de_paginas || 1,
        pagina,
      });
      setListarFiltros(prev => ({ ...prev, pagina }));
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} produto(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setListarData([]);
    } finally {
      setListarLoading(false);
    }
  };

  // Handler Consultar Estoque via ListarPosEstoque (dados reais por local de estoque)
  const handleConsultarEstoque = async () => {
    if (!estoqueCodigo.trim()) {
      setMessage({ type: 'error', text: 'Informe o código do produto para consultar o estoque' });
      return;
    }
    setEstoqueLoading(true);
    setMessage(null);
    setEstoqueData(null);
    try {
      const { data } = await axios.get(`/api/omie/estoque/posicao/${encodeURIComponent(estoqueCodigo.trim())}`, { withCredentials: true });
      if (!data.success) throw new Error(data.error || 'Erro ao consultar estoque');
      setEstoqueData(data.data);
      const saldo = data.data.totalSaldo ?? 0;
      const descricao = data.data.descricao ?? estoqueCodigo.trim();
      if (data.data.locais.length === 0) {
        setMessage({ type: 'error', text: `Produto "${descricao}" não encontrado na posição de estoque` });
      } else {
        setMessage({
          type: saldo > 0 ? 'success' : 'error',
          text: saldo > 0
            ? `Saldo disponível: ${saldo} unidade(s) em ${data.data.locais.length} local(is)`
            : `Produto "${descricao}" sem saldo disponível`
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setEstoqueData(null);
    } finally {
      setEstoqueLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {connectionReady === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Falha ao conectar com a API Omie. Verifique as credenciais na aba <strong>Visão Geral</strong>.
          </AlertDescription>
        </Alert>
      )}
      {connectionReady === true && (
        <Alert variant="default" className="border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>Conectado ao Omie — pronto para consultas.</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* LISTAGEM DE PRODUTOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Listagem de Produtos
          </CardTitle>
          <CardDescription>Listar produtos com filtros (código, descrição, NCM) e paginação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Código do Produto</Label>
              <Input
                placeholder="Ex: 20074A0"
                value={listarFiltros.codigo}
                onChange={(e) => setListarFiltros(prev => ({ ...prev, codigo: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleListarProdutos(1)}
              />
            </div>
            <div>
              <Label>Descrição (contém)</Label>
              <Input
                placeholder="Ex: iPhone"
                value={listarFiltros.descricao_like}
                onChange={(e) => setListarFiltros(prev => ({ ...prev, descricao_like: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleListarProdutos(1)}
              />
            </div>
            <div>
              <Label>NCM</Label>
              <Input
                placeholder="Ex: 85171290"
                value={listarFiltros.ncm}
                onChange={(e) => setListarFiltros(prev => ({ ...prev, ncm: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleListarProdutos(1)}
              />
            </div>
          </div>
          <Button onClick={() => handleListarProdutos(1)} disabled={listarLoading}>
            {listarLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Listar Produtos
          </Button>

          {listarLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : listarData.length > 0 ? (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cód. Omie</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead>Família</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Valor Unitário</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listarData.map((produto, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{produto.codigo_produto}</TableCell>
                        <TableCell className="font-medium">{produto.codigo}</TableCell>
                        <TableCell>{produto.descricao}</TableCell>
                        <TableCell>{produto.unidade || '-'}</TableCell>
                        <TableCell>{produto.ncm || '-'}</TableCell>
                        <TableCell>{produto.descricao_familia || '-'}</TableCell>
                        <TableCell>{produto.marca || '-'}</TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.valor_unitario || 0)}
                        </TableCell>
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
              {/* Paginação */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {listarMeta.total} produto(s) — página {listarMeta.pagina} de {listarMeta.totalPaginas}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleListarProdutos(listarMeta.pagina - 1)}
                    disabled={listarMeta.pagina <= 1 || listarLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleListarProdutos(listarMeta.pagina + 1)}
                    disabled={listarMeta.pagina >= listarMeta.totalPaginas || listarLoading}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* CONSULTA DE PRODUTO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Consulta de Produto
          </CardTitle>
          <CardDescription>Consultar cadastro de produto por código (ex: 20074A0)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Código do Produto</Label>
              <Input
                placeholder="Ex: 20074A0"
                value={produtoCodigo}
                onChange={(e) => setProdutoCodigo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConsultarProduto()}
              />
            </div>
            <Button onClick={handleConsultarProduto} disabled={produtoLoading}>
              {produtoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar
            </Button>
          </div>

          {produtoLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : produtoData ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Omie</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Família</TableHead>
                    <TableHead>Valor Unitário</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">{produtoData.codigo_produto}</TableCell>
                    <TableCell className="font-medium">{produtoData.codigo}</TableCell>
                    <TableCell>{produtoData.descricao}</TableCell>
                    <TableCell>{produtoData.unidade}</TableCell>
                    <TableCell>{produtoData.ncm || '-'}</TableCell>
                    <TableCell>{produtoData.marca || '-'}</TableCell>
                    <TableCell>{produtoData.descricao_familia || '-'}</TableCell>
                    <TableCell>R$ {produtoData.valor_unitario?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      <Badge variant={produtoData.inativo === 'S' ? 'destructive' : 'default'}>
                        {produtoData.inativo === 'S' ? 'Inativo' : 'Ativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* CONSULTA DE ESTOQUE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Consulta de Estoque
          </CardTitle>
          <CardDescription>Verificar saldo de estoque do produto por código</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Dados em tempo real via <code>ListarPosEstoque</code>, por local de estoque.
              O cache é atualizado automaticamente a cada 60 min — primeira consulta pode levar alguns segundos.
            </span>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Código do Produto *</Label>
              <Input
                placeholder="Ex: 20074A0"
                value={estoqueCodigo}
                onChange={(e) => setEstoqueCodigo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConsultarEstoque()}
              />
            </div>
            <Button onClick={handleConsultarEstoque} disabled={estoqueLoading}>
              {estoqueLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar Estoque
            </Button>
          </div>

          {estoqueLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : estoqueData ? (
            <div className="border rounded-lg overflow-x-auto">
              {/* Resumo totais */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg mb-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{estoqueData.totalSaldo ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Saldo Disponível</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{estoqueData.totalFisico ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Físico Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{estoqueData.totalReservado ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Reservado</div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local de Estoque (ID)</TableHead>
                    <TableHead className="text-right">Físico</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Saldo Disponível</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead className="text-right">CMC Unitário</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estoqueData.locais.map((local: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{local.codigo_local_estoque}</TableCell>
                      <TableCell className="text-right">{local.fisico ?? 0}</TableCell>
                      <TableCell className="text-right text-yellow-600">{local.reservado ?? 0}</TableCell>
                      <TableCell className="text-right font-bold">{local.nSaldo ?? 0}</TableCell>
                      <TableCell className="text-right">{local.nPendente ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(local.nCMC ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={(local.nSaldo ?? 0) <= 0 ? 'destructive' : 'default'}>
                          {(local.nSaldo ?? 0) <= 0 ? 'Sem Saldo' : 'Com Saldo'}
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

      {/* ORDENS DE COMPRA — não disponível */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Ordens de Compra</span>
          </CardTitle>
          <CardDescription>Consultar pedidos de compra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Endpoint não disponível</p>
              <p className="text-sm text-muted-foreground">
                A API de Ordens de Compra do Omie não está habilitada para esta conta.
                Consulte diretamente no ERP Omie ou entre em contato com o suporte para habilitar o acesso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MOVIMENTAÇÃO DE ESTOQUE — não disponível */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Movimentação de Estoque</span>
          </CardTitle>
          <CardDescription>Histórico de entradas e saídas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Endpoint não disponível</p>
              <p className="text-sm text-muted-foreground">
                A API de Movimentação de Estoque do Omie não está habilitada para esta conta.
                Consulte diretamente no ERP Omie ou entre em contato com o suporte para habilitar o acesso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
