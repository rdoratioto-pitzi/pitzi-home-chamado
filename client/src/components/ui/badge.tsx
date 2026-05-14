import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent shadow-xs",
        outline: "border shadow-xs",
        success: "border-transparent",
        warning: "border-transparent",
        info: "border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const semanticStyles: Record<string, React.CSSProperties> = {
  success: { background: "rgba(59,66,222,0.10)", color: "#3B42DE" },
  warning: { background: "rgba(192,122,0,0.10)", color: "#C07A00" },
  destructive: { background: "rgba(197,48,48,0.10)", color: "#C53030" },
  info: { background: "rgba(60,120,216,0.10)", color: "#3C78D8" },
}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  const variantKey = variant as string
  const mergedStyle = semanticStyles[variantKey]
    ? { ...semanticStyles[variantKey], ...style }
    : style

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={mergedStyle}
      {...props}
    />
  );
}

export { Badge, badgeVariants }
