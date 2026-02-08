import { storage } from "./storage";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ContextOptions {
  userId?: string;
  tenantId?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

let cachedModels: OpenRouterModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30 * 60 * 1000;

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedModels;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = (data.data || [])
      .filter((m: any) => {
        const modality = m.architecture?.modality || "";
        return modality.includes("text") && modality.includes("->text");
      })
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        context_length: m.context_length,
        pricing: {
          prompt: m.pricing?.prompt || "0",
          completion: m.pricing?.completion || "0",
        },
        architecture: m.architecture,
        top_provider: m.top_provider,
      }));

    cachedModels = models;
    cacheTimestamp = now;
    return models;
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    if (cachedModels) return cachedModels;
    throw error;
  }
}

async function getSystemPrompt(options: ContextOptions = {}): Promise<string> {
  const knowledgeDocs = await storage.getKnowledgeDocuments({ status: "aprovado" });
  const metas = await storage.getMetas();
  const tickets = await storage.getTickets();
  const tasks = await storage.getTasks();
  const projects = await storage.getProjects();
  const objectives = await storage.getObjectives();
  const pricingDevices = await storage.getPricingDevices();
  const pricingAlerts = options.userId ? await storage.getPricingAlerts(options.userId) : [];
  const logisticaPedidos = await storage.getLogisticaReversaPedidos();
  
  const docsContext = knowledgeDocs.slice(0, 10).map(d => `- ${d.titulo}: ${d.conteudo?.substring(0, 200)}...`).join("\n");
  const metasContext = metas.slice(0, 5).map(m => `- ${m.title} (${m.status}): ${m.currentValue}/${m.targetValue} ${m.unit || ''}`).join("\n");
  const ticketsContext = tickets.slice(0, 10).map(t => `- ${t.code}: ${t.title} (${t.status}, Prioridade: ${t.priority})`).join("\n");
  const tasksContext = tasks.slice(0, 10).map(t => `- ${t.title} (${t.status}, Prioridade: ${t.priority})`).join("\n");
  const projectsContext = projects.slice(0, 5).map(p => `- ${p.name}: ${p.description || 'Sem descrição'} (Status: ${p.status})`).join("\n");
  const objectivesContext = objectives.slice(0, 5).map(o => `- ${o.title} (${o.status})`).join("\n");
  const pricingContext = pricingDevices.slice(0, 5).map(d => `- ${d.manufacturerName} ${d.modelName} ${d.storage}GB`).join("\n");
  const alertsContext = pricingAlerts.slice(0, 3).map(a => `- Alerta dispositivo ${a.deviceId} (${a.alertType})`).join("\n");
  const logisticaContext = logisticaPedidos.slice(0, 5).map(p => `- Pedido #${p.id}: ${p.status}`).join("\n");

  return `Você é o assistente virtual da Renov Home, uma plataforma interna para gestão empresarial da Renov.
Seu papel é ajudar os usuários com informações sobre a plataforma e seus dados.

CONTEXTO DA PLATAFORMA:
A Renov Home possui os seguintes módulos:
- Tickets: gestão de chamados internos (TI, RH, Operações)
- Projetos: gestão de projetos com Kanban
- Tarefas: gestão de tarefas por área
- Metas: acompanhamento de metas mensais
- OKRs: objetivos e resultados-chave trimestrais
- Logística: simulação de frete, logística reversa, rastreamento
- Pricing: monitoramento de preços de smartphones/iPhones
- Base de Conhecimento: documentação interna

DADOS ATUAIS DO SISTEMA:

📚 Documentos da Base de Conhecimento (Aprovados):
${docsContext || "Nenhum documento disponível"}

📊 Metas Recentes:
${metasContext || "Nenhuma meta registrada"}

🎯 OKRs (Objetivos):
${objectivesContext || "Nenhum objetivo registrado"}

🎫 Tickets Recentes:
${ticketsContext || "Nenhum ticket registrado"}

✅ Tarefas Recentes:
${tasksContext || "Nenhuma tarefa registrada"}

📁 Projetos:
${projectsContext || "Nenhum projeto registrado"}

📱 Pricing (Dispositivos Monitorados):
${pricingContext || "Nenhum dispositivo monitorado"}

🔔 Alertas de Preço do Usuário:
${alertsContext || "Nenhum alerta configurado"}

📦 Logística Reversa (Pedidos Recentes):
${logisticaContext || "Nenhum pedido de logística reversa"}

INSTRUÇÕES:
1. Responda em português brasileiro de forma clara e objetiva
2. Use as informações do contexto para responder perguntas sobre dados da empresa
3. Sugira melhorias e forneça insights quando apropriado
4. Se não tiver informação suficiente, seja honesto e sugira onde o usuário pode encontrar
5. Mantenha um tom profissional mas amigável
6. Use markdown para formatar suas respostas quando útil
7. Ao listar dados, formate de forma clara e organizada`;
}

export async function* streamChatCompletion(
  messages: Message[],
  options: ContextOptions = {},
  model: string = "google/gemini-2.0-flash-001"
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = await getSystemPrompt(options);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://renov-home.replit.app",
      "X-Title": "Renov Home AI Assistant"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

export async function generateTitle(userMessage: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return userMessage.slice(0, 50);
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://renov-home.replit.app",
        "X-Title": "Renov Home AI Assistant"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { 
            role: "system", 
            content: "Gere um título curto (máximo 6 palavras) para esta conversa baseado na mensagem do usuário. Responda apenas com o título, sem aspas ou formatação extra." 
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 30
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || userMessage.slice(0, 50);
    }
  } catch {
    // Fall back to truncating message
  }
  
  return userMessage.slice(0, 50);
}
