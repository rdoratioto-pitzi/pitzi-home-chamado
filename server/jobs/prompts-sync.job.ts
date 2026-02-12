import cron from "node-cron";
import { promptsSyncService } from "../services/prompts-sync.service";

/**
 * Job de sincronização diária de prompts
 * Executa todos os dias às 03:00
 */
export function startPromptsSyncJob(): void {
  // Cron expression: 0 3 * * * = todo dia às 03:00
  cron.schedule("0 3 * * *", async () => {
    console.log("[CronJob] Iniciando sincronização automática de prompts...");
    
    try {
      const result = await promptsSyncService.sync();
      
      if (result.success) {
        console.log(
          `[CronJob] Sincronização concluída com sucesso. Criados: ${result.created}, Atualizados: ${result.updated}`
        );
      } else {
        console.error(
          `[CronJob] Sincronização concluída com erros. Erros: ${result.errors.length}`
        );
        result.errors.forEach((err) => console.error(`[CronJob] Erro: ${err}`));
      }
    } catch (error) {
      console.error(`[CronJob] Erro fatal na sincronização: ${error}`);
    }
  }, {
    timezone: "America/Sao_Paulo", // Fuso horário de Brasília
  });

  console.log("[CronJob] Job de sincronização de prompts agendado para 03:00 todos os dias");
}

/**
 * Executa a sincronização manualmente (útil para testes ou sincronização inicial)
 */
export async function runPromptsSyncNow(): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}> {
  console.log("[PromptsSync] Executando sincronização manual...");
  return await promptsSyncService.sync();
}
