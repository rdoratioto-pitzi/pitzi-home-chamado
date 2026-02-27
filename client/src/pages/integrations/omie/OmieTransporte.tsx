import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, Search, Loader2, Package } from 'lucide-react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OmieTransporte() {
  // Estados para CT-e
  const [cteFilters, setCteFilters] = useState({
    nPagina: 1,
    nRegPorPagina: 10,
    dDtEmiIni: '',
    dDtEmiFim: '',
    cNumCTe: '',
    cSerie: '',
    cSituacao: 'ALL'
  });
  const [cteData, setCteData] = useState<any[]>([]);
  const [cteLoading, setCteLoading] = useState(false);
  const [cteTotals, setCteTotals] = useState({ total: 0, autorizados: 0, cancelados: 0 });

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

  // Handler CT-e
  const handleBuscarCTe = async () => {
    setCteLoading(true);
    setMessage(null);
    try {
      const params = [{
        nPagina: cteFilters.nPagina,
        nRegPorPagina: cteFilters.nRegPorPagina
      }];

      if (cteFilters.dDtEmiIni) {
        params[0].dDtEmiIni = cteFilters.dDtEmiIni;
      }
      if (cteFilters.dDtEmiFim) {
        params[0].dDtEmiFim = cteFilters.dDtEmiFim;
      }
      if (cteFilters.cNumCTe) {
        params[0].cNumCTe = cteFilters.cNumCTe;
      }
      if (cteFilters.cSerie) {
        params[0].cSerie = cteFilters.cSerie;
      }
      if (cteFilters.cSituacao !== 'ALL') {
        params[0].cSituacao = cteFilters.cSituacao;
      }

      const result = await callOmieApi('servicos/cte/', 'ListarCTe', params, 'transporte');
      const ctes = result.cteCadastro || [];
      setCteData(ctes);

      // Calcular totais
      const total = ctes.length;
      const autorizados = ctes.filter((c: any) => c.cSituacao === 'AUTORIZADO').length;
      const cancelados = ctes.filter((c: any) => c.cSituacao === 'CANCELADO').length;
      setCteTotals({ total, autorizados, cancelados });

      setMessage({ type: 'success', text: `${result.total_de_registros || 0} CT-e encontrado(s)` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setCteData([]);
      setCteTotals({ total: 0, autorizados: 0, cancelados: 0 });
    } finally {
      setCteLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('cancelad')) return 'destructive';
    if (statusLower?.includes('autoriz')) return 'default';
    if (statusLower?.includes('pendent') || statusLower?.includes('transmit')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6 mt-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* CT-e - CONHECIMENTO DE TRANSPORTE ELETRÔNICO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            CT-e - Conhecimento de Transporte Eletrônico
          </CardTitle>
          <CardDescription>Consultar conhecimentos de transporte emitidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs */}
          {cteData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{cteTotals.total}</div>
                  <p className="text-xs text-muted-foreground">Total de CT-e</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{cteTotals.autorizados}</div>
                  <p className="text-xs text-muted-foreground">Autorizados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">{cteTotals.cancelados}</div>
                  <p className="text-xs text-muted-foreground">Cancelados</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Número CT-e</Label>
              <Input
                placeholder="Ex: 12345"
                value={cteFilters.cNumCTe}
                onChange={(e) => setCteFilters(prev => ({ ...prev, cNumCTe: e.target.value }))}
              />
            </div>
            <div>
              <Label>Série</Label>
              <Input
                placeholder="Ex: 1"
                value={cteFilters.cSerie}
                onChange={(e) => setCteFilters(prev => ({ ...prev, cSerie: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Inicial (DD/MM/YYYY)</Label>
              <Input
                placeholder="01/01/2026"
                value={cteFilters.dDtEmiIni}
                onChange={(e) => setCteFilters(prev => ({ ...prev, dDtEmiIni: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final (DD/MM/YYYY)</Label>
              <Input
                placeholder="31/01/2026"
                value={cteFilters.dDtEmiFim}
                onChange={(e) => setCteFilters(prev => ({ ...prev, dDtEmiFim: e.target.value }))}
              />
            </div>
            <div>
              <Label>Situação</Label>
              <Select value={cteFilters.cSituacao} onValueChange={(v) => setCteFilters(prev => ({ ...prev, cSituacao: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="AUTORIZADO">Autorizado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="TRANSMITIDO">Transmitido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleBuscarCTe} disabled={cteLoading}>
            {cteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar CT-e
          </Button>

          {cteLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : cteData.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Série</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Chave CTe</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cteData.map((cte, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cte.cNumCTe}</TableCell>
                      <TableCell>{cte.cSerie}</TableCell>
                      <TableCell>{cte.cNomeRemetente}</TableCell>
                      <TableCell>{cte.cNomeDestinatario}</TableCell>
                      <TableCell>R$ {cte.nValorCTe?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{cte.dDtEmis}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {cte.cChaveCTe ? (
                          <span className="truncate max-w-[200px] inline-block" title={cte.cChaveCTe}>
                            {cte.cChaveCTe}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(cte.cSituacao)}>
                          {cte.cSituacao}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* Info sobre CT-e */}
          {cteData.length === 0 && !cteLoading && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Sobre CT-e</p>
                    <p className="text-sm text-muted-foreground">
                      O Conhecimento de Transporte Eletrônico (CT-e) é o documento fiscal utilizado para registrar 
                      prestação de serviços de transporte de cargas. Use os filtros acima para consultar CT-e emitidos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
