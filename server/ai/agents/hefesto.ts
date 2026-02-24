import { openRouterService } from '../services/openrouter.service';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CoderResult {
  success: boolean;
  codigoGerado: string;
  arquivosCriados: string[];
  tokensInput: number;
  tokensOutput: number;
  custo: number;
  tentativas: number;
  erros: string[];
  modoUsado: 'DIFF' | 'COMPLETO';
}

interface ModelConfig {
  id: string;
  modelId: string;
  custoInputPorMm: string;
  custoOutputPorMm: string;
}

export class HefestoAgent {
  
  private readonly MAX_TENTATIVAS = 3;
  private readonly DIFF_THRESHOLD = 200;
  
  async execute(params: {
    prompt: string;
    modelId: string;
    modelo?: ModelConfig;
  }): Promise<CoderResult> {
    
    console.log('🔨 [Hefesto] Iniciando implementação com estratégia híbrida...');
    
    const arquivoAlvo = this.extrairArquivoAlvo(params.prompt);
    const estrategia = await this.decidirEstrategia(arquivoAlvo, params.prompt);
    
    console.log(`📋 [Hefesto] Estratégia escolhida: ${estrategia}`);
    
    try {
      if (estrategia === 'DIFF') {
        return await this.executarComDiff(params, arquivoAlvo!);
      } else {
        return await this.executarCompleto(params, arquivoAlvo);
      }
    } catch (error: any) {
      // FALLBACK: Se DIFF falhou, tentar COMPLETO
      if (estrategia === 'DIFF' && error.message.includes('Falha após')) {
        console.log('');
        console.log('🔄 [Hefesto] FALLBACK ATIVADO!');
        console.log('⚠️  [Hefesto] Modo DIFF falhou após 3 tentativas');
        console.log('🔄 [Hefesto] Tentando modo COMPLETO como alternativa...');
        console.log('');
        
        try {
          const result = await this.executarCompleto(params, arquivoAlvo);
          return {
            ...result,
            erros: [...result.erros, 'DIFF falhou, usado COMPLETO como fallback'],
          };
        } catch (fallbackError: any) {
          throw new Error(`DIFF e COMPLETO falharam. DIFF: ${error.message}, COMPLETO: ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }
  
  private async decidirEstrategia(arquivoAlvo: string | null, prompt: string): Promise<'DIFF' | 'COMPLETO'> {
    if (!arquivoAlvo || !existsSync(arquivoAlvo)) {
      return 'COMPLETO';
    }
    
    const conteudo = readFileSync(arquivoAlvo, 'utf-8');
    const linhas = conteudo.split('\n').length;
    
    if (linhas < this.DIFF_THRESHOLD) {
      return 'COMPLETO';
    }
    
    if (prompt.toLowerCase().includes('criar arquivo') || prompt.toLowerCase().includes('novo arquivo')) {
      return 'COMPLETO';
    }
    
    console.log(`📊 [Hefesto] Arquivo tem ${linhas} linhas (>${this.DIFF_THRESHOLD}) → usando DIFF`);
    return 'DIFF';
  }
  
  private async executarComDiff(params: any, arquivoAlvo: string): Promise<CoderResult> {
    console.log('✂️  [Hefesto] Modo DIFF ativado');
    
    let tentativa = 0;
    let ultimoErro = '';
    const erros: string[] = [];
    let tokensInputTotal = 0;
    let tokensOutputTotal = 0;
    
    while (tentativa < this.MAX_TENTATIVAS) {
      tentativa++;
      console.log(`\n🔄 [Hefesto] Tentativa ${tentativa}/${this.MAX_TENTATIVAS}`);
      
      try {
        const conteudoOriginal = readFileSync(arquivoAlvo, 'utf-8');
        const promptDiff = this.construirPromptDiff(params.prompt, conteudoOriginal, ultimoErro);
        
        const startTime = Date.now();
        const result = await openRouterService.chat({
          model: params.modelId,
          messages: [
            { role: 'system', content: this.getSystemPromptDiff() },
            { role: 'user', content: promptDiff }
          ],
          temperature: 0,
          maxTokens: 40000,
        });
        
        const tempoDecorrido = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  [Hefesto] Resposta em ${tempoDecorrido}s`);
        
        tokensInputTotal += result.tokensInput;
        tokensOutputTotal += result.tokensOutput;
        
        const novoConteudo = this.aplicarDiff(conteudoOriginal, result.content);
        const validacao = await this.validarCodigo(novoConteudo, arquivoAlvo);
        
        if (!validacao.valido) {
          ultimoErro = validacao.erros.join('; ');
          erros.push(`Tentativa ${tentativa}: ${ultimoErro}`);
          console.log(`❌ [Hefesto] Validação falhou: ${ultimoErro}`);
          
          if (tentativa < this.MAX_TENTATIVAS) {
            continue;
          } else {
            throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${ultimoErro}`);
          }
        }
        
        writeFileSync(arquivoAlvo, novoConteudo, 'utf-8');
        console.log(`✅ [Hefesto] Arquivo atualizado via DIFF`);
        
        const custo = this.calcularCusto(tokensInputTotal, tokensOutputTotal, params.modelo);
        
        return {
          success: true,
          codigoGerado: novoConteudo,
          arquivosCriados: [arquivoAlvo],
          tokensInput: tokensInputTotal,
          tokensOutput: tokensOutputTotal,
          custo,
          tentativas: tentativa,
          erros,
          modoUsado: 'DIFF',
        };
        
      } catch (error: any) {
        ultimoErro = error.message;
        erros.push(`Tentativa ${tentativa}: ${error.message}`);
        
        if (tentativa >= this.MAX_TENTATIVAS) {
          throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${ultimoErro}`);
        }
      }
    }
    
    throw new Error('Loop excedido');
  }
  
  private async executarCompleto(params: any, arquivoAlvo: string | null): Promise<CoderResult> {
    console.log('📄 [Hefesto] Modo COMPLETO ativado');
    
    let tentativa = 0;
    let ultimoErro = '';
    const erros: string[] = [];
    let tokensInputTotal = 0;
    let tokensOutputTotal = 0;
    
    while (tentativa < this.MAX_TENTATIVAS) {
      tentativa++;
      console.log(`\n🔄 [Hefesto] Tentativa ${tentativa}/${this.MAX_TENTATIVAS}`);
      
      try {
        let conteudoOriginal = '';
        
        if (arquivoAlvo && existsSync(arquivoAlvo)) {
          console.log(`📖 [Hefesto] Lendo arquivo: ${arquivoAlvo}`);
          conteudoOriginal = readFileSync(arquivoAlvo, 'utf-8');
        }
        
        const promptOtimizado = this.construirPromptCompleto(params.prompt, conteudoOriginal, ultimoErro, tentativa);
        
        const startTime = Date.now();
        const result = await openRouterService.chat({
          model: params.modelId,
          messages: [
            { role: 'system', content: this.getSystemPromptCompleto() },
            { role: 'user', content: promptOtimizado }
          ],
          temperature: 0,
          maxTokens: 40000,
        });
        
        const tempoDecorrido = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  [Hefesto] Gerado em ${tempoDecorrido}s`);
        
        tokensInputTotal += result.tokensInput;
        tokensOutputTotal += result.tokensOutput;
        
        const codigoLimpo = this.limparCodigo(result.content);
        const validacao = await this.validarCodigo(codigoLimpo, arquivoAlvo);
        
        if (!validacao.valido) {
          ultimoErro = validacao.erros.join('; ');
          erros.push(`Tentativa ${tentativa}: ${ultimoErro}`);
          console.log(`❌ [Hefesto] Validação falhou: ${ultimoErro}`);
          
          if (tentativa < this.MAX_TENTATIVAS) {
            continue;
          } else {
            throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${ultimoErro}`);
          }
        }
        
        const arquivosCriados = await this.salvarArquivos(codigoLimpo, arquivoAlvo);
        const custo = this.calcularCusto(tokensInputTotal, tokensOutputTotal, params.modelo);
        
        console.log(`💰 [Hefesto] Custo total: $${custo.toFixed(4)}`);
        console.log(`✅ [Hefesto] Sucesso na tentativa ${tentativa}!`);
        
        return {
          success: true,
          codigoGerado: codigoLimpo,
          arquivosCriados,
          tokensInput: tokensInputTotal,
          tokensOutput: tokensOutputTotal,
          custo,
          tentativas: tentativa,
          erros,
          modoUsado: 'COMPLETO',
        };
        
      } catch (error: any) {
        ultimoErro = error.message;
        erros.push(`Tentativa ${tentativa}: ${error.message}`);
        
        if (tentativa >= this.MAX_TENTATIVAS) {
          throw error;
        }
      }
    }
    
    throw new Error('Loop excedido');
  }
  
  private getSystemPromptDiff(): string {
    return `Você é Hefesto em MODO DIFF.

TAREFA: Retornar APENAS as mudanças necessárias no formato:

LINHA N: código modificado

EXEMPLOS:
LINHA 42: title: "Chat IA Renov",
LINHA 85: import { ChatBot } from "./chat";
LINHA 150-153: [DELETAR]
LINHA 154: // Nova funcionalidade

REGRAS:
- Retorne APENAS linhas que precisam mudar
- Use LINHA N: para substituições
- Use LINHA N-M: [DELETAR] para remover blocos
- NÃO retorne o arquivo completo
- NÃO use markdown
- Seja PRECISO no número da linha`;
  }
  
  private getSystemPromptCompleto(): string {
    return `Você é Hefesto em MODO COMPLETO.

REGRAS ABSOLUTAS:
1. Retorne APENAS código válido
2. NÃO use markdown com \`\`\`
3. NÃO adicione explicações
4. Use formato: //ARQUIVO: caminho seguido do código
5. Se modificar arquivo existente, retorne COMPLETO

TECNOLOGIAS:
✅ shadcn/ui, Wouter, TanStack Query, Drizzle ORM, Zod
❌ Material-UI, React Router, Prisma, Redux

IMPORTANTE: Cuide da sintaxe! Chaves JSX: href={value} não href=value`;
  }
  
  private construirPromptDiff(promptOriginal: string, conteudoArquivo: string, ultimoErro: string): string {
    let prompt = '';
    
    if (ultimoErro) {
      prompt += `ERRO ANTERIOR: ${ultimoErro}\n\nCORRIJA e tente novamente.\n\n`;
    }
    
    const linhasNumeradas = conteudoArquivo.split('\n')
      .map((linha, i) => `${i + 1}: ${linha}`)
      .join('\n');
    
    prompt += `ARQUIVO ATUAL:\n${linhasNumeradas}\n\n`;
    prompt += `TAREFA:\n${promptOriginal}\n\n`;
    prompt += `RETORNE: Apenas as linhas que precisam mudar no formato LINHA N: código`;
    
    return prompt;
  }
  
  private construirPromptCompleto(promptOriginal: string, conteudoArquivo: string, ultimoErro: string, tentativa: number): string {
    let prompt = '';
    
    if (tentativa > 1 && ultimoErro) {
      prompt += `TENTATIVA ${tentativa}: Erro anterior: "${ultimoErro}"\nCORRIJA e tente novamente.\n\n`;
    }
    
    if (conteudoArquivo) {
      prompt += `ARQUIVO ATUAL:\n\`\`\`typescript\n${conteudoArquivo}\n\`\`\`\n\n`;
    }
    
    prompt += `TAREFA:\n${promptOriginal}\n\nFORMATO:\n//ARQUIVO: caminho\n[código completo]`;
    
    return prompt;
  }
  
  private aplicarDiff(conteudoOriginal: string, diff: string): string {
    const linhas = conteudoOriginal.split('\n');
    
    console.log(`📝 [Hefesto] Aplicando DIFF... (${diff.length} chars)`);
    
    const diffLimpo = diff.replace(/```[a-z]*\n?/gi, '').replace(/```$/g, '').trim();
    
    if (!diffLimpo) {
      console.log('⚠️  [Hefesto] DIFF vazio, retornando original');
      return conteudoOriginal;
    }
    
    const mudancas = diffLimpo.split('\n').filter(l => l.trim());
    console.log(`📋 [Hefesto] ${mudancas.length} mudanças encontradas`);
    
    for (const mudanca of mudancas) {
      const matchLinha = mudanca.match(/^LINHA\s+(\d+):\s*(.*)$/i);
      if (matchLinha && matchLinha.length >= 3) {
        const numeroLinha = parseInt(matchLinha[1]) - 1;
        const novoConteudo = matchLinha[2];
        
        if (numeroLinha >= 0 && numeroLinha < linhas.length) {
          linhas[numeroLinha] = novoConteudo;
          console.log(`✏️  [Hefesto] Linha ${numeroLinha + 1} modificada`);
        } else {
          console.log(`⚠️  [Hefesto] Linha ${numeroLinha + 1} fora do range`);
        }
        continue;
      }
      
      const matchDelete = mudanca.match(/^LINHA\s+(\d+)-(\d+):\s*\[DELETAR\]$/i);
      if (matchDelete && matchDelete.length >= 3) {
        const inicio = parseInt(matchDelete[1]) - 1;
        const fim = parseInt(matchDelete[2]) - 1;
        
        if (inicio >= 0 && fim < linhas.length && inicio <= fim) {
          linhas.splice(inicio, fim - inicio + 1);
          console.log(`🗑️  [Hefesto] Linhas ${inicio + 1}-${fim + 1} deletadas`);
        }
      }
    }
    
    return linhas.join('\n');
  }
  
  private async validarCodigo(codigo: string, arquivoAlvo: string | null): Promise<{ valido: boolean; erros: string[] }> {
    const erros: string[] = [];
    
    if (!codigo || codigo.trim().length < 10) {
      erros.push('Código vazio');
      return { valido: false, erros };
    }
    
    const openBraces = (codigo.match(/{/g) || []).length;
    const closeBraces = (codigo.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      erros.push(`Chaves desbalanceadas: ${openBraces} vs ${closeBraces}`);
    }
    
    const proibidas = ['@mui/material', 'react-router-dom'];
    proibidas.forEach(lib => {
      if (codigo.includes(lib)) erros.push(`Biblioteca proibida: ${lib}`);
    });
    
    return { valido: erros.length === 0, erros };
  }
  
  private async salvarArquivos(codigo: string, arquivoAlvo: string | null): Promise<string[]> {
    const arquivos = this.extrairArquivos(codigo);
    const salvos: string[] = [];
    
    if (arquivos.length > 0) {
      for (const arq of arquivos) {
        this.salvarArquivo(arq.caminho, arq.conteudo);
        salvos.push(arq.caminho);
      }
    } else if (arquivoAlvo) {
      this.salvarArquivo(arquivoAlvo, codigo);
      salvos.push(arquivoAlvo);
    }
    
    return salvos;
  }
  
  private salvarArquivo(caminho: string, conteudo: string): void {
    const dir = dirname(caminho);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(caminho, conteudo, 'utf-8');
    console.log(`✅ [Hefesto] Salvo: ${caminho} (${conteudo.split('\n').length} linhas)`);
  }
  
  private limparCodigo(codigo: string): string {
    return codigo
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```$/g, '')
      .trim();
  }
  
  private extrairArquivoAlvo(prompt: string): string | null {
    const match = prompt.match(/(?:Arquivo|arquivo):\s*([^\n]+)/i);
    return match ? match[1].trim() : null;
  }
  
  private extrairArquivos(codigo: string): Array<{ caminho: string; conteudo: string }> {
    const arquivos: Array<{ caminho: string; conteudo: string }> = [];
    const regex = /\/\/\s*ARQUIVO:\s*([^\n]+)\n([\s\S]*?)(?=\/\/\s*ARQUIVO:|$)/gi;
    
    let match;
    while ((match = regex.exec(codigo)) !== null) {
      arquivos.push({ caminho: match[1].trim(), conteudo: match[2].trim() });
    }
    
    return arquivos;
  }
  
  private calcularCusto(tokensInput: number, tokensOutput: number, modelo?: ModelConfig): number {
    if (!modelo) return 0;
    const custoIn = (tokensInput / 1_000_000) * parseFloat(modelo.custoInputPorMm || '0');
    const custoOut = (tokensOutput / 1_000_000) * parseFloat(modelo.custoOutputPorMm || '0');
    return custoIn + custoOut;
  }
}

export const hefestoAgent = new HefestoAgent();
