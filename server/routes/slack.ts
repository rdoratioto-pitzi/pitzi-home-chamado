import type { Router } from "express";

// Slack → chamado roda só no Worker (produção): depende da assinatura do Slack e do
// executionCtx. No Express local as rotas respondem 501.
export function registerSlackRoutes(router: Router) {
  router.post("/api/slack/commands", (_req, res) => {
    res.status(501).json({ error: "Integração com o Slack disponível só no Worker (produção)." });
  });
  router.post("/api/slack/interactions", (_req, res) => {
    res.status(501).json({ error: "Integração com o Slack disponível só no Worker (produção)." });
  });
}
