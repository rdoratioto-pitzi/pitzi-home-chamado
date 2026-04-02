/**
 * Página de Consulta - Dashboard de Logística
 *
 * Esta página replica a funcionalidade da aba "Consulta" do app_logistica.py:
 * - Busca por lista de IMEIs ou Vouchers (manual ou via upload Excel)
 * - Busca por Rede (caso nenhum código seja informado)
 * - Exibe tabela com resultados detalhados
 * - Permite exportação para Excel
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  FileSpreadsheet,
  Upload,
  Download,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  ListOrdered,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAdmConsultaAggregates,
  useAdmDispositivosAggregates,
  LogisticaConsultaFilters,
  LogisticaConsultaResultado,
} from "@/hooks/use-adm-logistica";
import * as XLSX from "xlsx";

const REDE_NONE_VALUE = "__none__";

export default function ConsultaPage() {
  const { toast } = useToast();
  
  // State para input manual
  const [manualInput, setManualInput] = useState<string>("");
  
  // State para upload de arquivo
  const [uploadedCodes, setUploadedCodes] = useState<string[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State para rede
  const [selectedRede, setSelectedRede] = useState<string>("");
  
  // State para controlar a busca
  const [shouldSearch, setShouldSearch] = useState<boolean>(false);
  const [currentFilters, setCurrentFilters] = useState<LogisticaConsultaFilters>({});
  
  // Buscar lista de redes disponíveis do endpoint de dispositivos
  const { data: dispositivosData } = useAdmDispositivosAggregates({});
  const redesDisponiveis = useMemo(() => {
    const redes = dispositivosData?.filtros_disponiveis?.redes;
    if (!Array.isArray(redes)) return [];

    return Array.from(
      new Set(
        redes
          .map((rede) => String(rede ?? "").trim())
          .filter((rede) => rede.length > 0)
      )
    );
  }, [dispositivosData?.filtros_disponiveis?.redes]);
  
  // Hook para consulta
  const {
    data: consultaData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAdmConsultaAggregates(currentFilters, shouldSearch);

  // Parsear códigos do input manual
  const parseManualCodes = useCallback((text: string): string[] => {
    if (!text.trim()) return [];
    // Separa por quebra de linha, vírgula ou ponto e vírgula
    const raw = text.split(/[;,\n\r]+/);
    return raw
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
  }, []);

  // Handler para upload de arquivo Excel
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        if (jsonData.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: "O arquivo Excel não contém dados.",
            variant: "destructive",
          });
          return;
        }

        // Procurar coluna com IMEI ou Voucher
        const headers = jsonData[0] as string[];
        let targetColIndex = -1;
        
        for (let i = 0; i < headers.length; i++) {
          const header = String(headers[i] || "").toLowerCase().trim();
          if (["imei", "imeis", "voucher", "vouchers", "código", "codigo"].includes(header)) {
            targetColIndex = i;
            break;
          }
        }

        // Se não encontrou coluna específica, usa a primeira
        if (targetColIndex === -1 && headers.length > 0) {
          targetColIndex = 0;
        }

        // Extrair valores da coluna (pula o header)
        const codes: string[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (row && row[targetColIndex]) {
            const value = String(row[targetColIndex]).trim();
            if (value) {
              codes.push(value);
            }
          }
        }

        // Remove duplicados
        const uniqueCodes = [...new Set(codes)];
        
        setUploadedCodes(uniqueCodes);
        setUploadFileName(file.name);
        
        toast({
          title: "Arquivo carregado",
          description: `${uniqueCodes.length} código(s) encontrado(s) em "${file.name}"`,
        });
      } catch (err) {
        console.error("Erro ao processar arquivo:", err);
        toast({
          title: "Erro ao processar arquivo",
          description: "Não foi possível ler o arquivo Excel. Verifique se o formato está correto.",
          variant: "destructive",
        });
      }

      // Limpa o input para permitir upload do mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [toast]
  );

  // Handler para realizar a busca
  const handleSearch = useCallback(() => {
    // Combinar códigos do input manual e do upload
    const manualCodes = parseManualCodes(manualInput);
    const allCodes = [...new Set([...manualCodes, ...uploadedCodes])];

    // Validar se há algo para buscar
    if (allCodes.length === 0 && !selectedRede) {
      toast({
        title: "Preencha os campos",
        description: "Informe uma lista de IMEIs/Vouchers ou selecione uma Rede.",
        variant: "destructive",
      });
      return;
    }

    // Montar filtros
    const filters: LogisticaConsultaFilters = {};
    
    if (allCodes.length > 0) {
      // Se há códigos, prioriza eles (ignora rede)
      filters.codigos = allCodes.join(",");
    } else if (selectedRede) {
      // Se não há códigos mas tem rede selecionada
      filters.rede = selectedRede;
    }

    setCurrentFilters(filters);
    setShouldSearch(true);
  }, [manualInput, uploadedCodes, selectedRede, parseManualCodes, toast]);

  // Handler para limpar upload
  const handleClearUpload = useCallback(() => {
    setUploadedCodes([]);
    setUploadFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handler para exportar Excel
  const handleExportExcel = useCallback(() => {
    if (!consultaData?.tabela_resultado || consultaData.tabela_resultado.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(consultaData.tabela_resultado);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Consulta");
      XLSX.writeFile(workbook, "resultado_consulta_logistica.xlsx");
      
      toast({
        title: "Exportação concluída",
        description: "O arquivo Excel foi baixado com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o arquivo Excel.",
        variant: "destructive",
      });
    }
  }, [consultaData, toast]);

  // Dados da tabela
  const tableData = useMemo(() => {
    return consultaData?.tabela_resultado || [];
  }, [consultaData]);

  // Contadores para exibição
  const totalManual = parseManualCodes(manualInput).length;
  const totalUpload = uploadedCodes.length;
  const totalCodes = new Set([...parseManualCodes(manualInput), ...uploadedCodes]).size;

  // Badge de status do voucher
  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("utilizado")) {
      return <Badge className="bg-green-500">Utilizado</Badge>;
    } else if (statusLower.includes("disponível") || statusLower.includes("disponivel")) {
      return <Badge variant="secondary">Disponível</Badge>;
    }
    return <Badge variant="outline">{status || "-"}</Badge>;
  };

  // Badge de status do recebimento
  const getRecebimentoBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("triado")) {
      return <Badge className="bg-green-500">{status}</Badge>;
    } else if (statusLower.includes("confirmado")) {
      return <Badge className="bg-blue-500">{status}</Badge>;
    } else if (statusLower.includes("coleta")) {
      return <Badge className="bg-yellow-500 text-black">{status}</Badge>;
    } else if (statusLower.includes("bloqueado")) {
      return <Badge className="bg-red-500">{status}</Badge>;
    } else if (statusLower.includes("aguardando")) {
      return <Badge className="bg-orange-500">{status}</Badge>;
    }
    return <Badge variant="outline">{status || "-"}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Consulta de Vouchers / IMEIs"
        description="Consulte o status de dispositivos por IMEI, Voucher ou Rede"
        breadcrumbs={[
          { label: "Logística", href: "/logistica" },
          { label: "Consulta" },
        ]}
      />

      {/* Container de Entrada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Input Manual e Upload */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Lista de IMEIs ou Vouchers
            </CardTitle>
            <CardDescription>
              Cole os códigos abaixo (um por linha ou separado por vírgula)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`Cole aqui os IMEIs ou Vouchers...\nEx:\n358123456789012\nF3759042`}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            
            {totalManual > 0 && (
              <p className="text-sm text-muted-foreground">
                {totalManual} código(s) no campo de texto
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground font-medium">OU</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex flex-col items-center text-center">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">
                    Importar Planilha Excel
                  </span>
                </div>
              </label>
            </div>

            {uploadFileName && (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded-md">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {uploadFileName} ({totalUpload} códigos)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearUpload}
                  className="h-6 text-red-500 hover:text-red-700"
                >
                  Limpar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna 2: Busca por Rede e Ações */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Busca por Rede
            </CardTitle>
            <CardDescription>
              Se nenhum código for informado, consulte por Rede
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <label className="text-sm font-medium text-amber-800 dark:text-amber-200 block mb-2">
                Selecione a Rede (opcional):
              </label>
              <Select
                value={selectedRede || REDE_NONE_VALUE}
                onValueChange={(value) => setSelectedRede(value === REDE_NONE_VALUE ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma rede..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={REDE_NONE_VALUE}>Nenhuma</SelectItem>
                  {redesDisponiveis.map((rede) => (
                    <SelectItem key={rede} value={rede}>
                      {rede}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isLoading || isFetching}
              className="w-full h-12"
              size="lg"
            >
              {isLoading || isFetching ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Search className="h-5 w-5 mr-2" />
              )}
              Consultar Agora
            </Button>

            <hr />

            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportExcel}
                disabled={!tableData || tableData.length === 0}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Excel
              </Button>
              {consultaData?.mensagem && (
                <span className="text-sm text-muted-foreground italic">
                  {consultaData.mensagem}
                </span>
              )}
            </div>

            {/* Resumo dos códigos */}
            {(totalCodes > 0 || selectedRede) && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Resumo da busca:</p>
                {totalCodes > 0 && (
                  <p className="text-muted-foreground">
                    • {totalCodes} código(s) único(s) para consultar
                  </p>
                )}
                {selectedRede && totalCodes === 0 && (
                  <p className="text-muted-foreground">
                    • Busca por rede: {selectedRede}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna 3: Instruções */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5" />
              Instruções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>
                  <strong>Prioridade de Busca:</strong> Lista Manual &gt; Arquivo &gt; Rede.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>
                  Para arquivo Excel: O sistema busca coluna 'IMEI', 'Voucher', ou usa a primeira coluna.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>
                  A busca retorna 1 linha por item (IMEI ou Voucher).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                <span>
                  Prioriza registros onde o voucher foi 'Utilizado'.
                </span>
              </li>
            </ul>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Dica:</strong> Você pode colar uma lista grande de IMEIs diretamente do Excel - basta selecionar a coluna e colar no campo de texto.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Área de Resultados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultado da Consulta
            </CardTitle>
            {consultaData?.meta && (
              <CardDescription>
                {consultaData.meta.total_registros} registro(s) encontrado(s)
                {consultaData.meta.criterio && ` (critério: ${consultaData.meta.criterio})`}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Estado de Loading */}
          {(isLoading || isFetching) && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Estado de Erro */}
          {error && !isLoading && (
            <div className="flex items-center justify-center p-8 text-red-500">
              <AlertCircle className="h-6 w-6 mr-2" />
              <span>Erro ao carregar dados: {(error as Error).message}</span>
            </div>
          )}

          {/* Estado Vazio (antes da busca) */}
          {!shouldSearch && !isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma consulta realizada</p>
              <p className="text-sm">
                Informe os códigos ou selecione uma rede e clique em "Consultar Agora"
              </p>
            </div>
          )}

          {/* Estado Sem Resultados */}
          {shouldSearch && !isLoading && !isFetching && tableData.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum resultado encontrado</p>
              <p className="text-sm">
                Verifique os códigos informados ou tente outra rede
              </p>
            </div>
          )}

          {/* Tabela de Resultados */}
          {!isLoading && !isFetching && tableData.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Voucher</TableHead>
                    <TableHead className="whitespace-nowrap">IMEI</TableHead>
                    <TableHead className="whitespace-nowrap">Rede</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor Dispositivo</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor Voucher</TableHead>
                    <TableHead className="whitespace-nowrap">Data de Uso</TableHead>
                    <TableHead className="whitespace-nowrap">Data Recebimento</TableHead>
                    <TableHead className="whitespace-nowrap">Triagem</TableHead>
                    <TableHead className="whitespace-nowrap">Situação Voucher</TableHead>
                    <TableHead className="whitespace-nowrap">Status Recebimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {row["Numero do Voucher"] || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row["IMEI"] || "-"}
                      </TableCell>
                      <TableCell>{row["Rede"] || "-"}</TableCell>
                      <TableCell className="text-right">
                        {row["Valor do Dispositivo"] || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row["Valor do Voucher"] || "-"}
                      </TableCell>
                      <TableCell>{row["Data de Uso"] || "-"}</TableCell>
                      <TableCell>{row["Data Recebimento"] || "-"}</TableCell>
                      <TableCell>{row["Triagem"] || "-"}</TableCell>
                      <TableCell>{getStatusBadge(row["Situacao do voucher"])}</TableCell>
                      <TableCell>{getRecebimentoBadge(row["Status do Recebimento"])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
