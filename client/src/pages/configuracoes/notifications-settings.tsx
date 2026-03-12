import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Bell, Volume2, BellRing, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  useNotificationPreferences,
  playNotificationSound,
  requestPushPermission,
} from "@/hooks/use-notification-preferences";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  { id: "ticket_new", label: "Novo chamado", description: "Quando um novo chamado é criado", enabled: true },
  { id: "ticket_assigned", label: "Chamado atribuído", description: "Quando você é atribuído a um chamado", enabled: true },
  { id: "ticket_status", label: "Mudança de status (Chamado)", description: "Quando o status de um chamado muda", enabled: true },
  { id: "ticket_comment", label: "Novo comentário", description: "Quando há um novo comentário em seus chamados ou cards", enabled: true },
  { id: "mention", label: "Menções (@usuário)", description: "Quando alguém menciona você em um comentário", enabled: true },
  { id: "task_assigned", label: "Tarefa atribuída", description: "Quando uma tarefa é atribuída a você", enabled: true },
  { id: "project_card_assigned", label: "Card de projeto atribuído", description: "Quando você é definido como responsável ou relator de um card", enabled: true },
  { id: "project_card_status", label: "Mudança de status (Card)", description: "Quando o status de um card de projeto muda", enabled: true },
  { id: "project_update", label: "Atualização de projeto", description: "Quando há atualizações em projetos que você participa", enabled: true },
  { id: "meeting_invite", label: "Convite para reunião", description: "Quando você é convidado para uma nova reunião", enabled: true },
  { id: "flowchart_collaborator", label: "Colaborador em fluxograma", description: "Quando você é adicionado como colaborador em um fluxograma", enabled: true },
  { id: "okr_update", label: "Atualização de OKR", description: "Quando há progresso nos OKRs que você acompanha", enabled: true },
  { id: "shipment_update", label: "Status de envio", description: "Quando o status de um envio é atualizado", enabled: true },
];

export function NotificationsSettings() {
  const { toast } = useToast();
  const { prefs, setPrefs } = useNotificationPreferences();
  const queryClient = useQueryClient();

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Carregar preferências do backend
  const { data: serverPrefs, isLoading } = useQuery({
    queryKey: ["/api/notifications/preferences"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications/preferences");
      return res.json();
    },
  });

  // Aplicar preferências do servidor quando carregadas
  useEffect(() => {
    if (serverPrefs) {
      setEmailEnabled(serverPrefs.emailNotificationsEnabled ?? true);
      if (serverPrefs.emailPreferences) {
        setSettings((prev) =>
          prev.map((s) => ({
            ...s,
            enabled: serverPrefs.emailPreferences[s.id] ?? s.enabled,
          }))
        );
      }
    }
  }, [serverPrefs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emailPreferences: Record<string, boolean> = {};
      settings.forEach((s) => {
        emailPreferences[s.id] = s.enabled;
      });
      return apiRequest("PUT", "/api/notifications/preferences", {
        emailNotificationsEnabled: emailEnabled,
        pushNotificationsEnabled: prefs.pushEnabled,
        emailPreferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      setHasChanges(false);
      toast({
        title: "Configurações salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const toggleSetting = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setHasChanges(true);
  };

  const handleToggleEmail = (checked: boolean) => {
    setEmailEnabled(checked);
    setHasChanges(true);
  };

  const handleTogglePush = async () => {
    if (!prefs.pushEnabled) {
      const granted = await requestPushPermission();
      if (granted) {
        setPrefs({ pushEnabled: true });
        toast({ title: "Push ativado", description: "Você receberá notificações no navegador." });
      } else {
        toast({ title: "Permissão negada", description: "O navegador bloqueou as notificações. Verifique as configurações do navegador.", variant: "destructive" });
      }
    } else {
      setPrefs({ pushEnabled: false });
      toast({ title: "Push desativado", description: "Notificações do navegador foram desativadas." });
    }
  };

  const handleTestSound = () => {
    playNotificationSound(prefs.soundVolume);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando preferências...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notificações In-App
          </CardTitle>
          <CardDescription>
            Configure alertas sonoros e notificações push do navegador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Alerta sonoro</Label>
              <p className="text-sm text-muted-foreground">
                Toca um som sutil quando você recebe uma nova notificação
              </p>
            </div>
            <Switch
              checked={prefs.soundEnabled}
              onCheckedChange={(checked) => setPrefs({ soundEnabled: checked })}
              data-testid="switch-sound-notifications"
            />
          </div>

          {prefs.soundEnabled && (
            <div className="flex items-center gap-4 pl-4">
              <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[prefs.soundVolume * 100]}
                onValueChange={(val) => setPrefs({ soundVolume: val[0] / 100 })}
                max={100}
                min={10}
                step={10}
                className="flex-1"
                data-testid="slider-sound-volume"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestSound}
                data-testid="button-test-sound"
              >
                Testar
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Notificações push do navegador</Label>
              <p className="text-sm text-muted-foreground">
                Receba alertas nativos do sistema operacional, mesmo com a aba minimizada
              </p>
            </div>
            <Switch
              checked={prefs.pushEnabled}
              onCheckedChange={handleTogglePush}
              data-testid="switch-push-notifications"
            />
          </div>

          {prefs.pushEnabled && "Notification" in window && Notification.permission === "denied" && (
            <p className="text-sm text-destructive pl-4">
              As notificações estão bloqueadas pelo navegador. Clique no cadeado na barra de endereço para permitir.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notificações por E-mail
          </CardTitle>
          <CardDescription>
            Configure quais notificações você deseja receber por e-mail
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Habilitar notificações por e-mail</Label>
              <p className="text-sm text-muted-foreground">
                Receba atualizações importantes por e-mail
              </p>
            </div>
            <Switch
              checked={emailEnabled}
              onCheckedChange={handleToggleEmail}
              data-testid="switch-email-notifications"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Tipos de notificação</h4>
            {settings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-medium">{setting.label}</Label>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={() => toggleSetting(setting.id)}
                  disabled={!emailEnabled}
                  data-testid={`switch-${setting.id}`}
                />
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-notifications"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Preferências de E-mail
            </Button>
            {hasChanges && (
              <span className="ml-3 text-sm text-amber-600">Alterações não salvas</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
