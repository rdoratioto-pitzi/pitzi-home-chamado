import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck, Volume2, VolumeX, BellRing, Ticket, FolderKanban, CheckSquare, Target, Package, GitBranch, Calendar, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { Notification } from "@shared/schema";
import {
  useNotificationPreferences,
  playNotificationSound,
  requestPushPermission,
  sendBrowserNotification,
} from "@/hooks/use-notification-preferences";
import { useAuth } from "@/contexts/auth-context";

function timeAgo(date: string | Date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

function ModuleIcon({ module }: { module: string }) {
  const className = "h-3.5 w-3.5 text-muted-foreground";
  switch (module) {
    case "chamados": return <Ticket className={className} />;
    case "projetos": return <FolderKanban className={className} />;
    case "tarefas": return <CheckSquare className={className} />;
    case "metas": return <Target className={className} />;
    case "logistica": return <Package className={className} />;
    case "fluxogramas": return <GitBranch className={className} />;
    case "reunioes": return <Calendar className={className} />;
    case "comentarios": return <MessageSquare className={className} />;
    default: return <Bell className={className} />;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { prefs, setPrefs } = useNotificationPreferences();
  const prevUnreadRef = useRef<number>(0);
  const initialLoadRef = useRef(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Lista completa: sem polling automático — busca apenas quando o popover é aberto.
  // Isso elimina requisições periódicas desnecessárias à API.
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user?.id && open,
    staleTime: 0, // sempre busca fresh ao abrir
  });

  // Contador de não lidas: sem polling — atualiza apenas ao abrir o popover.
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread/count"],
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  // Ao abrir o popover, busca lista e contagem atualizadas.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      refetchNotifications();
      refetchUnreadCount();
    }
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      // Servidor usa PUT, não PATCH
      await apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/notifications/read-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  useEffect(() => {
    if (initialLoadRef.current) {
      prevUnreadRef.current = unreadCount;
      initialLoadRef.current = false;
      return;
    }

    if (unreadCount > prevUnreadRef.current) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);

      if (prefs.soundEnabled) {
        playNotificationSound(prefs.soundVolume);
      }

      if (prefs.pushEnabled) {
        const latestUnread = notifications.find((n) => !n.isRead);
        if (latestUnread) {
          sendBrowserNotification(
            latestUnread.title,
            latestUnread.message,
            latestUnread.linkUrl
          );
        }
      }
    }

    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifications, prefs.soundEnabled, prefs.pushEnabled, prefs.soundVolume]);

  useEffect(() => {
    if (prefs.pushEnabled) {
      requestPushPermission();
    }
  }, [prefs.pushEnabled]);

  const toggleSound = useCallback(() => {
    setPrefs({ soundEnabled: !prefs.soundEnabled });
  }, [prefs.soundEnabled, setPrefs]);

  const togglePush = useCallback(async () => {
    if (!prefs.pushEnabled) {
      const granted = await requestPushPermission();
      if (granted) {
        setPrefs({ pushEnabled: true });
      }
    } else {
      setPrefs({ pushEnabled: false });
    }
  }, [prefs.pushEnabled, setPrefs]);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markRead.mutate(notif.id);
    }
    if (notif.linkUrl) {
      const [path, query] = notif.linkUrl.split("?");
      const currentPath = window.location.pathname;
      if (currentPath === path && query) {
        window.location.href = notif.linkUrl;
      } else {
        navigate(notif.linkUrl);
      }
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`relative ${isAnimating ? "animate-bell-ring" : ""}`}
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground" data-testid="badge-unread-count">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <h4 className="text-sm font-semibold" data-testid="text-notifications-title">Notificações</h4>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-7 w-7 ${prefs.soundEnabled ? "text-primary" : "text-muted-foreground"}`}
                  onClick={toggleSound}
                  data-testid="button-toggle-sound"
                >
                  {prefs.soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{prefs.soundEnabled ? "Som ativado" : "Som desativado"}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-7 w-7 ${prefs.pushEnabled ? "text-primary" : "text-muted-foreground"}`}
                  onClick={togglePush}
                  data-testid="button-toggle-push"
                >
                  <BellRing className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{prefs.pushEnabled ? "Push ativado" : "Push desativado"}</p>
              </TooltipContent>
            </Tooltip>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2 ml-1"
                onClick={() => markAllRead.mutate()}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Ler todas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 hover-elevate transition-colors ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                  data-testid={`notification-item-${notif.id}`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.isRead && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">{timeAgo(notif.createdAt!)}</span>
                        {notif.module && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 capitalize">
                            <ModuleIcon module={notif.module} />
                            {notif.module}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
