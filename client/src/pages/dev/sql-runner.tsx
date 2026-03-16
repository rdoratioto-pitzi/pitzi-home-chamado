import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Download, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";

export default function SQLRunnerPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [affectedRows, setAffectedRows] = useState<number | null>(null);

  const executeMutation = useMutation({
    mutationFn: async (sql: string) => {
      const res = await apiRequest("POST", "/api/dev/sql-execute", { query: sql });
      return await res.json();
    },
    onSuccess: (data) => {
      // Check format based on Postman collection description
      // Read queries return JSON array
      // Write queries return affected rows count (maybe as number or object)
      
      if (Array.isArray(data)) {
        setResults(data);
        if (data.length > 0) {
          setColumns(Object.keys(data[0]));
        } else {
          setColumns([]);
        }
        setAffectedRows(null);
        toast({
          title: "Consulta executada com sucesso",
          description: `${data.length} registros retornados.`,
        });
      } else if (typeof data === 'object' && data !== null) {
        // Handle result that is not an array (e.g. { affectedRows: 1 } or error object if not caught)
        // If the API returns directly the number of affected rows or an object describing it
        // The Postman description says: "Queries de Escrita: Retorna o número de linhas afetadas."
        // Let's assume it returns something like { rowCount: 5 } or just a number?
        // If it's just an object, we'll try to display it.
        setResults([]);
        setColumns([]);
        setAffectedRows(JSON.stringify(data).length > 100 ? 1 : JSON.stringify(data, null, 2)); // Placeholder logic
        // Actually, let's just show the raw JSON if it's not a list
        toast({
            title: "Operação realizada",
            description: "Comando executado com sucesso.",
        });
      } else {
         // Fallback
         setResults([]);
         setColumns([]);
         setAffectedRows(data);
         toast({ title: "Executado", description: `Resultado: ${data}` });
      }
    },
    onError: (error: any) => {
      console.error("SQL Error:", error);
      
      let title = "Erro na execução";
      let desc = error.message || "Falha ao executar query.";

      // Tratamento de erros comuns
      if (desc.includes("syntax error") || desc.includes("psycopg2.errors.SyntaxError")) {
          title = "Erro de Sintaxe SQL";
          desc = "Verifique a escrita da sua consulta. Há um erro de comando.";
      } else if (desc.includes("timeout") || desc.includes("504")) {
          title = "Tempo Limite Excedido";
          desc = "A consulta demorou muito para responder. Tente otimizar ou usar LIMIT.";
      } else if (desc.includes("does not exist") || desc.includes("UndefinedTable")) {
          title = "Tabela ou Coluna não encontrada";
          desc = "Verifique se os nomes das tabelas e colunas estão corretos.";
      }

      toast({
        title: title,
        description: desc,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (results.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, `sql_export_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.xlsx`);
  };

  const handleExecute = () => {
    if (!query.trim()) return;
    executeMutation.mutate(query);
  };
 
  const [isExporting, setIsExporting] = useState(false);
  
  const handleDirectExport = async (format: "csv" | "xlsx") => {
    if (!query.trim()) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/dev/sql-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, format })
      });

      if (!response.ok) throw new Error("Falha na exportação");

      // Criar blob e link de download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Sucesso", description: `Arquivo ${format.toUpperCase()} baixado.` });
    } catch (e: any) {
      let desc = e.message || "Erro desconhecido";
      let title = "Erro na exportação";

      // Tratamento manual baseado na resposta da API
      // Obs: O fetch não lança erro em 4xx/5xx a menos que não receba resposta,
      // então o erro virá do `if (!response.ok) throw...` ou do blob
      // Vamos tentar capturar o corpo do erro se possível
      if (e.message.includes("500") || e.message.includes("Failed to fetch")) {
          title = "Erro no Servidor";
          desc = "O servidor demorou ou falhou. Tente uma query mais leve.";
      }

      toast({ 
        title: title, 
        description: desc,
        variant: "destructive" 
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader 
        title="SQL Runner" 
        breadcrumbs={[{ label: "Dev Tools" }, { label: "SQL Runner" }]}
      />
      
      <main className="flex-1 overflow-auto p-6 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SQL Runner (Dev Tool)</h1>
          <p className="text-muted-foreground mt-2">
            Ferramenta interna para execução de queries diretas. Use com cuidado.
          </p>
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded-md border border-yellow-200 dark:border-yellow-900/50">
            <p className="font-semibold mb-1">⚠️ Recomendações de Performance:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Para consultas com <strong>muitos resultados (+5.000 linhas)</strong>, evite usar o botão "Executar". 
                Prefira usar "Exportar CSV (Direto)".
              </li>
              <li>
                A exportação em <strong>XLSX (Excel)</strong> é limitada pela memória do servidor. Para bases muito grandes (+10.000 linhas), 
                use sempre a opção <strong>CSV</strong>.
              </li>
              <li>
                Queries de SELECT muito pesadas podem travar o navegador se executadas diretamente na tela.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="relative">
          <Textarea 
            placeholder="Digite sua query SQL aqui..." 
            className="min-h-[200px] font-mono text-sm leading-relaxed"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <Button 
            onClick={handleExecute} 
            disabled={executeMutation.isPending || !query.trim()}
            className="w-32"
          >
            {executeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Executar
          </Button>

          <Button 
            variant="outline" 
            onClick={() => handleDirectExport("xlsx")}
            disabled={isExporting || !query.trim()}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar XLSX (Direto)
          </Button>

          <Button 
            variant="outline" 
            onClick={() => handleDirectExport("csv")}
            disabled={isExporting || !query.trim()}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar CSV (Direto)
          </Button>
          
          {results.length > 0 && (
          <Button 
            variant="ghost" 
            onClick={handleExport}
            disabled={results.length === 0}
            className="ml-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Salvar Excel (Tela)
          </Button>
          )}
        </div>
      </div>

      {executeMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            {executeMutation.error instanceof Error ? executeMutation.error.message : "Erro desconhecido ao executar a query."}
          </AlertDescription>
        </Alert>
      )}

      {affectedRows !== null && !Array.isArray(results) && (
         <Alert>
           <AlertTitle>Resultado</AlertTitle>
           <AlertDescription>
             <pre className="whitespace-pre-wrap">{typeof affectedRows === 'object' ? JSON.stringify(affectedRows, null, 2) : affectedRows}</pre>
           </AlertDescription>
         </Alert>
      )}

      {results.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap px-4 py-2 bg-muted/50 font-semibold text-foreground">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    {columns.map((col) => (
                      <TableCell key={`${idx}-${col}`} className="px-4 py-2 font-mono text-sm">
                        {row[col] === null ? <span className="text-muted-foreground italic">null</span> : String(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-muted/30 p-2 text-xs text-muted-foreground text-right border-t">
            {results.length} registros encontrados
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
