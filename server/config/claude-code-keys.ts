/**
 * Mapeamento entre desenvolvedores Git e suas API Keys Anthropic (Claude Code)
 *
 * Mesmo padrão do openrouter-keys.ts — cada desenvolvedor pode ter múltiplas
 * keys (diferentes máquinas/ferramentas) e o sistema soma automaticamente o
 * consumo de todas as keys do mesmo dev.
 *
 * Keys Anthropic têm o formato: sk-ant-api03-...
 */

interface DeveloperKey {
  keyName: string;
  apiKey: string;
}

/**
 * Configuração de API Keys Anthropic (Claude Code) por desenvolvedor
 *
 * IMPORTANTE: Preencha as keys reais antes de usar.
 * Para obter sua key: https://console.anthropic.com/settings/keys
 */
export const CLAUDE_CODE_DEVELOPER_KEYS: Record<string, DeveloperKey[]> = {
  // Matheus Mundstock
  "Matheus Mundstock": [
    {
      keyName: "Matheus Claude Code Macbook M2",
      apiKey: "TODO_sk-ant-api03-macbook-m2"
    },
    {
      keyName: "Matheus Claude Code iMac",
      apiKey: "TODO_sk-ant-api03-imac"
    }
  ],

  // Juan Martins
  "Juan Martins": [
    {
      keyName: "Juan Claude Code",
      apiKey: "TODO_sk-ant-api03-juan"
    }
  ],

  // Atila Lima
  "Atila Lima": [
    {
      keyName: "Atila Claude Code",
      apiKey: "TODO_sk-ant-api03-atila"
    }
  ],

  // Marcelo Maciel
  "Marcelo Maciel": [
    {
      keyName: "Marcelo Claude Code",
      apiKey: "TODO_sk-ant-api03-marcelo"
    }
  ]
};

/**
 * Retorna apenas os developers com keys válidas (não-placeholder)
 */
export function getAllClaudeCodeDevelopers(): string[] {
  return Object.keys(CLAUDE_CODE_DEVELOPER_KEYS).filter(dev =>
    CLAUDE_CODE_DEVELOPER_KEYS[dev].some(k => !k.apiKey.startsWith("TODO_"))
  );
}

/**
 * Obtém as API Keys válidas de um desenvolvedor
 */
export function getClaudeCodeDeveloperKeys(developerName: string): DeveloperKey[] {
  return (CLAUDE_CODE_DEVELOPER_KEYS[developerName] || []).filter(
    k => !k.apiKey.startsWith("TODO_")
  );
}

/**
 * Todos os devs cadastrados (incluindo os sem keys válidas)
 * Útil para exibir no painel mesmo sem dados de uso
 */
export function getAllClaudeCodeDevelopersIncludingEmpty(): string[] {
  return Object.keys(CLAUDE_CODE_DEVELOPER_KEYS);
}
