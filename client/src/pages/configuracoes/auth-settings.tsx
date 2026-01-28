import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Mail, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([
    {
      id: "email",
      name: "Email e Senha",
      description: "Login tradicional com email e senha",
      icon: Mail,
      enabled: true,
      configured: true,
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

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Atualmente, apenas o login por email e senha está habilitado. 
          As integrações com Google OAuth e Microsoft OAuth estão temporariamente desabilitadas.
        </AlertDescription>
      </Alert>
    </div>
  );
}
