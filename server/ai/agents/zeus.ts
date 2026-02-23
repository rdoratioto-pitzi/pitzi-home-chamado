import { db } from '../../db';
import { aiPlans, aiPromptExecutions, aiModels } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { planParserService } from '../services/plan-parser.service';
import { aiEmailService } from '../services/email.service';

interface OrchestrationResult {
  success: boolean;
  planId: string;
  custoTotal: number;
  tempoTotal: number;
  arquivosModificados: string[];
  erros: string[];
}

export class ZeusAgent {
  
  async executePlan(params: {
    planPath: string;
    modeloNome: string;
    userId: number;
    userEmail: string;
  }): Promise<OrchestrationResult> {
    
    const startTime = Date.now();
    console.log('⚡ [Zeus] Iniciando execução do plan...');
    
    try {
      const parsedPlan = planParserService.parsePlanFile(params.planPath);
      const validation = planParserService.validatePlan(parsedPlan);
      
      if (!validation.valid) {
        throw new Error(`Plan inválido: ${validation.errors.join(', ')}`);
      }
      
      if (!db) throw new Error('Database not connected');
      
      const modelo = await db.query.aiModels.findFirst({
        where: eq(aiModels.nome, params.modeloNome),
      });
      
      if (!modelo || !modelo.ativo) {
        throw new Error(`Modelo "${params.modeloNome}" não encontrado`);
      }
      
      const [planRecord] = await db.insert(aiPlans).values({
        userId: params.userId,
        titulo: parsedPlan.titulo,
        requisito: parsedPlan.requisito,
        arquivoOrigem: params.planPath,
        prompts: parsedPlan.prompts,
        modeloId: modelo.id,
        status: 'running',
        startedAt: new Date(),
      }).returning();
      
      console.log(`✅ [Zeus] Plan ${planRecord.id} iniciado`);
      
      const arquivosModificados: string[] = [];
      let custoTotal = 0;
      const erros: string[] = [];
      
      for (const prompt of parsedPlan.prompts) {
        console.log(`🔄 [Zeus] PROMPT ${prompt.ordem}: ${prompt.titulo}`);
        
        await db.insert(aiPromptExecutions).values({
          planId: planRecord.id,
          ordem: prompt.ordem,
          titulo: prompt.titulo,
          prompt: prompt.prompt,
          status: 'pending',
          startedAt: new Date(),
        });
      }
      
      const endTime = Date.now();
      const tempoTotal = Math.floor((endTime - startTime) / 1000);
      
      await db.update(aiPlans)
        .set({
          status: 'completed',
          completedAt: new Date(),
          custoTotal: custoTotal.toString(),
          tempoTotalSegundos: tempoTotal,
          arquivosModificados,
        })
        .where(eq(aiPlans.id, planRecord.id));
      
      if (erros.length === 0) {
        await aiEmailService.sendPlanCompleted({
          userEmail: params.userEmail,
          planTitulo: parsedPlan.titulo,
          planId: planRecord.id,
          tempoTotal,
          custoTotal,
          arquivosModificados,
        });
      }
      
      console.log('⚡ [Zeus] Execução concluída!');
      
      return {
        success: erros.length === 0,
        planId: planRecord.id,
        custoTotal,
        tempoTotal,
        arquivosModificados,
        erros,
      };
      
    } catch (error: any) {
      console.error('❌ [Zeus] Erro:', error.message);
      throw error;
    }
  }
}

export const zeusAgent = new ZeusAgent();
