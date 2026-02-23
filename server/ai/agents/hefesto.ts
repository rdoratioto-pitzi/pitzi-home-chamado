import { openRouterService } from '../services/openrouter.service';

export class HefestoAgent {
  async execute(params: { prompt: string; modelId: string }): Promise<any> {
    console.log('🔨 [Hefesto] Implementando código...');
    
    const result = await openRouterService.chat({
      model: params.modelId,
      messages: [
        { role: 'system', content: 'Você é Hefesto, forjador de código. Gere código seguindo CLAUDE.md' },
        { role: 'user', content: params.prompt }
      ],
    });
    
    console.log('✅ [Hefesto] Código gerado!');
    return result;
  }
}

export const hefestoAgent = new HefestoAgent();
