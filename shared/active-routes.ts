// Produto ativo: central de chamados. Os módulos legados permanecem no repositório,
// mas suas APIs não ficam disponíveis, inclusive para administradores.
const SUPPORT_API_PREFIXES = [
  "/api/auth", "/api/tickets", "/api/ticket-responsaveis",
  "/api/workspace/chamados", "/api/users", "/api/settings",
  "/api/slas", "/api/notifications", "/api/uploads",
  "/api/v1/support-groups",
];
const SUPPORT_API_PATHS = new Set([
  "/api/health", "/api/version", "/api/external/chamados",
  "/api/meta-areas", // Cadastro auxiliar de áreas usado na configuração de usuários.
]);

export function isActiveApiPath(path: string): boolean {
  if (path !== "/api" && !path.startsWith("/api/")) return true;
  return SUPPORT_API_PATHS.has(path) || SUPPORT_API_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`),
  );
}
