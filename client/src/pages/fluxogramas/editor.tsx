import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type Connection,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Save,
  Download,
  MessageSquare,
  History,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  Circle,
  Diamond,
  Type,
  StickyNote,
  ArrowRight,
  Trash2,
  Send,
  Clock,
  Workflow,
  Palette,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Lock,
  Unlock,
} from "lucide-react";
import type { Flowchart, FlowchartComment, FlowchartVersion } from "@shared/schema";

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) return JSON.parse(userStr);
  } catch {}
  return null;
}

const NODE_COLORS = [
  { name: "Padrão", bg: "#ffffff", border: "#d1d5db", text: "#1f2937" },
  { name: "Azul", bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  { name: "Verde", bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  { name: "Amarelo", bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  { name: "Vermelho", bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  { name: "Roxo", bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  { name: "Renov", bg: "#d1fae5", border: "#00A137", text: "#065f46" },
];

function RectangleNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-md border-2 min-w-[140px] text-center shadow-sm transition-shadow",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: data.bgColor || "#ffffff",
        borderColor: data.borderColor || "#d1d5db",
        color: data.textColor || "#1f2937",
      }}
      data-testid={`node-rectangle-${data.label?.substring(0, 10)}`}
    >
      <div className="text-sm font-medium">{data.label || "Retângulo"}</div>
      {data.description && (
        <div className="text-xs mt-1 opacity-70">{data.description}</div>
      )}
    </div>
  );
}

function EllipseNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={cn(
        "px-6 py-3 rounded-full border-2 min-w-[140px] text-center shadow-sm",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: data.bgColor || "#dbeafe",
        borderColor: data.borderColor || "#3b82f6",
        color: data.textColor || "#1e40af",
      }}
      data-testid={`node-ellipse-${data.label?.substring(0, 10)}`}
    >
      <div className="text-sm font-medium">{data.label || "Início/Fim"}</div>
    </div>
  );
}

function DiamondNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        selected && "ring-2 ring-primary ring-offset-2 rounded-md"
      )}
    >
      <div
        className="w-[120px] h-[120px] border-2 flex items-center justify-center shadow-sm"
        style={{
          transform: "rotate(45deg)",
          backgroundColor: data.bgColor || "#fef9c3",
          borderColor: data.borderColor || "#eab308",
        }}
      >
        <div
          className="text-xs font-medium text-center max-w-[80px]"
          style={{ transform: "rotate(-45deg)", color: data.textColor || "#854d0e" }}
        >
          {data.label || "Decisão"}
        </div>
      </div>
    </div>
  );
}

function TextNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-2 min-w-[100px]",
        selected && "ring-2 ring-primary ring-offset-2 rounded-md"
      )}
    >
      <div className="text-sm" style={{ color: data.textColor || "#6b7280" }}>
        {data.label || "Texto"}
      </div>
    </div>
  );
}

function NoteNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-md border min-w-[160px] shadow-sm",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: data.bgColor || "#fef9c3",
        borderColor: data.borderColor || "#fde68a",
        color: data.textColor || "#854d0e",
      }}
    >
      <div className="text-xs font-semibold mb-1 flex items-center gap-1">
        <StickyNote className="h-3 w-3" />
        Nota
      </div>
      <div className="text-xs">{data.label || "Adicione uma nota..."}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  rectangle: RectangleNode,
  ellipse: EllipseNode,
  diamond: DiamondNode,
  textNode: TextNode,
  noteNode: NoteNode,
};

function FlowchartEditorInner() {
  const [, params] = useRoute("/fluxogramas/:id");
  const flowchartId = params?.id;
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeColor, setNodeColor] = useState(NODE_COLORS[0]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: flowchart, isLoading } = useQuery<Flowchart>({
    queryKey: ["/api/flowcharts", flowchartId],
    enabled: !!flowchartId,
  });

  const { data: comments, refetch: refetchComments } = useQuery<FlowchartComment[]>({
    queryKey: ["/api/flowcharts", flowchartId, "comments"],
    enabled: !!flowchartId,
  });

  const { data: versions } = useQuery<FlowchartVersion[]>({
    queryKey: ["/api/flowcharts", flowchartId, "versions"],
    enabled: !!flowchartId,
  });

  useEffect(() => {
    if (flowchart) {
      try {
        const parsedNodes = flowchart.nodesData ? JSON.parse(flowchart.nodesData) : [];
        const parsedEdges = flowchart.edgesData ? JSON.parse(flowchart.edgesData) : [];
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        if (flowchart.viewport) {
          const vp = JSON.parse(flowchart.viewport);
          setTimeout(() => {
            reactFlowInstance.setViewport(vp);
          }, 100);
        }
      } catch (e) {
        console.error("Error parsing flowchart data:", e);
      }
    }
  }, [flowchart]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    setHasChanges(true);
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setHasChanges(true);
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      type: "smoothstep",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
      style: { strokeWidth: 2, stroke: "#6b7280" },
    }, eds));
    setHasChanges(true);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeLabel(String(node.data.label || ""));
    setNodeDescription(String(node.data.description || ""));
    const color = NODE_COLORS.find(
      (c) => c.bg === node.data.bgColor
    ) || NODE_COLORS[0];
    setNodeColor(color);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: nodeLabel,
                description: nodeDescription,
                bgColor: nodeColor.bg,
                borderColor: nodeColor.border,
                textColor: nodeColor.text,
              },
            }
          : n
      )
    );
    setHasChanges(true);
  }, [selectedNode, nodeLabel, nodeDescription, nodeColor]);

  useEffect(() => {
    updateSelectedNode();
  }, [nodeLabel, nodeDescription, nodeColor]);

  const addNode = useCallback((type: string) => {
    const id = `node_${Date.now()}`;
    const defaultData: Record<string, any> = {
      rectangle: { label: "Processo", bgColor: "#ffffff", borderColor: "#d1d5db", textColor: "#1f2937" },
      ellipse: { label: "Início/Fim", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" },
      diamond: { label: "Decisão?", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" },
      textNode: { label: "Texto aqui", textColor: "#6b7280" },
      noteNode: { label: "Nota aqui...", bgColor: "#fef9c3", borderColor: "#fde68a", textColor: "#854d0e" },
    };

    const viewport = reactFlowInstance.getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

    const newNode: Node = {
      id,
      type,
      position: { x: centerX + Math.random() * 40 - 20, y: centerY + Math.random() * 40 - 20 },
      data: defaultData[type] || { label: "Novo" },
    };
    setNodes((nds) => [...nds, newNode]);
    setHasChanges(true);
  }, [reactFlowInstance]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setHasChanges(true);
  }, [selectedNode]);

  const handleSave = useCallback(async () => {
    if (!flowchartId) return;
    setIsSaving(true);
    try {
      const viewport = reactFlowInstance.getViewport();
      await apiRequest("PATCH", `/api/flowcharts/${flowchartId}`, {
        nodesData: JSON.stringify(nodes),
        edgesData: JSON.stringify(edges),
        viewport: JSON.stringify(viewport),
      });
      await apiRequest("POST", `/api/flowcharts/${flowchartId}/versions`, {
        createdBy: currentUser?.id,
        snapshotJson: JSON.stringify({ nodes, edges, viewport }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", flowchartId, "versions"] });
      setHasChanges(false);
      toast({ title: "Fluxograma salvo com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [flowchartId, nodes, edges, reactFlowInstance, currentUser]);

  const handleExportPNG = useCallback(() => {
    const flowEl = document.querySelector(".react-flow") as HTMLElement;
    if (!flowEl) return;
    import("html2canvas").then(({ default: html2canvas }) => {
      html2canvas(flowEl, { backgroundColor: "#ffffff", scale: 2 }).then((canvas) => {
        const link = document.createElement("a");
        link.download = `${flowchart?.title || "fluxograma"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    });
  }, [flowchart]);

  const addComment = useMutation({
    mutationFn: async () => {
      if (!commentText.trim() || !flowchartId) return;
      await apiRequest("POST", `/api/flowcharts/${flowchartId}/comments`, {
        userId: currentUser?.id,
        message: commentText,
        nodeId: selectedNode?.id || null,
      });
    },
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      toast({ title: "Comentário adicionado!" });
    },
  });

  const restoreVersion = useCallback(async (version: FlowchartVersion) => {
    try {
      const snapshot = JSON.parse(version.snapshotJson);
      setNodes(snapshot.nodes || []);
      setEdges(snapshot.edges || []);
      if (snapshot.viewport) {
        reactFlowInstance.setViewport(snapshot.viewport);
      }
      setHasChanges(true);
      toast({ title: `Versão ${version.versionNumber} restaurada` });
    } catch {
      toast({ title: "Erro ao restaurar versão", variant: "destructive" });
    }
  }, [reactFlowInstance]);

  const fitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="w-96 h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="flowchart-editor">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4 gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back-flowchart">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Workflow className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm truncate max-w-[200px]" data-testid="text-editor-title">
              {flowchart?.title || "Fluxograma"}
            </span>
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">Não salvo</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportPNG} data-testid="button-export-png">
              <Download className="h-4 w-4 mr-1" />
              PNG
            </Button>
            <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-open-comments">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Comentários
                  {comments && comments.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{comments.length}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent data-testid="sheet-comments">
                <SheetHeader>
                  <SheetTitle>Comentários</SheetTitle>
                  <SheetDescription>Discussões sobre este fluxograma</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-4 h-[calc(100vh-200px)]">
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {(!comments || comments.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário ainda</p>
                    )}
                    {comments?.map((c) => (
                      <div key={c.id} className="p-3 rounded-md bg-muted/50 border" data-testid={`comment-${c.id}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">{c.userId?.substring(0, 8)}</Badge>
                          {c.nodeId && <Badge variant="outline" className="text-xs">Nó: {c.nodeId.substring(0, 8)}</Badge>}
                        </div>
                        <p className="text-sm">{c.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar comentário..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment.mutate()}
                      data-testid="input-comment"
                    />
                    <Button size="icon" onClick={() => addComment.mutate()} disabled={!commentText.trim()} data-testid="button-send-comment">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-open-versions">
                  <History className="h-4 w-4 mr-1" />
                  Versões
                </Button>
              </SheetTrigger>
              <SheetContent data-testid="sheet-versions">
                <SheetHeader>
                  <SheetTitle>Histórico de Versões</SheetTitle>
                  <SheetDescription>Restaure versões anteriores do fluxograma</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3 overflow-y-auto h-[calc(100vh-200px)]">
                  {(!versions || versions.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma versão salva ainda</p>
                  )}
                  {versions?.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30" data-testid={`version-${v.id}`}>
                      <div>
                        <p className="text-sm font-medium">Versão {v.versionNumber}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {v.createdAt ? new Date(v.createdAt).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => restoreVersion(v)} data-testid={`button-restore-version-${v.id}`}>
                        Restaurar
                      </Button>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges} data-testid="button-save-flowchart">
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 border-r border-border bg-background flex flex-col items-center py-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="Retângulo (Processo)"
            onClick={() => addNode("rectangle")}
            data-testid="button-add-rectangle"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Elipse (Início/Fim)"
            onClick={() => addNode("ellipse")}
            data-testid="button-add-ellipse"
          >
            <Circle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Losango (Decisão)"
            onClick={() => addNode("diamond")}
            data-testid="button-add-diamond"
          >
            <Diamond className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button
            variant="ghost"
            size="icon"
            title="Texto"
            onClick={() => addNode("textNode")}
            data-testid="button-add-text"
          >
            <Type className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Nota"
            onClick={() => addNode("noteNode")}
            data-testid="button-add-note"
          >
            <StickyNote className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button
            variant="ghost"
            size="icon"
            title="Ajustar à tela"
            onClick={fitView}
            data-testid="button-fit-view"
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
              style: { strokeWidth: 2, stroke: "#6b7280" },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} data-testid="flow-controls" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="rounded-md border"
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div className="w-72 border-l border-border bg-background p-4 overflow-y-auto" data-testid="panel-node-properties">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Propriedades</h3>
              <Button variant="ghost" size="icon" onClick={deleteSelectedNode} data-testid="button-delete-node">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Texto</label>
                <Input
                  value={nodeLabel}
                  onChange={(e) => setNodeLabel(e.target.value)}
                  placeholder="Texto do elemento"
                  data-testid="input-node-label"
                />
              </div>
              {selectedNode.type !== "textNode" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                  <Textarea
                    value={nodeDescription}
                    onChange={(e) => setNodeDescription(e.target.value)}
                    placeholder="Descrição (opcional)"
                    rows={2}
                    data-testid="input-node-description"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  <Palette className="h-3 w-3 inline mr-1" />
                  Cor
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {NODE_COLORS.map((color) => (
                    <button
                      key={color.name}
                      className={cn(
                        "w-full h-8 rounded-md border-2 transition-all",
                        nodeColor.name === color.name ? "ring-2 ring-primary ring-offset-1" : ""
                      )}
                      style={{ backgroundColor: color.bg, borderColor: color.border }}
                      onClick={() => setNodeColor(color)}
                      title={color.name}
                      data-testid={`button-color-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Tipo: <Badge variant="outline" className="text-xs">{selectedNode.type}</Badge></p>
                <p className="mt-1">ID: {selectedNode.id.substring(0, 12)}...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlowchartEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowchartEditorInner />
    </ReactFlowProvider>
  );
}
