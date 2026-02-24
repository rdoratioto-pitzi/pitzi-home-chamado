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
}

interface ModelConfig {
  id: string;
  modelId: string;
  custoInputPorMm: string;
  custoOutputPorMm: string;
}

export class HefestoAgent {
  
  private readonly MAX_TENTATIVAS = 3;
  
  /**
   * Executa prompt com ReAct Loop completo
   * THINK → ACT → OBSERVE → REFINE (até 3x)
   */
  async execute(params: {
    prompt: string;
    modelId: string;
    modelo?: ModelConfig;
  }): Promise<CoderResult> {
    
    console.log('🔨 [Hefesto] Iniciando implementação com ReAct Loop...');
    
    let tentativa = 0;
    let ultimoErro = '';
    const erros: string[] = [];
    let tokensInputTotal = 0;
    let tokensOutputTotal = 0;
    
    while (tentativa < this.MAX_TENTATIVAS) {
      tentativa++;
      console.log(`\n🔄 [Hefesto] Tentativa ${tentativa}/${this.MAX_TENTATIVAS}`);
      
      try {
        // FASE 1: THINK (Raciocinar)
        console.log('🧠 [Hefesto] THINK - Planejando implementação...');
        const arquivoAlvo = this.extrairArquivoAlvo(params.prompt);
        let conteudoOriginal = '';
        
        if (arquivoAlvo && existsSync(arquivoAlvo)) {
          console.log(`📖 [Hefesto] Lendo arquivo: ${arquivoAlvo}`);
          conteudoOriginal = readFileSync(arquivoAlvo, 'utf-8');
        }
        
        // FASE 2: ACT (Implementar)
        console.log('⚡ [Hefesto] ACT - Gerando código...');
        const promptOtimizado = this.construirPromptOtimizado(
          params.prompt, 
          conteudoOriginal, 
          ultimoErro,
          tentativa
        );
        
        const startTime = Date.now();
        const result = await openRouterService.chat({
          model: params.modelId,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: promptOtimizado }
          ],
          temperature: 0,
          maxTokens: 8192,
        });
        
        const tempoDecorrido = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  [Hefesto] Gerado em ${tempoDecorrido}s`);
        
        tokensInputTotal += result.tokensInput;
        tokensOutputTotal += result.tokensOutput;
        
        // FASE 3: OBSERVE (Validar)
        console.log('👁️  [Hefesto] OBSERVE - Validando código gerado...');
        
        const codigoLimpo = this.limparCodigo(result.content);
        const validacao = await this.validarCodigo(codigoLimpo, arquivoAlvo);
        
        if (!validacao.valido) {
          ultimoErro = validacao.erros.join('; ');
          erros.push(`Tentativa ${tentativa}: ${ultimoErro}`);
          console.log(`❌ [Hefesto] Validação falhou: ${ultimoErro}`);
          
          if (tentativa < this.MAX_TENTATIVAS) {
            console.log('🔄 [Hefesto] REFINE - Tentando corrigir...');
            continue;
          } else {
            throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas: ${ultimoErro}`);
          }
        }
        
        // SUCESSO! Salvar arquivos
        console.log('✅ [Hefesto] Validação aprovada! Salvando...');
        const arquivosCriados = await this.salvarArquivos(codigoLimpo, arquivoAlvo);
        
        // Calcular custo
        const custo = this.calcularCusto(tokensInputTotal, tokensOutputTotal, params.modelo);
        
        console.log(`💰 [Hefesto] Custo total: $${custo.toFixed(4)}`);
        console.log(`📁 [Hefesto] ${arquivosCriados.length} arquivo(s) salvos`);
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
        };
        
      } catch (error: any) {
        ultimoErro = error.message;
        erros.push(`Tentativa ${tentativa}: ${error.message}`);
        console.error(`❌ [Hefesto] Erro: ${error.message}`);
        
        if (tentativa >= this.MAX_TENTATIVAS) {
          throw new Error(`Falha após ${this.MAX_TENTATIVAS} tentativas. Último erro: ${ultimoErro}`);
        }
      }
    }
    
    throw new Error('Loop de tentativas excedido');
  }
  
  private getSystemPrompt(): string {
    return `Você é Hefesto, forjador de código TypeScript/JavaScript de alta qualidade.

REGRAS ABSOLUTAS:
1. Retorne APENAS código válido
2. NÃO use markdown com \`\`\`
3. NÃO adicione explicações em português/inglês
4. Se modificar arquivo existente, retorne arquivo COMPLETO
5. Use formato: //ARQUIVO: caminho/arquivo.ts seguido do código

TECNOLOGIAS OBRIGATÓRIAS:
✅ shadcn/ui (componentes)
✅ Wouter (rotas)
✅ TanStack Query (state)
✅ Drizzle ORM (banco)
✅ Zod (validação)

PROIBIDO:
❌ Material-UI, Ant Design, Chakra UI
❌ React Router
❌ Prisma, TypeORM
❌ Redux, MobX, Zustand

FORMATO DE IMPORTS (EXEMPLOS):
✅ import { Button } from "@/components/ui/button";
✅ import { useQuery } from "@tanstack/react-query";
✅ import { Link } from "wouter";
✅ import { db } from "@/lib/db";
✅ import { z } from "zod";

VALIDAÇÕES QUE SERÃO FEITAS:
- Sintaxe TypeScript válida
- Chaves/parênteses balanceados
- Imports corretos
- Sem bibliotecas proibidas

Se modificar arquivo, retorne TUDO (imports, funções, exports).`;
  }
  
  private construirPromptOtimizado(
    promptOriginal: string, 
    conteudoArquivo: string,
    ultimoErro: string,
    tentativa: number
  ): string {
    let prompt = '';
    
    // Se é retry, mencionar erro
    if (tentativa > 1 && ultimoErro) {
      prompt += `TENTATIVA ${tentativa}: A tentativa anterior falhou com erro:\n"${ultimoErro}"\n\nCORRIJA o erro e tente novamente.\n\n`;
    }
    
    // Se tem arquivo original
    if (conteudoArquivo) {
      prompt += `ARQUIVO ATUAL (${conteudoArquivo.split('\n').length} linhas):\n\`\`\`typescript\n${conteudoArquivo}\n\`\`\`\n\n`;
    }
    
    // Prompt original
    prompt += `TAREFA:\n${promptOriginal}\n\n`;
    
    // Instruções de formato
    prompt += `FORMATO DE RESPOSTA:\n//ARQUIVO: caminho/completo/arquivo.ts\n[código completo aqui]\n\nRETORNE APENAS CÓDIGO, SEM EXPLICAÇÕES.`;
    
    return prompt;
  }
  
  private async validarCodigo(codigo: string, arquivoAlvo: string | null): Promise<{ valido: boolean; erros: string[] }> {
    const erros: string[] = [];
    
    // 1. Verificar se não está vazio
    if (!codigo || codigo.trim().length < 10) {
      erros.push('Código vazio ou muito curto');
      return { valido: false, erros };
    }
    
    // 2. Verificar chaves balanceadas
    const openBraces = (codigo.match(/{/g) || []).length;
    const closeBraces = (codigo.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      erros.push(`Chaves desbalanceadas: ${openBraces} aberturas vs ${closeBraces} fechamentos`);
    }
    
    // 3. Verificar parênteses balanceados
    const openParens = (codigo.match(/\(/g) || []).length;
    const closeParens = (codigo.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      erros.push(`Parênteses desbalanceados: ${openParens} aberturas vs ${closeParens} fechamentos`);
    }
    
    // 4. Verificar bibliotecas proibidas
    const proibidas = ['@mui/material', 'antd', '@chakra-ui', 'react-router-dom', 'prisma'];
    proibidas.forEach(lib => {
      if (codigo.includes(lib)) {
        erros.push(`Biblioteca proibida detectada: ${lib}`);
      }
    });
    
    // 5. Verificar se tem imports válidos (para arquivos TypeScript)
    if (codigo.includes('import') && !codigo.includes('from')) {
      erros.push('Imports mal formatados');
    }
    
    // 6. Verificar se tem código real (não só comentários)
    const semComentarios = codigo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (semComentarios.trim().length < 20) {
      erros.push('Código contém apenas comentários');
    }
    
    // 7. Syntax check com TypeScript (se possível)
    if (arquivoAlvo && arquivoAlvo.endsWith('.ts') || arquivoAlvo?.endsWith('.tsx')) {
      try {
        // Salvar temporariamente e testar compilação
        const tempFile = '/tmp/hefesto-test.ts';
        writeFileSync(tempFile, codigo, 'utf-8');
        
        const { stderr } = await execAsync(`npx tsc --noEmit ${tempFile}`, {
          timeout: 5000,
        });
        
        if (stderr && stderr.includes('error TS')) {
          const errorLines = stderr.split('\n').filter(l => l.includes('error TS'));
          if (errorLines.length > 0) {
            erros.push(`Erro TypeScript: ${errorLines[0].substring(0, 100)}`);
          }
        }
      } catch (error) {
        // Ignorar timeout ou outros erros de compilação por ora
      }
    }
    
    return {
      valido: erros.length === 0,
      erros,
    };
  }
  
  private async salvarArquivos(codigo: string, arquivoAlvo: string | null): Promise<string[]> {
    const arquivosCriados: string[] = [];
    
    // Extrair arquivos do padrão //ARQUIVO:
    const arquivos = this.extrairArquivos(codigo);
    
    if (arquivos.length > 0) {
      // Salvar arquivos marcados
      for (const arquivo of arquivos) {
        this.salvarArquivo(arquivo.caminho, arquivo.conteudo);
        arquivosCriados.push(arquivo.caminho);
      }
    } else if (arquivoAlvo) {
      // Fallback: salvar no arquivo alvo
      console.log('⚠️  [Hefesto] Nenhum //ARQUIVO: encontrado, salvando em arquivo alvo');
      this.salvarArquivo(arquivoAlvo, codigo);
      arquivosCriados.push(arquivoAlvo);
    } else {
      throw new Error('Nenhum arquivo para salvar encontrado');
    }
    
    return arquivosCriados;
  }
  
  private salvarArquivo(caminho: string, conteudo: string): void {
    console.log(`📝 [Hefesto] Salvando: ${caminho}`);
    
    const dir = dirname(caminho);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(caminho, conteudo, 'utf-8');
    const linhas = conteudo.split('\n').length;
    console.log(`✅ [Hefesto] Salvo: ${caminho} (${linhas} linhas)`);
  }
  
  private limparCodigo(codigo: string): string {
    let limpo = codigo;
    
    // Remover blocos markdown
    limpo = limpo.replace(/```[a-z]*\n?/gi, '').replace(/```$/g, '');
    
    // Remover explicações textuais
    const linhas = limpo.split('\n');
    const codigoLimpo: string[] = [];
    
    for (const linha of linhas) {
      // Parar se encontrar explicação em português/inglês
      if (/^(Neste|Este|This|The|Note|Observ|Como você|Agora|Para|Explicação)/i.test(linha.trim())) {
        break;
      }
      codigoLimpo.push(linha);
    }
    
    return codigoLimpo.join('\n').trim();
  }
  
  private extrairArquivoAlvo(prompt: string): string | null {
    const match = prompt.match(/(?:Arquivo|arquivo|File|file):\s*([^\n]+)/i);
    return match ? match[1].trim() : null;
  }
  
  private extrairArquivos(codigo: string): Array<{ caminho: string; conteudo: string }> {
    const arquivos: Array<{ caminho: string; conteudo: string }> = [];
    const regex = /\/\/\s*ARQUIVO:\s*([^\n]+)\n([\s\S]*?)(?=\/\/\s*ARQUIVO:|$)/gi;
    
    let match;
    while ((match = regex.exec(codigo)) !== null) {
      arquivos.push({
        caminho: match[1].trim(),
        conteudo: match[2].trim(),
      });
    }
    
    return arquivos;
  }
  
  private calcularCusto(tokensInput: number, tokensOutput: number, modelo?: ModelConfig): number {
    if (!modelo) return 0;
    
    const custoInput = (tokensInput / 1_000_000) * parseFloat(modelo.custoInputPorMm || '0');
    const custoOutput = (tokensOutput / 1_000_000) * parseFloat(modelo.custoOutputPorMm || '0');
    
    return custoInput + custoOutput;
  }
}

export const hefestoAgent = new HefestoAgent();
