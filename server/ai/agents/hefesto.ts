import { applyPatch, createPatch, parsePatch } from 'diff';
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
  modoUsado: 'PATCH' | 'COMPLETO';
}

interface ModelConfig {
  id: string;
  modelId: string;
  custoInputPorMm: string;
  custoOutputPorMm: string;
}

export class HefestoAgent {
  
  private readonly MAX_TENTATIVAS = 3;
  private readonly PATCH_THRESHOLD = 200; // linhas
  
  async execute(params: {
    prompt: string;
    modelId: string;
    modelo?: ModelConfig;
  }): Promise<CoderResult> {
    
    console.log('🔨 [Hefesto V8] Iniciando com Git Diff nativo...');
    
    const arquivoAlvo = this.extrairArquivoAlvo(params.prompt);
    const estrategia = await this.decidirEstrategia(arquivoAlvo, params.prompt);
    
    console.log(`📋 [Hefesto] Estratégia: ${estrategia}`);
    
    try {
      if (estrategia === 'PATCH') {
        return await this.executarComPatch(params, arquivoAlvo!);
      } else {
        return await this.executarCompleto(params, arquivoAlvo);
      }
    } catch (error: any) {
      // FALLBACK: Se PATCH falhou, tentar COMPLETO
      if (estrategia === 'PATCH' && error.message.includes('Falha após')) {
        console.log('🔄 [Hefesto] FALLBACK ATIVADO!');
        console.log('⚠️  [Hefesto] Modo PATCH falhou');
        console.log('🔄 [Hefesto] Tentando modo COMPLETO...');
        
        try {
          const result = await this.executarCompleto(params, arquivoAlvo);
          return {
            ...result,
            erros: [...result.erros, 'PATCH falhou, usado COMPLETO como fallback'],
          };
        } catch (fallbackError: any) {
          throw new Error(`PATCH e COMPLETO falharam. PATCH: ${error.message}, COMPLETO: ${fallbackError.message}`);
        }
      }
      throw error;
    }
  }
  
  private async decidirEstrategia(arquivoAlvo: string | null, prompt: string): Promise<'PATCH' | 'COMPLETO'> {
    if (!arquivoAlvo || !existsSync(arquivoAlvo)) {
      return 'COMPLETO';
    }
    
    const conteudo = readFileSync(arquivoAlvo, 'utf-8');
    const linhas = conteudo.split('\n').length;
    
    if (linhas < this.PATCH_THRESHOLD) {
      return 'COMPLETO';
    }
    
    if (prompt.toLowerCase().includes('criar arquivo') || prompt.toLowerCase().includes('novo arquivo')) {
      return 'COMPLETO';
    }
    
    console.log(`📊 [Hefesto] Arquivo tem ${linhas} linhas → usando PATCH`);
    return 'PATCH';
  }
  
  private async executarComPatch(params: any, arquivoAlvo: string): Promise<CoderResult> {
    console.log('✂️  [Hefesto] Modo PATCH (Git Diff Nativo)');
    
    let tentativa = 0;
    const erros: string[] = [];
    let tokensInputTotal = 0;
    let tokensOutputTotal = 0;
    
    while (tentativa < this.MAX_TENTATIVAS) {
      tentativa++;
      console.log(`\n🔄 [Hefesto] Tentativa ${tentativa}/${this.MAX_TENTATIVAS}`);
      
      try {
        const conteudoOriginal = readFileSync(arquivoAlvo, 'utf-8');
        
        const result = await openRouterService.chat({
          model: params.modelId,
          messages: [
            { role: 'system', content: this.getSystemPromptPatch() },
            { role: 'user', content: this.construirPromptPatch(params.prompt, conteudoOriginal, arquivoAlvo) }
          ],
          temperature: 0,
          maxTokens: 40000,
        });
        
        tokensInputTotal += result.tokensInput;
        tokensOutputTotal += result.tokensOutput;
        
        console.log(`📊 [Hefesto] Tokens: ${result.tokensInput} in / ${result.tokensOutput} out`);
        
        // Aplicar patch usando biblioteca 'diff'
        const patchTexto = this.limparPatch(result.content);
        console.log(`📝 [Hefesto] Patch recebido (${patchTexto.length} chars)`);
        
        const novoConteudo = applyPatch(conteudoOriginal, patchTexto);
        
        if (!novoConteudo || novoConteudo === conteudoOriginal) {
          erros.push(`Tentativa ${tentativa}: Patch não aplicou (formato inválido)`);
          console.log('❌ [Hefesto] Patch não aplicou');
          continue;
        }
        
        // Validar
        const validacao = await this.validarCodigo(novoConteudo, arquivoAlvo);
        
        if (!validacao.valido) {
          erros.push(`Tentativa ${tentativa}: ${validacao.erros.join('; ')}`);
          console.log(`❌ [Hefesto] Validação falhou: ${validacao.erros[0]}`);
          continue;
        }
        
        // Salvar
        writeFileSync(arquivoAlvo, novoConteudo, 'utf-8');
        console.log(`✅ [Hefesto] Patch aplicado com sucesso!`);
        
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
          modoUsado: 'PATCH',
        };
        
      } catch (error: any) {
        erros.push(`Tentativa ${tentativa}: ${error.message}`);
        console.log(`❌ [Hefesto] Erro: ${error.message}`);
      }
    }
    
    throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${erros[erros.length - 1]}`);
  }
  
  private async executarCompleto(params: any, arquivoAlvo: string | null): Promise<CoderResult> {
    console.log('📄 [Hefesto] Modo COMPLETO');
    
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
          console.log(`❌ [Hefesto] Validação falhou: ${validacao.erros[0]}`);
          continue;
        }
        
        const arquivosCriados = await this.salvarArquivos(codigoLimpo, arquivoAlvo);
        const custo = this.calcularCusto(tokensInputTotal, tokensOutputTotal, params.modelo);
        
        console.log(`💰 [Hefesto] Custo: $${custo.toFixed(4)}`);
        console.log(`✅ [Hefesto] Sucesso!`);
        
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
      }
    }
    
    throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${ultimoErro}`);
  }
  
  private getSystemPromptPatch(): string {
    return `Você é Hefesto. Retorne APENAS o unified diff patch.

EXEMPLO EXATO:
--- a/file.tsx
+++ b/file.tsx
@@ -5,4 +5,7 @@
 import { useState } from "react";
 
+/**
+ * Component description
+ */
 export function MyComponent() {
   return <div>Hello</div>;

REGRAS:
1. Primeira linha: --- a/caminho
2. Segunda linha: +++ b/caminho
3. @@ -linha,qtd +linha,qtd @@
4. Linhas de contexto SEM prefixo
5. Linhas removidas com -
6. Linhas adicionadas com +
7. NÃO use \`\`\`diff
8. NÃO explique
9. APENAS o patch`;
  }
  
  private getSystemPromptCompleto(): string {
    return `Você é Hefesto em MODO COMPLETO.

REGRAS:
1. Retorne APENAS código válido
2. NÃO use markdown
3. Use formato: //ARQUIVO: caminho seguido do código
4. Se modificar arquivo existente, retorne COMPLETO

Stack: shadcn/ui, Wouter, TanStack Query, Drizzle ORM
Proibido: Material-UI, React Router, Prisma, Redux`;
  }
  
  private construirPromptPatch(promptOriginal: string, conteudoArquivo: string, arquivoAlvo: string): string {
    return `Arquivo: ${arquivoAlvo}

Conteúdo atual (${conteudoArquivo.split('\n').length} linhas):
\`\`\`typescript
${conteudoArquivo}
\`\`\`

Tarefa: ${promptOriginal}

Retorne unified diff patch para aplicar as mudanças.`;
  }
  
  private construirPromptCompleto(promptOriginal: string, conteudoArquivo: string, ultimoErro: string, tentativa: number): string {
    let prompt = '';
    
    if (tentativa > 1 && ultimoErro) {
      prompt += `TENTATIVA ${tentativa}: Erro: "${ultimoErro}"\nCORRIJA e tente novamente.\n\n`;
    }
    
    if (conteudoArquivo) {
      prompt += `ARQUIVO ATUAL:\n\`\`\`typescript\n${conteudoArquivo}\n\`\`\`\n\n`;
    }
    
    prompt += `TAREFA:\n${promptOriginal}\n\nFORMATO:\n//ARQUIVO: caminho\n[código completo]`;
    
    return prompt;
  }
  
  private limparPatch(patch: string): string {
    return patch
      .replace(/```diff\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();
  }
  
  private limparCodigo(codigo: string): string {
    return codigo
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```$/g, '')
      .trim();
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
    const linhas = conteudo.split('\n').length;
    console.log(`✅ [Hefesto] Salvo: ${caminho} (${linhas} linhas)`);
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
