import { db } from "./db";
import { users, taskAreas, flowcharts, gitRepositories } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import https from "https";

const TEMPLATE_DATA = [
  {
    title: "Fluxograma Básico",
    description: "Modelo básico com início, processo, decisão e fim",
    templateCategory: "basico",
    nodesData: JSON.stringify([
      { id: "n1", type: "ellipse", position: { x: 250, y: 0 }, data: { label: "Início", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" } },
      { id: "n2", type: "rectangle", position: { x: 225, y: 120 }, data: { label: "Processo 1", bgColor: "#ffffff", borderColor: "#d1d5db", textColor: "#1f2937" } },
      { id: "n3", type: "diamond", position: { x: 210, y: 260 }, data: { label: "Decisão?", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n4", type: "rectangle", position: { x: 50, y: 440 }, data: { label: "Processo A", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n5", type: "rectangle", position: { x: 400, y: 440 }, data: { label: "Processo B", bgColor: "#f3e8ff", borderColor: "#a855f7", textColor: "#6b21a8" } },
      { id: "n6", type: "ellipse", position: { x: 250, y: 580 }, data: { label: "Fim", bgColor: "#fee2e2", borderColor: "#ef4444", textColor: "#991b1b" } },
    ]),
    edgesData: JSON.stringify([
      { id: "e1", source: "n1", target: "n2", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e2", source: "n2", target: "n3", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e3", source: "n3", target: "n4", type: "smoothstep", label: "Sim", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e4", source: "n3", target: "n5", type: "smoothstep", label: "Não", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e5", source: "n4", target: "n6", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e6", source: "n5", target: "n6", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
    ]),
  },
  {
    title: "Organograma",
    description: "Estrutura organizacional hierárquica da empresa",
    templateCategory: "organizacional",
    nodesData: JSON.stringify([
      { id: "n1", type: "rectangle", position: { x: 250, y: 0 }, data: { label: "CEO / Diretor Geral", bgColor: "#d1fae5", borderColor: "#00A137", textColor: "#065f46" } },
      { id: "n2", type: "rectangle", position: { x: 50, y: 140 }, data: { label: "Diretor Comercial", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n3", type: "rectangle", position: { x: 250, y: 140 }, data: { label: "Diretor Operações", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n4", type: "rectangle", position: { x: 450, y: 140 }, data: { label: "Diretor Financeiro", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n5", type: "rectangle", position: { x: 0, y: 280 }, data: { label: "Vendas", bgColor: "#f3e8ff", borderColor: "#a855f7", textColor: "#6b21a8" } },
      { id: "n6", type: "rectangle", position: { x: 150, y: 280 }, data: { label: "Marketing", bgColor: "#f3e8ff", borderColor: "#a855f7", textColor: "#6b21a8" } },
      { id: "n7", type: "rectangle", position: { x: 300, y: 280 }, data: { label: "Logística", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n8", type: "rectangle", position: { x: 450, y: 280 }, data: { label: "Contabilidade", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
    ]),
    edgesData: JSON.stringify([
      { id: "e1", source: "n1", target: "n2", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e2", source: "n1", target: "n3", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e3", source: "n1", target: "n4", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e4", source: "n2", target: "n5", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e5", source: "n2", target: "n6", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e6", source: "n3", target: "n7", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e7", source: "n4", target: "n8", type: "smoothstep", style: { strokeWidth: 2, stroke: "#6b7280" } },
    ]),
  },
  {
    title: "Matriz de Impacto/Esforço",
    description: "Priorize iniciativas com base no impacto vs esforço necessário",
    templateCategory: "estrategico",
    nodesData: JSON.stringify([
      { id: "n1", type: "textNode", position: { x: 0, y: 0 }, data: { label: "ALTO IMPACTO", textColor: "#166534" } },
      { id: "n2", type: "textNode", position: { x: 0, y: 350 }, data: { label: "BAIXO IMPACTO", textColor: "#991b1b" } },
      { id: "n3", type: "textNode", position: { x: 50, y: 400 }, data: { label: "BAIXO ESFORÇO →", textColor: "#6b7280" } },
      { id: "n4", type: "textNode", position: { x: 400, y: 400 }, data: { label: "← ALTO ESFORÇO", textColor: "#6b7280" } },
      { id: "n5", type: "rectangle", position: { x: 50, y: 50 }, data: { label: "Quick Wins\n(Fazer primeiro)", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" } },
      { id: "n6", type: "rectangle", position: { x: 350, y: 50 }, data: { label: "Projetos Estratégicos\n(Planejar)", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n7", type: "rectangle", position: { x: 50, y: 220 }, data: { label: "Tarefas Rotineiras\n(Automatizar)", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n8", type: "rectangle", position: { x: 350, y: 220 }, data: { label: "Evitar\n(Não priorizar)", bgColor: "#fee2e2", borderColor: "#ef4444", textColor: "#991b1b" } },
      { id: "n9", type: "noteNode", position: { x: 150, y: 100 }, data: { label: "Item exemplo 1", bgColor: "#d1fae5", borderColor: "#00A137", textColor: "#065f46" } },
      { id: "n10", type: "noteNode", position: { x: 450, y: 110 }, data: { label: "Item exemplo 2", bgColor: "#dbeafe", borderColor: "#93c5fd", textColor: "#1e40af" } },
    ]),
    edgesData: JSON.stringify([]),
  },
  {
    title: "Análise SWOT",
    description: "Forças, Fraquezas, Oportunidades e Ameaças",
    templateCategory: "estrategico",
    nodesData: JSON.stringify([
      { id: "n1", type: "textNode", position: { x: 200, y: 0 }, data: { label: "ANÁLISE SWOT", textColor: "#1f2937" } },
      { id: "n2", type: "rectangle", position: { x: 0, y: 60 }, data: { label: "FORÇAS (Strengths)\n\n• Ponto forte 1\n• Ponto forte 2\n• Ponto forte 3", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" } },
      { id: "n3", type: "rectangle", position: { x: 300, y: 60 }, data: { label: "FRAQUEZAS (Weaknesses)\n\n• Fraqueza 1\n• Fraqueza 2\n• Fraqueza 3", bgColor: "#fee2e2", borderColor: "#ef4444", textColor: "#991b1b" } },
      { id: "n4", type: "rectangle", position: { x: 0, y: 280 }, data: { label: "OPORTUNIDADES\n\n• Oportunidade 1\n• Oportunidade 2\n• Oportunidade 3", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n5", type: "rectangle", position: { x: 300, y: 280 }, data: { label: "AMEAÇAS (Threats)\n\n• Ameaça 1\n• Ameaça 2\n• Ameaça 3", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n6", type: "textNode", position: { x: -60, y: 40 }, data: { label: "INTERNO", textColor: "#6b7280" } },
      { id: "n7", type: "textNode", position: { x: -60, y: 260 }, data: { label: "EXTERNO", textColor: "#6b7280" } },
      { id: "n8", type: "textNode", position: { x: 120, y: 30 }, data: { label: "POSITIVO →", textColor: "#6b7280" } },
      { id: "n9", type: "textNode", position: { x: 380, y: 30 }, data: { label: "← NEGATIVO", textColor: "#6b7280" } },
    ]),
    edgesData: JSON.stringify([]),
  },
  {
    title: "Revisão de Projeto",
    description: "Framework para revisão e acompanhamento de projetos",
    templateCategory: "projetos",
    nodesData: JSON.stringify([
      { id: "n1", type: "ellipse", position: { x: 250, y: 0 }, data: { label: "Início da Revisão", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" } },
      { id: "n2", type: "rectangle", position: { x: 200, y: 120 }, data: { label: "Revisar Escopo\ne Objetivos", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n3", type: "rectangle", position: { x: 200, y: 240 }, data: { label: "Verificar Cronograma\ne Marcos", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n4", type: "rectangle", position: { x: 200, y: 360 }, data: { label: "Analisar Orçamento\ne Recursos", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n5", type: "diamond", position: { x: 220, y: 500 }, data: { label: "Riscos\nIdentificados?", bgColor: "#fee2e2", borderColor: "#ef4444", textColor: "#991b1b" } },
      { id: "n6", type: "rectangle", position: { x: 450, y: 520 }, data: { label: "Plano de\nMitigação", bgColor: "#fee2e2", borderColor: "#ef4444", textColor: "#991b1b" } },
      { id: "n7", type: "rectangle", position: { x: 200, y: 680 }, data: { label: "Documentar\nDecisões", bgColor: "#f3e8ff", borderColor: "#a855f7", textColor: "#6b21a8" } },
      { id: "n8", type: "ellipse", position: { x: 250, y: 800 }, data: { label: "Próximos Passos", bgColor: "#d1fae5", borderColor: "#00A137", textColor: "#065f46" } },
    ]),
    edgesData: JSON.stringify([
      { id: "e1", source: "n1", target: "n2", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e2", source: "n2", target: "n3", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e3", source: "n3", target: "n4", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e4", source: "n4", target: "n5", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e5", source: "n5", target: "n6", type: "smoothstep", label: "Sim", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e6", source: "n5", target: "n7", type: "smoothstep", label: "Não", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e7", source: "n6", target: "n7", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e8", source: "n7", target: "n8", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
    ]),
  },
  {
    title: "Planejamento de Roadmap",
    description: "Roadmap visual com fases e marcos do projeto",
    templateCategory: "projetos",
    nodesData: JSON.stringify([
      { id: "n1", type: "textNode", position: { x: 0, y: 0 }, data: { label: "ROADMAP DO PROJETO", textColor: "#1f2937" } },
      { id: "n2", type: "chevronNode", position: { x: 0, y: 60 }, data: { label: "Fase 1: Descoberta", bgColor: "#dbeafe", borderColor: "#3b82f6", textColor: "#1e40af" } },
      { id: "n3", type: "chevronNode", position: { x: 200, y: 60 }, data: { label: "Fase 2: Design", bgColor: "#dcfce7", borderColor: "#22c55e", textColor: "#166534" } },
      { id: "n4", type: "chevronNode", position: { x: 400, y: 60 }, data: { label: "Fase 3: Desenvolvimento", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n5", type: "chevronNode", position: { x: 600, y: 60 }, data: { label: "Fase 4: Lançamento", bgColor: "#d1fae5", borderColor: "#00A137", textColor: "#065f46" } },
      { id: "n6", type: "noteNode", position: { x: 0, y: 140 }, data: { label: "• Pesquisa de mercado\n• Entrevistas\n• Análise competitiva", bgColor: "#dbeafe", borderColor: "#93c5fd", textColor: "#1e40af" } },
      { id: "n7", type: "noteNode", position: { x: 200, y: 140 }, data: { label: "• Wireframes\n• Protótipos\n• Design system", bgColor: "#dcfce7", borderColor: "#86efac", textColor: "#166534" } },
      { id: "n8", type: "noteNode", position: { x: 400, y: 140 }, data: { label: "• Sprint 1-4\n• Testes QA\n• Integração", bgColor: "#fef9c3", borderColor: "#fde68a", textColor: "#854d0e" } },
      { id: "n9", type: "noteNode", position: { x: 600, y: 140 }, data: { label: "• Deploy\n• Marketing\n• Suporte", bgColor: "#d1fae5", borderColor: "#6ee7b7", textColor: "#065f46" } },
      { id: "n10", type: "starNode", position: { x: 100, y: 300 }, data: { label: "Marco 1", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n11", type: "starNode", position: { x: 350, y: 300 }, data: { label: "Marco 2", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
      { id: "n12", type: "starNode", position: { x: 600, y: 300 }, data: { label: "Marco 3", bgColor: "#fef9c3", borderColor: "#eab308", textColor: "#854d0e" } },
    ]),
    edgesData: JSON.stringify([
      { id: "e1", source: "n2", target: "n3", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e2", source: "n3", target: "n4", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
      { id: "e3", source: "n4", target: "n5", type: "smoothstep", markerEnd: { type: "arrowclosed", color: "#6b7280" }, style: { strokeWidth: 2, stroke: "#6b7280" } },
    ]),
  },
];

export async function seedDatabase() {
  if (!db) {
    console.warn("[seed] Skipping database seeding: No database connection found.");
    return;
  }

  try {
    console.log("[seed] Checking and seeding initial data...");

    // Credenciais padrão (consistentes com/sem DB)
    const DEFAULT_USERS = [
      { name: "Matheus", email: "Matheus@pitzi.com.br", password: "ma061184", modulePermissions: { chamados: true, projetos: true, tarefas: true, okrs: true, logistica: true, apis: true, configuracoes: true, updates: true } },
      { name: "Administrador", email: "admin@renov.com.br", password: "admin123", modulePermissions: { chamados: true, projetos: true, tarefas: true, okrs: true, logistica: true, apis: true, configuracoes: true } },
    ];

    for (const u of DEFAULT_USERS) {
      const existing = await db.select().from(users).where(eq(users.email, u.email));
      if (existing.length === 0) {
        console.log(`[seed] Creating user: ${u.email}`);
        await db.insert(users).values({
          name: u.name,
          email: u.email,
          password: u.password,
          status: "active",
          authMethod: "email",
          modulePermissions: JSON.stringify(u.modulePermissions),
        }).returning();
      }
    }

    const [adminRow] = await db.select().from(users).where(eq(users.email, "admin@renov.com.br"));
    const adminId = adminRow?.id ?? "";

    const defaultAreas = [
      { name: "TI", color: "#3B82F6" },
      { name: "RH", color: "#EF4444" },
      { name: "Operações", color: "#F59E0B" },
    ];

    for (const area of defaultAreas) {
      const existingArea = await db.select().from(taskAreas).where(eq(taskAreas.name, area.name));
      if (existingArea.length === 0) {
        console.log(`[seed] Creating task area: ${area.name}...`);
        await db.insert(taskAreas).values({
          name: area.name,
          ownerId: adminId,
          visibility: "shared",
          color: area.color,
          icon: "folder",
        });
      } else {
        console.log(`[seed] Task area '${area.name}' already exists.`);
      }
    }

    for (const template of TEMPLATE_DATA) {
      const existing = await db.select().from(flowcharts).where(
        and(eq(flowcharts.title, template.title), eq(flowcharts.isTemplate, true))
      );
      if (existing.length === 0) {
        console.log(`[seed] Creating flowchart template: ${template.title}...`);
        await db.insert(flowcharts).values({
          title: template.title,
          description: template.description,
          ownerId: adminId,
          nodesData: template.nodesData,
          edgesData: template.edgesData,
          isTemplate: true,
          templateCategory: template.templateCategory,
        });
      } else {
        console.log(`[seed] Template '${template.title}' already exists.`);
      }
    }

    await seedGitRepositories();

    console.log("[seed] Database seeding complete.");
  } catch (error) {
    console.error("[seed] Error during database seeding:", error);
    console.warn("[seed] Continuing server startup without full seeding.");
  }
}

async function fetchGitHubOrgRepos(org: string): Promise<any[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  return new Promise((resolve) => {
    const options = {
      hostname: "api.github.com",
      path: `/orgs/${org}/repos?per_page=100&type=all`,
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "Renov-Home-App",
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try {
          const repos = JSON.parse(data);
          resolve(Array.isArray(repos) ? repos : []);
        } catch {
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

async function seedGitRepositories() {
  if (!db) return;

  try {
    const existing = await db.select({ id: gitRepositories.id }).from(gitRepositories);
    if (existing.length > 0) {
      console.log(`[seed] Git repositories already configured (${existing.length} repos).`);
      return;
    }

    const repos = await fetchGitHubOrgRepos("Renov-BD");
    if (repos.length === 0) {
      console.log("[seed] No GitHub repos found for Renov-BD (token missing or no access).");
      return;
    }

    for (const repo of repos) {
      await db.insert(gitRepositories).values({
        githubId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        defaultBranch: repo.default_branch,
        isActive: true,
        syncEnabled: true,
      });
      console.log(`[seed] Git repo registered: ${repo.full_name}`);
    }

    console.log(`[seed] ${repos.length} GitHub repos registered. Initial sync will run via scheduled job.`);

    setTimeout(async () => {
      try {
        const { syncAllRepositories } = await import("./services/github-sync");
        console.log("[seed] Starting initial GitHub sync...");
        const result = await syncAllRepositories();
        console.log("[seed] Initial GitHub sync complete:", JSON.stringify(result));
      } catch (err) {
        console.error("[seed] Initial GitHub sync error:", err);
      }
    }, 5000);
  } catch (error) {
    console.error("[seed] Error seeding git repositories:", error);
  }
}
