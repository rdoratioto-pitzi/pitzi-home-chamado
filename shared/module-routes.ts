// Permissão de módulo exigida por prefixo de API (basta uma das listadas; admin passa sempre).
// Derivado das telas que chamam cada API (client/src/App.tsx → requiredPermission).
// Rotas compartilhadas entre módulos (usuários, notificações, uploads, chamados) ficam fora.
import type { ModulePermissionKey } from "./permissions";

export const MODULE_ROUTES: ReadonlyArray<{ prefix: string; modules: ModulePermissionKey[] }> = [
  { prefix: "/api/estoques", modules: ["estoques", "apis"] },
  { prefix: "/api/avaliacoes-ia", modules: ["avaliacoes", "apis", "logistica"] },
  { prefix: "/api/avaliacoes", modules: ["avaliacoes"] },
  { prefix: "/api/integrations/relatorio-pedidos", modules: ["apis"] },
  { prefix: "/api/logistica", modules: ["logistica", "apis"] },
  { prefix: "/api/shipments", modules: ["logistica"] },
  { prefix: "/api/triagem", modules: ["triagem"] },
  { prefix: "/api/etiquetas", modules: ["triagem"] },
  { prefix: "/api/pricing", modules: ["pricing"] },
  { prefix: "/api/apoio-vendas", modules: ["apoio_vendas"] },
  { prefix: "/api/apoio-gestao", modules: ["apoio_vendas"] },
  { prefix: "/api/okrs", modules: ["okrs"] },
  { prefix: "/api/metas", modules: ["metas"] },
  { prefix: "/api/comercial", modules: ["comercial"] },
];

/** Módulos que liberam `path`, ou null se a rota não pertence a um módulo específico. */
export function modulesForPath(path: string): ModulePermissionKey[] | null {
  const match = MODULE_ROUTES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match.modules : null;
}
