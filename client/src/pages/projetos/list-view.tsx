import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  User as UserIcon,
  Calendar,
  Lock,
  CheckSquare,
  Circle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { KanbanCard, KanbanColumn, User, KanbanLabel } from "@shared/schema";

interface ChecklistItem { id: string; text: string; done: boolean; }

interface ListViewProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  users: User[];
  labels?: KanbanLabel[];
  blockedCardIds?: Set<string>;
  onEditCard: (card: KanbanCard) => void;
}

const priorityColors: Record<string, string> = {
  muito_urgente: "bg-red-100 text-red-700 border-red-200",
  urgente: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
};

const priorityLabels: Record<string, string> = {
  muito_urgente: "Muito Urgente",
  urgente: "Urgente",
  normal: "Normal",
};

const statusGroups = [
  { key: "todo",  label: "A Fazer",      Icon: Circle,       badgeClass: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400" },
  { key: "doing", label: "Em Andamento", Icon: Clock,        badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" },
  { key: "done",  label: "Concluído",    Icon: CheckCircle2, badgeClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400" },
];

function parseJson<T>(str: unknown, fallback: T): T {
  try { return str ? JSON.parse(str as string) as T : fallback; }
  catch { return fallback; }
}

interface CardRowProps {
  card: KanbanCard;
  users: User[];
  labels: KanbanLabel[];
  columns: KanbanColumn[];
  isBlocked: boolean;
  onClick: () => void;
}

function CardRow({ card, users, labels, columns, isBlocked, onClick }: CardRowProps) {
  const assignee = users.find(u => u.id === card.assigneeId);
  const column = columns.find(c => c.id === card.columnId);
  const checklist = parseJson<ChecklistItem[]>(card.checklist, []);
  const labelIds = parseJson<string[]>(card.labelIds, []);
  const cardLabels = labels.filter(l => labelIds.includes(l.id));
  const checklistDone = checklist.filter(i => i.done).length;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      {/* Código */}
      <TableCell className="w-[90px]">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          {card.code}
        </span>
      </TableCell>

      {/* Título */}
      <TableCell className="min-w-[200px]">
        <div className="flex items-center gap-2 min-w-0">
          {isBlocked && <Lock className="h-3 w-3 text-red-500 flex-shrink-0" />}
          <span className="text-sm font-medium line-clamp-2">{card.title}</span>
          {cardLabels.length > 0 && (
            <div className="flex gap-0.5 flex-shrink-0">
              {cardLabels.slice(0, 3).map(label => (
                <span
                  key={label.id}
                  className="h-3 w-3 rounded-full inline-block"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ))}
            </div>
          )}
        </div>
      </TableCell>

      {/* Coluna Kanban */}
      <TableCell className="w-[130px]">
        <span className="text-xs text-muted-foreground truncate">{column?.name ?? "—"}</span>
      </TableCell>

      {/* Prioridade */}
      <TableCell className="w-[120px]">
        <Badge className={`text-[10px] h-5 px-1.5 uppercase font-bold ${priorityColors[card.priority]}`}>
          {priorityLabels[card.priority]}
        </Badge>
      </TableCell>

      {/* Responsável */}
      <TableCell className="w-[120px]">
        {assignee ? (
          <div className="flex items-center gap-1 text-xs">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserIcon className="h-3 w-3 text-primary" />
            </div>
            <span className="truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Prazo */}
      <TableCell className="w-[100px]">
        {card.dueDate ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(card.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Progresso */}
      <TableCell className="w-[120px]">
        {(card.progress ?? 0) > 0 ? (
          <div className="flex items-center gap-1.5">
            <Progress value={card.progress ?? 0} className="h-1.5 flex-1" />
            <span className="text-[10px] text-muted-foreground w-7">{card.progress}%</span>
          </div>
        ) : checklist.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <Progress value={(checklistDone / checklist.length) * 100} className="h-1.5 flex-1" />
            <span className="text-[10px] text-muted-foreground w-7">
              {checklistDone}/{checklist.length}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Checklist */}
      <TableCell className="w-[60px]">
        {checklist.length > 0 && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <CheckSquare className="h-3 w-3" />
            <span className={checklistDone === checklist.length ? "text-green-600" : ""}>
              {checklistDone}/{checklist.length}
            </span>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function ListView({ cards, columns, users, labels = [], blockedCardIds = new Set(), onEditCard }: ListViewProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    todo: true, doing: true, done: true,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3 pb-6">
      {statusGroups.map(({ key, label, Icon, badgeClass }) => {
        const groupCards = cards
          .filter(c => (c.status || "todo") === key)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const isOpen = openGroups[key] ?? true;
        const avgProgress = groupCards.length > 0
          ? Math.round(groupCards.reduce((acc, c) => acc + (c.progress ?? 0), 0) / groupCards.length)
          : 0;

        return (
          <div key={key} className="border rounded-lg overflow-hidden bg-card">
            <Collapsible open={isOpen} onOpenChange={() => toggleGroup(key)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors border-b">
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </Button>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{label}</span>
                  <Badge variant="outline" className={`h-5 text-[10px] ml-1 ${badgeClass}`}>
                    {groupCards.length}
                  </Badge>
                  {avgProgress > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Progresso médio: {avgProgress}%
                    </span>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {groupCards.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[90px] text-[10px] uppercase">
                          <div className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" /> Código</div>
                        </TableHead>
                        <TableHead className="text-[10px] uppercase">Título</TableHead>
                        <TableHead className="w-[130px] text-[10px] uppercase">Coluna</TableHead>
                        <TableHead className="w-[120px] text-[10px] uppercase">Prioridade</TableHead>
                        <TableHead className="w-[120px] text-[10px] uppercase">Responsável</TableHead>
                        <TableHead className="w-[100px] text-[10px] uppercase">Prazo</TableHead>
                        <TableHead className="w-[120px] text-[10px] uppercase">Progresso</TableHead>
                        <TableHead className="w-[60px] text-[10px] uppercase">
                          <CheckSquare className="h-3 w-3" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupCards.map(card => (
                        <CardRow
                          key={card.id}
                          card={card}
                          users={users}
                          labels={labels}
                          columns={columns}
                          isBlocked={blockedCardIds.has(card.id)}
                          onClick={() => onEditCard(card)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum card com este status
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
