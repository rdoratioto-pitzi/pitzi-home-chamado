import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FolderTree, Building2, Search, Loader2, Phone, Mail, MapPin } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function OmieGeral() {
  // Estados para Clientes
  const [clientesFilters, setClientesFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    cnpj_cpf: '',
    razao_social: '',
    cidade: '',
    inativo: 'ALL'
  });
  const [clientesData, setClientesData] = useState<any[]>([]);
  const [clientesResumo, setClientesResumo] = useState<any>(null);
  const [clientesTotalRegistros, setClientesTotalRegistros] = useState(0);
  const [clientesLoading, setClientesLoading] = useState(false);

  // Estados para Categorias
  const [cTipoFiltro, setCTipoFiltro] = useState('ALL');
  const [categoriasData, setCategoriasData] = useState<any[]>([]);
  const [categoriasResumo, setCategoriasResumo] = useState<any>(null);
  const [categoriasLoading, setCategoriasLoading] = useState(false);

  // Estados para Empresa
  const [empresaData, setEmpresaData] = useState<any>(null);
  const [empresaLoading, setEmpresaLoading] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar dados da empresa ao montar
  useEffect(() => {
    handleBuscarEmpresa();
  }, []);

  // Handler Clientes
  const handleBuscarClientes = async () => {
    setClientesLoading(true);
    setMessage(null);
    try {
      const body: any = {
        nPagina: clientesFilters.nPagina,
        nRegPorPagina: clientesFilters.nRegPorPagina,
      };
      if (clientesFilters.cnpj_cpf) body.cnpj_cpf = clientesFilters.cnpj_cpf;
      if (clientesFilters.razao_social) body.razao_social = clientesFilters.razao_social;
      if (clientesFilters.cidade) body.cidade = clientesFilters.cidade;
      if (clientesFilters.inativo !== 'ALL') body.inativo = clientesFilters.inativo;

      const { data } = await axios.post('/api/omie/geral/clientes', body, { withCredentials: true });

      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setClientesData(data.clientes || []);
      setClientesResumo(data.resumo);
      setClientesTotalRegistros(data.totalRegistros || 0);
      setMessage({ type: 'success', text: `${data.totalRegistros || 0} cliente(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setClientesData([]);
    } finally {
      setClientesLoading(false);
    }
  };

  // Handler Categorias
  const handleBuscarCategorias = async () => {
    setCategoriasLoading(true);
    setMessage(null);
    try {
      const { data } = await axios.post('/api/omie/geral/categorias', { nPagina: 1, nRegPorPagina: 500 }, { withCredentials: true });

      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setCategoriasData(data.categorias || []);
      setCategoriasResumo(data.resumo);
      setMessage({ type: 'success', text: `${data.totalRegistros || 0} categoria(s) encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setCategoriasData([]);
    } finally {
      setCategoriasLoading(false);
    }
  };

  // Handler Dados da Empresa
  const handleBuscarEmpresa = async () => {
    setEmpresaLoading(true);
    try {
      const { data } = await axios.get('/api/omie/geral/empresa', { withCredentials: true });

      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setEmpresaData(data.empresa);
    } catch (error: any) {
      // Silencioso no auto-load; apenas mostra mensagem se chamado manualmente
    } finally {
      setEmpresaLoading(false);
    }
  };

  const handleRecarregarEmpresa = async () => {
    setEmpresaLoading(true);
    setMessage(null);
    try {
      const { data } = await axios.get('/api/omie/geral/empresa', { withCredentials: true });

      if (!data.sucesso) throw new Error(data.error || 'Erro na requisição');

      setEmpresaData(data.empresa);
      setMessage({ type: 'success', text: data.empresa ? 'Dados da empresa carregados com sucesso' : 'Nenhuma empresa encontrada' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
      setEmpresaData(null);
    } finally {
      setEmpresaLoading(false);
    }
  };

  const formatDocument = (doc: string) => {
    if (!doc) return '';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  // Filtragem client-side de categorias por tipo
  const categoriasFiltradas = cTipoFiltro === 'ALL'
    ? categoriasData
    : categoriasData.filter(c => c.tipo === (cTipoFiltro === 'REC' ? 'Receita' : 'Despesa'));

  const receitas = categoriasData.filter(c => c.tipo === 'Receita');
  const despesas = categoriasData.filter(c => c.tipo === 'Despesa');
  const outros = categoriasData.filter(c => c.tipo === 'Outro');

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* DADOS DA EMPRESA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Empresa
              </CardTitle>
              <CardDescription>Informações da empresa cadastrada no Omie</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRecarregarEmpresa} disabled={empresaLoading}>
              {empresaLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Recarregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {empresaLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : empresaData ? (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Razão Social</Label>
                    <p className="text-sm font-medium">{empresaData.razaoSocial || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                    <p className="text-sm font-medium">{empresaData.nomeFantasia || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CNPJ</Label>
                    <p className="text-sm font-medium font-mono">{empresaData.cnpj || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                    <p className="text-sm font-medium">{empresaData.inscricaoEstadual || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Inscrição Municipal</Label>
                    <p className="text-sm font-medium">{empresaData.inscricaoMunicipal || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Regime Tributário</Label>
                    <p className="text-sm font-medium">{empresaData.regimeTributario || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Logradouro</Label>
                    <p className="text-sm">{empresaData.endereco || '-'}, {empresaData.enderecoNumero || 'S/N'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Complemento</Label>
                    <p className="text-sm">{empresaData.complemento || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <p className="text-sm">{empresaData.bairro || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cidade/UF</Label>
                    <p className="text-sm">{empresaData.cidade || '-'}/{empresaData.estado || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <p className="text-sm font-mono">{empresaData.cep || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Telefone
                    </Label>
                    <p className="text-sm">{empresaData.telefone || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                    <p className="text-sm">{empresaData.email || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado de empresa encontrado.</p>
          )}
        </CardContent>
      </Card>

      {/* CLIENTES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes
          </CardTitle>
          <CardDescription>Consultar cadastro de clientes e fornecedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={clientesFilters.cnpj_cpf}
                onChange={(e) => setClientesFilters(prev => ({ ...prev, cnpj_cpf: e.target.value }))}
              />
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input
                placeholder="Nome do cliente"
                value={clientesFilters.razao_social}
                onChange={(e) => setClientesFilters(prev => ({ ...prev, razao_social: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                placeholder="Ex: São Paulo"
                value={clientesFilters.cidade}
                onChange={(e) => setClientesFilters(prev => ({ ...prev, cidade: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={clientesFilters.inativo} onValueChange={(v) => setClientesFilters(prev => ({ ...prev, inativo: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="N">Ativo</SelectItem>
                  <SelectItem value="S">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleBuscarClientes} disabled={clientesLoading}>
            {clientesLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Clientes
          </Button>

          {clientesResumo && (
            <div className="flex gap-4 text-sm">
              <span>Total: <strong>{clientesTotalRegistros}</strong></span>
              <span className="text-green-600">Ativos: <strong>{clientesResumo.totalAtivos}</strong></span>
              <span className="text-red-500">Inativos: <strong>{clientesResumo.totalInativos}</strong></span>
            </div>
          )}

          {clientesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : clientesData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Nome Fantasia</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesData.map((cliente, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cliente.codigoOmie}</TableCell>
                      <TableCell>{cliente.razaoSocial}</TableCell>
                      <TableCell>{cliente.nomeFantasia || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDocument(cliente.cnpjCpf)}</TableCell>
                      <TableCell>{cliente.cidade}/{cliente.estado}</TableCell>
                      <TableCell>
                        {cliente.telefoneNumero
                          ? `(${cliente.telefoneDdd}) ${cliente.telefoneNumero}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs">{cliente.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={cliente.inativo ? 'destructive' : 'default'}>
                          {cliente.inativo ? 'Inativo' : 'Ativo'}
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

      {/* CATEGORIAS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Categorias
          </CardTitle>
          <CardDescription>Consultar categorias financeiras cadastradas no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Categoria</Label>
              <Select value={cTipoFiltro} onValueChange={setCTipoFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="REC">Receita</SelectItem>
                  <SelectItem value="DES">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleBuscarCategorias} disabled={categoriasLoading} className="w-full md:w-auto">
                {categoriasLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar Categorias
              </Button>
            </div>
          </div>

          {categoriasResumo && (
            <div className="flex gap-4 text-sm">
              <span className="text-blue-600">Receitas: <strong>{categoriasResumo.totalReceitas}</strong></span>
              <span className="text-orange-500">Despesas: <strong>{categoriasResumo.totalDespesas}</strong></span>
              {categoriasResumo.totalOutros > 0 && (
                <span className="text-muted-foreground">Outros: <strong>{categoriasResumo.totalOutros}</strong></span>
              )}
            </div>
          )}

          {categoriasLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : categoriasData.length > 0 ? (
            (() => {
              const renderTabela = (lista: any[], titulo: string, variant: 'default' | 'secondary' | 'outline') => (
                lista.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Badge variant={variant}>{titulo}</Badge>
                      <span className="text-muted-foreground">({lista.length})</span>
                    </h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.map((cat, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium font-mono">{cat.codigo}</TableCell>
                              <TableCell>{cat.descricao}</TableCell>
                              <TableCell>
                                <Badge variant={cat.ativa ? 'default' : 'destructive'} className="text-xs">
                                  {cat.ativa ? 'Ativa' : 'Inativa'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              );

              const showReceitas = cTipoFiltro === 'ALL' || cTipoFiltro === 'REC';
              const showDespesas = cTipoFiltro === 'ALL' || cTipoFiltro === 'DES';

              return (
                <div className="space-y-4">
                  {showReceitas && renderTabela(receitas, 'Receitas', 'default')}
                  {showDespesas && renderTabela(despesas, 'Despesas', 'secondary')}
                  {cTipoFiltro === 'ALL' && renderTabela(outros, 'Outros', 'outline')}
                </div>
              );
            })()
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
