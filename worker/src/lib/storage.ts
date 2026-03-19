// worker/src/lib/storage.ts
//
// Bridge: re-exports getStorage from server/storage.ts with type cast.
// The server's Database type (drizzle-orm/node-postgres) differs from
// the Worker's Database type (drizzle-orm/neon-http) at the TS level,
// but both expose identical Drizzle query APIs at runtime.
//
import { getStorage as _getStorage } from "../../../server/storage";
import type { IStorage } from "../../../server/storage";
import type { Database } from "./db";

export function getStorage(db: Database): IStorage {
  return _getStorage(db as any);
}

export type { IStorage };
