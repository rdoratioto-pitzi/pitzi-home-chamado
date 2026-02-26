/**
 * Job de sincronização automática do Git Analytics
 * 
 * Este job sincroniza automaticamente os dados dos repositórios GitHub
 * a cada 6 horas para manter o dashboard atualizado.
 * 
 * Timezone: America/Sao_Paulo (Brasília)
 */

import cron from "node-cron";
import { storage } from "../storage";
import { syncAllRepositories } from "../services/github-sync";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Função principal de sincronização
 * Sincroniza todos os repositórios ativos
 */
export async function runGitSyncJob(): Promise<void> {
  console.log("[GitSyncJob] Iniciando sincronização automática de repositórios GitHub...");
  
  try {
    // Verificar se o token está configurado
    if (!process.env.GITHUB_TOKEN) {
      console.error("[GitSyncJob] ERRO: GITHUB_TOKEN não está configurado");
      return;
    }
    
    // Buscar repositórios ativos
    const repositories = await storage.getGitRepositories();
    const activeRepos = repositories.filter(r => r.isActive && r.syncEnabled);
    
    if (activeRepos.length === 0) {
      console.log("[GitSyncJob] Nenhum repositório ativo para sincronizar");
      return;
    }
    
    console.log(`[GitSyncJob] Encontrados ${activeRepos.length} repositórios ativos para sincronizar`);
    
    // Executar sincronização
    await syncAllRepositories();
    
    console.log("[GitSyncJob] Sincronização automática concluída com sucesso");
    
  } catch (error) {
    console.error("[GitSyncJob] Erro durante sincronização automática:", error);
  }
}

/**
 * Inicia o cron job para sincronização automática
 * 
 * Executa a cada 6 horas:
 * - 00:00, 06:00, 12:00, 18:00
 * 
 * Expressão cron: "0 */6 * * *"
 */
export function startGitSyncJob(): void {
  cron.schedule("0 */6 * * *", async () => {
    console.log("\n========================================");
    console.log("[GitSyncJob] 🎯 Iniciando job de sincronização automática...");
    console.log("========================================\n");
    
    await runGitSyncJob();
    
    console.log("\n========================================");
    console.log("[GitSyncJob] ✅ Job de sincronização automática finalizado");
    console.log("========================================\n");
  }, {
    timezone: TIMEZONE,
    scheduled: true,
  });
  
  console.log("[GitSyncJob] ✅ Job agendado para executar a cada 6 horas (00:00, 06:00, 12:00, 18:00)");
  console.log("[GitSyncJob] 📍 Timezone: America/Sao_Paulo");
}

// Exporta também para execução manual
export { runGitSyncJob as runGitSyncNow };
