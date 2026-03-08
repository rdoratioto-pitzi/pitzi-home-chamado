import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Warehouse, ShoppingCart, ArrowRightLeft, Search, Loader2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function OmieComprasEstoque() {
  // Estados para Consulta de Produto
  const [produtoCodigo, setProdutoCodigo] = useState('');
  const [produtoData, setProdutoData] = useState<any>(null);
  const [produtoLoading, setProdutoLoading] = useState(false);

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
