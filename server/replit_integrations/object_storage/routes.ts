import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Check if we are on Replit or have the necessary env vars
      const isReplit = process.env.REPLIT_SLUG || process.env.REPLIT_ID;

      if (isReplit) {
        try {
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();
          const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
          return res.json({
            uploadURL,
            objectPath,
            metadata: { name, size, contentType },
          });
        } catch (replitError) {
          console.warn("Replit upload failed, falling back to local:", replitError);
        }
      }

      // Local fallback
      const objectId = randomUUID();
      const ext = path.extname(name);
      const localFilename = `${objectId}${ext}`;
      const uploadURL = `${req.protocol}://${req.get('host')}/api/uploads/local-put/${localFilename}`;
      const objectPath = `/objects/uploads/${localFilename}`;

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Local PUT handler for development
   */
  app.put("/api/uploads/local-put/:filename", (req, res) => {
    const filename = req.params.filename;
    const uploadDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      res.status(200).json({ success: true, path: `/objects/uploads/${filename}` });
    });

    writeStream.on("error", (err) => {
      console.error("Local upload error:", err);
      res.status(500).json({ error: "Failed to save file locally" });
    });
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get(/^\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectPath = req.path;

      // Try local filesystem first in development
      if (objectPath.startsWith("/objects/uploads/")) {
        const filename = objectPath.replace("/objects/uploads/", "");
        const localPath = path.join(process.cwd(), "uploads", filename);

        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
        }
      }

      // If not found locally, try Replit storage if available
      try {
        const privateDir = objectStorageService.getPrivateObjectDir();
        if (privateDir) {
          const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
          await objectStorageService.downloadObject(objectFile, res);
        } else {
          return res.status(404).json({ error: "Object not found (Local storage only)" });
        }
      } catch (err) {
        if (err instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Object not found" });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

