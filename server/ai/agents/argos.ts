export class ArgosAgent {
  async validate(codigo: string): Promise<{ valid: boolean; errors: string[] }> {
    console.log('👁️  [Argos] Validando código...');
    
    const errors: string[] = [];
    
    if (!codigo || codigo.length < 10) {
      errors.push('Código muito curto');
    }
    
    console.log(errors.length === 0 ? '✅ [Argos] Aprovado!' : '❌ [Argos] Erros encontrados');
    
    return { valid: errors.length === 0, errors };
  }
}

export const argosAgent = new ArgosAgent();
