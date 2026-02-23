import { openRouterService } from '../services/openrouter.service';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

interface CoderResult {
  success: boolean;
  codigoGerado: string;
  arquivosCriados: string[];
  tokensInput: number;
  tokensOutput: number;
  custo: number;
  tentativas: number;
  erros: string[];
}

interface ModelConfig {
  id: string;
  modelId: string;
  custoInputPorMm: string;
  custoOutputPorMm: string;
}

export class HefestoAgent {
  
  private readonly MAX_TENTATIVAS = 3;
  
  async execute(params: {
    prompt: string;
    modelId: string;
    modelo?: ModelConfig;
  }): Promise<CoderResult> {
    
    console.log('🔨 [Hefesto] Iniciando implementação...');
    
    // Extrair caminho do arquivo do prompt
    const arquivoAlvo = this.extrairArquivoAlvo(params.prompt);
    
    let conteudoOriginal = '';
    if (arquivoAlvo && existsSync(arquivoAlvo)) {
      console.log(`📖 [Hefesto] Lendo arquivo original: ${arquivoAlvo}`);
      conteudoOriginal = readFileSync(arquivoAlvo, 'utf-8');
    }
    
    // Construir prompt otimizado
    const promptOtimizado = this.construirPromptOtimizado(params.prompt, conteudoOriginal);
    
    // Chamar OpenRouter
    const startTime = Date.now();
    const result = await openRouterService.chat({
      model: params.modelId,
      messages: [
        { 
          role: 'system', 
          content: `Você é Hefesto, forjador de código.

REGRAS ESTRITAS:
1. Retorne APENAS código TypeScript/JavaScript válido
2. NÃO use markdown com \`\`\`
3. NÃO adicione explicações antes ou depois
4. NÃO adicione comentários explicativos em português
5. Se modificar arquivo existente, retorne arquivo COMPLETO
6. Use formato: //ARQUIVO: caminho/arquivo.ts seguido do código

Tecnologias permitidas: shadcn/ui, Wouter, TanStack Query, Drizzle ORM
Proibido: Material-UI, React Router, Prisma, Redux` 
        },
        { role: 'user', content: promptOtimizado }
      ],
      temperature: 0,
      maxTokens: 4000, // Limitar tokens para evitar excesso
    });
    
    const tempoDecorrido = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  [Hefesto] Resposta em ${tempoDecorrido}s`);
    console.log(`📊 [Hefesto] Tokens: ${result.tokensInput} in / ${result.tokensOutput} out`);
    
    const codigoGerado = result.content;
    const arquivosCriados: string[] = [];
    
    // Extrair e salvar arquivos
    const arquivos = this.extrairArquivos(codigoGerado);
    
    if (arquivos.length === 0) {
      console.log('⚠️  [Hefesto] Nenhum arquivo com //ARQUIVO: encontrado');
      console.log('💡 [Hefesto] Tentando salvar no arquivo alvo...');
      
      if (arquivoAlvo) {
        const codigoLimpo = this.limparCodigo(codigoGerado);
        this.salvarArquivo(arquivoAlvo, codigoLimpo);
        arquivosCriados.push(arquivoAlvo);
      }
    } else {
      for (const arquivo of arquivos) {
        const codigoLimpo = this.limparCodigo(arquivo.conteudo);
        this.salvarArquivo(arquivo.caminho, codigoLimpo);
        arquivosCriados.push(arquivo.caminho);
      }
    }
    
    // Calcular custo
    let custo = 0;
    if (params.modelo) {
      const custoInput = (result.tokensInput / 1_000_000) * parseFloat(params.modelo.custoInputPorMm || '0');
      const custoOutput = (result.tokensOutput / 1_000_000) * parseFloat(params.modelo.custoOutputPorMm || '0');
      custo = custoInput + custoOutput;
    }
    
    console.log(`💰 [Hefesto] Custo: $${custo.toFixed(4)}`);
    console.log(`📁 [Hefesto] ${arquivosCriados.length} arquivo(s) modificado(s)`);
    
    return {
      success: true,
      codigoGerado,
      arquivosCriados,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      custo,
      tentativas: 1,
      erros: [],
    };
  }
  
  private extrairArquivoAlvo(prompt: string): string | null {
    // Procurar por "Arquivo:" ou "arquivo:" no prompt
    const match = prompt.match(/(?:Arquivo|arquivo):\s*([^\n]+)/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }
  
  private construirPromptOtimizado(promptOriginal: string, conteudoArquivo: string): string {
    let prompt = promptOriginal;
    
    if (conteudoArquivo) {
      prompt = `ARQUIVO ATUAL:\n${conteudoArquivo}\n\nINSTRUÇÕES:\n${promptOriginal}\n\nRETORNE O ARQUIVO COMPLETO MODIFICADO.`;
    }
    
    return prompt;
  }
  
  private salvarArquivo(caminho: string, conteudo: string): void {
    try {
      console.log(`📝 [Hefesto] Salvando: ${caminho}`);
      
      const dir = dirname(caminho);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(caminho, conteudo, 'utf-8');
      console.log(`✅ [Hefesto] Salvo: ${caminho} (${conteudo.split('\n').length} linhas)`);
      
    } catch (error: any) {
      console.error(`❌ [Hefesto] Erro ao salvar ${caminho}:`, error.message);
      throw error;
    }
  }
  
  private limparCodigo(codigo: string): string {
    let limpo = codigo;
    
    // Remover blocos markdown
    limpo = limpo.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '');
    
    // Remover explicações em português/inglês após o código
    const linhas = limpo.split('\n');
    const codigoLimpo: string[] = [];
    
    for (const linha of linhas) {
      // Parar se encontrar explicação textual
      if (/^(Neste|Este|This|The|Note|Observ|Explicação|Como você pode|Agora|Para)/i.test(linha.trim())) {
        break;
      }
      codigoLimpo.push(linha);
    }
    
    return codigoLimpo.join('\n').trim();
  }
  
  private extrairArquivos(codigo: string): Array<{ caminho: string; conteudo: string }> {
    const arquivos: Array<{ caminho: string; conteudo: string }> = [];
    
    const regex = /\/\/\s*ARQUIVO:\s*([^\n]+)\n([\s\S]*?)(?=\/\/\s*ARQUIVO:|$)/gi;
    
    let match;
    while ((match = regex.exec(codigo)) !== null) {
      const caminho = match[1].trim();
      const conteudo = match[2].trim();
      
      arquivos.push({ caminho, conteudo });
    }
    
    return arquivos;
  }
}

export const hefestoAgent = new HefestoAgent();
