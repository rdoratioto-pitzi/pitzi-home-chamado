// scripts/migrate-uploads-to-r2.ts
// Run from Replit: COOKIE="access_token=<JWT>" npx tsx scripts/migrate-uploads-to-r2.ts
//
// 1. Checks if file already exists in R2 (idempotent)
// 2. Calls POST /api/uploads/request-url to get HMAC-signed upload URL
// 3. PUTs the file to the signed URL

import fs from "fs";
import path from "path";

const WORKER_API = "https://homeapi.renovsmart.com.br";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const COOKIE = process.env.COOKIE; // "access_token=eyJ..."

if (!COOKIE) {
  console.error("Usage: COOKIE='access_token=<JWT>' npx tsx scripts/migrate-uploads-to-r2.ts");
  console.error("Get the JWT by logging into home-next.renovsmart.com.br and copying the access_token cookie.");
  process.exit(1);
}

async function existsInR2(key: string): Promise<boolean> {
  const res = await fetch(`${WORKER_API}/objects/${key}`, { method: "HEAD" });
  return res.ok;
}

async function getSignedUploadUrl(filename: string, size: number): Promise<string> {
  const res = await fetch(`${WORKER_API}/api/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: COOKIE! },
    body: JSON.stringify({ name: filename, size, contentType: "application/octet-stream" }),
  });
  if (!res.ok) throw new Error(`request-url failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { uploadURL: string };
  return data.uploadURL;
}

async function migrateLocalFiles() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("No local uploads directory found");
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  console.log(`Found ${files.length} local files to check`);

  let uploaded = 0, skipped = 0, failed = 0;

  for (const filename of files) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const key = `uploads/${filename}`;

    // Idempotency: skip if already in R2
    if (await existsInR2(key)) {
      console.log(`  ~ Skipped (already exists): ${filename}`);
      skipped++;
      continue;
    }

    console.log(`Uploading ${filename} (${stat.size} bytes)`);

    try {
      // Step 1: Get HMAC-signed upload URL via authenticated API
      const uploadURL = await getSignedUploadUrl(filename, stat.size);

      // Step 2: PUT file to the signed URL
      const fileBuffer = fs.readFileSync(filePath);
      const res = await fetch(uploadURL, {
        method: "PUT",
        body: fileBuffer,
        headers: { "Content-Type": "application/octet-stream" },
      });

      if (res.ok) {
        console.log(`  ✓ Uploaded successfully`);
        uploaded++;
      } else {
        console.error(`  ✗ PUT failed: ${res.status} ${await res.text()}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
}

migrateLocalFiles().catch(console.error);
