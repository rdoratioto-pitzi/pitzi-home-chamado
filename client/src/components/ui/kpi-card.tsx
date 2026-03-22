import * as React from "react"
import { cn } from "@/lib/utils"

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number
  label: string
  highlight?: boolean
  icon?: React.ReactNode
  trend?: "up" | "down" | "neutral"
  trendValue?: string
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  ({ value, label, highlight = false, icon, trend, trendValue, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-kpi-card=""
        data-highlight={highlight ? "true" : undefined}
        className={cn(
          "rounded-xl p-5 min-w-[200px]",
          highlight
            ? "text-white"
            : "border",
          className
        )}
        style={
          highlight
            ? { background: "var(--vf)" }
            : { background: "var(--bg2)", borderColor: "var(--sep)" }
        }
        {...props}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: highlight ? "rgba(255,255,255,0.85)" : "var(--l3)" }}
          >
            {label}
          </span>
          {icon && (
            <span
              className="h-5 w-5 opacity-60"
              style={{ color: highlight ? "#FFFFFF" : "var(--l2)" }}
            >
              {icon}
            </span>
          )}
        </div>
        <div
          className="text-[28px] font-bold leading-none"
          style={{ color: highlight ? "#FFFFFF" : "var(--l1)" }}
        >
          {value}
        </div>
        {trend && trendValue && (
          <div className="flex items-center gap-1 mt-2">
            <span
              className="text-[11px] font-medium"
              style={{
                color:
                  trend === "up"
                    ? "var(--vb)"
                    : trend === "down"
                      ? "#C53030"
                      : "var(--l2)",
              }}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </span>
          </div>
        )}
      </div>
    )
  }
)
KpiCard.displayName = "KpiCard"

export { KpiCard }
