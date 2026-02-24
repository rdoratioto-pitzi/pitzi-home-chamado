interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message: string;
    code: number;
  };
}

interface ChatParams {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface ChatResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
}

class OpenRouterService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY não configurada');
    }
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://renovsmart.com.br',
        'X-Title': 'Renov AI Dev System',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0,
        max_tokens: params.maxTokens ?? 40000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [OpenRouter] Erro HTTP:', response.status, error);
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as OpenRouterResponse;
    
    // Debug: ver resposta
    console.log('📡 [OpenRouter] Status:', response.status);
    console.log('📊 [OpenRouter] Resposta (primeiros 300 chars):', JSON.stringify(data).substring(0, 300));
    
    // Verificar erro na resposta
    if (data.error) {
      console.error('❌ [OpenRouter] Erro na resposta:', data.error);
      throw new Error(`OpenRouter error: ${data.error.message}`);
    }
    
    // Validar formato
    if (!data.choices || data.choices.length === 0) {
      console.error('❌ [OpenRouter] Resposta sem choices:', JSON.stringify(data));
      throw new Error('OpenRouter retornou resposta sem choices');
    }
    
    if (!data.choices[0].message) {
      console.error('❌ [OpenRouter] Choice sem message:', JSON.stringify(data.choices[0]));
      throw new Error('OpenRouter retornou choice sem message');
    }
    
    const content = data.choices[0].message.content || '';
    const tokensInput = data.usage?.prompt_tokens || 0;
    const tokensOutput = data.usage?.completion_tokens || 0;
    
    console.log(`✅ [OpenRouter] Sucesso: ${tokensInput} in / ${tokensOutput} out`);
    
    return {
      content,
      tokensInput,
      tokensOutput,
    };
  }

  async testConnection(model: string = 'minimax/minimax-01'): Promise<boolean> {
    try {
      await this.chat({
        model,
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 10,
      });
      return true;
    } catch (error) {
      console.error('OpenRouter connection test failed:', error);
      return false;
    }
  }
}

export const openRouterService = new OpenRouterService();
