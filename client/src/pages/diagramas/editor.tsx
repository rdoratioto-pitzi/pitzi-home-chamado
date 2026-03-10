// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Save,
  Download,
  FileImage,
} from "lucide-react";
import type { Flowchart } from "@shared/schema";

export default function DiagramaEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initializedRef = useRef(false);

  const { data: diagrama, isLoading } = useQuery<Flowchart>({
    queryKey: ["/api/flowcharts", id],
    queryFn: async () => {
      const res = await fetch(`/api/flowcharts/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Diagrama não encontrado");
      return res.json();
    },
    enabled: !!id,
  });

  const initialData = useMemo(() => {
    if (!diagrama) return undefined;
    try {
      const elements = diagrama.nodesData ? JSON.parse(diagrama.nodesData) : [];
      const appState = diagrama.viewport ? JSON.parse(diagrama.viewport) : {};
      return { elements, appState };
    } catch {
      return { elements: [], appState: {} };
    }
  }, [diagrama]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!excalidrawAPI) throw new Error("Editor não inicializado");
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const res = await apiRequest("PATCH", `/api/flowcharts/${id}`, {
        nodesData: JSON.stringify(elements),
        viewport: JSON.stringify({
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          theme: appState.theme,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", id] });
      setHasChanges(false);
      toast({ title: "Diagrama salvo com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const handleExportPNG = useCallback(async () => {
    if (!excalidrawAPI) return;
    try {
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportWithDarkMode: false },
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${diagrama?.title || "diagrama"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar PNG", variant: "destructive" });
    }
  }, [excalidrawAPI, diagrama]);

  const handleExportSVG = useCallback(async () => {
    if (!excalidrawAPI) return;
    try {
      const svg = await exportToSvg({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportWithDarkMode: false },
        files: excalidrawAPI.getFiles(),
      });
      const svgStr = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${diagrama?.title || "diagrama"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar SVG", variant: "destructive" });
    }
  }, [excalidrawAPI, diagrama]);

  const handleChange = useCallback(() => {
    // Ignora primeira chamada do onChange disparada pela inicialização
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    setHasChanges(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando diagrama...</p>
      </div>
    );
  }

  if (!diagrama) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Diagrama não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/diagramas")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white shrink-0 h-14">
        <Button variant="ghost" size="icon" onClick={() => navigate("/diagramas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold truncate max-w-64">{diagrama.title}</h1>
          {hasChanges && (
            <Badge variant="secondary" className="text-xs shrink-0">Não salvo</Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSVG}
            title="Exportar como SVG"
          >
            <FileImage className="h-4 w-4 mr-1.5" />
            SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPNG}
            title="Exportar como PNG"
          >
            <Download className="h-4 w-4 mr-1.5" />
            PNG
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Canvas Excalidraw */}
      <div className="flex-1 overflow-hidden">
        {initialData !== undefined && (
          <Excalidraw
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            initialData={initialData}
            onChange={handleChange}
            langCode="pt-BR"
            UIOptions={{
              canvasActions: {
                export: false,
                loadScene: false,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
