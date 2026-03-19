// worker/src/services/omie.service.ts
// Factory pattern — replaces Express singleton + axios + pool.query()
import { sql } from "drizzle-orm";
import type { Database } from "../lib/db";

export interface OmieConfig {
  id: number;
  app_key: string;
  app_secret: string;
  is_active: boolean;
}

export interface OmieSyncLog {
  id: number;
  endpoint: string;
  category: string;
  status: string;
  total_records: number;
  request_params?: Record<string, any>;
  response_data?: Record<string, any>;
  error_message?: string;
  synced_at: Date;
}

export interface OmieRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

export interface OmieService {
  getConfig(): Promise<OmieConfig | null>;
  updateConfig(app_key: string, app_secret: string): Promise<void>;
  callApi(endpoint: string, call: string, params?: any[]): Promise<any>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  logSync(data: Partial<OmieSyncLog>): Promise<void>;
  getSyncLogs(category?: string, limit?: number): Promise<OmieSyncLog[]>;
}

const OMIE_BASE_URL = "https://app.omie.com.br/api/v1/";

export function getOmieService(db: Database): OmieService {
  async function getConfig(): Promise<OmieConfig | null> {
    try {
      const result = await db.execute(
        sql`SELECT id, app_key, app_secret, is_active FROM omie_config WHERE is_active = true LIMIT 1`,
      );
      const row = (result as any).rows?.[0];
      return row || null;
    } catch (error: any) {
      console.error("[OMIE Service] Error loading config:", error.message);
      return null;
    }
  }

  async function updateConfig(
    app_key: string,
    app_secret: string,
  ): Promise<void> {
    const existing = await db.execute(
      sql`SELECT id FROM omie_config LIMIT 1`,
    );
    const row = (existing as any).rows?.[0];

    if (row) {
      await db.execute(
        sql`UPDATE omie_config SET app_key = ${app_key}, app_secret = ${app_secret}, is_active = true, updated_at = NOW() WHERE id = ${row.id}`,
      );
    } else {
      await db.execute(
        sql`INSERT INTO omie_config (app_key, app_secret, is_active) VALUES (${app_key}, ${app_secret}, true)`,
      );
    }
  }

  async function callApi(
    endpoint: string,
    call: string,
    params: any[] = [],
  ): Promise<any> {
    const config = await getConfig();
    if (!config) {
      throw new Error(
        "Omie config not found. Please configure API credentials first.",
      );
    }

    const requestBody: OmieRequest = {
      call,
      app_key: config.app_key,
      app_secret: config.app_secret,
      param: params,
    };

    const fullUrl = `${OMIE_BASE_URL}${endpoint}`;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const duration = Date.now() - startTime;
        const data = (await response.json()) as any;

        console.log(
          `[OMIE Service] ${endpoint}/${call} — ${response.status} in ${duration}ms`,
        );

        if (data?.faultstring) {
          throw new Error(data.faultstring);
        }
        if (data?.error) {
          throw new Error(
            data.error.message || JSON.stringify(data.error),
          );
        }
        if (data?.status === "error") {
          throw new Error(data.message || "API returned error status");
        }
        if (response.status >= 400) {
          throw new Error(
            `Omie HTTP ${response.status}: ${JSON.stringify(data)}`,
          );
        }

        return data;
      } catch (error: any) {
        console.error(
          `[OMIE Service] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`,
        );

        // Only retry on network errors
        const isRetryable =
          error.message.includes("fetch failed") ||
          error.message.includes("network") ||
          error.message.includes("timeout");

        if (!isRetryable || attempt === MAX_RETRIES) {
          throw new Error(error.message);
        }

        const delay = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Max retries reached calling Omie API");
  }

  async function testConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const config = await getConfig();
      if (!config) {
        return {
          success: false,
          message: "Configuração não encontrada. Execute a migration.",
        };
      }

      const requestBody = {
        call: "ListarClientes",
        app_key: config.app_key,
        app_secret: config.app_secret,
        param: [{ pagina: 1, registros_por_pagina: 1 }],
      };

      const response = await fetch(`${OMIE_BASE_URL}geral/clientes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as any;

      if (data?.faultstring) {
        return { success: false, message: data.faultstring };
      }

      if (response.status === 200 && !data.faultstring) {
        return { success: true, message: "Conexão estabelecida com sucesso!" };
      }

      return {
        success: false,
        message: "Resposta inesperada da API Omie",
      };
    } catch (error: any) {
      if (error.response?.data?.faultstring) {
        return { success: false, message: error.response.data.faultstring };
      }
      return {
        success: false,
        message: error.message || "Erro ao testar conexão",
      };
    }
  }

  async function logSync(data: Partial<OmieSyncLog>): Promise<void> {
    try {
      await db.execute(
        sql`INSERT INTO omie_sync_log (endpoint, category, status, total_records, request_params, response_data, error_message)
           VALUES (${data.endpoint}, ${data.category || "geral"}, ${data.status}, ${data.total_records || 0}, ${JSON.stringify(data.request_params || {})}, ${JSON.stringify(data.response_data || {})}, ${data.error_message || null})`,
      );
    } catch (error: any) {
      console.error("[OMIE Service] Error saving log:", error.message);
    }
  }

  async function getSyncLogs(
    category?: string,
    limit: number = 50,
  ): Promise<OmieSyncLog[]> {
    try {
      let result;
      if (category) {
        result = await db.execute(
          sql`SELECT * FROM omie_sync_log WHERE category = ${category} ORDER BY synced_at DESC LIMIT ${limit}`,
        );
      } else {
        result = await db.execute(
          sql`SELECT * FROM omie_sync_log ORDER BY synced_at DESC LIMIT ${limit}`,
        );
      }
      return ((result as any).rows || []) as OmieSyncLog[];
    } catch (error: any) {
      console.error("[OMIE Service] Error fetching logs:", error.message);
      return [];
    }
  }

  return {
    getConfig,
    updateConfig,
    callApi,
    testConnection,
    logSync,
    getSyncLogs,
  };
}
