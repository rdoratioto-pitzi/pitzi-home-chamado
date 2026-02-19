import { db } from "../db";
import { promptsLibrary, type InsertPromptLibrary } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// Categorias a serem sincronizadas
const CATEGORIES_TO_SYNC = [
  "development-team",
  "development-tools",
  "programming-languages",
  "database",
];

// Repositório GitHub
const GITHUB_REPO = "davila7/claude-code-templates";
const REPO_URL = `https://github.com/${GITHUB_REPO}.git`;
const CLONE_DIR = "/tmp/claude-code-templates-sync";
const COMPONENTS_DIR = "cli-tool/components/agents";

interface PromptFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
  model?: string;
}

interface ParsedPrompt {
  frontmatter: PromptFrontmatter;
  content: string;
  filePath: string;
  category: string;
  subcategory: string;
}

/**
 * Serviço de sincronização de prompts do GitHub
 */
export class PromptsSyncService {
  /**
   * Executa a sincronização completa
   */
  async sync(): Promise<{
    success: boolean;
    created: number;
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    try {
      console.log("[PromptsSync] Iniciando sincronização...");

      // 1. Clonar ou atualizar repositório
      await this.cloneOrUpdateRepo();

      // 2. Parsear arquivos markdown
      const prompts = await this.parsePromptFiles();
      console.log(`[PromptsSync] ${prompts.length} prompts encontrados`);

      // 3. Sincronizar com o banco
      for (const prompt of prompts) {
        try {
          const result = await this.upsertPrompt(prompt);
          if (result === "created") created++;
          if (result === "updated") updated++;
        } catch (error) {
          const errorMsg = `Erro ao sincronizar ${prompt.filePath}: ${error}`;
          console.error(`[PromptsSync] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 4. Marcar prompts inativos (removidos do repo)
      await this.markInactivePrompts(prompts.map((p) => p.filePath));

      console.log(
        `[PromptsSync] Sincronização concluída. Criados: ${created}, Atualizados: ${updated}, Erros: ${errors.length}`
      );

      return { success: true, created, updated, errors };
    } catch (error) {
      const errorMsg = `Erro na sincronização: ${error}`;
      console.error(`[PromptsSync] ${errorMsg}`);
      errors.push(errorMsg);
      return { success: false, created, updated, errors };
    }
  }

  /**
   * Clona ou atualiza o repositório
   */
  private async cloneOrUpdateRepo(): Promise<void> {
    try {
      if (fs.existsSync(CLONE_DIR)) {
        console.log("[PromptsSync] Atualizando repositório existente...");
        execSync("git pull", {
          cwd: CLONE_DIR,
          stdio: "pipe",
        });
      } else {
        console.log("[PromptsSync] Clonando repositório...");
        execSync(`git clone --depth 1 ${REPO_URL} ${CLONE_DIR}`, {
          stdio: "pipe",
        });
      }
    } catch (error) {
      throw new Error(`Falha ao clonar/atualizar repositório: ${error}`);
    }
  }

  /**
   * Parseia todos os arquivos markdown das categorias selecionadas
   */
  private async parsePromptFiles(): Promise<ParsedPrompt[]> {
    const prompts: ParsedPrompt[] = [];

    for (const category of CATEGORIES_TO_SYNC) {
      const categoryPath = path.join(CLONE_DIR, COMPONENTS_DIR, category);

      if (!fs.existsSync(categoryPath)) {
        console.warn(`[PromptsSync] Categoria não encontrada: ${categoryPath}`);
        continue;
      }

      const files = fs.readdirSync(categoryPath);

      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const filePath = path.join(categoryPath, file);
        const content = fs.readFileSync(filePath, "utf-8");

        const parsed = this.parseMarkdown(content);
        if (parsed) {
          prompts.push({
            ...parsed,
            filePath: `${COMPONENTS_DIR}/${category}/${file}`,
            category,
            subcategory: file.replace(".md", ""),
          });
        }
      }
    }

    return prompts;
  }

  /**
   * Parseia um arquivo markdown extraindo frontmatter e conteúdo
   */
  private parseMarkdown(content: string): { frontmatter: PromptFrontmatter; content: string } | null {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return null;
    }

    try {
      const frontmatter = yaml.load(match[1]) as PromptFrontmatter;
      const bodyContent = match[2].trim();

      return {
        frontmatter: frontmatter || {},
        content: bodyContent,
      };
    } catch (error) {
      console.warn(`[PromptsSync] Erro ao parsear frontmatter: ${error}`);
      return null;
    }
  }

  /**
   * Insere ou atualiza um prompt no banco
   */
  private async upsertPrompt(parsed: ParsedPrompt): Promise<"created" | "updated" | "unchanged"> {
    const { frontmatter, content, filePath, category, subcategory } = parsed;

    // Formata o título a partir do nome do arquivo ou frontmatter
    const title = this.formatTitle(frontmatter.name || subcategory);

    // Extrai a descrição (primeiros 200 caracteres ou descrição do frontmatter)
    let description = frontmatter.description || "";
    if (!description && content) {
      // Remove markdown e pega o primeiro parágrafo
      description = content
        .replace(/#.*\n/g, "")
        .replace(/\*\*/g, "")
        .replace(/\n/g, " ")
        .trim()
        .substring(0, 300);
    }

    const promptData: InsertPromptLibrary = {
      category,
      subcategory,
      name: subcategory,
      title,
      description: description.length > 300 ? description.substring(0, 300) + "..." : description,
      content,
      tools: frontmatter.tools ? JSON.stringify(frontmatter.tools) : null,
      model: frontmatter.model || null,
      sourceUrl: `https://github.com/${GITHUB_REPO}/blob/main/${filePath}`,
      githubRepo: GITHUB_REPO,
      githubPath: filePath,
      isActive: true,
    };

    // Verifica se já existe
    if (!db) throw new Error("Database not connected");
    
    const existing = await db
      .select()
      .from(promptsLibrary)
      .where(eq(promptsLibrary.githubPath, filePath))
      .limit(1);

    if (existing.length > 0) {
      // Atualiza
      await db
        .update(promptsLibrary)
        .set({
          ...promptData,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(promptsLibrary.id, existing[0].id));

      return "updated";
    } else {
      // Insere novo
      await db.insert(promptsLibrary).values({
        ...promptData,
        lastSyncedAt: new Date(),
      });

      return "created";
    }
  }

  /**
   * Marca como inativos os prompts que não existem mais no repositório
   */
  private async markInactivePrompts(activePaths: string[]): Promise<void> {
    if (!db) return;
    if (activePaths.length === 0) return;
    
    // Usar parâmetros corretos para o NOT IN
    // Primeiro, buscar todos os prompts ativos
    const allPrompts = await db
      .select({ id: promptsLibrary.id, githubPath: promptsLibrary.githubPath })
      .from(promptsLibrary)
      .where(eq(promptsLibrary.isActive, true));
    
    // Identificar prompts que não estão mais no repositório
    const promptsToDeactivate = allPrompts.filter(p => !activePaths.includes(p.githubPath));
    
    if (promptsToDeactivate.length > 0) {
      console.log(`[PromptsSync] Desativando ${promptsToDeactivate.length} prompts removidos do repositório`);
      
      for (const prompt of promptsToDeactivate) {
        await db
          .update(promptsLibrary)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(promptsLibrary.id, prompt.id));
      }
    }
  }

  /**
   * Formata um nome de arquivo para título legível
   */
  private formatTitle(name: string): string {
    return name
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Retorna estatísticas da biblioteca de prompts
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    lastSync: Date | null;
  }> {
    if (!db) return { total: 0, byCategory: {}, lastSync: null };
    const allPrompts = await db.select().from(promptsLibrary);

    const byCategory: Record<string, number> = {};
    let lastSync: Date | null = null;

    for (const prompt of allPrompts) {
      byCategory[prompt.category] = (byCategory[prompt.category] || 0) + 1;

      if (prompt.lastSyncedAt) {
        if (!lastSync || prompt.lastSyncedAt > lastSync) {
          lastSync = prompt.lastSyncedAt;
        }
      }
    }

    return {
      total: allPrompts.length,
      byCategory,
      lastSync,
    };
  }
}

// Instância singleton
export const promptsSyncService = new PromptsSyncService();
