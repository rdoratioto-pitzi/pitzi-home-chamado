// worker/src/routes/knowledge.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  insertKnowledgeDocumentSchema,
  insertKnowledgeDocumentVersionSchema,
} from "@shared/schema";

const knowledge = new Hono<AppEnv>();

// GET /api/knowledge/documents
knowledge.get("/api/knowledge/documents", async (c) => {
  const storage = getStorage(c.get("db"));
  const query = c.req.query("query");
  const tag = c.req.query("tag");
  const area = c.req.query("area");
  const author = c.req.query("author");
  const status = c.req.query("status");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const favoritesOnly = c.req.query("favoritesOnly");

  const filters = {
    query: query || undefined,
    tag: tag || undefined,
    area: area || undefined,
    author: author || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    favoritesOnly: favoritesOnly === "true",
  };

  const documents = await storage.getKnowledgeDocuments(filters);
  return c.json(documents);
});

// GET /api/knowledge/documents/:id
knowledge.get("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const document = await storage.getKnowledgeDocument(c.req.param("id"));
  if (!document) return c.json({ error: "Document not found or access denied" }, 404);
  if ((document as any).createdBy !== user.userId && user.role !== "admin") {
    return c.json({ error: "Access denied" }, 403);
  }
  return c.json(document);
});

// POST /api/knowledge/documents
knowledge.post("/api/knowledge/documents", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentSchema.parse({
    ...body,
    createdBy: user.userId,
  });
  const newDocument = await storage.createKnowledgeDocument(validated);
  return c.json(newDocument, 201);
});

// PUT /api/knowledge/documents/:id
knowledge.put("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const document = await storage.getKnowledgeDocument(id);
  if (
    !document ||
    ((document as any).createdBy !== user.userId && user.role !== "admin")
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentSchema.partial().parse(body);
  const updatedDocument = await storage.updateKnowledgeDocument(id, validated);
  if (!updatedDocument) return c.json({ error: "Document not found" }, 404);
  return c.json(updatedDocument);
});

// DELETE /api/knowledge/documents/:id
knowledge.delete("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const document = await storage.getKnowledgeDocument(id);
  if (
    !document ||
    ((document as any).createdBy !== user.userId && user.role !== "admin")
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteKnowledgeDocument(id);
  if (!deleted) return c.json({ error: "Document not found" }, 404);
  return c.body(null, 204);
});

// GET /api/knowledge/documents/:id/versions
knowledge.get("/api/knowledge/documents/:id/versions", async (c) => {
  const storage = getStorage(c.get("db"));
  const versions = await storage.getKnowledgeDocumentVersions(c.req.param("id"));
  return c.json(versions);
});

// POST /api/knowledge/documents/:id/versions
knowledge.post("/api/knowledge/documents/:id/versions", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("id");
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentVersionSchema.parse({
    ...body,
    documentId,
    createdBy: user.userId,
  });
  const version = await storage.createKnowledgeDocumentVersion(validated);
  return c.json(version, 201);
});

// GET /api/knowledge/documents/:documentId/versions/:versionId
knowledge.get("/api/knowledge/documents/:documentId/versions/:versionId", async (c) => {
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("documentId");
  const versionId = c.req.param("versionId");
  const versions = await storage.getKnowledgeDocumentVersions(documentId);
  const version = versions.find((v) => v.id === versionId);
  if (!version) return c.json({ error: "Document version not found" }, 404);
  return c.json(version);
});

// POST /api/knowledge/documents/:documentId/versions/:versionId/revert — NOT IMPLEMENTED
knowledge.post(
  "/api/knowledge/documents/:documentId/versions/:versionId/revert",
  async (c) => {
    return c.json({ error: "Not Implemented: Revert Document Version" }, 501);
  }
);

// DELETE /api/knowledge/documents/:documentId/versions/:versionId — NOT IMPLEMENTED
knowledge.delete(
  "/api/knowledge/documents/:documentId/versions/:versionId",
  async (c) => {
    return c.json({ error: "Not Implemented: Delete Document Version" }, 501);
  }
);

// GET /api/knowledge/documents/:id/audit-logs
knowledge.get("/api/knowledge/documents/:id/audit-logs", async (c) => {
  const storage = getStorage(c.get("db"));
  const logs = await storage.getKnowledgeAuditLogs(c.req.param("id"));
  return c.json(logs);
});

// POST /api/knowledge/documents/:id/toggle-favorite
knowledge.post("/api/knowledge/documents/:id/toggle-favorite", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("id");
  const { isFavorite } = await c.req.json();

  if (isFavorite) {
    const existing = await storage.getKnowledgeFavorite(user.userId, documentId);
    if (!existing) {
      await storage.createKnowledgeFavorite({ userId: user.userId, documentId });
    }
  } else {
    const existing = await storage.getKnowledgeFavorite(user.userId, documentId);
    if (existing) {
      await storage.deleteKnowledgeFavorite(existing.id);
    }
  }
  return c.json({ success: true });
});

// GET /api/knowledge/favorites
knowledge.get("/api/knowledge/favorites", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const favorites = await storage.getKnowledgeFavorites(user.userId);
  return c.json(favorites);
});

export { knowledge };
