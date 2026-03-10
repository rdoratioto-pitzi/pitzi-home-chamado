import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Hash, Tag as TagIcon, Calendar, User as UserIcon, Lock, CheckSquare } from "lucide-react";
import type { KanbanCard, User } from "@shared/schema";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface DraggableCardProps {
  card: KanbanCard;
  users: User[];
  isReadOnly: boolean;
  priorityColors: Record<string, string>;
  priorityLabels: Record<string, string>;
  isBlocked?: boolean;
  onClick: () => void;
}

function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

export function DraggableCard({
  card,
  users,
  isReadOnly,
  priorityColors,
  priorityLabels,
  isBlocked = false,
  onClick
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: isReadOnly,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  const assignee = users.find(u => u.id === card.assigneeId);

  // Checklist stats
  const checklist: ChecklistItem[] = (() => {
    try { return card.checklist ? JSON.parse(card.checklist as unknown as string) : []; }
    catch { return []; }
  })();
  const checklistDone = checklist.filter(i => i.done).length;

  // Labels
  const labelIds: string[] = (() => {
    try { return card.labelIds ? JSON.parse(card.labelIds as unknown as string) : []; }
    catch { return []; }
  })();

  // Border color por prioridade
  const borderColorClass =
    card.priority === "muito_urgente" ? "border-l-red-500" :
    card.priority === "urgente" ? "border-l-orange-400" :
    "border-l-blue-400";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isDragging ? 'opacity-50' : ''} touch-none`}
    >
      <Card
        onClick={onClick}
        className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${borderColorClass} group ${isReadOnly ? 'opacity-80' : 'active:cursor-grabbing'}`}
        data-testid={`card-kanban-${card.id}`}
      >
        <CardContent className="p-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-tight truncate">
                  {card.code}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isBlocked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-red-500 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Card bloqueado por dependência</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Badge className={`text-[10px] h-4 px-1.5 uppercase font-bold tracking-wider ${priorityColors[card.priority]}`}>
                  {priorityLabels[card.priority]}
                </Badge>
              </div>
            </div>

            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h4 className="font-semibold text-sm leading-relaxed group-hover:text-primary transition-colors line-clamp-2 py-1">
                    {card.title}
                  </h4>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{card.title}</p>
                </TooltipContent>
              </Tooltip>
              {card.objectives && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {truncateText(stripHtml(card.objectives))}
                </p>
              )}
            </div>

            {/* Labels coloridas */}
            {labelIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {labelIds.slice(0, 4).map((labelId) => (
                  <div
                    key={labelId}
                    className="h-1.5 w-8 rounded-full opacity-80"
                    style={{ backgroundColor: "#6366f1" }}
                    title={labelId}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-muted/50">
              {card.tags?.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-none hover:bg-primary/20">
                  <TagIcon className="h-2 w-2 mr-1" />
                  {tag}
                </Badge>
              ))}

              <div className="flex items-center gap-3 ml-auto">
                {checklist.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckSquare className="h-3 w-3" />
                    <span className={checklistDone === checklist.length ? "text-green-600 font-medium" : ""}>
                      {checklistDone}/{checklist.length}
                    </span>
                  </div>
                )}
                {card.startDate && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(card.startDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                  </div>
                )}
                {assignee && (
                  <div className="flex items-center gap-1 text-[10px] font-medium">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <UserIcon className="h-3 w-3" />
                    </div>
                    <span className="max-w-[80px] truncate">{assignee.name.split(' ')[0]}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de progresso */}
            {(card.progress ?? 0) > 0 && (
              <Progress value={card.progress ?? 0} className="h-1" />
            )}

            {/* Progresso do checklist como barra quando não tem progress manual */}
            {checklist.length > 0 && (card.progress ?? 0) === 0 && (
              <Progress value={(checklistDone / checklist.length) * 100} className="h-1" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
