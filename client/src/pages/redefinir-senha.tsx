import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PitziLogo } from "@/components/renov-logo";
import { fetchWithAuth } from "@/lib/queryClient";

const schema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

/** Tela aberta pelo link do e-mail de redefinição de senha (?token=...). */
export default function RedefinirSenhaPage() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await fetchWithAuth("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: data.password }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) setDone(true);
      else setError(result.message || "Não foi possível redefinir a senha.");
    } catch {
      setError("Não foi possível redefinir a senha. Tente novamente.");
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <PitziLogo size="md" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Redefinir senha</h1>
          {!done && <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>}
        </div>

        {!token ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Link inválido. Solicite um novo na tela de login.</p>
            <Button className="w-full" onClick={() => setLocation("/login")}>Ir para o login</Button>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden />
            <p className="text-sm text-muted-foreground" role="status">
              Senha redefinida. Por segurança, você foi desconectado dos outros dispositivos.
            </p>
            <Button className="w-full" onClick={() => setLocation("/login")}>Entrar</Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Salvar nova senha
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
