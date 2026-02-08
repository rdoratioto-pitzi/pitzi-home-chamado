import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, User as UserIcon } from "lucide-react";
import type { KanbanCard, KanbanColumn, User } from "@shared/schema";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarViewProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  users: User[];
  onEditCard: (card: KanbanCard) => void;
  onNewCard: (columnId: string) => void;
  isReadOnly: boolean;
}

const priorityDotColors: Record<string, string> = {
  muito_urgente: "bg-red-500",
  urgente: "bg-orange-500",
  normal: "bg-blue-500",
};

const priorityBarColors: Record<string, string> = {
  muito_urgente: "bg-red-500/80 hover:bg-red-500",
  urgente: "bg-orange-500/80 hover:bg-orange-500",
  normal: "bg-blue-500/80 hover:bg-blue-500",
};

export function CalendarView({ cards, columns, users, onEditCard, onNewCard, isReadOnly }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getCardsForDay = (day: Date): KanbanCard[] => {
    return cards.filter(card => {
      if (card.startDate && card.endDate) {
        return isWithinInterval(startOfDay(day), {
          start: startOfDay(new Date(card.startDate)),
          end: endOfDay(new Date(card.endDate)),
        });
      }
      if (card.startDate) {
        return isSameDay(startOfDay(day), startOfDay(new Date(card.startDate)));
      }
      if (card.endDate) {
        return isSameDay(startOfDay(day), startOfDay(new Date(card.endDate)));
      }
      if (card.dueDate) {
        return isSameDay(startOfDay(day), startOfDay(new Date(card.dueDate)));
      }
      return false;
    });
  };

  const getAssignee = (assigneeId: string | null) => assigneeId ? users.find(u => u.id === assigneeId) : null;
  const getColumnName = (columnId: string) => columns.find(c => c.id === columnId)?.name || "";

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const MAX_VISIBLE = 3;

  return (
    <div className="flex flex-col h-full" data-testid="calendar-view">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[180px] text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(new Date())}
          data-testid="button-today"
        >
          Hoje
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden flex-1">
        <div className="grid grid-cols-7 bg-muted/40">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: "calc(100vh - 380px)" }}>
          {calendarDays.map((day, i) => {
            const dayCards = getCardsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const visibleCards = dayCards.slice(0, MAX_VISIBLE);
            const remaining = dayCards.length - MAX_VISIBLE;

            return (
              <div
                key={i}
                className={`border-b border-r p-1.5 min-h-[100px] transition-colors group ${
                  !isCurrentMonth ? "bg-muted/20" : ""
                } ${isTodayDate ? "bg-primary/5" : ""}`}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isTodayDate
                        ? "bg-primary text-primary-foreground"
                        : !isCurrentMonth
                        ? "text-muted-foreground/50"
                        : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {!isReadOnly && columns.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onNewCard(columns[0].id)}
                      data-testid={`calendar-add-task-${format(day, "yyyy-MM-dd")}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {visibleCards.map((card) => (
                    <Tooltip key={card.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 cursor-pointer transition-all text-white ${priorityBarColors[card.priority]}`}
                          onClick={() => onEditCard(card)}
                          data-testid={`calendar-card-${card.id}`}
                        >
                          <span className="text-[10px] font-medium truncate">
                            {card.title}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs">{card.title}</p>
                          <p className="text-[10px] text-muted-foreground">{card.code}</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span>{getColumnName(card.columnId)}</span>
                            {getAssignee(card.assigneeId) && (
                              <span className="flex items-center gap-1">
                                <UserIcon className="h-3 w-3" />
                                {getAssignee(card.assigneeId)?.name}
                              </span>
                            )}
                          </div>
                          {card.startDate && (
                            <p className="text-[10px]">
                              {format(new Date(card.startDate), "dd/MM/yyyy")}
                              {card.endDate && ` - ${format(new Date(card.endDate), "dd/MM/yyyy")}`}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {remaining > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-[10px] text-muted-foreground text-center cursor-default">
                          +{remaining} mais
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          {dayCards.slice(MAX_VISIBLE).map(card => (
                            <div
                              key={card.id}
                              className="text-xs cursor-pointer hover:underline"
                              onClick={() => onEditCard(card)}
                            >
                              {card.title}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
