import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, Tag as TagIcon, Calendar, User as UserIcon } from "lucide-react";
import type { KanbanCard, User } from "@shared/schema";

interface DraggableCardProps {
  card: KanbanCard;
  users: User[];
  isReadOnly: boolean;
  priorityColors: Record<string, string>;
  priorityLabels: Record<string, string>;
  onClick: () => void;
}

export function DraggableCard({ 
  card, 
  users, 
  isReadOnly, 
  priorityColors, 
  priorityLabels, 
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
        className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary/50 group ${isReadOnly ? 'opacity-80' : 'active:cursor-grabbing'}`}
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
              <Badge className={`text-[10px] h-4 px-1.5 uppercase font-bold tracking-wider ${priorityColors[card.priority]}`}>
                {priorityLabels[card.priority]}
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                {card.title}
              </h4>
              {card.objectives && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {card.objectives}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-muted/50">
              {card.tags?.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-none hover:bg-primary/20">
                  <TagIcon className="h-2 w-2 mr-1" />
                  {tag}
                </Badge>
              ))}
              
              <div className="flex items-center gap-3 ml-auto">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
