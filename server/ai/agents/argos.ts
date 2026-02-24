interface MonitorResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  metrics: {
    linesOfCode: number;
    complexity: number;
    imports: number;
  };
}

export class ArgosAgent {
  
  async validate(params: {
    codigo: string;
    prompt: string;
  }): Promise<MonitorResult> {
    
    console.log('👁️  [Argos] Iniciando validação...');
    
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Validação de entrada
    if (!params.codigo || typeof params.codigo !== 'string') {
      console.log('⚠️  [Argos] Código vazio ou inválido');
      return {
        valid: false,
        warnings: [],
        errors: ['Código vazio ou inválido'],
        metrics: { linesOfCode: 0, complexity: 0, imports: 0 },
      };
    }
    
    // 1. Validações de sintaxe básica
    console.log('🔍 [Argos] Verificando sintaxe...');
    const syntaxCheck = this.checkSyntax(params.codigo);
    errors.push(...syntaxCheck);
    
    // 2. Validações de padrões do projeto
    console.log('🔍 [Argos] Verificando padrões do projeto...');
    const patternsCheck = this.checkProjectPatterns(params.codigo);
    errors.push(...patternsCheck.errors);
    warnings.push(...patternsCheck.warnings);
    
    // 3. Análise de complexidade
    console.log('🔍 [Argos] Analisando complexidade...');
    const metrics = this.analyzeComplexity(params.codigo);
    
    if (metrics.complexity > 20) {
      warnings.push(`Complexidade alta: ${metrics.complexity} (recomendado < 20)`);
    }
    
    const isValid = errors.length === 0;
    
    if (isValid) {
      console.log('✅ [Argos] Código aprovado!');
    } else {
      console.log(`❌ [Argos] ${errors.length} erro(s) encontrado(s)`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    
    if (warnings.length > 0) {
      console.log(`⚠️  [Argos] ${warnings.length} aviso(s)`);
    }
    
    return {
      valid: isValid,
      warnings,
      errors,
      metrics,
    };
  }
  
  private checkSyntax(code: string): string[] {
    const errors: string[] = [];
    
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    // Verificar parênteses/chaves balanceadas
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Chaves desbalanceadas: ${openBraces} aberturas, ${closeBraces} fechamentos`);
    }
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      errors.push(`Parênteses desbalanceados: ${openParens} aberturas, ${closeParens} fechamentos`);
    }
    
    return errors;
  }
  
  private checkProjectPatterns(code: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!code || typeof code !== 'string') {
      return { errors: [], warnings: [] };
    }
    
    // Bibliotecas proibidas
    const forbidden = [
      { lib: '@mui/material', name: 'Material-UI' },
      { lib: 'antd', name: 'Ant Design' },
      { lib: '@chakra-ui', name: 'Chakra UI' },
      { lib: 'react-router-dom', name: 'React Router' },
      { lib: 'redux', name: 'Redux' },
      { lib: 'prisma', name: 'Prisma' },
    ];
    
    forbidden.forEach(({ lib, name }) => {
      if (code.includes(lib)) {
        errors.push(`Biblioteca proibida: ${name} - use alternativas do CLAUDE.md`);
      }
    });
    
    // Validação com Zod
    if (code.includes('interface') && code.includes('Props') && !code.includes('zod')) {
      warnings.push('Considere usar Zod para validação de schemas');
    }
    
    return { errors, warnings };
  }
  
  private analyzeComplexity(code: string): {
    linesOfCode: number;
    complexity: number;
    imports: number;
  } {
    if (!code || typeof code !== 'string') {
      return { linesOfCode: 0, complexity: 0, imports: 0 };
    }
    
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    const linesOfCode = lines.length;
    
    // Complexidade ciclomática
    const ifCount = (code.match(/\bif\s*\(/g) || []).length;
    const forCount = (code.match(/\bfor\s*\(/g) || []).length;
    const whileCount = (code.match(/\bwhile\s*\(/g) || []).length;
    const switchCount = (code.match(/\bswitch\s*\(/g) || []).length;
    const ternaryCount = (code.match(/\?[^:]+:/g) || []).length;
    
    const complexity = 1 + ifCount + forCount + whileCount + switchCount + ternaryCount;
    
    // Contar imports
    const imports = (code.match(/^import\s+/gm) || []).length;
    
    return {
      linesOfCode,
      complexity,
      imports,
    };
  }
}

export const argosAgent = new ArgosAgent();
