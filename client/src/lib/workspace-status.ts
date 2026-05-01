// Helpers de status/prioridade do Workspace.
//
// Chamados e tarefas têm vocabulários diferentes:
// - Chamado: open / in_progress / blocked / resolved / closed (5)
// - Tarefa : a-fazer / em-andamento / bloqueado / concluido (4)
//
// Este módulo centraliza opções, labels e cores para que todos os
// pontos de edição (drawer, linha da lista, kanban) compartilhem a
// mesma fonte de verdade.

export type ItemKind = "chamado" | "tarefa";

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

const CHAMADO_STATUS: readonly StatusOption[] = [
  { value: "open", label: "Aberto", color: "#f59e0b" },
  { value: "in_progress", label: "Em Andamento", color: "#00c853" },
  { value: "blocked", label: "Bloqueado", color: "#ef4444" },
  { value: "resolved", label: "Resolvido", color: "#4ade80" },
  { value: "closed", label: "Fechado", color: "#4ade80" },
] as const;

const TAREFA_STATUS: readonly StatusOption[] = [
  { value: "a-fazer", label: "A Fazer", color: "#f59e0b" },
  { value: "em-andamento", label: "Em Andamento", color: "#00c853" },
  { value: "bloqueado", label: "Bloqueado", color: "#ef4444" },
  { value: "concluido", label: "Concluído", color: "#4ade80" },
] as const;

const ALL_STATUS: readonly StatusOption[] = [...CHAMADO_STATUS, ...TAREFA_STATUS];

export function statusOptionsForKind(kind: ItemKind): readonly StatusOption[] {
  return kind === "chamado" ? CHAMADO_STATUS : TAREFA_STATUS;
}

export function statusLabelOf(value: string): string {
  return ALL_STATUS.find((o) => o.value === value)?.label ?? value;
}

export function statusColorOf(value: string): string {
  return ALL_STATUS.find((o) => o.value === value)?.color ?? "rgba(255,255,255,0.3)";
}

export interface PriorityOption {
  value: string;
  label: string;
}

const CHAMADO_PRIORITY: readonly PriorityOption[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
] as const;

const TAREFA_PRIORITY: readonly PriorityOption[] = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
] as const;

const ALL_PRIORITY: readonly PriorityOption[] = [...CHAMADO_PRIORITY, ...TAREFA_PRIORITY];

export function priorityOptionsForKind(kind: ItemKind): readonly PriorityOption[] {
  return kind === "chamado" ? CHAMADO_PRIORITY : TAREFA_PRIORITY;
}

export function priorityLabelOf(value: string): string {
  return ALL_PRIORITY.find((o) => o.value === value)?.label ?? value;
}

export function priorityClassOf(value: string): string {
  switch (value) {
    case "baixa":
    case "low":
      return "bg-slate-500/10 text-slate-400 border-slate-700";
    case "normal":
      return "bg-blue-500/10 text-blue-400 border-blue-700";
    case "media":
    case "medium":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-700";
    case "alta":
    case "high":
      return "bg-orange-500/10 text-orange-400 border-orange-700";
    case "critica":
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-700";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-700";
  }
}
