import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RenovLogo } from "@/components/renov-logo";
import { Loader2, Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import { PasswordRequirements } from "@/components/auth/password-requirements";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

const forgotPasswordSchema = z.object({
  email: z.string().email("Digite um email válido"),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.8, y: -20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Auto-focus on email input when page loads - using callback ref

  // Countdown timer for forgot password
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  const forgotForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      
      if (result.success) {
        setLoginSuccess(true);
        
        // Store user data and token in localStorage for multi-tab persistence
        // Import saveAuth from auth library
        const { saveAuth } = await import("@/lib/auth");
        saveAuth({
          token: result.token || `session_${result.user.id}_${Date.now()}`,
          user: result.user
        });
        
        // Show success animation before redirect
        setTimeout(() => {
          toast({ title: "Login realizado com sucesso!" });
          setLocation("/");
        }, 800);
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

  const onForgotPasswordSubmit = async (data: ForgotPasswordData) => {
    if (countdown > 0) return;
    
    setForgotPasswordLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await response.json();

      if (result.success) {
        setForgotPasswordSent(true);
        setCountdown(60); // 60 seconds countdown
      } else {
        toast({
          title: "Erro",
          description: result.message || "Erro ao processar a solicitação",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao processar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    const currentEmail = form.getValues("email");
    if (currentEmail) {
      forgotForm.setValue("email", currentEmail);
    }
    setForgotPasswordSent(false);
    setForgotPasswordOpen(true);
  };

  const handleCloseForgotPassword = () => {
    setForgotPasswordOpen(false);
    setForgotPasswordSent(false);
    forgotForm.reset();
  };

  // Handle Enter key navigation
  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const passwordInput = document.getElementById("password-input");
      passwordInput?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 dark:from-background dark:via-background dark:to-primary/10" />
      
      {/* Decorative circles */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      
      {/* Success overlay */}
      <AnimatePresence>
        {loginSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
            >
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* Card container */}
        <motion.div
          variants={itemVariants}
          className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl p-6 sm:p-8"
        >
          {/* Logo and title */}
          <div className="flex flex-col items-center space-y-6 mb-8">
            <motion.div variants={logoVariants}>
              <RenovLogo size="xl" variant="auto" className="scale-110" />
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bem-vindo</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Acesse sua conta para continuar
              </p>
            </motion.div>
          </div>

          {/* Login form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="email"
                            placeholder="seuemail@renovsmart.com.br" 
                            className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            data-testid="input-login-email"
                            onKeyDown={handleEmailKeyDown}
                            aria-label="Email para login"
                            aria-describedby="email-description"
                            autoFocus
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                      <span id="email-description" className="sr-only">
                        Digite seu email corporativo
                      </span>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                        <FormLabel className="text-sm font-medium">Senha</FormLabel>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
                          data-testid="button-forgot-password"
                          onClick={handleOpenForgotPassword}
                          aria-label="Esqueceu sua senha? Clique para recuperar"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="password-input"
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite sua senha"
                            className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            data-testid="input-login-password"
                            aria-label="Senha para login"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 hover:bg-transparent h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                      
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
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
                          aria-label="Lembrar de mim neste dispositivo"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer select-none">
                        Lembrar de mim
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button 
                  type="submit" 
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20"
                  disabled={isLoading}
                  data-testid="button-login-submit"
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Entrando...</span>
                    </motion.div>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </motion.div>
            </form>
          </Form>

          {/* Terms and privacy */}
          <motion.p
            variants={itemVariants}
            className="text-center text-xs text-muted-foreground mt-6"
          >
            Ao continuar, você concorda com nossos{" "}
            <button className="text-primary hover:underline underline-offset-4 transition-colors" data-testid="link-terms-of-service">
              Termos de Serviço
            </button>{" "}
            e{" "}
            <button className="text-primary hover:underline underline-offset-4 transition-colors" data-testid="link-privacy-policy">
              Política de Privacidade
            </button>
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Forgot password dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              {forgotPasswordSent
                ? "Verifique seu email para a senha temporária."
                : "Digite seu email cadastrado para receber uma senha temporária."}
            </DialogDescription>
          </DialogHeader>

          {forgotPasswordSent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10"
              >
                <Mail className="w-8 h-8 text-primary" />
              </motion.div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Se o email estiver cadastrado no sistema, você receberá uma senha temporária em instantes.
                </p>
                <p className="text-sm text-muted-foreground">
                  Use essa senha para acessar o sistema.
                </p>
              </div>
              <Button
                className="w-full mt-2"
                onClick={handleCloseForgotPassword}
                data-testid="button-forgot-password-close"
              >
                Voltar ao Login
              </Button>
            </motion.div>
          ) : (
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                <FormField
                  control={forgotForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="seuemail@renovsmart.com.br"
                            className="pl-10"
                            data-testid="input-forgot-password-email"
                            aria-label="Email para recuperação de senha"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseForgotPassword}
                    className="flex-1"
                    data-testid="button-forgot-password-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotPasswordLoading || countdown > 0}
                    className="flex-1"
                    data-testid="button-forgot-password-submit"
                  >
                    {forgotPasswordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : countdown > 0 ? (
                      `Aguarde ${countdown}s`
                    ) : (
                      "Enviar"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}