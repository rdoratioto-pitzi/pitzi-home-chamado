import type { IStorage } from "../lib/storage";
import { getExternalDataContext, needsExternalData } from "./external-data";
import { detectPricingQuery, scrapeMercadoLivre, formatPricingContext } from "./firecrawl.service";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

type MessageContent = string | Array<{type: string; text?: string; image_url?: {url: string}}>;

interface Message {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

interface ContextOptions {
  userId?: string;
  tenantId?: string;
}

export interface Attachment {
  type: string;
  name: string;
  base64: string;
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

let cachedSystemPrompt: string | null = null;
let systemPromptCacheTimestamp = 0;
const SYSTEM_PROMPT_CACHE_DURATION = 5 * 60 * 1000;

export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedModels;
  }

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

async function getSystemPrompt(storage: IStorage, options: ContextOptions = {}): Promise<string> {
  const now = Date.now();
  if (cachedSystemPrompt && (now - systemPromptCacheTimestamp) < SYSTEM_PROMPT_CACHE_DURATION) {
    return cachedSystemPrompt;
  }

  const [knowledgeDocs, metas, tickets, tasks, projects, objectives, pricingDevices, pricingAlerts, logisticaPedidos, users, flowchartsList] = await Promise.all([
    storage.getKnowledgeDocuments({ status: "aprovado" }),
    storage.getMetas(),
    storage.getTickets(),
    storage.getTasks(),
    storage.getProjects(),
    storage.getObjectives(),
    storage.getPricingDevices(),
    options.userId ? storage.getPricingAlerts(options.userId) : Promise.resolve([]),
    storage.getLogisticaReversaPedidos(),
    storage.getUsers(),
    storage.getFlowcharts(),
  ]);
  
  const docsContext = knowledgeDocs.slice(0, 20).map(d => `- ${d.titulo}: ${d.conteudo?.substring(0, 300)}...`).join("\n");

  const metasAtingidas = metas.filter(m => m.status === "concluida" || m.status === "completed").length;
  const metasPendentes = metas.filter(m => m.status === "em_andamento" || m.status === "in_progress").length;
  const metasContext = metas.slice(0, 15).map(m => {
    const pct = m.targetValue && Number(m.targetValue) > 0 ? Math.round((Number(m.currentValue) / Number(m.targetValue)) * 100) : 0;
    return `- ${m.title} (${m.status}): ${m.currentValue}/${m.targetValue} ${m.unit || ''} [${pct}% concluido]`;
  }).join("\n");

  const ticketsAbertos = tickets.filter(t => t.status === "aberto" || t.status === "open").length;
  const ticketsAndamento = tickets.filter(t => t.status === "em_andamento" || t.status === "in_progress").length;
  const ticketsFechados = tickets.filter(t => t.status === "fechado" || t.status === "closed" || t.status === "resolved").length;
  const ticketsCriticos = tickets.filter(t => t.priority === "critica" || t.priority === "critical" || t.priority === "urgente").length;
  const ticketsContext = tickets.slice(0, 25).map(t => {
    const assignee = t.assigneeId ? ` | Responsavel: ${t.assigneeId}` : '';
    return `- ${t.code}: ${t.title} (Status: ${t.status}, Prioridade: ${t.priority}${assignee})`;
  }).join("\n");

  const tarefasPendentes = tasks.filter(t => t.status === "pendente" || t.status === "todo").length;
  const tarefasAndamento = tasks.filter(t => t.status === "em_andamento" || t.status === "in_progress").length;
  const tarefasConcluidas = tasks.filter(t => t.status === "concluida" || t.status === "done").length;
  const tasksContext = tasks.slice(0, 25).map(t => {
    const area = t.tagId ? ` | Tag: ${t.tagId}` : '';
    return `- ${t.title} (Status: ${t.status}, Prioridade: ${t.priority}${area})`;
  }).join("\n");

  const projectsContext = projects.slice(0, 15).map(p => {
    return `- ${p.name}: ${p.description || 'Sem descricao'} (Status: ${p.status})`;
  }).join("\n");

  const objectivesContext = objectives.slice(0, 15).map(o => `- ${o.title} (${o.status})`).join("\n");

  const pricingContext = pricingDevices.slice(0, 15).map(d => `- ${d.manufacturerName} ${d.modelName} ${d.storage}GB`).join("\n");
  const alertsContext = pricingAlerts.slice(0, 10).map(a => `- Alerta dispositivo ${a.deviceId} (${a.alertType})`).join("\n");
  const logisticaContext = logisticaPedidos.slice(0, 15).map(p => `- Pedido #${p.id}: ${p.status}`).join("\n");

  const usersContext = users.slice(0, 20).map(u => `- ${u.name} (${u.email})${u.perfilAcesso ? ` | Perfil: ${u.perfilAcesso}` : ''}${u.areaNegocio ? ` | Area: ${u.areaNegocio}` : ''}`).join("\n");

  const flowchartsContext = flowchartsList.slice(0, 15).map(f => `- ${f.title}${f.description ? `: ${f.description.substring(0, 100)}` : ''}`).join("\n");

  const prompt = `Voce e o Chat IA, o assistente virtual estrategico da Renov Home - uma plataforma interna de gestao empresarial da Renov.
Voce e um assistente avancado capaz de: analisar dados, gerar relatorios, sugerir codigo, criar prompts, identificar tendencias e fornecer insights estrategicos.
Voce tambem pode analisar imagens enviadas pelos usuarios.

CONHECIMENTO GERAL:
Voce possui conhecimento geral amplo treinado em uma grande variedade de-topicos. Isso inclui:
- Historia, geografia, ciencia, tecnologia, artes e cultura
- Atualidades e eventos mundiais
- Conceitos de negocios, economia e financa
- Programacao e desenvolvimento de software
- Linguas e traducaos
- E muito mais

Use seu conhecimento geral para responder perguntas que nao estejam relacionadas aos dados internos da plataforma Renov Home. Quando necessario, forneca informacoes precisas e atualizadas baseadas em seu treinamento.

CONTEXTO DA PLATAFORMA:
A Renov Home possui os seguintes modulos:
- Tickets: gestao de chamados internos (TI, RH, Operacoes) com SLA, Kanban, atribuicao automatica
- Projetos: gestao de projetos com Kanban, Gantt e Calendario, suporte a subtarefas
- Tarefas: gestao de tarefas por area com prioridades e comentarios
- Metas: acompanhamento de metas mensais com indicadores de progresso
- OKRs: objetivos e resultados-chave trimestrais
- Logistica: simulacao de frete (Correios), logistica reversa, rastreamento, impressao de etiquetas
- Pricing: monitoramento de precos de smartphones/iPhones com alertas e historico
- Biblioteca: documentacao interna aprovada
- Reunioes: gestao de reunioes com pautas e atas
- Fluxogramas: criacao e gestao de fluxogramas de processos

ESTATISTICAS CONSOLIDADAS:

-- Usuarios --
Total: ${users.length}
${usersContext || "Nenhum usuario registrado"}

-- Tickets --
Total: ${tickets.length} | Abertos: ${ticketsAbertos} | Em Andamento: ${ticketsAndamento} | Fechados: ${ticketsFechados} | Criticos: ${ticketsCriticos}
Taxa de Resolucao: ${tickets.length > 0 ? Math.round((ticketsFechados / tickets.length) * 100) : 0}%
${ticketsContext || "Nenhum ticket registrado"}

-- Tarefas --
Total: ${tasks.length} | Pendentes: ${tarefasPendentes} | Em Andamento: ${tarefasAndamento} | Concluidas: ${tarefasConcluidas}
Taxa de Conclusao: ${tasks.length > 0 ? Math.round((tarefasConcluidas / tasks.length) * 100) : 0}%
${tasksContext || "Nenhuma tarefa registrada"}

-- Metas --
Total: ${metas.length} | Atingidas: ${metasAtingidas} | Em Andamento: ${metasPendentes}
${metasContext || "Nenhuma meta registrada"}

-- OKRs --
${objectivesContext || "Nenhum objetivo registrado"}

-- Projetos --
Total: ${projects.length}
${projectsContext || "Nenhum projeto registrado"}

-- Fluxogramas --
Total: ${flowchartsList.length}
${flowchartsContext || "Nenhum fluxograma registrado"}

-- Pricing (Dispositivos Monitorados) --
Total: ${pricingDevices.length}
${pricingContext || "Nenhum dispositivo monitorado"}
Alertas: ${alertsContext || "Nenhum alerta configurado"}

-- Logistica Reversa --
Total Pedidos: ${logisticaPedidos.length}
${logisticaContext || "Nenhum pedido de logistica reversa"}

-- Biblioteca --
Documentos Aprovados: ${knowledgeDocs.length}
${docsContext || "Nenhum documento disponivel"}

CAPACIDADES ESPECIAIS:
1. ANALISE DE DADOS: Voce pode cruzar informacoes entre modulos para insights estrategicos
2. GERACAO DE CODIGO: Quando solicitado, gere codigo (SQL, JavaScript, Python, etc.) formatado em blocos de codigo markdown com a linguagem especificada
3. CRIACAO DE PROMPTS: Ajude usuarios a criar prompts otimizados para outras ferramentas de IA
4. RELATORIOS: Gere relatorios consolidados com dados dos modulos da plataforma
5. SUGESTOES ESTRATEGICAS: Identifique gargalos, tendencias e oportunidades de melhoria
6. AUTOMACAO: Sugira automacoes e workflows para otimizar processos
7. ANALISE DE IMAGENS: Quando o usuario enviar imagens, analise e descreva o conteudo visual
8. DADOS EXTERNOS EM TEMPO REAL: Quando o usuario perguntar sobre clima/tempo, previsoes meteorologicas, temperatura ou condicoes climaticas de qualquer cidade brasileira, voce recebera dados atualizados automaticamente. Use esses dados para responder com informacoes precisas sobre:
   - Temperatura atual e sensacao termica
   - Condicoes do ceu (limpo, nublado, chuva, etc.)
   - Umidade relativa do ar
   - Velocidade do vento
   - Indice UV
   - Precipitacao
   - Previsão para os proximos dias
   Sempre inclua emojis relevantes

ACESSO A DADOS INTERNOS:
Para consultas especificas sobre dados da plataforma (tickets, tarefas, metas, projetos, etc.), voce possui ferramentas que podem ser usadas dinamicamente para buscar informacoes detalhadas. Quando necessario, voce pode:
- Buscar tickets por titulo, status ou prioridade
- Obter detalhes de tarefas e projetos especificos
- Listar metas e seus progressos
- Consultar usuarios e documentos da base de conhecimento
- Obter estatisticas consolidadas da plataforma
Use essas ferramentas quando precisar de informacoes que vao alem dos dados resumidos fornecidos no contexto.

INSTRUCOES:
1. Responda em portugues brasileiro de forma clara e objetiva
2. Use as informacoes do contexto para responder perguntas sobre dados da empresa
3. Sugira melhorias e forneca insights quando apropriado
4. Se nao tiver informacao suficiente, seja honesto e sugira onde o usuario pode encontrar
5. Mantenha um tom profissional mas amigavel
6. Use markdown para formatar suas respostas: titulos, listas, tabelas, blocos de codigo
7. Ao listar dados, formate de forma clara e organizada com tabelas quando possivel
8. Quando gerar codigo, sempre use blocos \`\`\`linguagem para syntax highlighting
9. Ao final de respostas analiticas, sugira proximos passos ou perguntas de aprofundamento
10. Em analises numericas, calcule percentuais, medias e tendencias quando relevante
11. Ao gerar relatorios, use tabelas markdown e secoes bem organizadas`;

  cachedSystemPrompt = prompt;
  systemPromptCacheTimestamp = now;
  return prompt;
}

export async function* streamChatCompletion(
  messages: Message[],
  options: ContextOptions = {},
  model: string = "google/gemini-2.0-flash-001",
  attachments?: Attachment[],
  deps: { storage: IStorage; apiKey: string; firecrawlApiKey?: string },
): AsyncGenerator<string> {
  const { apiKey, storage, firecrawlApiKey } = deps;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = await getSystemPrompt(storage, options);

  const apiMessages: Array<{role: string; content: MessageContent}> = [
    { role: "system", content: systemPrompt },
  ];

  // Check if the last user message needs external data
  let externalDataContext: string | null = null;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === "user" && typeof lastMessage.content === "string") {
    const userQuery = lastMessage.content;
    
    // Check if we need external data for this query
    if (needsExternalData(userQuery)) {
      try {
        console.log("[External Data] Detected weather query, fetching external data...");
        externalDataContext = await getExternalDataContext(userQuery);
        
        if (externalDataContext) {
          console.log("[External Data] Successfully fetched external data");
          // Add external data as a system message before the user's question
          apiMessages.push({
            role: "system",
            content: `DADOS EXTERNOS RECUPERADOS AUTOMATICAMENTE:\n${externalDataContext}\n\nUse esses dados acima para responder a pergunta do usuário. Se os dados forem sobre clima/tempo, inclua informações atualizadas na sua resposta.`
          });
        }
      } catch (error) {
        console.error("[External Data] Error fetching external data:", error);
        // Continue without external data - the AI will handle it gracefully
      }
    }

    // Check if we need pricing data from Firecrawl
    if (detectPricingQuery(userQuery)) {
      try {
        console.log("[Firecrawl] Detected pricing query, fetching market data...");
        const pricingResult = await scrapeMercadoLivre(userQuery, firecrawlApiKey);
        if (pricingResult) {
          console.log("[Firecrawl] Successfully fetched pricing data");
          apiMessages.push({
            role: "system",
            content: `DADOS DE PREÇOS COLETADOS AGORA DO MERCADO LIVRE:\n${formatPricingContext(pricingResult)}\n\nUse esses dados reais de mercado para responder a pergunta do usuário sobre preços. Calcule trade-in com 25% de margem operacional quando solicitado.`
          });
        }
      } catch (error) {
        console.error("[Firecrawl] Error fetching pricing data:", error);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLastUserMessage = i === messages.length - 1 && msg.role === "user";

    if (isLastUserMessage && attachments && attachments.length > 0) {
      const contentParts: Array<{type: string; text?: string; image_url?: {url: string}}> = [];
      
      if (typeof msg.content === "string" && msg.content.trim()) {
        contentParts.push({ type: "text", text: msg.content });
      }

      for (const att of attachments) {
        if (att.type.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: { url: att.base64 },
          });
        } else {
          try {
            const base64Data = att.base64.includes(",") ? att.base64.split(",")[1] : att.base64;
            const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
            contentParts.push({
              type: "text",
              text: `\n\n--- Conteudo do arquivo: ${att.name} ---\n${decoded}\n--- Fim do arquivo ---`,
            });
          } catch {
            contentParts.push({
              type: "text",
              text: `\n\n[Arquivo anexado: ${att.name} (${att.type})]`,
            });
          }
        }
      }

      apiMessages.push({ role: "user", content: contentParts });
    } else {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://renov-home.replit.app",
      "X-Title": "Matheus Mundstock Macbook M2"
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
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
        }
      }
    }
  }
}

export async function generateTitle(userMessage: string, apiKey?: string): Promise<string> {
  
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
  }
  
  return userMessage.slice(0, 50);
}
