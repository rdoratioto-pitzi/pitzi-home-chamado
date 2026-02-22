import { Router } from "express";
import { storage } from "../storage";
import {
  insertKnowledgeDocumentSchema,
  insertKnowledgeDocumentVersionSchema,
  insertKnowledgeAuditLogSchema,
  insertKnowledgeFavoriteSchema,
} from "@shared/schema";
import { z } from "zod";
import { getSessionUser, requireAdmin, requireAuth } from "../middleware/auth";

export function registerKnowledgeBaseRoutes(router: Router) {
  // ============== KNOWLEDGE BASE ==============
  router.get("/api/knowledge/documents", requireAuth, async (req, res) => {
    const { userId } = getSessionUser(req);
    const { query, tag, area, author, status, startDate, endDate, favoritesOnly } = req.query;

    const filters = {
      query: query as string || undefined,
      tag: tag as string || undefined,
      area: area as string || undefined,
      author: author as string || undefined,
      status: status as string || undefined,
      startDate: startDate as string || undefined,
      endDate: endDate as string || undefined,
      favoritesOnly: favoritesOnly === 'true',
    };

    // Adjusted to match `getKnowledgeDocuments` signature which now only takes userId and filters
    const documents = await storage.getKnowledgeDocuments(filters);
    res.json(documents);
  });

  router.get("/api/knowledge/documents/:id", requireAuth, async (req, res) => {
    const document = await storage.getKnowledgeDocument(req.params.id);
    if (!document) return res.status(404).json({ error: "Document not found or access denied" });
    const { userId } = getSessionUser(req);
    if ((document as any).createdBy !== userId && !getSessionUser(req).isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(document);
  });

  router.post("/api/knowledge/documents", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const validated = insertKnowledgeDocumentSchema.parse({ ...req.body, createdBy: userId });
      const newDocument = await storage.createKnowledgeDocument(validated);
      res.status(201).json(newDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create document" });
    }
  });

  router.put("/api/knowledge/documents/:id", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const document = await storage.getKnowledgeDocument(req.params.id);
      if (!document || ((document as any).createdBy !== userId && !getSessionUser(req).isAdmin)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const validated = insertKnowledgeDocumentSchema.partial().parse(req.body);
      const updatedDocument = await storage.updateKnowledgeDocument(req.params.id, validated);
      if (!updatedDocument) return res.status(404).json({ error: "Document not found" });
      res.json(updatedDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update document" });
    }
  });

  router.delete("/api/knowledge/documents/:id", requireAuth, async (req, res) => {
    const { userId } = getSessionUser(req);
    const document = await storage.getKnowledgeDocument(req.params.id);
    if (!document || ((document as any).createdBy !== userId && !getSessionUser(req).isAdmin)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const deleted = await storage.deleteKnowledgeDocument(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    res.status(204).send();
  });

  // Get document versions
  router.get("/api/knowledge/documents/:id/versions", requireAuth, async (req, res) => {
    const versions = await storage.getKnowledgeDocumentVersions(req.params.id);
    res.json(versions);
  });

  // Create a document version
  router.post("/api/knowledge/documents/:id/versions", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const documentId = req.params.id;
      const validated = insertKnowledgeDocumentVersionSchema.parse({ ...req.body, documentId, createdBy: userId });
      const version = await storage.createKnowledgeDocumentVersion(validated);
      res.status(201).json(version);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create document version" });
    }
  });

  // Get a specific document version
  router.get("/api/knowledge/documents/:documentId/versions/:versionId", requireAuth, async (req, res) => {
    const documentId = req.params.documentId;
    const versionId = req.params.versionId;
    const versions = await storage.getKnowledgeDocumentVersions(documentId);
    const version = versions.find(v => v.id === versionId);
    if (!version) return res.status(404).json({ error: "Document version not found" });
    res.json(version);
  });

  // Revert to a specific document version
  // TODO: Implement revertKnowledgeDocumentToVersion in storage
  router.post("/api/knowledge/documents/:documentId/versions/:versionId/revert", requireAuth, async (req, res) => {
    res.status(501).json({ error: "Not Implemented: Revert Document Version" });
  });

  // Delete a document version (only if not active)
  // TODO: Implement deleteKnowledgeDocumentVersion in storage
  router.delete("/api/knowledge/documents/:documentId/versions/:versionId", requireAuth, async (req, res) => {
    res.status(501).json({ error: "Not Implemented: Delete Document Version" });
  });

  // Get audit logs for a document
  router.get("/api/knowledge/documents/:id/audit-logs", requireAuth, async (req, res) => {
    const logs = await storage.getKnowledgeAuditLogs(req.params.id);
    res.json(logs);
  });

  // Add/remove document from favorites
  router.post("/api/knowledge/documents/:id/toggle-favorite", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const documentId = req.params.id;
      const isFavorite = req.body.isFavorite;

      if (isFavorite) {
        const existingFavorite = await storage.getKnowledgeFavorite(userId, documentId);
        if (!existingFavorite) {
          await storage.createKnowledgeFavorite({ userId, documentId });
        }
      } else {
        const existingFavorite = await storage.getKnowledgeFavorite(userId, documentId);
        if (existingFavorite) {
          await storage.deleteKnowledgeFavorite(existingFavorite.id);
        }
      }
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to toggle favorite status" });
    }
  });

  // Get user's favorite documents
  router.get("/api/knowledge/favorites", requireAuth, async (req, res) => {
    const { userId } = getSessionUser(req);
    const favorites = await storage.getKnowledgeFavorites(userId);
    res.json(favorites);
  });
}
