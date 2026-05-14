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
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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

  async chat(params: {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    tokensInput: number;
    tokensOutput: number;
  }> {
    try {
      console.log('📡 [OpenRouter] Request:', params.model);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://pitzi.com.br',
          'X-Title': 'Renov AI Dev System',
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0,
          max_tokens: params.maxTokens ?? 40000,
        }),
      });

      console.log('📡 [OpenRouter] Status:', response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ [OpenRouter] Error:', error);
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as OpenRouterResponse;
      
      console.log('📊 [OpenRouter] Choices:', data.choices?.length || 0);
      
      if (!data.choices || data.choices.length === 0) {
        console.error('❌ [OpenRouter] Response:', JSON.stringify(data).substring(0, 500));
        throw new Error('OpenRouter retornou resposta vazia');
      }

      return {
        content: data.choices[0]?.message?.content || '',
        tokensInput: data.usage?.prompt_tokens || 0,
        tokensOutput: data.usage?.completion_tokens || 0,
      };
    } catch (error: any) {
      console.error('❌ [OpenRouter] Exception:', error.message);
      throw error;
    }
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
