import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle } from "react-icons/si";

interface AuthMethod {
  id: string;
  name: string;
  description: string;
  icon: any;
  enabled: boolean;
  configured: boolean;
}

export function AuthSettings() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([
    {
      id: "email",
      name: "Email e Senha",
      description: "Login tradicional com email e senha",
      icon: Mail,
      enabled: true,
      configured: true,
    },
    {
      id: "google",
      name: "Google OAuth",
      description: "Permitir login com conta Google",
      icon: SiGoogle,
      enabled: false,
      configured: false,
    },
    {
      id: "microsoft",
      name: "Microsoft OAuth",
      description: "Permitir login com conta Microsoft",
      icon: Building2,
      enabled: false,
      configured: false,
    },
  ]);

  const toggleMethod = (id: string) => {
    setAuthMethods(methods => 
      methods.map(m => 
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
    );
    toast({
      title: "Configuração atualizada",
      description: "As alterações foram salvas.",
    });
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Autenticação</CardTitle>
          <CardDescription>
            Configure os métodos de login disponíveis para os usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authMethods.map((method) => (
            <div key={method.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <method.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{method.name}</h4>
                    {method.configured ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        Configurado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não configurado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {method.description}
                  </p>
                </div>
              </div>
              <Switch 
                checked={method.enabled}
                onCheckedChange={() => toggleMethod(method.id)}
                data-testid={`switch-auth-${method.id}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Google OAuth</CardTitle>
          <CardDescription>
            Configure as credenciais do Google Cloud Console para habilitar login com Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google-client-id">Client ID</Label>
            <Input 
              id="google-client-id"
              placeholder="Seu Google Client ID"
              data-testid="input-google-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-client-secret">Client Secret</Label>
            <div className="relative">
              <Input 
                id="google-client-secret"
                type={showSecrets["google"] ? "text" : "password"}
                placeholder="Seu Google Client Secret"
                data-testid="input-google-client-secret"
              />
              <Button 
                type="button"
                variant="ghost" 
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => toggleShowSecret("google")}
              >
                {showSecrets["google"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button data-testid="button-save-google">Salvar Configurações</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Microsoft OAuth</CardTitle>
          <CardDescription>
            Configure as credenciais do Azure AD para habilitar login com Microsoft
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="microsoft-client-id">Client ID</Label>
            <Input 
              id="microsoft-client-id"
              placeholder="Seu Microsoft Client ID"
              data-testid="input-microsoft-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="microsoft-client-secret">Client Secret</Label>
            <div className="relative">
              <Input 
                id="microsoft-client-secret"
                type={showSecrets["microsoft"] ? "text" : "password"}
                placeholder="Seu Microsoft Client Secret"
                data-testid="input-microsoft-client-secret"
              />
              <Button 
                type="button"
                variant="ghost" 
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => toggleShowSecret("microsoft")}
              >
                {showSecrets["microsoft"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="microsoft-tenant">Tenant ID (opcional)</Label>
            <Input 
              id="microsoft-tenant"
              placeholder="Deixe vazio para multi-tenant"
              data-testid="input-microsoft-tenant"
            />
          </div>
          <Button data-testid="button-save-microsoft">Salvar Configurações</Button>
        </CardContent>
      </Card>
    </div>
  );
}
