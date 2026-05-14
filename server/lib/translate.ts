/**
 * Serviço de tradução usando Claude via OpenRouter
 * Traduz prompts de integração para PT-BR
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface TranslationResult {
  translatedText: string;
  cached: boolean;
}

/**
 * Traduz texto para português brasileiro usando Claude via OpenRouter
 * @param text - Texto a ser traduzido
 * @param context - Contexto adicional para melhorar a tradução (opcional)
 * @returns Texto traduzido
 */
export async function translateToPortuguese(
  text: string,
  context?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = `Você é um tradutor especializado em traduzir prompts de IA e documentação técnica.
Sua tarefa é traduzir o texto fornecido para português brasileiro (pt-BR).

REGRAS:
1. Mantenha a formatação original (markdown, código, etc.)
2. Preserve variáveis como {{variable}}, {variable}, $variable, etc.
3. Traduza comentários e explicações, mas mantenha código inalterado
4. Use terminologia técnica apropriada em português
5. Mantenha o tom e estilo original do texto
6. Se o texto já estiver em português, retorne-o inalterado
7. Responda APENAS com o texto traduzido, sem explicações ou comentários adicionais`;

  const userMessage = context 
    ? `Contexto: ${context}\n\nTexto para traduzir:\n\n${text}`
    : `Traduza o seguinte texto para português brasileiro:\n\n${text}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rdoratioto-pitzi.github.io/pitzi-home-chamado",
        "X-Title": "Pitzi Home - Tradutor de Prompts"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 16000,
        temperature: 0.3 // Baixa temperatura para traduções mais consistentes
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Translate] OpenRouter API error:", response.status, error);
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error("Empty translation response");
    }

    console.log("[Translate] Tradução concluída com sucesso");
    return translatedText;
  } catch (error) {
    console.error("[Translate] Erro na tradução:", error);
    throw error;
  }
}

/**
 * Traduz conteúdo de prompt com cache
 * Verifica se já existe tradução no banco antes de chamar a API
 */
export async function translatePromptContent(
  promptId: string,
  originalContent: string,
  existingTranslation?: string | null,
  context?: string
): Promise<TranslationResult> {
  // Se já existe tradução, retorna do cache
  if (existingTranslation) {
    console.log(`[Translate] Usando tradução em cache para prompt ${promptId}`);
    return {
      translatedText: existingTranslation,
      cached: true
    };
  }

  // Traduz usando Claude
  console.log(`[Translate] Traduzindo prompt ${promptId} com Claude...`);
  const translatedText = await translateToPortuguese(originalContent, context);
  
  return {
    translatedText,
    cached: false
  };
}

/**
 * Verifica se o texto precisa de tradução
 * Detecta se o texto está em inglês ou outro idioma
 */
export function needsTranslation(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Palavras comuns em inglês que indicam necessidade de tradução
  const englishIndicators = [
    'the ', 'is ', 'are ', 'you ', 'your ', 'this ', 'that ', 'with ', 
    'from ', 'have ', 'will ', 'can ', 'should ', 'when ', 'where ',
    'create', 'update', 'delete', 'read', 'write', 'execute', 'perform',
    'please ', 'ensure ', 'following ', 'using ', 'based on ', 'in order to'
  ];

  const lowerText = text.toLowerCase();
  const englishWordCount = englishIndicators.filter(word => lowerText.includes(word)).length;
  
  // Se encontrar mais de 3 indicadores de inglês, provavelmente precisa tradução
  return englishWordCount > 3;
}
