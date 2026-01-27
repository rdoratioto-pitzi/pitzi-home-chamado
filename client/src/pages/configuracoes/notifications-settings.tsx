import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function NotificationsSettings() {
  const { toast } = useToast();
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  const [settings, setSettings] = useState<NotificationSetting[]>([
    { id: "ticket_new", label: "Novo chamado", description: "Quando um novo chamado é criado", enabled: true },
    { id: "ticket_assigned", label: "Chamado atribuído", description: "Quando você é atribuído a um chamado", enabled: true },
    { id: "ticket_status", label: "Mudança de status", description: "Quando o status de um chamado muda", enabled: true },
    { id: "ticket_comment", label: "Novo comentário", description: "Quando há um novo comentário em seus chamados", enabled: true },
    { id: "project_task", label: "Nova tarefa", description: "Quando uma tarefa é criada em seus projetos", enabled: false },
    { id: "project_update", label: "Atualização de projeto", description: "Quando há atualizações em projetos que você participa", enabled: false },
    { id: "okr_update", label: "Atualização de OKR", description: "Quando há progresso nos OKRs que você acompanha", enabled: true },
    { id: "shipment_update", label: "Status de envio", description: "Quando o status de um envio é atualizado", enabled: true },
  ]);

  const toggleSetting = (id: string) => {
    setSettings(prev => 
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const queryClient = useQueryClient();
  
  const saveMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        key: "notifications",
        value: JSON.stringify({ emailNotifications, settings }),
      });
      toast({
        title: "Configurações salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações por Email
          </CardTitle>
          <CardDescription>
            Configure quais notificações você deseja receber por email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Habilitar notificações por email</Label>
              <p className="text-sm text-muted-foreground">
                Receba atualizações importantes por email
              </p>
            </div>
            <Switch 
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              data-testid="switch-email-notifications"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            {settings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-medium">{setting.label}</Label>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                <Switch 
                  checked={setting.enabled}
                  onCheckedChange={() => toggleSetting(setting.id)}
                  disabled={!emailNotifications}
                  data-testid={`switch-${setting.id}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>
            Configure webhooks e integrações com outros serviços
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input 
              id="webhook-url"
              placeholder="https://..."
              data-testid="input-webhook-url"
            />
            <p className="text-xs text-muted-foreground">
              Receba notificações em um endpoint personalizado
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Slack Webhook</Label>
            <Input 
              id="slack-webhook"
              placeholder="https://hooks.slack.com/services/..."
              data-testid="input-slack-webhook"
            />
            <p className="text-xs text-muted-foreground">
              Envie notificações para um canal do Slack
            </p>
          </div>

          <Button onClick={handleSave} data-testid="button-save-notifications">
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
