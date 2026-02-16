/**
 * AI Tools - Dynamic Tool-based Internal Database Access
 * Provides tools that the AI can use to query specific internal data on-demand
 */

import { storage } from "./storage";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Get all available tools for the AI
 */
export function getAvailableTools(): ToolDefinition[] {
  return [
    {
      name: "search_tickets",
      description: "Busca tickets/chamados por título, descrição, status ou prioridade. Útil para encontrar tickets específicos ou listar tickets com certos critérios.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no título ou descrição dos tickets"
          },
          status: {
            type: "string",
            description: "Filtrar por status: 'aberto', 'em_andamento', 'fechado', 'closed', 'open', 'in_progress'"
          },
          priority: {
            type: "string",
            description: "Filtrar por prioridade: 'baixa', 'media', 'alta', 'critica', 'low', 'medium', 'high', 'critical'"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_ticket_details",
      description: "Obtém detalhes completos de um ticket específico pelo ID ou código.",
      parameters: {
        type: "object",
        properties: {
          ticketId: {
            type: "string",
            description: "ID ou código do ticket (ex: 'T-001' ou 'abc123')"
          }
        },
        required: ["ticketId"]
      }
    },
    {
      name: "search_tasks",
      description: "Busca tarefas por título, status ou área. Útil para listar tarefas com certos critérios.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no título das tarefas"
          },
          status: {
            type: "string",
            description: "Filtrar por status: 'pendente', 'em_andamento', 'concluida', 'todo', 'in_progress', 'done'"
          },
          areaId: {
            type: "string",
            description: "Filtrar por área (ID da área)"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_task_details",
      description: "Obtém detalhes completos de uma tarefa específica pelo ID.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "ID da tarefa"
          }
        },
        required: ["taskId"]
      }
    },
    {
      name: "search_projects",
      description: "Busca projetos por nome ou descrição.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no nome ou descrição dos projetos"
          },
          status: {
            type: "string",
            description: "Filtrar por status: 'ativo', 'inativo', 'concluido', 'active', 'inactive', 'completed'"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_project_details",
      description: "Obtém detalhes completos de um projeto específico pelo ID.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID do projeto"
          }
        },
        required: ["projectId"]
      }
    },
    {
      name: "search_goals",
      description: "Busca metas/objetivos por título ou status.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no título das metas"
          },
          status: {
            type: "string",
            description: "Filtrar por status: 'pendente', 'em_andamento', 'concluida', 'in_progress', 'completed'"
          },
          month: {
            type: "string",
            description: "Filtrar por mês (formato: '2024-01')"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "search_knowledge",
      description: "Busca documentos na base de conhecimento por título ou conteúdo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no título ou conteúdo dos documentos"
          },
          status: {
            type: "string",
            description: "Filtrar por status: 'rascunho', 'aprovado', 'revisando', 'draft', 'approved', 'reviewing'"
          },
          area: {
            type: "string",
            description: "Filtrar por área (ex: 'TI', 'RH', 'Operacoes')"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_pricing_devices",
      description: "Busca dispositivos monitorados no módulo de pricing por fabricante, modelo ou nome.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar (fabricante, modelo, etc.)"
          },
          manufacturerName: {
            type: "string",
            description: "Filtrar por nome do fabricante (ex: 'Apple', 'Samsung')"
          },
          isActive: {
            type: "boolean",
            description: "Filtrar apenas dispositivos ativos"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "search_logistica",
      description: "Busca pedidos de logística reversa.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar (ID do pedido, status, etc.)"
          },
          status: {
            type: "string",
            description: "Filtrar por status do pedido"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_users",
      description: "Lista usuários da plataforma. Útil para encontrar informações de colaboradores.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto para buscar no nome ou email dos usuários"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "get_dashboard_stats",
      description: "Obtém estatísticas consolidadas da plataforma (tickets, tarefas, metas, etc.). Útil para relatórios gerais.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  ];
}

/**
 * Execute a tool based on the tool name and arguments
 */
export async function executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case "search_tickets": {
        const { query, status, priority, limit = 10 } = args;
        const tickets = await storage.getTickets();
        
        let filtered = tickets;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(t => 
            t.title.toLowerCase().includes(lowerQuery) || 
            (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
            (t.code && t.code.toLowerCase().includes(lowerQuery))
          );
        }
        
        if (status) {
          filtered = filtered.filter(t => t.status === status);
        }
        
        if (priority) {
          filtered = filtered.filter(t => t.priority === priority);
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(t => ({
            id: t.id,
            code: t.code,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assigneeId: t.assigneeId,
            createdAt: t.createdAt
          }))
        };
      }

      case "get_ticket_details": {
        const { ticketId } = args;
        // Try to find by code first, then by ID
        let ticket = (await storage.getTickets()).find(t => t.code === ticketId || t.id === ticketId);
        
        if (!ticket) {
          return { success: false, error: `Ticket não encontrado: ${ticketId}` };
        }
        
        // Get comments
        const comments = await storage.getTicketComments(ticket.id);
        
        return {
          success: true,
          data: {
            ...ticket,
            comments
          }
        };
      }

      case "search_tasks": {
        const { query, status, tagId, limit = 10 } = args;
        const tasks = await storage.getTasks({ tagId, status });
        
        let filtered = tasks;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(t => t.title.toLowerCase().includes(lowerQuery));
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            tagId: t.tagId,
            assigneeId: t.assigneeId,
            dueDate: t.dueDate
          }))
        };
      }

      case "get_task_details": {
        const { taskId } = args;
        const task = await storage.getTask(taskId);
        
        if (!task) {
          return { success: false, error: `Tarefa não encontrada: ${taskId}` };
        }
        
        const comments = await storage.getTaskComments(taskId);
        
        return {
          success: true,
          data: {
            ...task,
            comments
          }
        };
      }

      case "search_projects": {
        const { query, status, limit = 10 } = args;
        const projects = await storage.getProjects();
        
        let filtered = projects;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) || 
            (p.description && p.description.toLowerCase().includes(lowerQuery))
          );
        }
        
        if (status) {
          filtered = filtered.filter(p => p.status === status);
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            createdAt: p.createdAt
          }))
        };
      }

      case "get_project_details": {
        const { projectId } = args;
        const project = await storage.getProject(projectId);
        
        if (!project) {
          return { success: false, error: `Projeto não encontrado: ${projectId}` };
        }
        
        const members = await storage.getProjectMembers(projectId);
        const columns = await storage.getKanbanColumns(projectId);
        
        return {
          success: true,
          data: {
            ...project,
            members,
            kanbanColumns: columns
          }
        };
      }

      case "search_goals": {
        const { query, status, month, limit = 10 } = args;
        const goals = await storage.getMetas({ month });
        
        let filtered = goals;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(g => g.title.toLowerCase().includes(lowerQuery));
        }
        
        if (status) {
          filtered = filtered.filter(g => g.status === status);
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(g => ({
            id: g.id,
            title: g.title,
            currentValue: g.currentValue,
            targetValue: g.targetValue,
            unit: g.unit,
            status: g.status,
            month: g.month
          }))
        };
      }

      case "search_knowledge": {
        const { query, status, area, limit = 10 } = args;
        const docs = await storage.getKnowledgeDocuments({ status, area });
        
        let filtered = docs;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(d => 
            d.titulo.toLowerCase().includes(lowerQuery) || 
            (d.conteudo && d.conteudo.toLowerCase().includes(lowerQuery))
          );
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(d => ({
            id: d.id,
            titulo: d.titulo,
            tipo: d.tipo,
            area: d.area,
            status: d.status,
            createdAt: d.createdAt
          }))
        };
      }

      case "get_pricing_devices": {
        const { query, manufacturerName, isActive, limit = 10 } = args;
        const devices = await storage.getPricingDevices({ 
          manufacturerName, 
          isActive 
        });
        
        let filtered = devices;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(d => 
            d.manufacturerName.toLowerCase().includes(lowerQuery) || 
            d.modelName.toLowerCase().includes(lowerQuery)
          );
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(d => ({
            id: d.id,
            manufacturerName: d.manufacturerName,
            modelName: d.modelName,
            storage: d.storage,
            categoryId: d.categoryId,
            isActive: d.isActive
          }))
        };
      }

      case "search_logistica": {
        const { query, status, limit = 10 } = args;
        const pedidos = await storage.getLogisticaReversaPedidos();
        
        let filtered = pedidos;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(p => 
            p.id.toLowerCase().includes(lowerQuery) || 
            (p.status && p.status.toLowerCase().includes(lowerQuery))
          );
        }
        
        if (status) {
          filtered = filtered.filter(p => p.status === status);
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit)
        };
      }

      case "get_users": {
        const { query, limit = 10 } = args;
        const users = await storage.getUsers();
        
        let filtered = users;
        
        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(lowerQuery) || 
            u.email.toLowerCase().includes(lowerQuery)
          );
        }
        
        return {
          success: true,
          data: filtered.slice(0, limit).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            perfilAcesso: u.perfilAcesso,
            areaNegocio: u.areaNegocio
          }))
        };
      }

      case "get_dashboard_stats": {
        const [tickets, tasks, metas, projects, users, devices, pedidos] = await Promise.all([
          storage.getTickets(),
          storage.getTasks(),
          storage.getMetas(),
          storage.getProjects(),
          storage.getUsers(),
          storage.getPricingDevices(),
          storage.getLogisticaReversaPedidos()
        ]);

        const ticketsAbertos = tickets.filter(t => t.status === "aberto" || t.status === "open").length;
        const ticketsFechados = tickets.filter(t => t.status === "fechado" || t.status === "closed" || t.status === "resolved").length;
        const tarefasPendentes = tasks.filter(t => t.status === "pendente" || t.status === "todo").length;
        const tarefasConcluidas = tasks.filter(t => t.status === "concluida" || t.status === "done").length;
        const metasAtingidas = metas.filter(m => m.status === "concluida" || m.status === "completed").length;
        const projetosAtivos = projects.filter(p => p.status === "ativo" || p.status === "active").length;

        return {
          success: true,
          data: {
            usuarios: { total: users.length },
            tickets: { 
              total: tickets.length, 
              abertos: ticketsAbertos, 
              fechados: ticketsFechados,
              taxaResolucao: tickets.length > 0 ? Math.round((ticketsFechados / tickets.length) * 100) : 0
            },
            tarefas: { 
              total: tasks.length, 
              pendentes: tarefasPendentes, 
              concluidas: tarefasConcluidas,
              taxaConclusao: tasks.length > 0 ? Math.round((tarefasConcluidas / tasks.length) * 100) : 0
            },
            metas: { 
              total: metas.length, 
              atingidas: metasAtingidas 
            },
            projetos: { 
              total: projects.length, 
              ativos: projetosAtivos 
            },
            pricing: { 
              dispositivosMonitorados: devices.length 
            },
            logistica: { 
              pedidos: pedidos.length 
            }
          }
        };
      }

      default:
        return { success: false, error: `Ferramenta desconhecida: ${toolName}` };
    }
  } catch (error) {
    console.error(`[AI Tools] Error executing tool ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao executar ferramenta"
    };
  }
}

/**
 * Get tools description in JSON schema format for OpenAI-compatible API
 */
export function getToolsDescription(): any[] {
  return getAvailableTools().map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}
