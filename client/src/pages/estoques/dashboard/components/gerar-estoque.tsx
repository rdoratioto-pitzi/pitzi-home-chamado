import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Search, Upload } from "lucide-react";

import { fetchWithAuth } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface GerarEstoqueResponse {
  rows: Record<string, unknown>[];
  total: number;
}

const DASH_ESTOQUE_EXTERNAL_URL = "https://dash.pitzi.com.br/api/dash_estoque/defeitos";
const DASH_ESTOQUE_EXTERNAL_TOKEN = "Renov123";

function normalizeImeis(values: unknown[]): string[] {
  const cleaned = values
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/\.0$/, ""));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const imei of cleaned) {
    if (seen.has(imei)) continue;
    seen.add(imei);
    unique.push(imei);
  }

  return unique;
}

function parseImeisText(text: string): string[] {
  const parts = text.split(/[\n,;\t\s]+/);
  return normalizeImeis(parts);
}

async function parseImeisFromSheet(file: File): Promise<string[]> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("A planilha está vazia.");
  }

  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) {
    throw new Error("Não foi possível identificar colunas na planilha.");
  }

  const imeiColumn = columns.find((col) => ["imei", "imeis"].includes(col.trim().toLowerCase())) ?? columns[0];
  const imeis = normalizeImeis(rows.map((row) => row[imeiColumn]));

  if (imeis.length === 0) {
    throw new Error("Nenhum IMEI válido encontrado na planilha.");
  }

  return imeis;
}

function exportRowsToExcel(rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Defeitos");
  XLSX.writeFile(workbook, `gerar-estoque-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function GerarEstoque() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imeis, setImeis] = useState<string[]>([]);
  const [imeisText, setImeisText] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const gerarEstoqueMutation = useMutation<GerarEstoqueResponse, Error, string[]>({
    mutationFn: async (imeisInput: string[]) => {
      console.info("[GerarEstoque] Iniciando consulta", { totalImeis: imeisInput.length });
      const internalResponse = await fetchWithAuth("/api/estoques/dashboard/gerar-estoque", {
        method: "POST",
        body: JSON.stringify({ imeis: imeisInput }),
      });

      const internalPayload = await internalResponse.json().catch(() => ({}));
      const internalError = String(internalPayload?.error || "");
      const shouldFallbackExternal =
        internalResponse.status === 404 || internalError.includes("Rota não encontrada");

      if (!internalResponse.ok && !shouldFallbackExternal) {
        throw new Error(internalPayload?.error || `Erro ${internalResponse.status}`);
      }

      if (internalResponse.ok && internalPayload?.success) {
        return internalPayload.data as GerarEstoqueResponse;
      }

      const externalResponse = await fetch(DASH_ESTOQUE_EXTERNAL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DASH_ESTOQUE_EXTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ imeis: imeisInput }),
      });

      const externalPayload = await externalResponse.json().catch(() => []);
      if (!externalResponse.ok) {
        const externalError = (externalPayload as any)?.error;
        throw new Error(externalError || `Erro ${externalResponse.status} na API externa`);
      }

      const rows = Array.isArray(externalPayload)
        ? externalPayload
        : Array.isArray((externalPayload as any)?.data)
          ? (externalPayload as any).data
          : Array.isArray((externalPayload as any)?.results)
            ? (externalPayload as any).results
            : [];

      return { rows, total: rows.length };
    },
    onMutate: (imeisInput) => {
      setParseError("");
      setStatusMessage(`Consultando ${imeisInput.length} IMEI(s)...`);
    },
    onSuccess: (data) => {
      setStatusMessage(`Consulta concluída: ${data.total} linha(s) retornada(s).`);
      console.info("[GerarEstoque] Consulta concluída", { totalLinhas: data.total });
    },
    onError: (error) => {
      setStatusMessage("");
      console.error("[GerarEstoque] Falha na consulta", error);
    },
  });

  const rows = gerarEstoqueMutation.data?.rows ?? [];
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError("");
    setIsParsingFile(true);

    try {
      const parsedImeis = await parseImeisFromSheet(file);
      setImeis(parsedImeis);
      setSelectedFileName(file.name);
      setImeisText(parsedImeis.join("\n"));
    } catch (error: any) {
      setImeis([]);
      setSelectedFileName("");
      setParseError(error?.message || "Falha ao ler a planilha.");
    } finally {
      setIsParsingFile(false);
      event.target.value = "";
    }
  }

  function handleParseTextImeis() {
    const parsed = parseImeisText(imeisText);
    setImeis(parsed);
    if (parsed.length === 0) {
      setParseError("Nenhum IMEI válido foi identificado no texto informado.");
      return;
    }
    setParseError("");
    setSelectedFileName("");
  }

  function handleGerarEstoque() {
    if (imeis.length === 0) {
      setParseError("Adicione pelo menos 1 IMEI via planilha ou texto para gerar o estoque.");
      setStatusMessage("");
      console.warn("[GerarEstoque] Clique ignorado: lista de IMEIs vazia");
      return;
    }
    gerarEstoqueMutation.mutate(imeis);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerar Estoque por Defeitos (IMEI)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">1. Faça upload da planilha com coluna IMEI</p>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingFile}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Selecionar planilha
                </Button>
                {selectedFileName && (
                  <Badge variant="secondary" className="max-w-[220px] truncate">
                    <FileSpreadsheet className="h-3 w-3 mr-1" />
                    {selectedFileName}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Se não houver coluna IMEI, a primeira coluna será usada.</p>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">2. Ou cole os IMEIs manualmente</p>
              <Textarea
                value={imeisText}
                onChange={(e) => setImeisText(e.target.value)}
                rows={4}
                placeholder="Cole IMEIs separados por vírgula, espaço ou quebra de linha"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleParseTextImeis}>
                Carregar IMEIs do texto
              </Button>
            </div>
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertTitle>Erro de validação</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">IMEIs únicos: {imeis.length}</Badge>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleGerarEstoque}
              disabled={gerarEstoqueMutation.isPending}
            >
              <Search className="h-3.5 w-3.5" />
              {gerarEstoqueMutation.isPending ? "Consultando..." : "Gerar estoque"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => exportRowsToExcel(rows)}
              disabled={rows.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar resultado
            </Button>
          </div>

          {statusMessage && (
            <Alert>
              <AlertTitle>Status da consulta</AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {gerarEstoqueMutation.isError && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao consultar API de estoque</AlertTitle>
          <AlertDescription>{gerarEstoqueMutation.error.message}</AlertDescription>
        </Alert>
      )}

      {isParsingFile && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado da Consulta ({rows.length} linhas)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column} className="whitespace-nowrap text-xs">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`gerar-estoque-row-${idx}`}>
                    {columns.map((column) => (
                      <TableCell key={`${column}-${idx}`} className="text-xs whitespace-nowrap">
                        {String(row[column] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
