import { Zap, Bug, Wrench, FileText, GitBranch, Shield } from "lucide-react";

// Badge para tipo de commit/PR
interface TypeBadgeProps {
  type: string;
  showIcon?: boolean;
}

export function TypeBadge({ type, showIcon = true }: TypeBadgeProps) {
  const config: Record<string, { label: string; className: string; icon: typeof Zap }> = {
    feature: {
      label: "Feature",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      icon: Zap,
    },
    bugfix: {
      label: "Correção",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: Bug,
    },
    improvement: {
      label: "Melhoria",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      icon: Wrench,
    },
    docs: {
      label: "Documentação",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      icon: FileText,
    },
    refactor: {
      label: "Refatoração",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      icon: GitBranch,
    },
    security: {
      label: "Segurança",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      icon: Shield,
    },
  };

  const { label, className, icon: Icon } = config[type] || config.improvement;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

// Badge para severidade de vulnerabilidade
interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-500 text-white",
    low: "bg-blue-500 text-white",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${config[severity] || config.medium}`}>
      {severity}
    </span>
  );
}

// Badge para status de PR
interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    open: {
      label: "Aberto",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    merged: {
      label: "Merged",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    },
    closed: {
      label: "Fechado",
      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    },
  };

  const { label, className } = config[status] || config.open;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// Cores para gráficos por tipo
export const TYPE_COLORS: Record<string, string> = {
  feature: "#22c55e",
  bugfix: "#ef4444",
  improvement: "#3b82f6",
  docs: "#f59e0b",
  refactor: "#8b5cf6",
  security: "#f97316",
  other: "#94a3b8",
};

// Labels em português
export const TYPE_LABELS: Record<string, string> = {
  feature: "Features",
  bugfix: "Correções",
  improvement: "Melhorias",
  docs: "Docs",
  refactor: "Refatoração",
  security: "Segurança",
  other: "Outros",
};
