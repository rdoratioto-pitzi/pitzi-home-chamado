import { RenovLogo } from "@/components/renov-logo";
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
import { useAuth } from "@/contexts/auth-context";
import { fetchWithAuth } from "@/lib/queryClient";
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

const leftPanelVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Decorative recycling arrows for green panel
function RecycleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Arrow 1 — top */}
      <path
        d="M60 14L74 32H66V50L46 30L66 10V28L60 14Z"
        fill="white"
      />
      {/* Arrow 2 — bottom-right */}
      <path
        d="M60 14L74 32H66V50L46 30L66 10V28L60 14Z"
        fill="white"
        transform="rotate(120 60 60)"
      />
      {/* Arrow 3 — bottom-left */}
      <path
        d="M60 14L74 32H66V50L46 30L66 10V28L60 14Z"
        fill="white"
        transform="rotate(240 60 60)"
      />
    </svg>
  );
}

// Dark input classes — always dark regardless of app theme
const darkInputClass =
  "h-[52px] bg-white/[0.08] border-white/[0.12] rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-[#00A137] focus-visible:border-[#00A137] text-sm";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
    mode: "onChange",
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
      const response = await fetchWithAuth("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        setLoginSuccess(true);
        auth.login(result.user);
        setTimeout(() => {
          toast({ title: "Login realizado com sucesso!" });
          setLocation("/");
        }, 800);
      } else {
        toast({
          title: "Erro no login",
          description: result.message || "Email ou senha incorretos",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message || "Email ou senha incorretos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordData) => {
    if (countdown > 0) return;

    setForgotPasswordLoading(true);
    try {
      const response = await fetchWithAuth("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        setForgotPasswordSent(true);
        setCountdown(60);
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
        description: error.message || "Erro ao processar a solicitação. Tente novamente.",
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

  // Enter key navigates from email to password
  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const passwordInput = document.getElementById("password-input");
      passwordInput?.focus();
    }
  };

  const passwordValue = form.watch("password");

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A" }}>

      {/* Login success overlay */}
      <AnimatePresence>
        {loginSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
            >
              <CheckCircle2 className="w-24 h-24" style={{ color: "#00A137" }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT PANEL — Desktop only ── */}
      <motion.div
        variants={leftPanelVariants}
        initial="hidden"
        animate="visible"
        className="hidden md:flex relative flex-col items-center justify-center overflow-hidden"
        style={{ width: "50%", minHeight: "100vh", background: "#068130" }}
      >
        {/* Decorative recycling icons */}
        <RecycleIcon
          className="absolute w-32 h-32 pointer-events-none"
          style={{ top: "10%", left: "8%", opacity: 0.12 }}
        />
        <RecycleIcon
          className="absolute w-20 h-20 pointer-events-none"
          style={{ top: "22%", right: "9%", opacity: 0.09 }}
        />
        <RecycleIcon
          className="absolute w-28 h-28 pointer-events-none"
          style={{ bottom: "14%", left: "14%", opacity: 0.12 }}
        />
        <RecycleIcon
          className="absolute w-16 h-16 pointer-events-none"
          style={{ bottom: "32%", right: "7%", opacity: 0.07 }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="mb-8"
          >
            <RenovLogo variant="white" size="xl" className="mx-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
            className="space-y-2"
          >
            <p
              className="text-white"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "16px",
                fontWeight: 400,
                opacity: 0.9,
              }}
            >
              Sua Troca Inteligente.
            </p>
            <p
              className="text-white"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "14px",
                fontWeight: 300,
                opacity: 0.6,
              }}
            >
              Plataforma de Gestão Interna
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* ── RIGHT PANEL — Form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 md:px-14"
        style={{ background: "#0A0A0A", minHeight: "100vh" }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          {/* Mobile logo pill — hidden on desktop */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8 md:hidden">
            <div
              className="inline-flex items-center justify-center rounded-2xl px-6 py-3"
              style={{ background: "#068130" }}
            >
              <RenovLogo variant="white" size="md" />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1
              className="text-white font-bold mb-1"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "24px",
              }}
            >
              Bem-vindo
            </h1>
            <p
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Faça login para continuar
            </p>
          </motion.div>

          {/* Login form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.6px",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail
                            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          />
                          <Input
                            type="email"
                            placeholder="seuemail@renovsmart.com.br"
                            className={`${darkInputClass} pl-10`}
                            data-testid="input-login-email"
                            onKeyDown={handleEmailKeyDown}
                            aria-label="Email para login"
                            aria-describedby="email-description"
                            autoFocus
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" style={{ color: "#C53030" }} />
                      <span id="email-description" className="sr-only">
                        Digite seu email corporativo
                      </span>
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Password */}
              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: "10px",
                            fontWeight: 600,
                            letterSpacing: "0.6px",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          Senha
                        </FormLabel>
                        <button
                          type="button"
                          className="transition-colors duration-150 hover:underline underline-offset-4"
                          style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}
                          data-testid="button-forgot-password"
                          onClick={handleOpenForgotPassword}
                          aria-label="Esqueceu sua senha? Clique para recuperar"
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#00A137")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
                          }
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
                            className={`${darkInputClass} pr-10`}
                            data-testid="input-login-password"
                            aria-label="Senha para login"
                            onFocus={() => setPasswordFocused(true)}
                            {...field}
                            onBlur={() => {
                              field.onBlur();
                              setPasswordFocused(false);
                            }}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                            style={{
                              color: "rgba(255,255,255,0.35)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                            }}
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" style={{ color: "#C53030" }} />

                      {/* Password requirements — show on focus when has content */}
                      <AnimatePresence>
                        {passwordFocused && passwordValue.length > 0 && (
                          <PasswordRequirements password={passwordValue} className="mt-2" />
                        )}
                      </AnimatePresence>
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Remember me */}
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
                      <FormLabel
                        className="font-normal cursor-pointer select-none"
                        style={{
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        Lembrar-me
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Submit */}
              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  data-testid="button-login-submit"
                  aria-busy={isLoading}
                  className="w-full font-semibold text-white transition-colors duration-200 rounded-xl"
                  style={{
                    background: "#00A137",
                    height: "48px",
                    fontSize: "16px",
                    fontWeight: 600,
                    fontFamily: "Montserrat, sans-serif",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading)
                      (e.currentTarget as HTMLButtonElement).style.background = "#068130";
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading)
                      (e.currentTarget as HTMLButtonElement).style.background = "#00A137";
                  }}
                >
                  {isLoading ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando...
                    </motion.span>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </motion.div>
            </form>
          </Form>

          {/* Version footer */}
          <motion.p
            variants={itemVariants}
            className="text-center mt-10"
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: "12px",
              fontWeight: 300,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Renov Home v1.0
          </motion.p>
        </motion.div>
      </div>

      {/* ── Forgot password dialog ── */}
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
                className="flex items-center justify-center w-16 h-16 rounded-full"
                style={{ background: "rgba(0,161,55,0.1)" }}
              >
                <Mail className="w-8 h-8" style={{ color: "#00A137" }} />
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
