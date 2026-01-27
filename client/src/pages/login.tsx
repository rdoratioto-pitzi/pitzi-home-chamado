import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RenovLogo } from "@/components/renov-logo";
import { Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      
      if (result.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));
        sessionStorage.setItem("modulePermissions", result.user.modulePermissions || "{}");
        toast({ title: "Login realizado com sucesso!" });
        setLocation("/");
      } else {
        toast({ 
          title: "Erro no login", 
          description: result.message || "Email ou senha incorretos",
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Erro no login", 
        description: "Email ou senha incorretos",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-12 -mt-20">
        <div className="flex flex-col items-center space-y-8">
          <RenovLogo size="xl" className="scale-125" />
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Entrar</h2>
            <p className="text-muted-foreground">
              Acesse sua conta para continuar
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="seuemail@renovsmart.com.br" 
                      data-testid="input-login-email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Senha</FormLabel>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                      data-testid="button-forgot-password"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha" 
                        className="pr-10"
                        data-testid="input-login-password"
                        {...field} 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-remember-me"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Lembrar de mim
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11"
              disabled={isLoading}
              data-testid="button-login-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Ao continuar, você concorda com nossos{" "}
          <button className="text-sm text-primary hover:underline underline-offset-4" data-testid="link-terms-of-service">
            Termos de Serviço
          </button>{" "}
          e{" "}
          <button className="text-sm text-primary hover:underline underline-offset-4" data-testid="link-privacy-policy">
            Política de Privacidade
          </button>
        </p>
      </div>
    </div>
  );
}
