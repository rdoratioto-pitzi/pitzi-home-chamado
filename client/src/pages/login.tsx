import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef, useCallback } from "react";
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
import { fetchWithAuth, API_BASE, setStoredToken } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import { VersionBadge } from "@/components/version-badge";

// Identidade nova da Pitzi (logo em PNG transparente, cor do fundo da arte oficial).
const PITZI_BLUE = "#1933FC";
const PITZI_LOGO_URL = `${import.meta.env.BASE_URL}brand/pitzi-logo-2026-white.png`;

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
// Dark input classes — always dark regardless of app theme
const darkInputClass =
  "h-[52px] bg-black/[0.05] border-black/[0.10] rounded-xl text-gray-900 placeholder:text-black/30 focus-visible:ring-1 focus-visible:ring-[#3B42DE] focus-visible:border-[#3B42DE] text-sm";

// O banco (Neon) desliga quando fica parado e leva alguns segundos para voltar; sem limite,
// o botão ficava em "Entrando..." para sempre. Cada tentativa tem LOGIN_TIMEOUT_MS e há uma
// segunda tentativa automática.
const LOGIN_TIMEOUT_MS = 20_000;

class LoginTimeoutError extends Error {}

async function fetchLoginWithTimeout(body: string, path = "/api/auth/login"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    return await fetchWithAuth(path, { method: "POST", body, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new LoginTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/auth/config: "all" = senha para todos (Google não configurado), "admins" = chave de
 * emergência (senha só para admins), "off" = somente Google. */
interface AuthConfig {
  googleClientId: string | null;
  allowedDomains: string[];
  passwordLogin: "all" | "admins" | "off";
}

const FALLBACK_AUTH_CONFIG: AuthConfig = { googleClientId: null, allowedDomains: ["pitzi.com.br"], passwordLogin: "all" };

declare global {
  interface Window {
    google?: any;
  }
}

let gisScriptPromise: Promise<void> | null = null;
function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisScriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error("Não foi possível carregar o login do Google"));
    };
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

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
  const [slowServer, setSlowServer] = useState(false);

  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [showEmergencyLogin, setShowEmergencyLogin] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Acorda a API e o banco; descobre como o login é feito (Google, senha ou os dois).
  useEffect(() => {
    fetch(`${API_BASE}/api/health`, { credentials: "include" }).catch(() => undefined);
    fetch(`${API_BASE}/api/auth/config`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : FALLBACK_AUTH_CONFIG))
      .then((cfg: AuthConfig) => setAuthConfig(cfg))
      .catch(() => setAuthConfig(FALLBACK_AUTH_CONFIG));
  }, []);
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

  const handleLoginResult = (result: any) => {
    if (result.success) {
      if (result.accessToken) {
        setStoredToken(result.accessToken);
      }
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
  };

  // Callback do botão do Google: manda o ID token para a API, que cria a sessão.
  const handleGoogleCredential = useCallback(async (response: { credential?: string }) => {
    if (!response?.credential) return;
    setIsLoading(true);
    setSlowServer(false);
    const body = JSON.stringify({ credential: response.credential, rememberMe: form.getValues("rememberMe") });
    try {
      let res: Response;
      try {
        res = await fetchLoginWithTimeout(body, "/api/auth/google");
      } catch {
        setSlowServer(true);
        res = await fetchLoginWithTimeout(body, "/api/auth/google");
      }
      handleLoginResult(await res.json());
    } catch {
      toast({
        title: "O servidor demorou para responder",
        description: "Tente de novo em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSlowServer(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botão oficial do Google Identity Services.
  useEffect(() => {
    const clientId = authConfig?.googleClientId;
    if (!clientId || !googleButtonRef.current) return;
    let cancelled = false;
    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: "popup",
          hd: authConfig?.allowedDomains?.[0],
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          locale: "pt-BR",
          width: googleButtonRef.current.offsetWidth || 344,
        });
      })
      .catch((err: Error) => setGoogleError(err.message));
    return () => {
      cancelled = true;
    };
  }, [authConfig, handleGoogleCredential]);

  const passwordMode = authConfig?.passwordLogin ?? "all";
  const googleEnabled = !!authConfig?.googleClientId;
  const showPasswordForm =
    authConfig !== null && (passwordMode === "all" || (passwordMode === "admins" && showEmergencyLogin));

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setSlowServer(false);
    try {
      const body = JSON.stringify(data);
      let response: Response;
      try {
        response = await fetchLoginWithTimeout(body);
      } catch (error) {
        // Timeout ou queda de rede: tenta mais uma vez avisando que o servidor está lento.
        setSlowServer(true);
        response = await fetchLoginWithTimeout(body);
      }
      handleLoginResult(await response.json());
    } catch (error: any) {
      const timedOut = error instanceof LoginTimeoutError || error?.name === "TypeError";
      toast({
        title: timedOut ? "O servidor demorou para responder" : "Erro no login",
        description: timedOut
          ? "Tente de novo em alguns segundos."
          : error.message || "Email ou senha incorretos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSlowServer(false);
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
    <div className="min-h-screen flex" style={{ background: "#FFFFFF" }}>

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
              <CheckCircle2 className="w-24 h-24" style={{ color: "#3B42DE" }} />
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
        style={{ width: "50%", minHeight: "100vh", background: PITZI_BLUE }}
      >

        {/* Center logo */}
        <div className="relative z-10 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            <img src={PITZI_LOGO_URL} alt="Pitzi" width={300} style={{ display: "block", width: 300, height: "auto" }} />
          </motion.div>
        </div>
      </motion.div>

      {/* ── RIGHT PANEL — Form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 md:px-14"
        style={{ background: "#FFFFFF", minHeight: "100vh" }}
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
              style={{ background: PITZI_BLUE }}
            >
              <img src={PITZI_LOGO_URL} alt="Pitzi" style={{ display: "block", width: 120, height: "auto" }} />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1
              className="text-gray-900 font-bold mb-1"
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
                color: "rgba(0,0,0,0.5)",
              }}
            >
              Faça login para continuar
            </p>
          </motion.div>

          {/* Login com Google (padrão). Senha só na transição ou na chave de emergência. */}
          {authConfig === null && (
            <motion.div variants={itemVariants} className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </motion.div>
          )}
          {googleEnabled && (
            <motion.div variants={itemVariants} className="space-y-3">
              <div ref={googleButtonRef} className="w-full flex justify-center min-h-[44px]" data-testid="google-login-button" />
              {isLoading && (
                <p className="text-center text-xs" style={{ color: "rgba(0,0,0,0.5)" }}>
                  {slowServer ? "Servidor lento, tentando de novo..." : "Entrando..."}
                </p>
              )}
              {googleError && <p className="text-center text-xs text-red-600">{googleError}</p>}
              <p className="text-center" style={{ fontSize: "12px", color: "rgba(0,0,0,0.45)" }}>
                Use a sua conta {authConfig?.allowedDomains.map((d) => "@" + d).join(" ou ")}
              </p>
              {passwordMode === "admins" && !showEmergencyLogin && (
                <button
                  type="button"
                  className="block mx-auto hover:underline underline-offset-4"
                  style={{ fontSize: "11px", color: "rgba(0,0,0,0.45)" }}
                  onClick={() => setShowEmergencyLogin(true)}
                  data-testid="button-emergency-login"
                >
                  Acesso de emergência (administradores)
                </button>
              )}
            </motion.div>
          )}
          {authConfig !== null && !googleEnabled && (
            <motion.p variants={itemVariants} className="mb-4" style={{ fontSize: "12px", color: "rgba(0,0,0,0.45)" }}>
              Login com Google ainda não configurado — entre com e-mail e senha.
            </motion.p>
          )}

          {/* Login form */}
          {showPasswordForm && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className={googleEnabled ? "space-y-5 mt-6" : "space-y-5"}>

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
                          color: "rgba(0,0,0,0.5)",
                        }}
                      >
                        Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail
                            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                            style={{ color: "rgba(0,0,0,0.35)" }}
                          />
                          <Input
                            type="email"
                            placeholder="seuemail@pitzi.com.br"
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
                            color: "rgba(0,0,0,0.5)",
                          }}
                        >
                          Senha
                        </FormLabel>
                        {passwordMode === "all" && <button
                          type="button"
                          className="transition-colors duration-150 hover:underline underline-offset-4"
                          style={{ fontSize: "11px", color: "rgba(0,0,0,0.5)" }}
                          data-testid="button-forgot-password"
                          onClick={handleOpenForgotPassword}
                          aria-label="Esqueceu sua senha? Clique para recuperar"
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#3B42DE")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "rgba(0,0,0,0.5)")
                          }
                        >
                          Esqueceu a senha?
                        </button>}
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
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 text-muted-foreground hover:text-foreground p-1 bg-transparent border-none cursor-pointer"
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
                          color: "rgba(0,0,0,0.7)",
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
                    background: "#3B42DE",
                    height: "48px",
                    fontSize: "16px",
                    fontWeight: 600,
                    fontFamily: "Montserrat, sans-serif",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading)
                      (e.currentTarget as HTMLButtonElement).style.background = "#2B32C4";
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading)
                      (e.currentTarget as HTMLButtonElement).style.background = "#3B42DE";
                  }}
                >
                  {isLoading ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {slowServer ? "Servidor lento, tentando de novo..." : "Entrando..."}
                    </motion.span>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </motion.div>
            </form>
          </Form>
          )}

          {/* Version / status footer — same component as sidebar */}
          <motion.div variants={itemVariants} className="mt-8 flex justify-center">
            <VersionBadge />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Forgot password dialog ── */}
      <Dialog open={forgotPasswordOpen} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              {forgotPasswordSent
                ? "Verifique seu email para redefinir a senha."
                : "Digite seu email cadastrado para receber um link de redefinição."}
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
                style={{ background: "rgba(59,66,222,0.1)" }}
              >
                <Mail className="w-8 h-8" style={{ color: "#3B42DE" }} />
              </motion.div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Se o email estiver cadastrado no sistema, você receberá um link em instantes.
                </p>
                <p className="text-sm text-muted-foreground">
                  O link vale por 30 minutos. Sua senha atual continua valendo até você trocá-la.
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
                            placeholder="seuemail@pitzi.com.br"
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
