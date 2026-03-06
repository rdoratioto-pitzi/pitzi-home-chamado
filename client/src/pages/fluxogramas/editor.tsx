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
  Handle,
  Position,
  NodeResizer,
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

const handleStyle = {
  width: 10,
  height: 10,
  backgroundColor: "#00A137",
  border: "2px solid white",
  borderRadius: "50%",
  opacity: 0,
  transition: "opacity 0.15s",
};

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Top} id="top-source" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Left} id="left-source" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Right} id="right-target" style={handleStyle} className="!opacity-0 group-hover:!opacity-100" />
    </>
  );
}

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
  Star,
  Triangle,
  ChevronRight,
  MessageCircle,
  Database,
  Columns,
  Presentation,
  Users,
  ToggleLeft,
  ToggleRight,
  Plus,
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
    <div className="group relative">
      <NodeResizer minWidth={100} minHeight={40} isVisible={selected} />
      <div
        className={cn(
          "px-4 py-3 rounded-md border-2 w-full h-full min-w-[140px] text-center shadow-sm transition-shadow flex flex-col justify-center",
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
      <NodeHandles />
    </div>
  );
}

function EllipseNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative">
      <NodeResizer minWidth={100} minHeight={40} isVisible={selected} />
      <div
        className={cn(
          "px-6 py-3 rounded-full border-2 w-full h-full min-w-[140px] text-center shadow-sm flex items-center justify-center",
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
      <NodeHandles />
    </div>
  );
}

function DiamondNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative">
      <NodeResizer minWidth={100} minHeight={100} isVisible={selected} />
      <div
        className={cn(
          "flex items-center justify-center w-full h-full",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <div
          className="w-full h-full border-2 flex items-center justify-center shadow-sm"
          style={{
            transform: "rotate(45deg)",
            backgroundColor: data.bgColor || "#fef9c3",
            borderColor: data.borderColor || "#eab308",
          }}
        >
          <div
            className="text-xs font-medium text-center max-w-[80%]"
            style={{ transform: "rotate(-45deg)", color: data.textColor || "#854d0e" }}
          >
            {data.label || "Decisão"}
          </div>
        </div>
      </div>
      <NodeHandles />
    </div>
  );
}

function TextNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative">
      <NodeResizer minWidth={50} minHeight={30} isVisible={selected} />
      <div
        className={cn(
          "px-3 py-2 w-full h-full min-w-[100px]",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <div className="text-sm h-full w-full" style={{ color: data.textColor || "#6b7280" }}>
          {data.label || "Texto"}
        </div>
      </div>
      <NodeHandles />
    </div>
  );
}

function NoteNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={100} minHeight={60} isVisible={selected} />
      <div
        className={cn(
          "px-4 py-3 rounded-md border w-full h-full min-w-[160px] shadow-sm flex flex-col",
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
        <div className="text-xs flex-1">{data.label || "Adicione uma nota..."}</div>
      </div>
      <NodeHandles />
    </div>
  );
}

function StarNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={60} minHeight={60} isVisible={selected} />
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full preserve-aspect-ratio">
          <polygon
            points="50,5 63,38 98,38 70,60 80,95 50,73 20,95 30,60 2,38 37,38"
            fill={data.bgColor || "#fef9c3"}
            stroke={data.borderColor || "#eab308"}
            strokeWidth="3"
          />
          <text x="50" y="55" textAnchor="middle" fontSize="10" fill={data.textColor || "#854d0e"} fontWeight="500">
            {(data.label || "Estrela").substring(0, 12)}
          </text>
        </svg>
      </div>
      <NodeHandles />
    </div>
  );
}

function TriangleNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={60} minHeight={60} isVisible={selected} />
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <svg viewBox="0 0 120 100" className="w-full h-full preserve-aspect-ratio">
          <polygon
            points="60,5 115,95 5,95"
            fill={data.bgColor || "#dbeafe"}
            stroke={data.borderColor || "#3b82f6"}
            strokeWidth="3"
          />
          <text x="60" y="70" textAnchor="middle" fontSize="11" fill={data.textColor || "#1e40af"} fontWeight="500">
            {(data.label || "Alerta").substring(0, 12)}
          </text>
        </svg>
      </div>
      <NodeHandles />
    </div>
  );
}

function ChevronNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={80} minHeight={30} isVisible={selected} />
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <svg viewBox="0 0 160 50" className="w-full h-full preserve-aspect-ratio">
          <polygon
            points="0,0 130,0 160,25 130,50 0,50 30,25"
            fill={data.bgColor || "#dcfce7"}
            stroke={data.borderColor || "#22c55e"}
            strokeWidth="2"
          />
          <text x="80" y="30" textAnchor="middle" fontSize="11" fill={data.textColor || "#166534"} fontWeight="500">
            {(data.label || "Etapa").substring(0, 16)}
          </text>
        </svg>
      </div>
      <NodeHandles />
    </div>
  );
}

function BubbleNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={100} minHeight={40} isVisible={selected} />
      <div
        className={cn(
          "px-4 py-3 rounded-2xl border-2 w-full h-full min-w-[140px] text-center shadow-sm relative flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2"
        )}
        style={{
          backgroundColor: data.bgColor || "#f3e8ff",
          borderColor: data.borderColor || "#a855f7",
          color: data.textColor || "#6b21a8",
        }}
      >
        <div className="text-sm font-medium">{data.label || "Comentário"}</div>
        <div
          className="absolute -bottom-2 left-6 w-4 h-4 border-b-2 border-r-2 rotate-45"
          style={{
            backgroundColor: data.bgColor || "#f3e8ff",
            borderColor: data.borderColor || "#a855f7",
          }}
        />
      </div>
      <NodeHandles />
    </div>
  );
}

function CylinderNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={80} minHeight={60} isVisible={selected} />
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <svg viewBox="0 0 120 80" className="w-full h-full preserve-aspect-ratio">
          <ellipse cx="60" cy="15" rx="55" ry="12" fill={data.bgColor || "#dbeafe"} stroke={data.borderColor || "#3b82f6"} strokeWidth="2" />
          <rect x="5" y="15" width="110" height="50" fill={data.bgColor || "#dbeafe"} stroke="none" />
          <line x1="5" y1="15" x2="5" y2="65" stroke={data.borderColor || "#3b82f6"} strokeWidth="2" />
          <line x1="115" y1="15" x2="115" y2="65" stroke={data.borderColor || "#3b82f6"} strokeWidth="2" />
          <ellipse cx="60" cy="65" rx="55" ry="12" fill={data.bgColor || "#dbeafe"} stroke={data.borderColor || "#3b82f6"} strokeWidth="2" />
          <text x="60" y="45" textAnchor="middle" fontSize="11" fill={data.textColor || "#1e40af"} fontWeight="500">
            {(data.label || "Banco de Dados").substring(0, 14)}
          </text>
        </svg>
      </div>
      <NodeHandles />
    </div>
  );
}

function ParallelogramNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className="group relative h-full w-full">
      <NodeResizer minWidth={100} minHeight={40} isVisible={selected} />
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          selected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <svg viewBox="0 0 160 50" className="w-full h-full preserve-aspect-ratio">
          <polygon
            points="20,0 160,0 140,50 0,50"
            fill={data.bgColor || "#ffffff"}
            stroke={data.borderColor || "#d1d5db"}
            strokeWidth="2"
          />
          <text x="80" y="30" textAnchor="middle" fontSize="11" fill={data.textColor || "#1f2937"} fontWeight="500">
            {(data.label || "Entrada/Saída").substring(0, 16)}
          </text>
        </svg>
      </div>
      <NodeHandles />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  rectangle: RectangleNode,
  ellipse: EllipseNode,
  diamond: DiamondNode,
  textNode: TextNode,
  noteNode: NoteNode,
  starNode: StarNode,
  triangleNode: TriangleNode,
  chevronNode: ChevronNode,
  bubbleNode: BubbleNode,
  cylinderNode: CylinderNode,
  parallelogramNode: ParallelogramNode,
};

function CollaboratorsDialog({
  open,
  onOpenChange,
  flowchartId,
  flowchart,
  allUsers,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowchartId: string;
  flowchart: Flowchart | undefined;
  allUsers: any[];
  currentUserId?: string;
}) {
  const { toast } = useToast();
  const [searchUser, setSearchUser] = useState("");
  const [selectedRole, setSelectedRole] = useState<"view" | "edit" | "comment">("edit");

  const currentPermissions: Record<string, string> = useMemo(() => {
    try {
      if (flowchart?.permissions) return JSON.parse(flowchart.permissions);
    } catch {}
    return {};
  }, [flowchart?.permissions]);

  const collaboratorIds = Object.keys(currentPermissions);

  const addCollaborator = useMutation({
    mutationFn: async (userId: string) => {
      const newPerms = { ...currentPermissions, [userId]: selectedRole };
      await apiRequest("PATCH", `/api/flowcharts/${flowchartId}`, {
        permissions: JSON.stringify(newPerms),
      });
      const user = allUsers.find((u: any) => u.id === userId);
      if (user?.email) {
        try {
          await apiRequest("POST", `/api/flowcharts/${flowchartId}/notify-collaborator`, {
            userId,
            role: selectedRole,
          });
        } catch {}
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", flowchartId] });
      toast({ title: "Colaborador adicionado com sucesso!" });
      setSearchUser("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar colaborador", description: err.message, variant: "destructive" });
    },
  });

  const removeCollaborator = useMutation({
    mutationFn: async (userId: string) => {
      const newPerms = { ...currentPermissions };
      delete newPerms[userId];
      await apiRequest("PATCH", `/api/flowcharts/${flowchartId}`, {
        permissions: JSON.stringify(newPerms),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", flowchartId] });
      toast({ title: "Colaborador removido" });
    },
  });

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter(
        (u: any) =>
          u.status === "active" &&
          u.id !== currentUserId &&
          u.id !== flowchart?.ownerId &&
          !collaboratorIds.includes(u.id) &&
          (u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchUser.toLowerCase()))
      )
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 8);
  }, [allUsers, searchUser, collaboratorIds, currentUserId, flowchart?.ownerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-collaborators">
        <DialogHeader>
          <DialogTitle>Gerenciar Colaboradores</DialogTitle>
          <DialogDescription>Adicione ou remova pessoas que podem acessar este fluxograma</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Adicionar colaborador</label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                data-testid="input-search-collaborator"
              />
              <select
                className="border rounded-md px-2 text-sm bg-background"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                data-testid="select-collaborator-role"
              >
                <option value="edit">Editor</option>
                <option value="view">Visualizar</option>
                <option value="comment">Comentar</option>
              </select>
            </div>
            {searchUser && filteredUsers.length > 0 && (
              <div className="mt-2 border rounded-md max-h-32 overflow-y-auto">
                {filteredUsers.map((u: any) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                    onClick={() => addCollaborator.mutate(u.id)}
                    data-testid={`button-add-collaborator-${u.id}`}
                  >
                    <div>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Colaboradores atuais</label>
            <div className="space-y-2">
              {flowchart?.ownerId && (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {allUsers.find((u: any) => u.id === flowchart.ownerId)?.name || "Proprietário"}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">Proprietário</Badge>
                </div>
              )}
              {collaboratorIds.map((userId) => {
                const user = allUsers.find((u: any) => u.id === userId);
                const role = currentPermissions[userId];
                const roleLabel = role === "edit" ? "Editor" : role === "view" ? "Visualizar" : "Comentar";
                return (
                  <div key={userId} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{user?.name || userId.substring(0, 8)}</span>
                      <Badge variant="outline" className="text-xs">{roleLabel}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCollaborator.mutate(userId)}
                      data-testid={`button-remove-collaborator-${userId}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              {collaboratorIds.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum colaborador adicionado</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);
  const [showMoreShapes, setShowMoreShapes] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);

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

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
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

  const onConnect: OnConnect = useCallback(
    (params) => {
      const newEdge: Edge = {
        ...params,
        id: `edge_${Date.now()}`,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
        style: { strokeWidth: 2, stroke: "#6b7280" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setHasChanges(true);
    },
    [setEdges]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setSelectedNode(null);

    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === edge.id) {
          // Cycle arrow directions: A->B (End), B->A (Start), A<->B (Both), none
          const hasStart = !!e.markerStart;
          const hasEnd = !!e.markerEnd;

          let nextState;
          if (!hasStart && hasEnd) nextState = "B->A";
          else if (hasStart && !hasEnd) nextState = "A<->B";
          else if (hasStart && hasEnd) nextState = "none";
          else nextState = "A->B";

          const marker = { type: MarkerType.ArrowClosed, color: (e.style as any)?.stroke || "#6b7280" };

          switch (nextState) {
            case "B->A":
              return { ...e, markerStart: marker, markerEnd: undefined };
            case "A<->B":
              return { ...e, markerStart: marker, markerEnd: marker };
            case "none":
              return { ...e, markerStart: undefined, markerEnd: undefined };
            default: // A->B
              return { ...e, markerStart: undefined, markerEnd: marker };
          }
        }
        return e;
      })
    );
    setHasChanges(true);
  }, [setEdges]);

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
    setSelectedEdge(null);
  }, []);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    setSelectedEdge(null);
    setHasChanges(true);
  }, [selectedEdge]);

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
      starNode: { label: "Estrela", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" },
      triangleNode: { label: "Alerta", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" },
      chevronNode: { label: "Etapa", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" },
      bubbleNode: { label: "Comentário", bgColor: "#f3e8ff", borderColor: "#a855f7", textColor: "#6b21a8" },
      cylinderNode: { label: "Banco de Dados", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" },
      parallelogramNode: { label: "Entrada/Saída", bgColor: "#ffffff", borderColor: "#d1d5db", textColor: "#1f2937" },
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

  const enterPresentationMode = useCallback(() => {
    setPresentationMode(true);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.1 });
    }, 100);
  }, [reactFlowInstance]);

  const exitPresentationMode = useCallback(() => {
    setPresentationMode(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && presentationMode) {
        exitPresentationMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presentationMode, exitPresentationMode]);

  const handleCommentInput = useCallback((value: string) => {
    setCommentText(value);
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex >= 0) {
      const afterAt = value.substring(lastAtIndex + 1);
      const hasSpace = afterAt.includes(" ");
      if (!hasSpace && afterAt.length >= 0) {
        setShowMentions(true);
        setMentionQuery(afterAt.toLowerCase());
        setMentionCursorPos(lastAtIndex);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  const insertMention = useCallback((userName: string) => {
    const beforeAt = commentText.substring(0, mentionCursorPos);
    const afterAt = commentText.substring(mentionCursorPos);
    const afterMentionText = afterAt.replace(/@[^\s]*/, "");
    setCommentText(`${beforeAt}@${userName} ${afterMentionText}`);
    setShowMentions(false);
  }, [commentText, mentionCursorPos]);

  const filteredMentionUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((u: any) =>
      u.status === "active" &&
      (u.name?.toLowerCase().includes(mentionQuery) ||
      u.email?.toLowerCase().includes(mentionQuery))
    ).slice(0, 5);
  }, [allUsers, mentionQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="w-96 h-64" />
      </div>
    );
  }

  if (presentationMode) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white" data-testid="presentation-mode">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
            style: { strokeWidth: 2, stroke: "#6b7280" },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="absolute top-4 right-4 z-50">
          <Button onClick={exitPresentationMode} variant="outline" data-testid="button-exit-presentation">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Sair da Apresentação
          </Button>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            {flowchart?.title || "Fluxograma"} — Pressione ESC para sair
          </Badge>
        </div>
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
            <Button variant="outline" size="sm" onClick={enterPresentationMode} data-testid="button-presentation">
              <Presentation className="h-4 w-4 mr-1" />
              Apresentar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPNG} data-testid="button-export-png">
              <Download className="h-4 w-4 mr-1" />
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCollaboratorsOpen(true)} data-testid="button-collaborators">
              <Users className="h-4 w-4 mr-1" />
              Colaboradores
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
                    {comments?.map((c) => {
                      const commentUser = allUsers?.find((u: any) => u.id === c.userId);
                      return (
                        <div key={c.id} className="p-3 rounded-md bg-muted/50 border" data-testid={`comment-${c.id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{commentUser?.name || c.userId?.substring(0, 8)}</Badge>
                            {c.nodeId && <Badge variant="outline" className="text-xs">Nó: {c.nodeId.substring(0, 8)}</Badge>}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString("pt-BR") : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="relative">
                    {showMentions && filteredMentionUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 border rounded-md bg-background shadow-lg z-50 max-h-40 overflow-y-auto" data-testid="mentions-dropdown">
                        {filteredMentionUsers.map((u: any) => (
                          <button
                            key={u.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2"
                            onClick={() => insertMention(u.name)}
                            data-testid={`mention-user-${u.id}`}
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Comentar... Use @ para mencionar"
                        value={commentText}
                        onChange={(e) => handleCommentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !showMentions) addComment.mutate();
                        }}
                        data-testid="input-comment"
                      />
                      <Button size="icon" onClick={() => addComment.mutate()} disabled={!commentText.trim()} data-testid="button-send-comment">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
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

      <CollaboratorsDialog
        open={collaboratorsOpen}
        onOpenChange={setCollaboratorsOpen}
        flowchartId={flowchartId || ""}
        flowchart={flowchart}
        allUsers={allUsers || []}
        currentUserId={currentUser?.id}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 border-r border-border bg-background flex flex-col items-center py-3 gap-1 overflow-y-auto">
          <Button variant="ghost" size="icon" title="Retângulo (Processo)" onClick={() => addNode("rectangle")} data-testid="button-add-rectangle">
            <Square className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Elipse (Início/Fim)" onClick={() => addNode("ellipse")} data-testid="button-add-ellipse">
            <Circle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Losango (Decisão)" onClick={() => addNode("diamond")} data-testid="button-add-diamond">
            <Diamond className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button variant="ghost" size="icon" title="Estrela" onClick={() => addNode("starNode")} data-testid="button-add-star">
            <Star className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Triângulo (Alerta)" onClick={() => addNode("triangleNode")} data-testid="button-add-triangle">
            <Triangle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Seta (Etapa)" onClick={() => addNode("chevronNode")} data-testid="button-add-chevron">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Balão (Comentário)" onClick={() => addNode("bubbleNode")} data-testid="button-add-bubble">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button variant="ghost" size="icon" title="Banco de Dados" onClick={() => addNode("cylinderNode")} data-testid="button-add-cylinder">
            <Database className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Entrada/Saída" onClick={() => addNode("parallelogramNode")} data-testid="button-add-parallelogram">
            <Columns className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button variant="ghost" size="icon" title="Texto" onClick={() => addNode("textNode")} data-testid="button-add-text">
            <Type className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Nota" onClick={() => addNode("noteNode")} data-testid="button-add-note">
            <StickyNote className="h-5 w-5" />
          </Button>
          <Separator className="my-1 w-8" />
          <Button variant="ghost" size="icon" title="Ajustar à tela" onClick={fitView} data-testid="button-fit-view">
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
            onEdgeClick={onEdgeClick}
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

        {selectedEdge && (
          <div className="w-72 border-l border-border bg-background p-4 overflow-y-auto" data-testid="panel-edge-properties">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Propriedades da Conexão</h3>
              <Button variant="ghost" size="icon" onClick={deleteSelectedEdge} data-testid="button-delete-edge">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Seta de Direção</label>
                <div className="p-2 border rounded-md bg-muted/30 text-xs flex items-center justify-between mb-2">
                  <span>
                    {!selectedEdge.markerStart && selectedEdge.markerEnd ? "A → B" :
                     selectedEdge.markerStart && !selectedEdge.markerEnd ? "B → A" :
                     selectedEdge.markerStart && selectedEdge.markerEnd ? "A ↔ B" :
                     "Sem Seta"}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={(e) => onEdgeClick(e as any, selectedEdge)}>
                    Alternar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Dica: Clique diretamente na seta no gráfico para alternar o sentido rapidamente.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Tipo: <Badge variant="outline" className="text-xs">Conexão</Badge></p>
                <p className="mt-1">De: {selectedEdge.source.substring(0, 12)}...</p>
                <p>Para: {selectedEdge.target.substring(0, 12)}...</p>
              </div>
            </div>
          </div>
        )}

        {selectedNode && !selectedEdge && (
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
