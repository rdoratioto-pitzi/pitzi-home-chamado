import { useState } from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react";

interface HelpTooltipProps {
  text: string;
}

export function HelpTooltip({ text }: HelpTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block ml-1.5">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] cursor-help hover:bg-muted/80 transition-colors"
      >
        ?
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="relative">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  change?: string;
  changeType?: "up" | "down" | "neutral" | "good-down";
  helpText?: string;
  alert?: boolean;
  highlight?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  changeType,
  helpText,
  alert,
  highlight,
  clickable,
  onClick,
}: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border p-4 hover:shadow-lg transition-all ${
        alert ? "border-amber-500/50" : highlight ? "border-blue-500/50" : "border-border"
      } ${clickable ? "cursor-pointer hover:scale-[1.02]" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium inline-flex items-center">
            {title}
            {helpText && <HelpTooltip text={helpText} />}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        <div
          className={`p-2 rounded-xl ${
            alert
              ? "bg-amber-100 dark:bg-amber-900/30"
              : highlight
              ? "bg-blue-100 dark:bg-blue-900/30"
              : "bg-muted"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              alert
                ? "text-amber-600 dark:text-amber-400"
                : highlight
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted-foreground"
            }`}
          />
        </div>
      </div>

      {change && (
        <div className="flex items-center mt-3 pt-3 border-t border-border/50">
          {changeType === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />}
          {changeType === "down" && <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />}
          {changeType === "neutral" && <Minus className="h-4 w-4 text-muted-foreground mr-1" />}
          {changeType === "good-down" && <ArrowDownRight className="h-4 w-4 text-emerald-500 mr-1" />}
          <span
            className={`text-sm font-medium ${
              changeType === "up"
                ? "text-emerald-600"
                : changeType === "down"
                ? "text-red-600"
                : changeType === "good-down"
                ? "text-emerald-600"
                : "text-muted-foreground"
            }`}
          >
            {change}
          </span>
          <span className="text-xs text-muted-foreground ml-1">vs anterior</span>
        </div>
      )}

      {clickable && (
        <div className="flex items-center justify-end mt-2 text-blue-600 text-xs font-medium">
          Ver detalhes <ChevronRight className="h-3 w-3 ml-1" />
        </div>
      )}
    </div>
  );
}

// Textos de ajuda para os KPIs
export const KPI_HELP_TEXTS = {
  pullRequests: "Solicitações de merge de código. Um PR agrupa um ou mais commits para revisão antes de integrar ao código principal.",
  commits: "Quantidade de alterações de código salvas no repositório. Cada commit representa uma unidade de mudança.",
  developers: "Número de desenvolvedores que realizou pelo menos um commit no período selecionado.",
  frequency: "Média de commits realizados por dia no período. Indica a velocidade de desenvolvimento da equipe.",
  vulnerabilities: "Problemas de segurança detectados nas dependências do projeto pelo Dependabot do GitHub.",
  repositories: "Quantidade de repositórios GitHub conectados e sendo monitorados pelo Git Analytics.",
  features: "Commits que adicionam novas funcionalidades ao sistema. Identificados pelo prefixo 'feat:' na mensagem.",
  corrections: "Commits que corrigem bugs. O Bug Rate é o percentual de correções sobre o total - quanto menor, melhor a qualidade do código.",
  improvements: "Commits que melhoram código existente sem adicionar funcionalidades ou corrigir bugs (refatoração, performance, estilo).",
  refactorDocs: "Commits de refatoração de código e atualização de documentação. Importantes para manutenibilidade.",
};
