import { db } from '../../db';
import { aiPlans, aiPromptExecutions, aiModels } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { planParserService } from '../services/plan-parser.service';
import { aiEmailService } from '../services/email.service';
import { hefestoAgent } from './hefesto';
import { argosAgent } from './argos';
import { atenaAgent } from './atena';
import { hermesAgent } from './hermes';

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
      // 1. Parse e validação
      const parsedPlan = planParserService.parsePlanFile(params.planPath);
      const validation = planParserService.validatePlan(parsedPlan);
      
      if (!validation.valid) {
        throw new Error(`Plan inválido: ${validation.errors.join(', ')}`);
      }
      
      console.log(`✅ [Zeus] Plan validado: ${parsedPlan.prompts.length} prompts`);
      
      // 2. Buscar modelo
      if (!db) throw new Error('Database not connected');
      
      const modelo = await db.query.aiModels.findFirst({
        where: eq(aiModels.nome, params.modeloNome),
      });
      
      if (!modelo || !modelo.ativo) {
        throw new Error(`Modelo "${params.modeloNome}" não encontrado`);
      }
      
      console.log(`✅ [Zeus] Modelo: ${modelo.nome} (${modelo.provider})`);
      
      // 3. Criar plan no banco
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
      
      // 4. Executar cada prompt com os agentes
      const arquivosModificados: string[] = [];
      let custoTotal = 0;
      const erros: string[] = [];
      
      for (const prompt of parsedPlan.prompts) {
        console.log(`\n🔄 [Zeus] PROMPT ${prompt.ordem}: ${prompt.titulo}`);
        
        try {
          // Criar execução no banco
          const [execution] = await db.insert(aiPromptExecutions).values({
            planId: planRecord.id,
            ordem: prompt.ordem,
            titulo: prompt.titulo,
            prompt: prompt.prompt,
            status: 'running',
            startedAt: new Date(),
          }).returning();
          
          // HEFESTO: Gerar código
          console.log('🔨 [Zeus] → Chamando Hefesto...');
          const coderResult = await hefestoAgent.execute({
            prompt: prompt.prompt,
            modelId: modelo.modelId,
            modelo: {
              id: modelo.id,
              modelId: modelo.modelId,
              custoInputPorMm: modelo.custoInputPorMm || '0',
              custoOutputPorMm: modelo.custoOutputPorMm || '0',
            },
          });
          
          const codigo = coderResult.codigoGerado;
          
          // ARGOS: Validar código em paralelo
          console.log('👁️  [Zeus] → Chamando Argos...');
          const monitorResult = await argosAgent.validate({
            codigo: coderResult.codigoGerado,
            prompt: prompt.prompt,
          });
          
          if (!monitorResult.valid) {
            throw new Error(`Validação falhou: ${monitorResult.errors.join(', ')}`);
          }
          
          if (monitorResult.errors.length > 0) {
            console.log(`⚠️  [Zeus] Avisos do Argos: ${monitorResult.errors.join(', ')}`);
          }
          
          // Atualizar execução como sucesso
          await db.update(aiPromptExecutions)
            .set({
              status: 'completed',
              codigoGerado: codigo,
              arquivosCriados: coderResult.arquivosCriados,
              tokensInput: coderResult.tokensInput,
              tokensOutput: coderResult.tokensOutput,
              custo: coderResult.custo.toString(),
              completedAt: new Date(),
            })
            .where(eq(aiPromptExecutions.id, execution.id));
          
          // Adicionar arquivos modificados
          arquivosModificados.push(...coderResult.arquivosCriados);
          
          // Calcular custo (agora vem do Hefesto)
          custoTotal += coderResult.custo;
          
          console.log(`✅ [Zeus] PROMPT ${prompt.ordem} concluído`);
          
        } catch (error: any) {
          console.error(`❌ [Zeus] Erro no PROMPT ${prompt.ordem}:`, error.message);
          erros.push(`PROMPT ${prompt.ordem}: ${error.message}`);
        }
      }
      
      // 5. ATENA: QA Final
      if (erros.length === 0) {
        console.log('\n🦉 [Zeus] → Chamando Atena para QA final...');
        const qaResult = await atenaAgent.validate();
        
        if (!qaResult.passed) {
          erros.push(`QA falhou: ${qaResult.newErrors} novos erros`);
          console.log(`❌ [Zeus] QA reprovou: ${qaResult.newErrors} novos erros`);
        } else {
          console.log('✅ [Zeus] QA aprovado!');
        }
      }
      
      // 6. HERMES: Commit (se tudo OK)
      if (erros.length === 0 && arquivosModificados.length > 0) {
        console.log('\n📨 [Zeus] → Chamando Hermes para commit...');
        
        const commitMsg = hermesAgent.generateCommitMessage({
          planTitulo: parsedPlan.titulo,
          promptsCompletados: parsedPlan.prompts.length,
          totalPrompts: parsedPlan.prompts.length,
        });
        
        const commitResult = await hermesAgent.commit({
          arquivos: arquivosModificados,
          titulo: commitMsg.titulo,
          descricao: commitMsg.descricao,
        });
        
        if (commitResult.success) {
          console.log('✅ [Zeus] Commit criado!');
        }
      }
      
      // 7. Atualizar plan no banco
      const endTime = Date.now();
      const tempoTotal = Math.floor((endTime - startTime) / 1000);
      
      await db.update(aiPlans)
        .set({
          status: erros.length === 0 ? 'completed' : 'failed',
          completedAt: new Date(),
          custoTotal: custoTotal.toFixed(4),
          tempoTotalSegundos: tempoTotal,
          arquivosModificados,
          errosEncontrados: erros.map(e => ({ erro: e, fase: 'execution' })),
        })
        .where(eq(aiPlans.id, planRecord.id));
      
      // 8. Email de conclusão
      if (erros.length === 0) {
        console.log('\n📧 [Zeus] → Enviando email...');
        await aiEmailService.sendPlanCompleted({
          userEmail: params.userEmail,
          planTitulo: parsedPlan.titulo,
          planId: planRecord.id,
          tempoTotal,
          custoTotal,
          arquivosModificados,
        });
      }
      
      console.log('\n⚡ [Zeus] Execução concluída!');
      console.log(`⏱️  Tempo: ${tempoTotal}s`);
      console.log(`💰 Custo: $${custoTotal.toFixed(2)}`);
      
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
