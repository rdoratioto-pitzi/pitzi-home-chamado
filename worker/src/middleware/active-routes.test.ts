import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { Hono } from "hono";
import { activeRoutesMiddleware as expressGate } from "../../../server/middleware/active-routes";
import { activeRoutesMiddleware as workerGate } from "./active-routes";

const allowed = [
  "/api/auth/login", "/api/auth/reset-password", "/api/tickets/123/comments",
  "/api/workspace/chamados", "/api/workspace/chamados/123/comentarios",
  "/api/ticket-responsaveis", "/api/users", "/api/settings/ticket_types",
  "/api/slas", "/api/uploads/request-url", "/api/notifications", "/api/version",
  "/objects/tenant/anexo.pdf", "/api/external/chamados", "/api/meta-areas",
];
const disabled = [
  "/api/projects", "/api/tasks", "/api/workspace/projetos", "/api/workspace/todos",
  "/api/workspace/counts", "/api/ai/chat", "/api/estoques", "/api/pricing",
  "/api/git-analytics/github-webhook", "/api/logistica-reversa/eventos",
  "/api/integrations/hermes/execution-update", "/api/tickets-other", "/api",
];

describe("APIs da central de chamados", () => {
  const server = express();
  server.use(expressGate);
  server.use((_req, res) => { res.status(204).end(); });
  const worker = new Hono();
  worker.use("*", workerGate);
  worker.all("*", c => c.body(null, 204));

  it.each(allowed)("preserva %s nos dois runtimes", async path => {
    expect((await request(server).get(path)).status).toBe(204);
    expect((await worker.request(path)).status).toBe(204);
  });
  it.each(disabled)("bloqueia leitura e escrita em %s antes do handler", async path => {
    for (const method of ["get", "post"] as const) {
      expect((await request(server)[method](path)).status).toBe(404);
      expect((await worker.request(path, { method: method.toUpperCase() })).status).toBe(404);
    }
  });
});
