import { Badge } from "@/components/ui/badge"
import type { HealthStatus } from "@/lib/okr-health"

const HEALTH_CONFIG: Record<HealthStatus, { label: string; cls: string }> = {
  on_track:  { label: "No Caminho", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
  at_risk:   { label: "Em Risco",   cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  off_track: { label: "Atrasado",   cls: "bg-red-500/10 text-red-500 border-red-500/20" },
}

interface HealthBadgeProps {
  status: HealthStatus
  /** Reduz o tamanho para uso como badge secundário ao lado de outro badge */
  secondary?: boolean
}

export function HealthBadge({ status, secondary = false }: HealthBadgeProps) {
  const { label, cls } = HEALTH_CONFIG[status]
  return (
    <Badge
      variant="outline"
      className={`font-bold uppercase tracking-wider ${cls} ${secondary ? "text-[9px] px-[5px] py-[1px] opacity-80" : "text-[10px]"}`}
    >
      {label}
    </Badge>
  )
}
