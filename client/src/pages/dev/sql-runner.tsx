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
      toast({
        title: "Erro na execução",
        description: error.message || "Falha ao executar query.",
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

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SQL Runner (Dev Tool)</h1>
          <p className="text-muted-foreground mt-2">
            Ferramenta interna para execução de queries diretas. Use com cuidado.
          </p>
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
        
        <div className="flex gap-4">
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
            onClick={handleExport}
            disabled={results.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
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
    </div>
  );
}
