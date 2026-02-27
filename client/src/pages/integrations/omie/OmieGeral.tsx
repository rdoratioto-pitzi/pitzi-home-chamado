import { useState } from 'react';
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
    pagina: 1,
    registros_por_pagina: 10,
    cnpj_cpf: '',
    razao_social: '',
    cidade: '',
    inativo: 'ALL'
  });
  const [clientesData, setClientesData] = useState<any[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);

  // Estados para Categorias
  const [categoriasFilters, setCategoriasFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 50,
    cTipo: 'ALL'
  });
  const [categoriasData, setCategoriasData] = useState<any[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(false);

  // Estados para Empresa
  const [empresaData, setEmpresaData] = useState<any>(null);
  const [empresaLoading, setEmpresaLoading] = useState(false);

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

  // Handler Clientes
  const handleBuscarClientes = async () => {
    setClientesLoading(true);
    setMessage(null);
    try {
      const params = [{
        pagina: clientesFilters.pagina,
        registros_por_pagina: clientesFilters.registros_por_pagina,
        apenas_importado_api: 'N',
        clientesFiltro: {}
      }];

      if (clientesFilters.cnpj_cpf) {
        params[0].clientesFiltro.cnpj_cpf = clientesFilters.cnpj_cpf;
      }
      if (clientesFilters.razao_social) {
        params[0].clientesFiltro.razao_social = clientesFilters.razao_social;
      }
      if (clientesFilters.cidade) {
        params[0].clientesFiltro.cidade = clientesFilters.cidade;
      }
      if (clientesFilters.inativo !== 'ALL') {
        params[0].clientesFiltro.inativo = clientesFilters.inativo;
      }

      const result = await callOmieApi('geral/clientes/', 'ListarClientes', params, 'geral');
      setClientesData(result.clientes_cadastro || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} cliente(s) encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
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
      const params = [{
        nPagina: categoriasFilters.nPagina,
        nRegPorPagina: categoriasFilters.nRegPorPagina
      }];

      if (categoriasFilters.cTipo !== 'ALL') {
        params[0].cTipo = categoriasFilters.cTipo;
      }

      const result = await callOmieApi('geral/categorias/', 'ListarCategorias', params, 'geral');
      setCategoriasData(result.categoria_cadastro || []);
      setMessage({ type: 'success', text: `${result.total_de_registros || 0} categoria(s) encontrada(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setCategoriasData([]);
    } finally {
      setCategoriasLoading(false);
    }
  };

  // Handler Dados da Empresa
  const handleBuscarEmpresa = async () => {
    setEmpresaLoading(true);
    setMessage(null);
    try {
      const result = await callOmieApi('geral/empresas/', 'ConsultarEmpresa', [{}], 'geral');
      setEmpresaData(result);
      setMessage({ type: 'success', text: 'Dados da empresa carregados com sucesso' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
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

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* CLIENTES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes
          </CardTitle>
          <CardDescription>Consultar cadastro de clientes</CardDescription>
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
                      <TableCell className="font-medium">{cliente.codigo_cliente_omie}</TableCell>
                      <TableCell>{cliente.razao_social}</TableCell>
                      <TableCell>{cliente.nome_fantasia || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDocument(cliente.cnpj_cpf)}</TableCell>
                      <TableCell>{cliente.cidade}/{cliente.estado}</TableCell>
                      <TableCell>{cliente.telefone1_numero ? `(${cliente.telefone1_ddd}) ${cliente.telefone1_numero}` : '-'}</TableCell>
                      <TableCell className="text-xs">{cliente.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={cliente.inativo === 'S' ? 'destructive' : 'default'}>
                          {cliente.inativo === 'S' ? 'Inativo' : 'Ativo'}
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
          <CardDescription>Consultar categorias cadastradas no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Categoria</Label>
              <Select value={categoriasFilters.cTipo} onValueChange={(v) => setCategoriasFilters(prev => ({ ...prev, cTipo: v }))}>
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

          {categoriasLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : categoriasData.length > 0 ? (
            <>
              {/* Receitas */}
              {categoriasData.some(c => c.cTipo === 'REC') && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Badge variant="default">Receitas</Badge>
                    <span className="text-muted-foreground">({categoriasData.filter(c => c.cTipo === 'REC').length})</span>
                  </h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoriasData.filter(c => c.cTipo === 'REC').map((cat, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{cat.nCodCategoria}</TableCell>
                            <TableCell>{cat.cNomeCategoria}</TableCell>
                            <TableCell>
                              <Badge variant={cat.cInativo === 'S' ? 'destructive' : 'default'} className="text-xs">
                                {cat.cInativo === 'S' ? 'Inativa' : 'Ativa'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Despesas */}
              {categoriasData.some(c => c.cTipo === 'DES') && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Badge variant="secondary">Despesas</Badge>
                    <span className="text-muted-foreground">({categoriasData.filter(c => c.cTipo === 'DES').length})</span>
                  </h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoriasData.filter(c => c.cTipo === 'DES').map((cat, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{cat.nCodCategoria}</TableCell>
                            <TableCell>{cat.cNomeCategoria}</TableCell>
                            <TableCell>
                              <Badge variant={cat.cInativo === 'S' ? 'destructive' : 'default'} className="text-xs">
                                {cat.cInativo === 'S' ? 'Inativa' : 'Ativa'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* DADOS DA EMPRESA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>Informações da empresa cadastrada no Omie</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleBuscarEmpresa} disabled={empresaLoading}>
            {empresaLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Carregar Dados da Empresa
          </Button>

          {empresaLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : empresaData ? (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Razão Social</Label>
                    <p className="text-sm font-medium">{empresaData.razao_social || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                    <p className="text-sm font-medium">{empresaData.nome_fantasia || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CNPJ</Label>
                    <p className="text-sm font-medium font-mono">{formatDocument(empresaData.cnpj) || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                    <p className="text-sm font-medium">{empresaData.inscricao_estadual || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Inscrição Municipal</Label>
                    <p className="text-sm font-medium">{empresaData.inscricao_municipal || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Regime Tributário</Label>
                    <p className="text-sm font-medium">{empresaData.regime_tributario || '-'}</p>
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
                    <p className="text-sm">{empresaData.endereco || '-'}, {empresaData.numero || 'S/N'}</p>
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
