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
    
    // Chamar OpenRouter
    const result = await openRouterService.chat({
      model: params.modelId,
      messages: [
        { 
          role: 'system', 
          content: `Você é Hefesto, forjador de código. 

INSTRUÇÕES CRÍTICAS:
1. Leia o arquivo COMPLETO antes de modificar
2. Gere o arquivo COMPLETO modificado
3. Use o formato:
//ARQUIVO: caminho/do/arquivo.ts
[código completo do arquivo aqui]

4. NÃO adicione explicações após o código
5. NÃO use markdown com \`\`\`
6. Apenas código TypeScript/JavaScript válido
7. Mantenha TODA a estrutura original, apenas faça a mudança solicitada

Siga CLAUDE.md: shadcn/ui, Wouter, TanStack Query, Drizzle ORM.` 
        },
        { role: 'user', content: params.prompt }
      ],
    });
    
    console.log('✅ [Hefesto] Código gerado!');
    
    const codigoGerado = result.content;
    const arquivosCriados: string[] = [];
    
    // Extrair e salvar arquivos do código gerado
    const arquivos = this.extrairArquivos(codigoGerado);
    
    for (const arquivo of arquivos) {
      try {
        console.log(`📝 [Hefesto] Salvando: ${arquivo.caminho}`);
        
        // Limpar código antes de salvar
        const codigoLimpo = this.limparCodigo(arquivo.conteudo);
        
        // Criar diretório se não existir
        const dir = dirname(arquivo.caminho);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        
        // Salvar arquivo
        writeFileSync(arquivo.caminho, codigoLimpo, 'utf-8');
        arquivosCriados.push(arquivo.caminho);
        
        console.log(`✅ [Hefesto] Salvo: ${arquivo.caminho}`);
        
      } catch (error: any) {
        console.error(`❌ [Hefesto] Erro ao salvar ${arquivo.caminho}:`, error.message);
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
  
  /**
   * Limpa código gerado pelo LLM
   * Remove explicações, markdown, texto extra
   */
  private limparCodigo(codigo: string): string {
    let limpo = codigo;
    
    // Remover blocos markdown
    limpo = limpo.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '');
    
    // Remover explicações em português/inglês após o código
    // Procura por linhas que começam com texto descritivo
    const linhas = limpo.split('\n');
    const codigoLimpo: string[] = [];
    let dentroExplicacao = false;
    
    for (const linha of linhas) {
      // Se linha começa com texto não-código (português/inglês)
      if (/^(Neste|Este|This|The|Note|Observ|Explicação)/i.test(linha.trim())) {
        dentroExplicacao = true;
        continue;
      }
      
      if (!dentroExplicacao) {
        codigoLimpo.push(linha);
      }
    }
    
    return codigoLimpo.join('\n').trim();
  }
  
  /**
   * Extrai arquivos do código gerado
   */
  private extrairArquivos(codigo: string): Array<{ caminho: string; conteudo: string }> {
    const arquivos: Array<{ caminho: string; conteudo: string }> = [];
    
    // Padrão: //ARQUIVO: caminho/do/arquivo.ts
    const regex = /\/\/\s*ARQUIVO:\s*([^\n]+)\n([\s\S]*?)(?=\/\/\s*ARQUIVO:|$)/gi;
    
    let match;
    while ((match = regex.exec(codigo)) !== null) {
      const caminho = match[1].trim();
      const conteudo = match[2].trim();
      
      arquivos.push({ caminho, conteudo });
    }
    
    if (arquivos.length === 0) {
      console.log('⚠️  [Hefesto] Nenhum arquivo com //ARQUIVO: encontrado');
    }
    
    return arquivos;
  }
}

export const hefestoAgent = new HefestoAgent();
