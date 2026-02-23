import { readFileSync } from 'fs';
import { join } from 'path';

interface ParsedPrompt {
  ordem: number;
  titulo: string;
  prompt: string;
}

interface ParsedPlan {
  titulo: string;
  requisito: string;
  prompts: ParsedPrompt[];
  arquivoOrigem: string;
}

export class PlanParserService {
  
  /**
   * Faz o parse de um arquivo plan.md
   * 
   * Formato esperado:
   * # Título da Feature
   * 
   * Descrição (opcional)
   * 
   * ## PROMPT 1: Título da Fase
   * [conteúdo do prompt]
   * 
   * ## PROMPT 2: Título da Fase
   * [conteúdo do prompt]
   */
  parsePlanFile(filePath: string): ParsedPlan {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let titulo = '';
    let requisito = '';
    const prompts: ParsedPrompt[] = [];
    
    let currentPrompt: Partial<ParsedPrompt> | null = null;
    let collectingRequisito = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Título principal (# Título)
      if (line.startsWith('# ') && !titulo) {
        titulo = line.replace(/^# /, '').trim();
        collectingRequisito = true;
        continue;
      }
      
      // Prompt header (## PROMPT N: Título)
      const promptMatch = line.match(/^## PROMPT (\d+): (.+)$/);
      if (promptMatch) {
        collectingRequisito = false;
        
        // Salvar prompt anterior se existir
        if (currentPrompt && currentPrompt.titulo && currentPrompt.prompt) {
          prompts.push(currentPrompt as ParsedPrompt);
        }
        
        // Iniciar novo prompt
        currentPrompt = {
          ordem: parseInt(promptMatch[1]),
          titulo: promptMatch[2].trim(),
          prompt: '',
        };
        continue;
      }
      
      // Coletar requisito (texto entre título e primeiro prompt)
      if (collectingRequisito && line && !line.startsWith('#')) {
        requisito += (requisito ? ' ' : '') + line;
        continue;
      }
      
      // Coletar conteúdo do prompt
      if (currentPrompt) {
        if (line) {
          currentPrompt.prompt += (currentPrompt.prompt ? '\n' : '') + line;
        }
      }
    }
    
    // Salvar último prompt
    if (currentPrompt && currentPrompt.titulo && currentPrompt.prompt) {
      prompts.push(currentPrompt as ParsedPrompt);
    }
    
    if (!titulo) {
      throw new Error('Plan inválido: título não encontrado');
    }
    
    if (prompts.length === 0) {
      throw new Error('Plan inválido: nenhum prompt encontrado');
    }
    
    return {
      titulo,
      requisito: requisito || 'Sem descrição',
      prompts,
      arquivoOrigem: filePath,
    };
  }
  
  /**
   * Valida se um plan está no formato correto
   */
  validatePlan(plan: ParsedPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!plan.titulo) {
      errors.push('Título é obrigatório');
    }
    
    if (plan.prompts.length === 0) {
      errors.push('Pelo menos 1 prompt é obrigatório');
    }
    
    // Verificar ordem sequencial
    const ordens = plan.prompts.map(p => p.ordem).sort((a, b) => a - b);
    for (let i = 0; i < ordens.length; i++) {
      if (ordens[i] !== i + 1) {
        errors.push(`Ordem dos prompts deve ser sequencial (esperado ${i + 1}, encontrado ${ordens[i]})`);
        break;
      }
    }
    
    // Verificar prompts vazios
    plan.prompts.forEach(p => {
      if (!p.prompt.trim()) {
        errors.push(`PROMPT ${p.ordem} está vazio`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const planParserService = new PlanParserService();
