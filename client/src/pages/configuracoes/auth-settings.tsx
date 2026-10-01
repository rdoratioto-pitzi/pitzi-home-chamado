import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, KeyRound, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { API_BASE } from "@/lib/queryClient";

/** Mesmo formato de GET /api/auth/config (shared/auth-policy.ts). */
interface AuthConfig {
  googleClientId: string | null;
  allowedDomains: string[];
  passwordLogin: "all" | "admins" | "off";
}

// Só leitura: o login é configurado no servidor (docs/login-google-setup.md), não por esta tela.
export function AuthSettings() {
  const { data: config, isLoading } = useQuery<AuthConfig>({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/auth/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar a configuração de login");
      return res.json();
    },
  });

  const domains = (config?.allowedDomains ?? []).map((d) => "@" + d).join(", ");
  const googleOn = !!config?.googleClientId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Autenticação</CardTitle>
          <CardDescription>Como as pessoas entram no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !config ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="p-2 rounded-lg bg-muted">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Google</h4>
                    {googleOn ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Não configurado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="auth-google-status">
                    {googleOn
                      ? `Login somente com Google (contas ${domains}). No primeiro acesso a pessoa é cadastrada como "Usuário".`
                      : "Google ainda não configurado — login por senha ativo."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="p-2 rounded-lg bg-muted">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">E-mail e senha</h4>
                    {config.passwordLogin === "all" && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">Ativo para todos</Badge>
                    )}
                    {config.passwordLogin === "admins" && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Emergência: só administradores</Badge>
                    )}
                    {config.passwordLogin === "off" && <Badge variant="secondary">Desativado</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {config.passwordLogin === "all"
                      ? "Vale até o login com Google ser configurado."
                      : config.passwordLogin === "admins"
                        ? "A chave de emergência está ligada no servidor: administradores podem entrar com senha."
                        : "Desativado. Em emergência, a equipe técnica pode religar só para administradores."}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          A forma de login é definida no servidor. Para promover alguém a técnico ou administrador, use a aba
          Usuários.
        </AlertDescription>
      </Alert>
    </div>
  );
}
