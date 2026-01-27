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
import { Plus, Search, Filter, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Ticket } from "@shared/schema";
import { TicketDialog } from "./ticket-dialog";
import { TicketDetailSheet } from "./ticket-detail-sheet";
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
  resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export default function ChamadosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tickets">{stats.total}</div>
              <p className="text-xs text-muted-foreground">chamados registrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abertos</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-open-tickets">{stats.open}</div>
              <p className="text-xs text-muted-foreground">aguardando atendimento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-progress-tickets">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">sendo resolvidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-resolved-tickets">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">concluídos com sucesso</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Chamados</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar chamados..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                    data-testid="input-search-tickets"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abertos</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="resolved">Resolvidos</SelectItem>
                    <SelectItem value="closed">Fechados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`row-ticket-${ticket.id}`}
                    >
                      <TableCell className="font-medium">{ticket.title}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[ticket.status]}>
                          {statusLabels[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityColors[ticket.priority]}>
                          {priorityLabels[ticket.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
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
