import * as XLSX from "xlsx";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
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
  BarChart3,
  LayoutGrid,
  List,
  Download,
  Ban,
  Trello,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check
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
import type { Ticket, User, SlaRule } from "@shared/schema";
import { TicketKanban } from "./ticket-kanban";
import { CSATAnalytics } from "./csat-analytics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

// Helper function to get type color based on type value
const getTypeColor = (type: string): string => {
  const lowerType = type?.toLowerCase() || "";
  if (lowerType.includes("bug")) return "bg-red-500/10 text-red-600 dark:text-red-400";
  if (lowerType.includes("melhoria")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (lowerType.includes("negócio") || lowerType.includes("negocio")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
};

import { format, addHours, isWeekend, isBefore, addDays, getHours, setHours, setMinutes, setSeconds, addBusinessDays, isAfter, subHours } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";
const WORK_START_HOUR = 8;
const WORK_HOURS_PER_DAY = 8;

function calculateBusinessSLADeadline(createdAt: Date, slaHours: number): Date {
  // Use UTC base for calculations to avoid local JS timezone offsets
  const zonedCreated = toZonedTime(createdAt, TIMEZONE);
  let current = new Date(zonedCreated);

  // If created before 08:00, move to 08:00 of the same day
  if (getHours(current) < WORK_START_HOUR) {
    current = setHours(setMinutes(setSeconds(current, 0), 0), WORK_START_HOUR);
  }

  // If created after 16:00 (WORK_START_HOUR + WORK_HOURS_PER_DAY), move to next business day at 08:00
  if (getHours(current) >= WORK_START_HOUR + WORK_HOURS_PER_DAY) {
    current = addBusinessDays(setHours(setMinutes(setSeconds(current, 0), 0), WORK_START_HOUR), 1);
  }

  // Ensure we are not on a weekend
  if (isWeekend(current)) {
    current = addBusinessDays(current, 1);
    current = setHours(setMinutes(setSeconds(current, 0), 0), WORK_START_HOUR);
  }

  const fullDays = Math.floor(slaHours / WORK_HOURS_PER_DAY);
  const remainingHours = slaHours % WORK_HOURS_PER_DAY;

  // Add full business days
  let deadline = addBusinessDays(current, fullDays);

  // Calculate hours remaining in the current business day
  const currentHour = getHours(deadline);
  const hoursLeftInDay = (WORK_START_HOUR + WORK_HOURS_PER_DAY) - currentHour;

  if (remainingHours <= hoursLeftInDay) {
    deadline = addHours(deadline, remainingHours);
  } else {
    // Move to next business day and add the spillover hours
    deadline = addBusinessDays(setHours(setMinutes(setSeconds(deadline, 0), 0), WORK_START_HOUR), 1);
    deadline = addHours(deadline, remainingHours - hoursLeftInDay);
  }

  return deadline;
}

// Helper function to format date for display in PT-BR accounting for timezone
const formatDisplayDate = (date: Date | string | null): string => {
  if (!date) return "-";
  // The date from the database might be interpreted as UTC or local depending on the driver
  // We want to force it to show the date correctly for Sao Paulo
  const d = new Date(date);
  return format(toZonedTime(d, TIMEZONE), "dd/MM/yyyy");
};

// Helper function to calculate business hours between two dates
const calculateBusinessHours = (start: Date, end: Date): number => {
  let totalHours = 0;
  let current = new Date(start);
  const endDate = new Date(end);

  while (current < endDate) {
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Check if we're within business hours (8:00 to 16:00)
    const currentHour = current.getHours();
    
    if (currentHour < WORK_START_HOUR) {
      // Before business hours, move to start of business day
      current.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    } else if (currentHour >= WORK_START_HOUR + WORK_HOURS_PER_DAY) {
      // After business hours, move to next business day
      current.setDate(current.getDate() + 1);
      current.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Calculate hours until end of day or end time
    const endOfBusinessDay = new Date(current);
    endOfBusinessDay.setHours(WORK_START_HOUR + WORK_HOURS_PER_DAY, 0, 0, 0);
    
    const timeUntilEndOfDay = endOfBusinessDay.getTime() - current.getTime();
    const timeUntilEndDate = endDate.getTime() - current.getTime();
    const hoursToAdd = Math.min(timeUntilEndOfDay, timeUntilEndDate) / (1000 * 60 * 60);

    totalHours += hoursToAdd;
    current = new Date(current.getTime() + Math.min(timeUntilEndOfDay, timeUntilEndDate));
  }

  return totalHours;
};

// Helper function to calculate time open with business hours
const calculateTimeOpen = (createdAt: Date | string | null): { text: string; colorClass: string } => {
  if (!createdAt) return { text: "-", colorClass: "text-muted-foreground" };

  const created = new Date(createdAt);
  const now = new Date();

  // Calculate business hours (8h per day, Monday to Friday)
  const businessHours = calculateBusinessHours(created, now);

  // Calculate full business days and remaining hours
  const businessDays = Math.floor(businessHours / WORK_HOURS_PER_DAY);
  const remainingHours = Math.round((businessHours % WORK_HOURS_PER_DAY) * 10) / 10; // Round to 1 decimal place

  let text: string;
  if (businessDays > 0) {
    // Format: "2d 4.5h" (2 days * 8h = 16h + 4.5h = 20.5h total business hours)
    text = `${businessDays}d ${remainingHours}h`;
  } else if (remainingHours > 0) {
    text = `${remainingHours}h`;
  } else {
    text = "0h";
  }

  // Color based on business hours
  let colorClass: string;
  if (businessHours < 24) {
    colorClass = "text-green-600 dark:text-green-400";
  } else if (businessHours < 72) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
  } else {
    colorClass = "text-red-600 dark:text-red-400";
  }

  return { text, colorClass };
};

// Helper function to get SLA for a ticket
const getSlaForTicket = (
  ticket: Ticket,
  slaRules: SlaRule[]
): { slaHoras: number | null; status: "dentro_prazo" | "em_atraso" | null } => {
  const tipo = ticket.type?.toLowerCase();
  
  // Buscar regra de SLA para qualquer tipo de ticket que tenha regra correspondente
  const rule = slaRules.find(
    r => r.tipo.toLowerCase() === tipo && r.prioridade === ticket.priority && r.ativo
  );

  if (!rule || !rule.slaHoras) {
    return { slaHoras: null, status: null };
  }

  const slaHoras = parseFloat(rule.slaHoras.toString());
  const createdAt = ticket.dataAbertura ? new Date(ticket.dataAbertura) : ticket.createdAt ? new Date(ticket.createdAt) : null;

  if (!createdAt) {
    return { slaHoras, status: null };
  }

  const deadline = calculateBusinessSLADeadline(createdAt, slaHoras);

  if (ticket.status === "closed" || ticket.status === "resolved") {
    if (ticket.dataResolucao) {
      const resolutionDate = new Date(ticket.dataResolucao);
      return isAfter(resolutionDate, deadline) ? { slaHoras, status: "em_atraso" } : { slaHoras, status: "dentro_prazo" };
    }
    return { slaHoras, status: "dentro_prazo" };
  }

  const now = new Date();
  return {
    slaHoras,
    status: isAfter(now, deadline) ? "em_atraso" : "dentro_prazo",
  };
};

type SortField = "code" | "title" | "category" | "priority" | "status" | "createdAt" | "requesterId";
type SortOrder = "asc" | "desc";

export default function ChamadosPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [periodFilter, setPeriodFilter] = useState<"month" | "year" | "total" | "previousMonth" | "execution">("year");
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "grid" | "analytics">("list");
  
  // Get current user info for admin check
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser?.isAdmin === true || currentUser?.isAdmin === "true" || currentUser?.perfilAcesso === "diretor";

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  useEffect(() => {
    // Clean URL if legacy query parameters exist
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: slaRules = [] } = useQuery<SlaRule[]>({
    queryKey: ["/api/slas"],
  });

  const { toast } = useToast();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

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

  const getUser = (userId: string | null) => users.find(u => u.id === userId);

  const getPeriodTickets = (allTickets: Ticket[]) => {
    return allTickets.filter(t => {
      if (periodFilter === "total") return true;
      const ticketDateStr = t.dataAbertura || t.createdAt;
      if (!ticketDateStr) return false;

      const date = new Date(ticketDateStr);
      const now = new Date();
      if (periodFilter === "month") {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (periodFilter === "previousMonth") {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear();
      }
      if (periodFilter === "year") {
        return date.getFullYear() === now.getFullYear();
      }
      if (periodFilter === "execution") {
        return t.status === "open" || t.status === "in_progress" || t.status === "blocked";
      }
      return true;
    });
  };

  const periodTickets = getPeriodTickets(tickets);

  const filteredTickets = periodTickets
    .filter((ticket) => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.code?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesType = typeFilter === "all" || (ticket.type || "").toLowerCase() === typeFilter.toLowerCase();
      const matchesAssignee = assigneeFilter === "all" || ticket.assigneeId === assigneeFilter;

      let matchesSla = true;
      if (slaFilter === "dentro_prazo" || slaFilter === "em_atraso") {
        // Só filtra SLA para chamados abertos ou em andamento
        if (ticket.status !== "open" && ticket.status !== "in_progress") {
          matchesSla = false;
        } else {
          const sla = getSlaForTicket(ticket, slaRules);
          matchesSla = sla.status === slaFilter;
        }
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesAssignee && matchesSla;
    })
    .sort((a, b) => {
      let valA: any = a[sortField as keyof Ticket];
      let valB: any = b[sortField as keyof Ticket];

      if (sortField === "createdAt") {
        // Ensure we compare the actual time to get precise sort, 
        // but display is handled by formatDisplayDate
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortField === "requesterId") {
        const userA = users.find(u => u.id === a.requesterId)?.name || "";
        const userB = users.find(u => u.id === b.requesterId)?.name || "";
        valA = userA.toLowerCase();
        valB = userB.toLowerCase();
      }

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const stats = {
    total: periodTickets.length,
    open: periodTickets.filter(t => t.status === "open").length,
    inProgress: periodTickets.filter(t => t.status === "in_progress").length,
    blocked: periodTickets.filter(t => t.status === "blocked").length,
    resolved: periodTickets.filter(t => t.status === "resolved").length,
    dentroPrazo: periodTickets.filter(t => {
      const sla = getSlaForTicket(t, slaRules);
      return sla.status === "dentro_prazo";
    }).length,
    emAtraso: periodTickets.filter(t => {
      if (t.status !== "open" && t.status !== "in_progress") return false;
      const sla = getSlaForTicket(t, slaRules);
      return sla.status === "em_atraso";
    }).length,
    historicalTotal: tickets.length,
  };

  // Calcular total de resolvidos no mês anterior (usando dataResolucao)
  const previousMonthResolved = useMemo(() => {
    if (periodFilter !== "previousMonth") return 0;
    
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return tickets.filter(t => {
      if (t.status !== "resolved" && t.status !== "closed") return false;
      const dataResolucao = t.dataResolucao ? new Date(t.dataResolucao) : null;
      if (!dataResolucao) return false;
      
      return dataResolucao.getMonth() === prevMonth.getMonth() &&
             dataResolucao.getFullYear() === prevMonth.getFullYear();
    }).length;
  }, [periodFilter, tickets]);

  // Calcular total de resolvidos nos últimos 30 dias (usado para "Em Tratativa")
  const last30DaysResolved = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return tickets.filter(t => {
      if (t.status !== "resolved" && t.status !== "closed") return false;
      const dataResolucao = t.dataResolucao ? new Date(t.dataResolucao) : null;
      if (!dataResolucao) return false;
      
      return dataResolucao >= thirtyDaysAgo && dataResolucao <= now;
    }).length;
  }, [tickets]);

  const openPerc = stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0;
  const inProgressPerc = stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const blockedPerc = stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100) : 0;
  const resolvedPerc = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const dentroPrazoPerc = stats.total > 0 ? Math.round((stats.dentroPrazo / stats.total) * 100) : 0;
  const emAtrasoPerc = stats.total > 0 ? Math.round((stats.emAtraso / stats.total) * 100) : 0;

  const MAX_EXCEL_CELL_LENGTH = 32767;

  const stripHtml = (html: string | undefined | null): string => {
    if (!html) return "";
    // Replace common HTML entities
    let text = html
      .replace(/&nbsp;/g, " ")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/'/g, "'");
    // Remove base64 images (data:image/...)
    text = text.replace(/<img[^>]*src=["']data:image\/[^"']*["'][^>]*>/gi, "");
    text = text.replace(/data:image\/[^;]+;base64,[^\s"']+/g, "");
    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, "");
    // Clean up multiple spaces and line breaks
    text = text.replace(/\s+/g, " ").trim();
    return text;
  };

  const truncateText = (text: string | undefined | null, maxLength: number = MAX_EXCEL_CELL_LENGTH): string => {
    if (!text) return "";
    const cleanText = stripHtml(text);
    return cleanText.length > maxLength ? cleanText.substring(0, maxLength) : cleanText;
  };

  const exportToExcel = () => {
    const data = filteredTickets.map((ticket) => {
      const requester = getUser(ticket.requesterId);
      const assignee = getUser(ticket.assigneeId || null);
      const timeOpen = calculateTimeOpen(ticket.createdAt);
      const slaInfo = getSlaForTicket(ticket, slaRules);
      return {
        "Código": ticket.code || "",
        "Título": truncateText(ticket.title),
        "Descrição": truncateText(ticket.description),
        "Categoria": ticket.category,
        "Tipo": ticket.type || "Bug",
        "Local": ticket.location || "",
        "Prioridade": priorityLabels[ticket.priority],
        "Status": statusLabels[ticket.status],
        "Solicitante": requester?.name || "",
        "Responsável": assignee?.name || "",
        "Abertura": ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("pt-BR") : "",
        "Resolução": ticket.dataResolucao ? new Date(ticket.dataResolucao).toLocaleDateString("pt-BR") : "",
        "Tempo Aberto": timeOpen.text,
        "SLA": slaInfo.slaHoras !== null ? `${slaInfo.slaHoras}h` : "—",
        "Status SLA": slaInfo.status === "dentro_prazo" ? "Dentro do Prazo" : slaInfo.status === "em_atraso" ? "Em Atraso" : "—",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chamados");
    XLSX.writeFile(workbook, `chamados_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleKpiClick = (type: "status" | "sla", value: string) => {
    if (type === "status") {
      setStatusFilter(value);
      setSlaFilter("all");
    } else {
      setStatusFilter("all");
      setSlaFilter(value);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Gestão de Chamados"
        breadcrumbs={[{ label: "Chamados" }]}
        actions={
          <Button onClick={() => setLocation("/chamados/novo")} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Novo Chamado
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/40">
            <Button
              variant={periodFilter === "month" ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-[12px] font-bold transition-all ${periodFilter === "month" ? "shadow-sm" : ""}`}
              onClick={() => setPeriodFilter("month")}
            >
              Mês Vigente
            </Button>
            <Button
              variant={periodFilter === "previousMonth" ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-[12px] font-bold transition-all ${periodFilter === "previousMonth" ? "shadow-sm" : ""}`}
              onClick={() => setPeriodFilter("previousMonth")}
            >
              Mês Anterior
            </Button>
            <Button
              variant={periodFilter === "year" ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-[12px] font-bold transition-all ${periodFilter === "year" ? "shadow-sm" : ""}`}
              onClick={() => setPeriodFilter("year")}
            >
              Este Ano
            </Button>
            <Button
              variant={periodFilter === "total" ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-[12px] font-bold transition-all ${periodFilter === "total" ? "shadow-sm" : ""}`}
              onClick={() => setPeriodFilter("total")}
            >
              Total Histórico
            </Button>
            <Button
              variant={periodFilter === "execution" ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-[12px] font-bold transition-all ${periodFilter === "execution" ? "shadow-sm" : ""}`}
              onClick={() => setPeriodFilter("execution")}
            >
              Em Tratativa
            </Button>
          </div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
            Visão Estratégica
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-7">
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-300 ${statusFilter === "all" && slaFilter === "all" ? "ring-2 ring-primary bg-primary/5" : "bg-card"}`}
            onClick={() => handleKpiClick("status", "all")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total</CardTitle>
              <div className="p-1.5 bg-muted rounded-md tracking-tighter">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight mb-2" data-testid="text-total-tickets">{stats.total}</div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(stats.total / (stats.historicalTotal || 1)) * 100}%` }} />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">de {stats.historicalTotal}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-blue-500/30 transition-all duration-300 ${statusFilter === "open" ? "ring-2 ring-blue-500 bg-blue-500/5" : "bg-card"}`}
            onClick={() => handleKpiClick("status", "open")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Abertos</CardTitle>
              <div className="p-1.5 bg-blue-500/10 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight text-blue-600 mb-1" data-testid="text-open-tickets">{stats.open}</div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">{openPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">do período</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-yellow-500/30 transition-all duration-300 ${statusFilter === "in_progress" ? "ring-2 ring-yellow-500 bg-yellow-500/5" : "bg-card"}`}
            onClick={() => handleKpiClick("status", "in_progress")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Andamento</CardTitle>
              <div className="p-1.5 bg-yellow-500/10 rounded-md">
                <Clock className="h-3.5 w-3.5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight text-yellow-600 mb-1" data-testid="text-progress-tickets">{stats.inProgress}</div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-yellow-50 text-yellow-700 border-yellow-200">{inProgressPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">do período</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-red-500/30 transition-all duration-300 ${statusFilter === "blocked" ? "ring-2 ring-red-500 bg-red-500/5" : "bg-card"}`}
            onClick={() => handleKpiClick("status", "blocked")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Bloqueados</CardTitle>
              <div className="p-1.5 bg-red-500/10 rounded-md">
                <Ban className="h-3.5 w-3.5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight text-red-600 mb-1" data-testid="text-blocked-tickets">{stats.blocked}</div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-red-50 text-red-700 border-red-200">{blockedPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">do período</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-green-500/30 transition-all duration-300 ${statusFilter === "resolved" ? "ring-2 ring-green-500 bg-green-500/5" : "bg-card"}`}
            onClick={() => handleKpiClick("status", "resolved")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Resolvidos</CardTitle>
              <div className="p-1.5 bg-green-500/10 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight text-green-600 mb-1" data-testid="text-resolved-tickets">
                {periodFilter === "previousMonth" ? (
                  <span>
                    {stats.resolved} <span className="text-green-400 text-2xl">/</span> {previousMonthResolved}
                  </span>
                ) : periodFilter === "execution" ? (
                  <span>
                    {stats.resolved} <span className="text-green-400 text-2xl">/</span> {last30DaysResolved}
                  </span>
                ) : (
                  stats.resolved
                )}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200">{resolvedPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {periodFilter === "previousMonth" ? "resolvidos / total mês" : periodFilter === "execution" ? "resolvidos / últimos 30 dias" : "do período"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-green-600/30 transition-all duration-300 ${slaFilter === "dentro_prazo" ? "ring-2 ring-green-600 bg-green-600/5" : "bg-card"}`}
            onClick={() => handleKpiClick("sla", "dentro_prazo")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">No Prazo</CardTitle>
              <div className="p-1.5 bg-green-600/10 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight text-green-700 font-mono mb-1" data-testid="text-sla-in-time-tickets">
                {stats.dentroPrazo}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-800 border-green-300 font-bold">{dentroPrazoPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">taxa de sucesso</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`shadow-sm border-border/60 cursor-pointer hover:shadow-md hover:border-red-600/30 transition-all duration-300 ${slaFilter === "em_atraso" ? "ring-2 ring-red-600 bg-red-600/5" : "bg-card"}`}
            onClick={() => handleKpiClick("sla", "em_atraso")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Em Atraso</CardTitle>
              <div className="p-1.5 bg-red-600/10 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              </div>
            </CardHeader>
             <CardContent>
              <div className="text-4xl font-bold tracking-tight text-red-700 font-mono mb-1" data-testid="text-sla-overdue-tickets">
                {stats.emAtraso}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-red-50 text-red-800 border-red-300 font-bold">{emAtrasoPerc}%</Badge>
                <p className="text-[11px] font-medium text-muted-foreground">em atraso</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Label de período ativo */}
          <div className="mt-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Período: {periodFilter === "month" ? "Mês Vigente" : periodFilter === "previousMonth" ? "Mês Anterior" : periodFilter === "year" ? "Este Ano" : periodFilter === "execution" ? "Em Tratativa" : "Total Histórico"}
            </span>
          </div>
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
                  Exportar Excel
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
                  {isAdmin && (
                    <Button
                      variant={viewMode === "analytics" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode("analytics")}
                      title="CSAT Analytics"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
                    <SelectItem value="all">Status</SelectItem>
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
                    <SelectItem value="all">Prioridade</SelectItem>
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
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full sm:w-[200px] h-10 text-[13px] justify-between font-normal"
                      data-testid="select-assignee-filter"
                    >
                      {assigneeFilter === "all"
                        ? "Responsável"
                        : users.find(u => u.id === assigneeFilter)?.name || "Responsável"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar responsável..." />
                      <CommandList>
                        <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setAssigneeFilter("all");
                              setAssigneeOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${assigneeFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                            Todos
                          </CommandItem>
                          {users
                            .filter(u => u.status === "active")
                            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                            .map(user => (
                              <CommandItem
                                key={user.id}
                                value={user.name}
                                onSelect={() => {
                                  setAssigneeFilter(user.id);
                                  setAssigneeOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${assigneeFilter === user.id ? "opacity-100" : "opacity-0"}`} />
                                {user.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
            ) : viewMode === "analytics" ? (
              <CSATAnalytics />
            ) : viewMode === "kanban" ? (
              <TicketKanban
                tickets={filteredTickets}
                users={users}
                onTicketClick={(ticket) => setLocation(`/chamados/${ticket.id}`)}
              />
            ) : (
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("code")}
                      >
                        Código
                        {sortField === "code" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider min-w-[250px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("title")}
                      >
                        Título
                        {sortField === "title" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("category")}
                      >
                        Categoria
                        {sortField === "category" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("requesterId")}
                      >
                        Solicitante
                        {sortField === "requesterId" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Responsável</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("status")}
                      >
                        Status
                        {sortField === "status" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("priority")}
                      >
                        Prioridade
                        {sortField === "priority" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider"
                        onClick={() => handleSort("createdAt")}
                      >
                        Abertura
                        {sortField === "createdAt" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Resolução</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Tempo Aberto</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">SLA</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wider">Status SLA</TableHead>
                    <TableHead className="w-[60px] text-[12px] font-bold uppercase tracking-wider">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {filteredTickets.map((ticket) => {
                      return (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setLocation(`/chamados/${ticket.id}`)}
                          data-testid={`row-ticket-${ticket.id}`}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px] font-bold">
                              {ticket.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-[13px] max-w-[300px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate cursor-help">
                                  {ticket.title}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md p-3">
                                <p className="text-sm font-medium">{ticket.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">{ticket.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${getTypeColor(ticket.type || "bug")} text-[10px] font-bold uppercase tracking-wider`}>
                              {ticket.type || "Bug"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[13px]">
                            <span className="font-medium text-muted-foreground/80">
                              {users.find(u => u.id === ticket.requesterId)?.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {ticket.assigneeId ? (
                              <span className="font-medium">
                                {users.find(u => u.id === ticket.assigneeId)?.name || "—"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Não atribuído</span>
                            )}
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
                            {formatDisplayDate(ticket.createdAt)}
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground">
                            {ticket.dataResolucao ? formatDisplayDate(ticket.dataResolucao) : "—"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const timeOpen = calculateTimeOpen(ticket.createdAt);
                              return (
                                <span className={`text-[12px] font-medium ${timeOpen.colorClass}`}>
                                  {timeOpen.text}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const slaInfo = getSlaForTicket(ticket, slaRules);
                              if (slaInfo.slaHoras === null) {
                                return <span className="text-[12px] text-muted-foreground">—</span>;
                              }
                              return (
                                <span className="text-[12px] font-medium">
                                  {slaInfo.slaHoras}h
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const slaInfo = getSlaForTicket(ticket, slaRules);
                              if (slaInfo.status === null) {
                                return <span className="text-[12px] text-muted-foreground">—</span>;
                              }
                              return slaInfo.status === "dentro_prazo" ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">
                                  Dentro do Prazo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">
                                  Em Atraso
                                </Badge>
                              );
                            })()}
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
                                  setLocation(`/chamados/${ticket.id}`);
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
                  </TooltipProvider>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

    </div>
  );
}