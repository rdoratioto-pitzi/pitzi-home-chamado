import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpDown, 
  LayoutGrid, 
  List,
  Download,
  Ban,
  Trello,
  MoreHorizontal,
  Edit,
  Trash2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Ticket, User } from "@shared/schema";
import { TicketDialog } from "./ticket-dialog";
import { TicketDetailSheet } from "./ticket-detail-sheet";
import { TicketKanban } from "./ticket-kanban";
import { Skeleton } from "@/components/ui/skeleton";

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
  resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  blocked: "Bloqueado",
  resolved: "Resolvido",
  closed: "Fechado",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const typeLabels: Record<string, string> = {
  bug: "Bug",
  melhoria: "Melhoria",
  negocio: "Negócio",
};

const typeColors: Record<string, string> = {
  bug: "bg-red-500/10 text-red-600 dark:text-red-400",
  melhoria: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  negocio: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function ChamadosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateSortAsc, setDateSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "grid">("list");

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { toast } = useToast();

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tickets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Chamado excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir chamado", variant: "destructive" });
    },
  });

  const filteredTickets = tickets
    .filter((ticket) => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.code?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesType = typeFilter === "all" || ticket.type === typeFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateSortAsc ? dateA - dateB : dateB - dateA;
    });

  const getUser = (userId: string | null) => users.find(u => u.id === userId);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    blocked: tickets.filter(t => t.status === "blocked").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  const exportToExcel = () => {
    const headers = [
      "Código",
      "Título",
      "Descrição",
      "Categoria",
      "Tipo",
      "Local",
      "Prioridade",
      "Status",
      "Solicitante",
      "Responsável",
      "Data de Criação",
    ];

    const rows = filteredTickets.map((ticket) => {
      const requester = getUser(ticket.requesterId);
      const assignee = getUser(ticket.assigneeId || null);
      return [
        ticket.code || "",
        ticket.title,
        ticket.description,
        ticket.category,
        typeLabels[ticket.type || "bug"] || ticket.type,
        ticket.location || "",
        priorityLabels[ticket.priority],
        statusLabels[ticket.status],
        requester?.name || "",
        assignee?.name || "",
        ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("pt-BR") : "",
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chamados_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Gestão de Chamados" 
        breadcrumbs={[{ label: "Chamados" }]}
        actions={
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Novo Chamado
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Total</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tickets">{stats.total}</div>
              <p className="text-[11px] text-muted-foreground mt-1">chamados registrados</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Abertos</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-open-tickets">{stats.open}</div>
              <p className="text-[11px] text-muted-foreground mt-1">aguardando</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-progress-tickets">{stats.inProgress}</div>
              <p className="text-[11px] text-muted-foreground mt-1">sendo resolvidos</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Bloqueados</CardTitle>
              <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-blocked-tickets">{stats.blocked}</div>
              <p className="text-[11px] text-muted-foreground mt-1">impedidos</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Resolvidos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-resolved-tickets">{stats.resolved}</div>
              <p className="text-[11px] text-muted-foreground mt-1">concluídos</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-4 px-6 pt-6 border-b border-border/50">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="text-[18px] font-bold tracking-tight">Chamados</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-3 text-[12px] font-bold"
                  onClick={exportToExcel}
                  data-testid="button-export-excel"
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Exportar CSV
                </Button>
                <div className="flex items-center border rounded-lg p-1 bg-muted/50">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "kanban" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode("kanban")}
                    data-testid="button-view-kanban"
                  >
                    <Trello className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar chamados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-[13px]"
                  data-testid="input-search-tickets"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-10 text-[13px]" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abertos</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="blocked">Bloqueados</SelectItem>
                    <SelectItem value="resolved">Resolvidos</SelectItem>
                    <SelectItem value="closed">Fechados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-10 text-[13px]" data-testid="select-priority-filter">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[120px] h-10 text-[13px]" data-testid="select-type-filter">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="melhoria">Melhoria</SelectItem>
                    <SelectItem value="negocio">Negócio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum chamado encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  {tickets.length === 0 
                    ? "Crie seu primeiro chamado clicando no botão acima"
                    : "Tente ajustar os filtros de busca"}
                </p>
              </div>
            ) : viewMode === "kanban" ? (
              <TicketKanban 
                tickets={filteredTickets} 
                users={users}
                onTicketClick={setSelectedTicket}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] text-[12px] font-bold uppercase tracking-wider">Código</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Título</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Categoria</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Local</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Prioridade</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateSortAsc(!dateSortAsc);
                        }}
                        data-testid="button-sort-date"
                      >
                        Data
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[60px] text-[12px] font-bold uppercase tracking-wider">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => {
                    return (
                      <TableRow 
                        key={ticket.id} 
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedTicket(ticket)}
                        data-testid={`row-ticket-${ticket.id}`}
                      >
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[11px] font-bold">
                            {ticket.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-[13px] max-w-[200px] truncate">
                          {ticket.title}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{ticket.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${typeColors[ticket.type || "bug"]} text-[10px] font-bold uppercase tracking-wider`}>
                            {typeLabels[ticket.type || "bug"]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">{ticket.location}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusColors[ticket.status]} text-[10px] font-bold uppercase tracking-wider`}>
                            {statusLabels[ticket.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${priorityColors[ticket.priority]} text-[10px] font-bold uppercase tracking-wider`}>
                            {priorityLabels[ticket.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7" 
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-ticket-menu-${ticket.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(ticket);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTicketMutation.mutate(ticket.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <TicketDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <TicketDetailSheet ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
}
