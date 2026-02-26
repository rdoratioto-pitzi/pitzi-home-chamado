import cron from "node-cron";
import { parseCommits } from "../../scripts/parse-commits";

/**
 * Job de sincronização de commits do Git
 * Executa a cada 6 horas
 */
export function startGitSyncJob(): void {
  cron.schedule("0 */6 * * *", async () => {
    console.log("[GitSyncJob] Iniciando sincronização automática...");
    
    try {
      const result = await parseCommits();
      console.log(
        `[GitSyncJob] Concluído. Criados: ${result.created}, Ignorados: ${result.skipped}`
      );
    } catch (error) {
      console.error("[GitSyncJob] Erro na sincronização:", error);
    }
  }, {
    timezone: "America/Sao_Paulo",
  });

  console.log("[GitSyncJob] Agendado para executar a cada 6 horas");
}

/**
 * Executa sincronização manual
 */
export async function runGitSyncNow(): Promise<{ created: number; skipped: number }> {
  console.log("[GitSync] Executando sincronização manual...");
  return await parseCommits();
}