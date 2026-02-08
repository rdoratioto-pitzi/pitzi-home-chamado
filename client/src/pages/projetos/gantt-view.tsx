import { useState, useMemo, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User as UserIcon, Plus } from "lucide-react";
import type { KanbanCard, KanbanColumn, User } from "@shared/schema";
import {
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  differenceInDays,
  format,
  isSameDay,
  isWeekend,
  isToday,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  max as dateMax,
  min as dateMin,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface GanttViewProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  users: User[];
  onEditCard: (card: KanbanCard) => void;
  onNewCard: (columnId: string, parentCardId?: string) => void;
  isReadOnly: boolean;
}

const priorityColors: Record<string, string> = {
  muito_urgente: "bg-red-500",
  urgente: "bg-orange-500",
  normal: "bg-blue-500",
};

const priorityLabels: Record<string, string> = {
  muito_urgente: "Muito Urgente",
  urgente: "Urgente",
  normal: "Normal",
};

export function GanttView({ cards, columns, users, onEditCard, onNewCard, isReadOnly }: GanttViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const todayRef = useRef<HTMLDivElement>(null);

  const cardsWithDates = cards.filter(c => c.startDate || c.endDate);
  const parentCards = cards.filter(c => !c.parentCardId);
  const childCards = cards.filter(c => c.parentCardId);

  const getChildren = (parentId: string) => childCards.filter(c => c.parentCardId === parentId);

  const toggleExpand = (cardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const { timelineStart, timelineEnd, days } = useMemo(() => {
    const allDates: Date[] = [];
    cards.forEach(c => {
      if (c.startDate) allDates.push(new Date(c.startDate));
      if (c.endDate) allDates.push(new Date(c.endDate));
    });

    // Also include subtasks in the date range calculation explicitly
    // though the above loop already covers all cards.


    if (allDates.length === 0) {
      const today = new Date();
      const start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const end = endOfWeek(addWeeks(today, 4), { weekStartsOn: 1 });
      return {
        timelineStart: start,
        timelineEnd: end,
        days: eachDayOfInterval({ start, end }),
      };
    }

    const minDate = dateMin(allDates);
    const maxDate = dateMax(allDates);
    const start = startOfWeek(subWeeks(minDate, 1), { weekStartsOn: 1 });
    const end = endOfWeek(addWeeks(maxDate, 2), { weekStartsOn: 1 });

    return {
      timelineStart: start,
      timelineEnd: end,
      days: eachDayOfInterval({ start, end }),
    };
  }, [cards]);

  const weeks = useMemo(() => {
    const wks: { start: Date; end: Date; days: Date[] }[] = [];
    let current = timelineStart;
    while (current < timelineEnd) {
      const wEnd = endOfWeek(current, { weekStartsOn: 1 });
      const actualEnd = wEnd > timelineEnd ? timelineEnd : wEnd;
      wks.push({
        start: current,
        end: actualEnd,
        days: eachDayOfInterval({ start: current, end: actualEnd }),
      });
      current = addDays(actualEnd, 1);
    }
    return wks;
  }, [timelineStart, timelineEnd]);

  const DAY_WIDTH = 36;
  const ROW_HEIGHT = 40;
  const HEADER_HEIGHT = 56;

  const getBarPosition = (card: KanbanCard) => {
    const start = card.startDate ? startOfDay(new Date(card.startDate)) : null;
    const end = card.endDate ? endOfDay(new Date(card.endDate)) : null;

    if (!start && !end) return null;

    const effectiveStart = start || end!;
    const effectiveEnd = end || start!;

    const leftDays = differenceInDays(effectiveStart, timelineStart);
    const durationDays = differenceInDays(effectiveEnd, effectiveStart) + 1;

    return {
      left: leftDays * DAY_WIDTH,
      width: Math.max(durationDays * DAY_WIDTH - 4, DAY_WIDTH - 4),
    };
  };

  const buildRows = (): { card: KanbanCard; depth: number }[] => {
    const rows: { card: KanbanCard; depth: number }[] = [];
    const sorted = [...parentCards].sort((a, b) => {
      const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aDate - bDate;
    });

    sorted.forEach(parent => {
      rows.push({ card: parent, depth: 0 });
      const children = getChildren(parent.id);
      if (expandedCards.has(parent.id) && children.length > 0) {
        children
          .sort((a, b) => {
            const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
            const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
            return aDate - bDate;
          })
          .forEach(child => {
            rows.push({ card: child, depth: 1 });
          });
      }
    });

    return rows;
  };

  const rows = buildRows();
  const totalWidth = days.length * DAY_WIDTH;

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ inline: "center", behavior: "smooth" });
    }
  }, []);

  const getColumnName = (columnId: string) => columns.find(c => c.id === columnId)?.name || "";
  const getAssignee = (assigneeId: string | null) => assigneeId ? users.find(u => u.id === assigneeId) : null;

  return (
    <div className="flex flex-col h-full" data-testid="gantt-view">
      <div className="flex h-full border rounded-lg overflow-hidden">
        <div className="flex-shrink-0 w-[320px] border-r bg-muted/20">
          <div className="h-14 border-b flex items-center px-3 bg-muted/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarefa</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
            {rows.map(({ card, depth }, idx) => {
              const children = getChildren(card.id);
              const hasChildren = children.length > 0 && depth === 0;
              const assignee = getAssignee(card.assigneeId);

              return (
                <div
                  key={card.id}
                  className={`flex items-center gap-2 px-3 border-b hover:bg-muted/50 cursor-pointer ${
                    idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                  }`}
                  style={{ height: ROW_HEIGHT, paddingLeft: depth * 24 + 12 }}
                  onClick={() => onEditCard(card)}
                  data-testid={`gantt-task-row-${card.id}`}
                >
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(card.id);
                      }}
                      data-testid={`button-toggle-subtasks-${card.id}`}
                    >
                      {expandedCards.has(card.id) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  {!hasChildren && depth === 0 && <div className="w-5 flex-shrink-0" />}
                  <div className={`w-1.5 h-5 rounded-full flex-shrink-0 ${priorityColors[card.priority]}`} />
                  <span className="text-xs font-medium truncate flex-1">
                    {card.title}
                  </span>
                  {hasChildren && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                      {children.length}
                    </Badge>
                  )}
                  {assignee && (
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-3 w-3 text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
            {!isReadOnly && columns.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 border-b hover:bg-muted/50 cursor-pointer text-primary"
                style={{ height: ROW_HEIGHT, paddingLeft: 12 }}
                onClick={() => onNewCard(columns[0].id)}
                data-testid="button-gantt-new-task"
              >
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium">Nova Tarefa</span>
              </div>
            )}
            {rows.length === 0 && !(!isReadOnly && columns.length > 0) && (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Nenhuma tarefa com datas definidas
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            <div className="sticky top-0 z-10 bg-background border-b" style={{ height: HEADER_HEIGHT }}>
              <div className="flex" style={{ height: 28 }}>
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="border-r border-b text-center text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center"
                    style={{ width: week.days.length * DAY_WIDTH }}
                  >
                    {format(week.start, "dd MMM", { locale: ptBR })} - {format(week.end, "dd MMM", { locale: ptBR })}
                  </div>
                ))}
              </div>
              <div className="flex" style={{ height: 28 }}>
                {days.map((day, i) => (
                  <div
                    key={i}
                    ref={isToday(day) ? todayRef : null}
                    className={`border-r flex items-center justify-center text-[10px] ${
                      isToday(day)
                        ? "bg-primary/10 text-primary font-bold"
                        : isWeekend(day)
                        ? "bg-muted/40 text-muted-foreground"
                        : "text-muted-foreground"
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    {format(day, "dd")}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 border-r ${
                    isToday(day)
                      ? "bg-primary/5"
                      : isWeekend(day)
                      ? "bg-muted/20"
                      : ""
                  }`}
                  style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, height: (rows.length + (!isReadOnly && columns.length > 0 ? 1 : 0)) * ROW_HEIGHT }}
                />
              ))}

              {isToday(new Date()) && (
                <div
                  className="absolute top-0 w-0.5 bg-primary z-20"
                  style={{
                    left: differenceInDays(new Date(), timelineStart) * DAY_WIDTH + DAY_WIDTH / 2,
                    height: (rows.length + (!isReadOnly && columns.length > 0 ? 1 : 0)) * ROW_HEIGHT,
                  }}
                />
              )}

              {rows.map(({ card, depth }, idx) => {
                const pos = getBarPosition(card);
                const assignee = getAssignee(card.assigneeId);

                return (
                  <div
                    key={card.id}
                    className={`relative border-b ${
                      idx % 2 === 0 ? "" : "bg-muted/5"
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {pos && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute rounded cursor-pointer transition-all hover:brightness-110 hover:shadow-md ${
                              priorityColors[card.priority]
                            } ${depth > 0 ? "opacity-90" : ""}`}
                            style={{
                              left: pos.left + 2,
                              width: pos.width,
                              height: 24,
                              top: 8,
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCard(card);
                            }}
                            data-testid={`gantt-bar-${card.id}`}
                          >
                            <div className="flex items-center h-full px-2 gap-1 overflow-hidden">
                              <span className="text-[10px] font-medium text-white truncate">
                                {card.title}
                              </span>
                            </div>
                            {card.progress != null && card.progress > 0 && (
                              <div
                                className="absolute bottom-0 left-0 h-1 rounded-b bg-white/30"
                                style={{ width: `${card.progress}%` }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs" style={{ zIndex: 100 }}>
                          <div className="space-y-1">
                            <p className="font-semibold text-xs">{card.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {card.startDate && format(new Date(card.startDate), "dd/MM/yyyy")}
                              {card.startDate && card.endDate && " - "}
                              {card.endDate && format(new Date(card.endDate), "dd/MM/yyyy")}
                            </p>
                            <div className="flex items-center gap-2 text-[10px]">
                              <Badge variant="secondary" className="text-[9px] h-4">
                                {priorityLabels[card.priority]}
                              </Badge>
                              <span>{getColumnName(card.columnId)}</span>
                              {assignee && <span>{assignee.name}</span>}
                            </div>
                            {card.progress != null && card.progress > 0 && (
                              <p className="text-[10px]">Progresso: {card.progress}%</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
              {!isReadOnly && columns.length > 0 && (
                <div className="relative border-b" style={{ height: ROW_HEIGHT }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
