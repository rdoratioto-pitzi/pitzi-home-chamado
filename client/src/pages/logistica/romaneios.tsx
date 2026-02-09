import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, FileSpreadsheet, Download, ClipboardList } from "lucide-react";

const coletasFilterSchema = z.object({
  voucher_imei: z.string().optional(),
  code: z.string().optional(),
  awb_code: z.string().optional(),
  rede: z.string().optional(),
  operator: z.string().optional(),
  req_start: z.string().optional(),
  req_end: z.string().optional(),
  col_start: z.string().optional(),
  col_end: z.string().optional(),
  status: z.string().optional(),
  represados: z.string().optional(),
});

type ColetasFilterData = z.infer<typeof coletasFilterSchema>;

interface ColetaItem {
  [key: string]: any;
}

const STATUS_COLORS: Record<string, string> = {
  "Coletado": "bg-green-500/10 text-green-700 border-green-500/30",
  "Pendente": "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  "Em Trânsito": "bg-blue-500/10 text-blue-700 border-blue-500/30",
  "Cancelado": "bg-red-500/10 text-red-700 border-red-500/30",
  "Entregue": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

function getStatusBadgeClass(status: string): string {
  for (const [key, className] of Object.entries(STATUS_COLORS)) {
    if (status?.toLowerCase().includes(key.toLowerCase())) return className;
  }
  return "bg-muted text-muted-foreground";
}

export default function RomaneiosPage() {
  const { toast } = useToast();
  const [results, setResults] = useState<ColetaItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const form = useForm<ColetasFilterData>({
    resolver: zodResolver(coletasFilterSchema),
    defaultValues: {
      voucher_imei: "",
      code: "",
      awb_code: "",
      rede: "",
      operator: "",
      req_start: "",
      req_end: "",
      col_start: "",
      col_end: "",
      status: "",
      represados: "",
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (data: ColetasFilterData) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value && value.trim()) params.append(key, value.trim());
      });
      const response = await fetch(`/api/integrations/adm-logistica/coletas?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setHasSearched(true);
      const items = Array.isArray(data) ? data : (data?.data || data?.results || data?.coletas || []);
      setResults(items);
      toast({
        title: "Busca concluída",
        description: `${items.length} registro(s) encontrado(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na busca",
        description: error.message || "Falha ao buscar coletas",
        variant: "destructive",
      });
    },
  });

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    const columns = [
      "voucher_imei", "code", "awb_code", "rede", "operator", 
      "status", "req_date", "col_date", "represados"
    ];
    const allKeys = results.length > 0 ? Object.keys(results[0]) : columns;
    
    const header = allKeys.join(",");
    const rows = results.map(item => 
      allKeys.map(key => {
        const val = item[key];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n") 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      }).join(",")
    );
    
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `romaneios_coletas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exportação concluída", description: "Arquivo CSV baixado com sucesso." });
  };

  const handleLimparFiltros = () => {
    form.reset();
    setResults([]);
    setHasSearched(false);
  };

  const displayColumns = results.length > 0 
    ? Object.keys(results[0]).slice(0, 15)
    : ["voucher_imei", "code", "awb_code", "rede", "operator", "status", "req_date", "col_date", "represados"];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="title-romaneios">Romaneios</h1>
            <p className="text-sm text-muted-foreground">
              Consulte coletas do Dashboard Renov com filtros avançados
            </p>
          </div>
        </div>
        {results.length > 0 && (
          <Button variant="outline" className="gap-2" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filtros de Busca
          </CardTitle>
          <CardDescription>
            Filtre coletas por IMEI, código, AWB, rede, operador, datas e status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => searchMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="voucher_imei"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">IMEI do Voucher</FormLabel>
                      <FormControl>
                        <Input placeholder="IMEI do voucher" {...field} data-testid="input-romaneio-voucher_imei" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Código da Coleta</FormLabel>
                      <FormControl>
                        <Input placeholder="Código da coleta" {...field} data-testid="input-romaneio-code" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="awb_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Código AWB</FormLabel>
                      <FormControl>
                        <Input placeholder="Código AWB" {...field} data-testid="input-romaneio-awb_code" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rede"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nome da Rede</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da rede" {...field} data-testid="input-romaneio-rede" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Operador Logístico</FormLabel>
                      <FormControl>
                        <Input placeholder="Loggi / Correios" {...field} data-testid="input-romaneio-operator" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Status da Coleta</FormLabel>
                      <FormControl>
                        <Input placeholder="Status da coleta" {...field} data-testid="input-romaneio-status" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="req_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Data Requisição Início</FormLabel>
                      <FormControl>
                        <Input type="date" className="date-picker-full" {...field} data-testid="input-romaneio-req_start" />
                      </FormControl>
                      <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="req_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Data Requisição Fim</FormLabel>
                      <FormControl>
                        <Input type="date" className="date-picker-full" {...field} data-testid="input-romaneio-req_end" />
                      </FormControl>
                      <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="col_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Data Coleta Início</FormLabel>
                      <FormControl>
                        <Input type="date" className="date-picker-full" {...field} data-testid="input-romaneio-col_start" />
                      </FormControl>
                      <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="col_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Data Coleta Fim</FormLabel>
                      <FormControl>
                        <Input type="date" className="date-picker-full" {...field} data-testid="input-romaneio-col_end" />
                      </FormControl>
                      <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="represados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Represados</FormLabel>
                      <FormControl>
                        <Input placeholder="true / false" {...field} data-testid="input-romaneio-represados" />
                      </FormControl>
                      <FormDescription className="text-xs">Filtrar itens represados</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleLimparFiltros}
                  data-testid="button-limpar-filtros"
                >
                  Limpar Filtros
                </Button>
                <Button 
                  type="submit" 
                  className="gap-2"
                  disabled={searchMutation.isPending}
                  data-testid="button-buscar-coletas"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar Coletas
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Resultados
              </CardTitle>
              <Badge variant="secondary" data-testid="badge-total-results">
                {results.length} registro(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma coleta encontrada</p>
                <p className="text-sm">Tente ajustar os filtros da busca.</p>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {displayColumns.map((col) => (
                          <TableHead key={col} className="text-xs font-bold whitespace-nowrap">
                            {col.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((item, idx) => (
                        <TableRow key={idx} data-testid={`row-coleta-${idx}`}>
                          {displayColumns.map((col) => (
                            <TableCell key={col} className="text-sm whitespace-nowrap">
                              {col.toLowerCase().includes("status") ? (
                                <Badge variant="outline" className={getStatusBadgeClass(String(item[col] || ""))}>
                                  {String(item[col] || "-")}
                                </Badge>
                              ) : col.toLowerCase().includes("date") || col.toLowerCase().includes("data") ? (
                                <span className="font-mono text-xs">
                                  {item[col] ? new Date(item[col]).toLocaleDateString("pt-BR") : "-"}
                                </span>
                              ) : typeof item[col] === "boolean" ? (
                                item[col] ? "Sim" : "Não"
                              ) : (
                                String(item[col] ?? "-")
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
